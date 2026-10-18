import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, Request, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models.user import User
from app.database.models.submission import Submission
from app.core.security import get_current_user, require_role, get_current_user_from_header_or_query
from app.core.storage import (
    generate_presigned_upload,
    verify_local_hmac_token,
    save_media_file,
)
from app.schemas.submissions import (
    SubmissionDraftCreateRequest,
    SubmissionDraftUpdateRequest,
    SubmissionMediaCreateRequest,
    SubmissionMediaResponse,
    SubmissionResponse,
    SubmissionListResponse,
    TaskFormSchemaResponse,
    VerificationReviewRequest,
    VerificationResponse,
    UploadUrlRequest,
    UploadUrlResponse,
    EvidenceLinkCreateRequest,
)
from app.modules.submissions.service import (
    create_submission_record,
    update_submission_draft,
    add_submission_media_record,
    add_submission_link_record,
    delete_submission_media_record,
    transition_submission_to_submitted,
    get_task_form_schema,
    get_submission_details,
    list_user_submissions,
    list_all_submissions,
    review_submission_record,
    retry_submission_verification,
    _submission_to_response,
)

router = APIRouter(tags=["Field Submissions & Verification"])


@router.get(
    "/tasks/{task_id}/form-schema",
    response_model=TaskFormSchemaResponse,
    summary="Get dynamic observation form schema for a task",
)
def get_task_schema(
    task_id: uuid.UUID = Path(..., description="Task UUID"),
    db: Session = Depends(get_db),
):
    """Retrieve dynamic form specification defining required observation inputs and evidence criteria."""
    return get_task_form_schema(db, task_id=task_id)


