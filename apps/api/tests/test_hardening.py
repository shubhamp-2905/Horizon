from datetime import datetime, timezone
import pytest
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.storage import (
    generate_presigned_upload,
    generate_local_hmac_token,
    verify_local_hmac_token,
    get_safe_local_path,
)
from app.modules.tokens.service import audit_token_ledger_integrity
from app.modules.validation.ai_service import AIValidationService
from app.database.models.token import TokenAccount, TokenTransaction
from app.database.models.submission import Submission
from app.database.models.task import Task
from app.database.models.user import User


def test_security_headers_and_correlation_id(client: TestClient):
    """Verify security headers, correlation IDs, and response time metrics on responses."""
    resp = client.get("/health")
    assert resp.status_code == 200
    headers = resp.headers

    assert "x-correlation-id" in headers
    assert "x-response-time" in headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"

    # Custom correlation ID propagation
    custom_id = "test-corr-id-12345"
    resp_custom = client.get("/health", headers={"X-Correlation-ID": custom_id})
    assert resp_custom.headers.get("x-correlation-id") == custom_id


def test_health_and_readiness_probes(client: TestClient):
    """Verify liveness and readiness probe semantics for container orchestrators."""
    # Liveness probe
    liveness_resp = client.get("/healthz")
    assert liveness_resp.status_code == 200
    data = liveness_resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "horizon-api"

    # Readiness probe
    readiness_resp = client.get("/readyz")
    assert readiness_resp.status_code in (200, 503)
    rdata = readiness_resp.json()
    assert "subsystems" in rdata
    assert "database" in rdata["subsystems"]
    assert "status" in rdata


