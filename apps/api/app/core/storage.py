"""
Production Storage Manager for Project Horizon.

Provides direct-to-object-storage presigned upload URL generation (S3, MinIO,
Supabase Storage, Cloudflare R2) and tamper-proof local persistent storage drivers
with path traversal protection.
"""

import os
import re
import hmac
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, Optional
from urllib.parse import urlencode, quote

from app.core.config import settings


def sanitize_filename(filename: str) -> str:
    """Sanitize user-provided filename, removing path separators and dangerous characters."""
    clean = os.path.basename(filename)
    clean = re.sub(r"[^a-zA-Z0-9_.-]", "_", clean)
    if not clean:
        clean = f"upload_{uuid.uuid4().hex[:8]}.jpg"
    return clean


def generate_storage_key(submission_id: str, filename: str) -> str:
    """Generate a unique, structured storage key for a submission artifact."""
    clean_name = sanitize_filename(filename)
    unique_prefix = uuid.uuid4().hex[:12]
    return f"submissions/{submission_id}/{unique_prefix}_{clean_name}"


def generate_local_hmac_token(storage_key: str, expires_at: int) -> str:
    """Generate HMAC-SHA256 signature for local persistent upload requests."""
    message = f"{storage_key}:{expires_at}".encode("utf-8")
    secret = settings.SECRET_KEY.encode("utf-8")
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def verify_local_hmac_token(storage_key: str, expires_at: int, token: str) -> bool:
    """Verify HMAC-SHA256 signature for local upload requests and check expiration."""
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    if now_epoch > expires_at:
        return False
    expected_token = generate_local_hmac_token(storage_key, expires_at)
    return hmac.compare_digest(expected_token, token)


def generate_s3_presigned_put_url(
    storage_key: str,
    content_type: str = "image/jpeg",
    expires_in: int = 3600,
) -> str:
    """
    Generate an AWS SigV4 Presigned PUT URL in pure Python without external SDK dependencies.
    Compatible with AWS S3, MinIO, Supabase S3 storage, and Cloudflare R2.
    """
    endpoint = settings.S3_ENDPOINT.rstrip("/")
    bucket = settings.S3_BUCKET
    region = settings.S3_REGION
    access_key = settings.S3_ACCESS_KEY
    secret_key = settings.S3_SECRET_KEY

    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    # Host and Path determination
    # Path-style: endpoint/bucket/key
    endpoint_netloc = endpoint.split("://")[-1].split("/")[0]
    canonical_uri = f"/{bucket}/{storage_key.lstrip('/')}"
    host = endpoint_netloc

    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    signed_headers = "content-type;host"

    query_params = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": f"{access_key}/{credential_scope}",
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires_in),
        "X-Amz-SignedHeaders": signed_headers,
    }

    # Sort query parameters for canonical request
    sorted_query_keys = sorted(query_params.keys())
    canonical_query_string = "&".join(
        f"{quote(k, safe='')}={quote(query_params[k], safe='')}"
        for k in sorted_query_keys
    )

    # Canonical headers (must be lowercase and trimmed)
    canonical_headers = f"content-type:{content_type.strip()}\nhost:{host}\n"

    # Canonical request
    # Method\nCanonicalURI\nCanonicalQueryString\nCanonicalHeaders\nSignedHeaders\nHashedPayload
    # For presigned PUT, payload hash is 'UNSIGNED-PAYLOAD'
    payload_hash = "UNSIGNED-PAYLOAD"
    canonical_request = (
        f"PUT\n{canonical_uri}\n{canonical_query_string}\n{canonical_headers}\n"
        f"{signed_headers}\n{payload_hash}"
    )

    # String to sign
    algorithm = "AWS4-HMAC-SHA256"
    string_to_sign = (
        f"{algorithm}\n{amz_date}\n{credential_scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    # Signing key derivation
    def sign(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    k_date = sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = sign(k_date, region)
    k_service = sign(k_region, "s3")
    k_signing = sign(k_service, "aws4_request")

    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    return f"{endpoint}{canonical_uri}?{canonical_query_string}&X-Amz-Signature={signature}"


def generate_presigned_upload(
    submission_id: str,
    filename: str,
    content_type: str = "image/jpeg",
    expires_in: int = 3600,
    base_api_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate an upload target for field evidence media.
    Uses S3 SigV4 presigned PUT if S3 credentials are configured;
    otherwise generates a HMAC-authenticated persistent direct upload URL.
    """
    storage_key = generate_storage_key(submission_id, filename)
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    expires_at = now_epoch + expires_in

    # Check if S3 / MinIO backend is active
    use_s3 = bool(
        settings.S3_ACCESS_KEY
        and settings.S3_SECRET_KEY
        and settings.S3_ACCESS_KEY != "minioadmin"  # Non-default or explicitly requested
    ) or os.getenv("HORIZON_USE_S3", "false").lower() in ("true", "1")

    if use_s3:
        upload_url = generate_s3_presigned_put_url(
            storage_key=storage_key,
            content_type=content_type,
            expires_in=expires_in,
        )
        backend = "s3"
        required_headers = {"Content-Type": content_type}
    else:
        # In strict production/staging mode, ephemeral local filesystem is strictly forbidden
        if settings.is_production and os.getenv("ALLOW_EPHEMERAL_STORAGE_FOR_TESTS", "").lower() not in ("true", "1"):
            raise RuntimeError(
                "Production/staging media storage configuration failure: object storage (S3/MinIO/Supabase/R2) "
                "credentials are required. Ephemeral local container storage is strictly forbidden in production."
            )
        # Local persistent driver with HMAC signature
        token = generate_local_hmac_token(storage_key, expires_at)
        api_prefix = settings.API_V1_STR
        upload_url = (
            f"{api_prefix}/submissions/{submission_id}/media-upload-direct"
            f"?storage_key={quote(storage_key, safe='')}&expires_at={expires_at}&token={token}"
        )
        backend = "local_persistent"
        required_headers = {"Content-Type": content_type}

    return {
        "storage_key": storage_key,
        "upload_url": upload_url,
        "method": "PUT",
        "backend": backend,
        "content_type": content_type,
        "expires_in_seconds": expires_in,
        "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
        "required_headers": required_headers,
    }


def get_safe_local_path(storage_key: str) -> Path:
    """
    Resolve storage_key to an absolute Path inside STORAGE_PERSISTENT_DIR,
    strictly verifying no directory traversal attack (path traversal guard).
    """
    base_dir = Path(settings.STORAGE_PERSISTENT_DIR).resolve()
    base_dir.mkdir(parents=True, exist_ok=True)

    # Normalize and resolve target path
    normalized = os.path.normpath(storage_key).lstrip("/\\")
    target_path = (base_dir / normalized).resolve()

    if not str(target_path).startswith(str(base_dir)):
        raise ValueError(f"Path traversal detected for storage key: {storage_key}")

    return target_path


def save_media_file(storage_key: str, data: bytes) -> Path:
    """Save raw media bytes securely to persistent local storage."""
    target_path = get_safe_local_path(storage_key)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with open(target_path, "wb") as f:
        f.write(data)
    return target_path