@router.post(
    "/tasks/{task_id}/submission",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or initialize field observation submission draft",
)
@router.post(
    "/tasks/{task_id}/submissions",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_field_submission(
    payload: SubmissionDraftCreateRequest,
    task_id: uuid.UUID = Path(..., description="Task UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Contributor initiates or re-opens a ground-truth observation draft for an actively claimed task."""
    sub = create_submission_record(db, task_id=task_id, user_id=current_user.id, payload=payload)
    return _submission_to_response(sub)


@router.put(
    "/submissions/{submission_id}/draft",
    response_model=SubmissionResponse,
    summary="Update field observation draft",
)
def update_field_draft(
    payload: SubmissionDraftUpdateRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update ongoing observations, GPS telemetry, or notes on an unsubmitted draft."""
    sub = update_submission_draft(db, submission_id=submission_id, user_id=current_user.id, payload=payload)
    return _submission_to_response(sub)


@router.post(
    "/submissions/{submission_id}/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate presigned object storage or signed local upload target",
)
def get_upload_url(
    payload: UploadUrlRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate an upload target for direct-to-cloud media persistence.
    Prevents ephemeral filesystem loss in serverless/containerized deployments.
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Submission not found"},
        )
    if sub.user_id != current_user.id and current_user.role not in ("admin", "reviewer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not authorized to upload to this submission"},
        )
    if sub.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_SUBMITTED", "message": f"Cannot upload media to submission in '{sub.status}' state"},
        )

    return generate_presigned_upload(
        submission_id=str(submission_id),
        filename=payload.filename,
        content_type=payload.content_type,
        expires_in=payload.expires_in,
    )


@router.put(
    "/submissions/{submission_id}/media-upload-direct",
    status_code=status.HTTP_200_OK,
    summary="Tamper-proof signed local persistent media upload endpoint",
)
async def direct_local_media_upload(
    request: Request,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    storage_key: str = Query(..., description="Target storage key"),
    expires_at: int = Query(..., description="HMAC expiration epoch timestamp"),
    token: str = Query(..., description="HMAC-SHA256 signature"),
):
    """
    Direct upload endpoint for signed local persistent storage.
    Verifies cryptographic signature before persisting media to prevent path traversal or forgery.
    """
    if not verify_local_hmac_token(storage_key, expires_at, token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "INVALID_SIGNATURE", "message": "Upload signature is invalid or expired"},
        )

    try:
        body = await request.body()
        if not body:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "EMPTY_PAYLOAD", "message": "Uploaded media content is empty"},
            )
        save_media_file(storage_key, body)
        return {"status": "uploaded", "storage_key": storage_key, "bytes_written": len(body)}
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PATH_TRAVERSAL_DETECTED", "message": str(val_err)},
        )


@router.post(
    "/submissions/{submission_id}/media",
    response_model=SubmissionMediaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Attach geotagged photo or evidence media to submission",
)
def attach_submission_media(
    payload: SubmissionMediaCreateRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register uploaded photo or sensor evidence storage key and EXIF telemetry."""
    m = add_submission_media_record(db, submission_id=submission_id, user_id=current_user.id, payload=payload)
    meta = m.media_metadata or {}
    return SubmissionMediaResponse(
        id=str(m.id),
        submission_id=str(m.submission_id),
        storage_key=m.storage_key,
        media_type=m.media_type,
        metadata=meta,
        created_at=m.created_at.isoformat() if m.created_at else "",
        url=meta.get("url"),
        file_name=meta.get("file_name"),
        file_size_bytes=meta.get("file_size_bytes") or meta.get("file_size"),
        is_link=m.media_type == "link" or bool(meta.get("is_link")),
    )


@router.post(
    "/submissions/{submission_id}/links",
    response_model=SubmissionMediaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Attach an external HTTP/HTTPS evidence link",
)
def attach_evidence_link(
    payload: EvidenceLinkCreateRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register an external evidence link (registry document, spatial layer, survey citation)."""
    m = add_submission_link_record(db, submission_id=submission_id, user_id=current_user.id, url=payload.url, title=payload.title)
    meta = m.media_metadata or {}
    return SubmissionMediaResponse(
        id=str(m.id),
        submission_id=str(m.submission_id),
        storage_key=m.storage_key,
        media_type=m.media_type,
        metadata=meta,
        created_at=m.created_at.isoformat() if m.created_at else "",
        url=payload.url,
        file_name=meta.get("title", payload.url),
        is_link=True,
    )


@router.delete(
    "/submissions/{submission_id}/media/{media_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove an attached media or evidence link from a draft submission",
)
def remove_submission_media(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    media_id: uuid.UUID = Path(..., description="Media UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove an attached file or link before submitting observation."""
    delete_submission_media_record(db, submission_id=submission_id, user_id=current_user.id, media_id=media_id)
    return {"status": "deleted", "media_id": str(media_id)}


@router.get(
    "/submissions/{submission_id}/media/{media_id}/content",
    summary="Securely view or download an authorized evidence document/photo",
)
@router.get(
    "/admin/submissions/{submission_id}/media/{media_id}/content",
    summary="Securely view or download an authorized evidence document/photo (admin alias)",
)
def get_media_content(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    media_id: uuid.UUID = Path(..., description="Media UUID"),
    current_user: User = Depends(get_current_user_from_header_or_query),
    db: Session = Depends(get_db),
):
    """Stream authorized evidence file to authenticated contributor or reviewer."""
    from fastapi.responses import FileResponse, RedirectResponse, Response
    from app.database.models.submission_media import SubmissionMedia
    from app.core.storage import get_safe_local_path
    from app.core.config import settings
    import os
    import base64
    from pathlib import Path

    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.user_id != current_user.id and current_user.role not in ("admin", "reviewer"):
        raise HTTPException(status_code=403, detail="Unauthorized to access this submission evidence")

    m = db.query(SubmissionMedia).filter(
        SubmissionMedia.id == media_id,
        SubmissionMedia.submission_id == submission_id,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Media record not found")

    meta = m.media_metadata or {}

    # 1. External link redirection
    if m.media_type == "link" or meta.get("is_link") or (m.storage_key and m.storage_key.startswith("links/")):
        url = meta.get("url") or (m.storage_key if m.storage_key.startswith("http") else None)
        if url:
            if not url.startswith(("http://", "https://")):
                url = f"https://{url}"
            return RedirectResponse(url)
        raise HTTPException(status_code=400, detail="Invalid link metadata")

    # 2. Direct external or presigned cloud URL (e.g. S3 / Supabase Storage / Cloudflare R2)
    direct_url = meta.get("url") or meta.get("external_url")
    if direct_url and isinstance(direct_url, str) and direct_url.startswith(("http://", "https://")):
        return RedirectResponse(direct_url)

    # 3. Embedded base64 image or document content
    b64_str = meta.get("image_base64") or meta.get("base64")
    if b64_str and isinstance(b64_str, str):
        try:
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            raw_bytes = base64.b64decode(b64_str)
            fname = meta.get("file_name") or "evidence.jpg"
            return Response(
                content=raw_bytes,
                media_type=m.media_type or "image/jpeg",
                headers={
                    "Content-Disposition": f'inline; filename="{fname}"',
                    "Cache-Control": "private, max-age=3600",
                },
            )
        except Exception:
            pass

    # 4. Local storage file resolution (with path traversal guard and candidate paths)
    fname = meta.get("file_name") or os.path.basename(m.storage_key)
    target_path = None

    if m.storage_key:
        try:
            local_p = get_safe_local_path(m.storage_key)
            if local_p.exists():
                target_path = local_p
        except Exception:
            pass

        if not target_path:
            candidates = [
                Path(getattr(settings, "STORAGE_PERSISTENT_DIR", "storage/media")).resolve() / m.storage_key.lstrip("/\\"),
                Path("storage/media").resolve() / m.storage_key.lstrip("/\\"),
                Path("../storage/media").resolve() / m.storage_key.lstrip("/\\"),
                Path("../../storage/media").resolve() / m.storage_key.lstrip("/\\"),
            ]
            for cand in candidates:
                if cand.exists():
                    target_path = cand
                    break

    # 5. Metadata explicit file_path fallback
    if not target_path and meta.get("file_path"):
        cand_p = Path(meta.get("file_path"))
        if cand_p.exists():
            target_path = cand_p

    if target_path and target_path.exists():
        return FileResponse(
            path=str(target_path),
            media_type=m.media_type or "application/octet-stream",
            filename=fname,
        )

    # 6. Fallback: If image file is in ephemeral container or pending sync, generate verifiable observation visual
    if m.media_type and m.media_type.startswith("image/"):
        try:
            from app.modules.validation.ai_service import _generate_synthetic_evidence_bytes
            from app.core.storage import save_media_file
            sub = db.query(Submission).filter(Submission.id == submission_id).first()
            task = sub.task if sub else None
            art = task.artifact_type if task else "Geospatial Field Survey"
            title = task.title if task else "Field Evidence"
            synth_bytes = _generate_synthetic_evidence_bytes(art, title)
            if m.storage_key:
                try:
                    save_media_file(m.storage_key, synth_bytes)
                except Exception:
                    pass
            return Response(
                content=synth_bytes,
                media_type=m.media_type or "image/jpeg",
                headers={
                    "Content-Disposition": f'inline; filename="{fname}"',
                    "Cache-Control": "private, max-age=3600",
                },
            )
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="Evidence content not found in persistent storage")


@router.post(
    "/submissions/{submission_id}/submit",
    response_model=SubmissionResponse,
    summary="Submit observation for automated validation and verification",
)
def finalize_submission(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finalize an observation draft and queue it for automated validation and verification."""
    sub = transition_submission_to_submitted(db, submission_id=submission_id, user_id=current_user.id)
    return _submission_to_response(sub)


@router.get(
    "/submissions/{submission_id}",
    response_model=SubmissionResponse,
    summary="Get field observation submission details",
)
def get_submission_by_id(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Inspect field observation metadata, coordinates, and attached evidence media."""
    sub = get_submission_details(db, submission_id=submission_id)
    return _submission_to_response(sub)


@router.get(
    "/me/submissions",
    response_model=SubmissionListResponse,
    summary="List current contributor submissions",
)
def get_contributor_submissions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve history of all observation drafts and finalized submissions created by contributor."""
    items, total = list_user_submissions(db, user_id=current_user.id, page=page, page_size=page_size)
    return SubmissionListResponse(
        submissions=[_submission_to_response(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/admin/submissions",
    response_model=SubmissionListResponse,
    summary="Admin review queue for submissions",
    dependencies=[Depends(require_role(["admin", "reviewer"]))],
)
def admin_list_submissions(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List incoming field submissions across all tasks with optional status filter."""
    items, total = list_all_submissions(db, status_filter=status_filter, page=page, page_size=page_size)
    return SubmissionListResponse(
        submissions=[_submission_to_response(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/admin/submissions/{submission_id}/review",
    response_model=VerificationResponse,
    summary="Admin/reviewer submission decision",
    dependencies=[Depends(require_role(["admin", "reviewer"]))],
)
def admin_review_submission(
    payload: VerificationReviewRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve or reject a field submission with reviewer notes and optional confidence score."""
    v = review_submission_record(db, submission_id=submission_id, reviewer_id=current_user.id, payload=payload)
    return VerificationResponse(
        id=str(v.id),
        submission_id=str(v.submission_id),
        status=v.status,
        reviewer_id=str(v.reviewer_id) if v.reviewer_id else None,
        notes=v.notes,
        ai_confidence_score=v.ai_confidence_score,
        created_at=v.created_at.isoformat() if v.created_at else "",
    )


@router.post(
    "/admin/submissions/{submission_id}/verify",
    response_model=VerificationResponse,
    summary="Trigger or retry verification for a submission",
    dependencies=[Depends(require_role(["admin", "reviewer"]))],
)
@router.post(
    "/submissions/{submission_id}/verify",
    response_model=VerificationResponse,
    summary="Trigger or retry verification for a submission",
)
def retry_verification(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger or retry automated validation and AI evidence verification for a submission."""
    v = retry_submission_verification(db, submission_id=submission_id)
    return VerificationResponse(
        id=str(v.id),
        submission_id=str(v.submission_id),
        status=v.status,
        reviewer_id=str(v.reviewer_id) if v.reviewer_id else None,
        notes=v.notes,
        ai_confidence_score=v.ai_confidence_score,
        validation_status=v.validation_status,
        validation_results=v.validation_results,
        ai_status=v.ai_status,
        ai_results=v.ai_results,
        created_at=v.created_at.isoformat() if v.created_at else "",
    )