def test_admin_ledger_audit_security(client: TestClient, contributor_token: str, admin_token: str):
    """Verify RBAC protection and mathematical integrity on the token ledger audit endpoint."""
    # 1. Unauthenticated -> 401
    resp_unauth = client.get("/api/v1/admin/tokens/audit")
    assert resp_unauth.status_code == 401

    # 2. Contributor role -> 403 Forbidden
    resp_contrib = client.get(
        "/api/v1/admin/tokens/audit",
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert resp_contrib.status_code == 403

    # 3. Admin role -> 200 OK with valid mathematical audit report
    resp_admin = client.get(
        "/api/v1/admin/tokens/audit",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200
    data = resp_admin.json()
    assert data["status"] == "HEALTHY"
    assert data["is_healthy"] is True
    assert data["total_accounts_audited"] >= 2  # Admin + Contributor fixtures
    assert data["total_circulating_available"] >= 200
    assert data["anomaly_count"] == 0


def test_ledger_anomaly_detection(db_session):
    """Verify audit_token_ledger_integrity correctly detects corrupted balances or orphan entries."""
    # Baseline audit should be healthy
    baseline = audit_token_ledger_integrity(db_session)
    assert baseline["is_healthy"] is True

    # Inject a simulated corruption: account with negative balance
    corrupt_acc = TokenAccount(
        user_id=uuid.uuid4(),
        available_balance=-50,
        locked_balance=0,
    )
    db_session.add(corrupt_acc)
    db_session.flush()

    audit_result = audit_token_ledger_integrity(db_session)
    assert audit_result["is_healthy"] is False
    assert audit_result["status"] == "ANOMALIES_DETECTED"
    assert any(a["type"] == "NEGATIVE_AVAILABLE_BALANCE" for a in audit_result["anomalies"])

    # Roll back dirty injection
    db_session.rollback()


def test_presigned_upload_url_flow_and_security(client: TestClient, contributor_token: str, admin_token: str, db_session):
    """Verify presigned upload generation, ownership validation, and HMAC direct upload."""
    # Create task & submission
    task = Task(
        title="Hardening Test Task",
        description="Verify media persistence",
        artifact_type="water_source",
        status="published",
        base_reward=50,
        commitment_stake=10,
    )
    db_session.add(task)
    db_session.flush()

    # Contributor claims the task first (staking commitment)
    claim_resp = client.post(
        f"/api/v1/tasks/{task.id}/claim",
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert claim_resp.status_code in (200, 201)

    # Create submission draft via API
    draft_resp = client.post(
        f"/api/v1/tasks/{task.id}/submissions",
        json={"latitude": 18.52, "longitude": 73.85, "form_data": {"note": "test"}},
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert draft_resp.status_code == 201
    sub_id = draft_resp.json()["id"]

    # 1. Contributor requests upload URL
    upload_req = client.post(
        f"/api/v1/submissions/{sub_id}/upload-url",
        json={"filename": "canopy_test.jpg", "content_type": "image/jpeg"},
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert upload_req.status_code == 200
    u_data = upload_req.json()
    assert "storage_key" in u_data
    assert "upload_url" in u_data
    assert u_data["method"] == "PUT"

    # 2. Upload media bytes directly using HMAC token
    # Extract query params from generated upload_url
    url_parts = u_data["upload_url"].split("?")
    assert len(url_parts) == 2
    query_string = url_parts[1]

    # Test direct upload with valid HMAC
    upload_resp = client.put(
        f"{url_parts[0]}?{query_string}",
        content=b"test_image_binary_content_bytes_12345",
        headers={"Content-Type": "image/jpeg"},
    )
    assert upload_resp.status_code == 200
    assert upload_resp.json()["status"] == "uploaded"

    # 3. Security test: Forged / Tampered token -> 403 Forbidden
    bad_upload_resp = client.put(
        f"{url_parts[0]}?storage_key=forged_key&expires_at=9999999999&token=invalid_hmac",
        content=b"malicious_bytes",
    )
    assert bad_upload_resp.status_code == 403

    # 4. Security test: Path traversal detection
    with pytest.raises(ValueError, match="Path traversal detected"):
        get_safe_local_path("../../etc/passwd")


def test_production_database_fallback_prevention():
    """Verify that in production mode, PostgreSQL failure raises RuntimeError instead of falling back to SQLite."""
    with patch.object(settings, "ENVIRONMENT", "production"):
        assert settings.is_production is True
        from app.database.session import create_db_engine
        with patch("app.database.session.create_engine") as mock_engine:
            mock_engine.side_effect = Exception("Connection refused to production Postgres cluster")
            with pytest.raises(RuntimeError, match="Production database connection failure"):
                create_db_engine()


def test_production_sqlite_direct_rejection():
    """Verify that in production mode, direct SQLite DATABASE_URL raises RuntimeError."""
    with patch.object(settings, "ENVIRONMENT", "production"), patch.object(settings, "DATABASE_URL", "sqlite:///./prod_trap.db"):
        assert settings.is_production is True
        from app.database.session import create_db_engine
        with pytest.raises(RuntimeError, match="SQLite database is strictly forbidden in production/staging mode"):
            create_db_engine()


def test_production_ephemeral_storage_fallback_prevention():
    """Verify that in production mode, absence of object storage credentials raises RuntimeError."""
    with patch.object(settings, "ENVIRONMENT", "production"), patch.object(settings, "S3_ACCESS_KEY", "minioadmin"), patch.dict("os.environ", {"HORIZON_USE_S3": "false", "ALLOW_EPHEMERAL_STORAGE_FOR_TESTS": "false"}):
        assert settings.is_production is True
        with pytest.raises(RuntimeError, match="Production/staging media storage configuration failure"):
            generate_presigned_upload(submission_id="sub_test", filename="photo.jpg")


def test_ai_service_resilience_and_safe_fallback(db_session):
    """Verify AI microservice failures trigger fail-safe fallback without crashing submission workflows."""
    # Create dummy submission
    sub = Submission(
        user_id=uuid.uuid4(),
        task_id=uuid.uuid4(),
        captured_at=datetime.now(timezone.utc),
        status="submitted",
        form_data={"observation": "valid"},
    )
    db_session.add(sub)
    db_session.flush()

    # Trigger simulated failure
    AIValidationService.SIMULATE_FAILURE = True
    try:
        result = AIValidationService.evaluate_submission_media(db_session, sub)
        assert result["status"] == "WARNING"
        assert result["overall_status"] == "WARNING"
        assert result.get("service_unavailable") is True
        assert len(result["reasons"]) > 0
    finally:
        AIValidationService.SIMULATE_FAILURE = False


def test_push_token_registration(client: TestClient, contributor_token: str):
    """Verify contributor can register push token for critical alerts."""
    resp = client.post(
        "/api/v1/auth/push-token",
        json={"push_token": "ExponentPushToken[hardening_test_token_123]", "device_type": "android"},
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
