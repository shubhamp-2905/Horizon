import logging
import uuid
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc, func
from geoalchemy2.shape import to_shape, from_shape
from shapely.geometry import Point
import os
from app.database.models.submission import Submission
from app.database.models.submission_media import SubmissionMedia
from app.database.models.verification import Verification
from app.database.models.task import Task
from app.database.models.task_claim import TaskClaim
from app.database.models.task_schema import TaskFormSchema
from app.schemas.submissions import (
    SubmissionDraftCreateRequest,
    SubmissionDraftUpdateRequest,
    SubmissionMediaCreateRequest,
    SubmissionMediaResponse,
    SubmissionResponse,
    TaskFormFieldDefinition,
    TaskFormSchemaResponse,
    VerificationReviewRequest,
    VerificationResponse,
)
from app.modules.tasks.spreadsheet_schema import compile_task_form_schema


def _extract_coordinates(location_point) -> Tuple[Optional[float], Optional[float]]:
    if location_point is None:
        return None, None
    try:
        shape = to_shape(location_point)
        if isinstance(shape, Point):
            return shape.y, shape.x
    except Exception:
        pass
    return None, None


def _submission_to_response(sub: Submission) -> SubmissionResponse:
    lat, lng = _extract_coordinates(sub.location)
    media_list = []
    if sub.media:
        for m in sub.media:
            meta = m.media_metadata or {}
            is_link = (m.media_type == "link") or bool(meta.get("is_link")) or bool(m.storage_key and m.storage_key.startswith("links/"))
            link_url = meta.get("url") or meta.get("external_url") or (m.storage_key if (m.storage_key and m.storage_key.startswith("http")) else None)
            fname = meta.get("file_name") or meta.get("filename") or (os.path.basename(m.storage_key) if not is_link else meta.get("title", link_url or "Evidence Link"))
            fsize = meta.get("file_size_bytes") or meta.get("file_size")
            # Exclude massive raw base64 data from metadata to avoid multi-megabyte payloads
            clean_meta = {k: v for k, v in meta.items() if k not in ("image_base64", "base64")}
            media_list.append(
                SubmissionMediaResponse(
                    id=str(m.id),
                    submission_id=str(m.submission_id),
                    storage_key=m.storage_key,
                    media_type=m.media_type,
                    metadata=clean_meta,
                    created_at=m.created_at.isoformat() if m.created_at else "",
                    url=link_url,
                    file_name=fname,
                    file_size_bytes=fsize,
                    is_link=is_link,
                )
            )

    return SubmissionResponse(
        id=str(sub.id),
        task_id=str(sub.task_id),
        task_title=sub.task.title if sub.task else None,
        artifact_type=sub.task.artifact_type if sub.task else None,
        user_id=str(sub.user_id),
        contributor_email=sub.user.email if sub.user else None,
        status=sub.status,
        gps_accuracy=sub.gps_accuracy,
        latitude=lat,
        longitude=lng,
        captured_at=sub.captured_at.isoformat() if sub.captured_at else "",
        submitted_at=sub.submitted_at.isoformat() if sub.submitted_at else None,
        form_data=sub.form_data or {},
        media=media_list,
        verification_status=sub.verification.status if sub.verification else None,
        verification_notes=sub.verification.notes if sub.verification else None,
        ai_confidence_score=sub.verification.ai_confidence_score if sub.verification else None,
        created_at=sub.captured_at.isoformat() if sub.captured_at else None,
        validation_status=sub.verification.validation_status if sub.verification else None,
        validation_results=sub.verification.validation_results if sub.verification else None,
        ai_status=sub.verification.ai_status if sub.verification else None,
        ai_results=sub.verification.ai_results if sub.verification else None,
    )


def create_submission_record(
    db: Session,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SubmissionDraftCreateRequest,
) -> Submission:
    """Create or reuse an observation draft for an actively claimed task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": f"Task {task_id} not found"},
        )

    # Check if this task already has a submitted observation (idempotent retry)
    existing_submitted = (
        db.query(Submission)
        .filter(
            Submission.task_id == task_id,
            Submission.user_id == user_id,
            Submission.status.in_(["submitted", "validating", "under_review", "approved", "verified"]),
        )
        .first()
    )
    if existing_submitted:
        return existing_submitted

    # Contributor must have an active claim on this task
    claim = (
        db.query(TaskClaim)
        .filter(
            TaskClaim.task_id == task_id,
            TaskClaim.user_id == user_id,
            TaskClaim.status.in_(["claimed", "in_progress"]),
        )
        .first()
    )
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "NO_ACTIVE_CLAIM",
                "message": "You must have an active commitment on this task to submit field observations",
            },
        )

    # Transition claim status to in_progress
    if claim.status == "claimed":
        claim.status = "in_progress"

    # Reuse existing draft if present for idempotency
    existing_draft = (
        db.query(Submission)

        .filter(
            Submission.task_id == task_id,
            Submission.user_id == user_id,
            Submission.status == "draft",
        )
        .first()
    )

    location_geom = None
    if payload.latitude is not None and payload.longitude is not None:
        location_geom = from_shape(Point(payload.longitude, payload.latitude), srid=4326)

    captured_at = payload.captured_at or datetime.now(timezone.utc)

    if existing_draft:
        if location_geom is not None:
            existing_draft.location = location_geom
        existing_draft.gps_accuracy = payload.gps_accuracy
        existing_draft.captured_at = captured_at
        if payload.form_data:
            updated_form = dict(existing_draft.form_data or {})
            updated_form.update(payload.form_data)
            existing_draft.form_data = updated_form
        db.commit()
        db.refresh(existing_draft)
        return existing_draft

    submission = Submission(
        task_id=task_id,
        user_id=user_id,
        location=location_geom,
        gps_accuracy=payload.gps_accuracy,
        captured_at=captured_at,
        status="draft",
        form_data=payload.form_data or {},
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def update_submission_draft(
    db: Session,
    submission_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SubmissionDraftUpdateRequest,
) -> Submission:
    """Update observation fields, GPS coordinates, or accuracy for an active draft."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )
    if submission.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not authorized to edit this draft"},
        )
    if submission.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "SUBMISSION_LOCKED",
                "message": f"Cannot edit submission in '{submission.status}' status",
            },
        )

    if payload.latitude is not None and payload.longitude is not None:
        submission.location = from_shape(Point(payload.longitude, payload.latitude), srid=4326)
    if payload.gps_accuracy is not None:
        submission.gps_accuracy = payload.gps_accuracy
    if payload.captured_at is not None:
        submission.captured_at = payload.captured_at
    if payload.form_data is not None:
        merged = dict(submission.form_data or {})
        merged.update(payload.form_data)
        submission.form_data = merged

    db.commit()
    db.refresh(submission)
    return submission


def add_submission_media_record(
    db: Session,
    submission_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SubmissionMediaCreateRequest,
) -> SubmissionMedia:
    """Attach geotagged photograph or sensor artifact metadata to a submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )
    if submission.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not authorized to edit this submission"},
        )

    # Idempotent deduplication: return existing media if same storage_key already attached
    existing_media = (
        db.query(SubmissionMedia)
        .filter(
            SubmissionMedia.submission_id == submission_id,
            SubmissionMedia.storage_key == payload.storage_key,
        )
        .first()
    )
    if existing_media:
        return existing_media

    media = SubmissionMedia(
        submission_id=submission_id,
        storage_key=payload.storage_key,
        media_type=payload.media_type,
        media_metadata=payload.metadata,
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


def add_submission_link_record(
    db: Session,
    submission_id: uuid.UUID,
    user_id: uuid.UUID,
    url: str,
    title: Optional[str] = None,
) -> SubmissionMedia:
    """Attach external HTTP/HTTPS evidence link to submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )
    if submission.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not authorized to edit this submission"},
        )
    if submission.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "SUBMISSION_LOCKED", "message": f"Cannot add link to submission in '{submission.status}' state"},
        )

    # Validate HTTP/HTTPS protocol
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_URL", "message": "URL must be a valid HTTP or HTTPS address."},
        )

    storage_key = f"links/{submission_id}/{uuid.uuid4().hex[:8]}"
    metadata = {
        "url": url,
        "title": title or parsed.netloc,
        "hostname": parsed.netloc,
        "is_link": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    media = SubmissionMedia(
        submission_id=submission_id,
        storage_key=storage_key,
        media_type="link",
        media_metadata=metadata,
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


def delete_submission_media_record(
    db: Session,
    submission_id: uuid.UUID,
    user_id: uuid.UUID,
    media_id: uuid.UUID,
) -> bool:
    """Delete an attached media or link item from a submission draft."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )
    if submission.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not authorized to edit this submission"},
        )
    if submission.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "SUBMISSION_LOCKED", "message": f"Cannot remove media from submission in '{submission.status}' state"},
        )

    media = db.query(SubmissionMedia).filter(
        SubmissionMedia.id == media_id,
        SubmissionMedia.submission_id == submission_id,
    ).first()
    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "MEDIA_NOT_FOUND", "message": "Media artifact not found"},
        )

    db.delete(media)
    db.commit()
    return True


def transition_submission_to_submitted(
    db: Session,
    submission_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Submission:
    """Transition a field draft to 'submitted' for automated validation and verification."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )
    if submission.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not authorized to submit this observation"},
        )
    # Idempotent completion check
    if submission.status in ["submitted", "validating", "under_review", "approved", "verified"]:
        return submission

    if submission.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ALREADY_SUBMITTED",
                "message": f"Submission is already in '{submission.status}' status",
            },
        )


    # Basic completeness validation: ensure form observations are present
    if not submission.form_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "MISSING_EVIDENCE", "message": "Submission observations cannot be empty"},
        )

    submission.status = "submitted"
    submission.submitted_at = datetime.now(timezone.utc)

    # Transition corresponding task claim to submitted
    claim = (
        db.query(TaskClaim)
        .filter(
            TaskClaim.task_id == submission.task_id,
            TaskClaim.user_id == submission.user_id,
            TaskClaim.status.in_(["claimed", "in_progress"]),
        )
        .first()
    )
    if claim:
        claim.status = "submitted"
        claim.completed_at = datetime.now(timezone.utc)

    db.commit()
    # 1. Trigger deterministic automated data validation before human/AI review
    from app.modules.validation.service import AutomatedValidationService
    val_result = AutomatedValidationService.validate_submission(db, submission)
    AutomatedValidationService.record_validation_result(db, submission, val_result)

    # 2. Trigger AI Image Quality validation
    from app.modules.validation.ai_service import AIValidationService
    ai_result = AIValidationService.evaluate_submission_media(db, submission)
    AIValidationService.record_ai_result(db, submission, ai_result)

    db.refresh(submission)
    return submission


def get_task_form_schema(db: Session, task_id: uuid.UUID) -> TaskFormSchemaResponse:
    """Get the dynamic schema definition for task observation forms, backed by Google Sheets."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": "Task not found"},
        )

    schema_record = db.query(TaskFormSchema).filter(TaskFormSchema.task_id == task_id).first()
    if schema_record and "fields" in schema_record.schema_definition:
        schema_def = schema_record.schema_definition
        raw_fields = schema_def.get("fields", [])
        fields = [
            TaskFormFieldDefinition(**{k: v for k, v in f.items() if k in TaskFormFieldDefinition.model_fields})
            for f in raw_fields
        ]
        sections = [
            s["title"] if isinstance(s, dict) else str(s)
            for s in schema_def.get("sections", [])
        ]
        return TaskFormSchemaResponse(
            task_id=str(task_id),
            version=schema_record.version,
            fields=fields,
            sections=sections,
            project_type=schema_def.get("project_type"),
            user_profile=schema_def.get("user_profile"),
            minimum_photos=schema_def.get("minimum_photos", 1),
            instructions=schema_def.get("instructions"),
        )

    # Compile authoritative spreadsheet-derived schema for this task's artifact / project type
    compiled = compile_task_form_schema(
        task_id=str(task_id),
        project_type=task.artifact_type,
        instructions=f"Complete ground observation for {task.title}. Evaluate Tenure & Governance, Environmental & Climatic, and Development Suitability.",
    )

    # Persist snapshot directly into task_form_schemas to guarantee historical schema preservation
    schema_record = TaskFormSchema(
        task_id=task_id,
        schema_definition=compiled,
        version=1,
    )
    db.add(schema_record)
    db.commit()
    db.refresh(schema_record)

    fields = [
        TaskFormFieldDefinition(**{k: v for k, v in f.items() if k in TaskFormFieldDefinition.model_fields})
        for f in compiled.get("fields", [])
    ]
    sections = [
        s["title"] if isinstance(s, dict) else str(s)
        for s in compiled.get("sections", [])
    ]
    return TaskFormSchemaResponse(
        task_id=str(task_id),
        version=schema_record.version,
        fields=fields,
        sections=sections,
        project_type=compiled.get("project_type"),
        user_profile=compiled.get("user_profile"),
        minimum_photos=compiled.get("minimum_photos", 1),
        instructions=compiled.get("instructions"),
    )


def get_submission_details(db: Session, submission_id: uuid.UUID) -> Submission:
    submission = (
        db.query(Submission)
        .options(
            joinedload(Submission.task),
            joinedload(Submission.user),
            joinedload(Submission.verification),
            selectinload(Submission.media),
        )
        .filter(Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )
    return submission


def list_user_submissions(
    db: Session,
    user_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[Submission], int]:
    total = (
        db.query(func.count(Submission.id))
        .filter(Submission.user_id == user_id)
        .scalar()
        or 0
    )
    items = (
        db.query(Submission)
        .options(
            joinedload(Submission.task),
            joinedload(Submission.user),
            joinedload(Submission.verification),
            selectinload(Submission.media),
        )
        .filter(Submission.user_id == user_id)
        .order_by(desc(Submission.captured_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def list_all_submissions(
    db: Session,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[Submission], int]:
    count_query = db.query(func.count(Submission.id))
    data_query = (
        db.query(Submission)
        .options(
            joinedload(Submission.task),
            joinedload(Submission.user),
            joinedload(Submission.verification),
            selectinload(Submission.media),
        )
    )
    if status_filter:
        count_query = count_query.filter(Submission.status == status_filter)
        data_query = data_query.filter(Submission.status == status_filter)

    total = count_query.scalar() or 0
    items = (
        data_query.order_by(desc(Submission.captured_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def review_submission_record(
    db: Session,
    submission_id: uuid.UUID,
    reviewer_id: uuid.UUID,
    payload: VerificationReviewRequest,
) -> Verification:
    """Authoritative administrative review and final decision for a contributor submission."""
    submission = (
        db.query(Submission)
        .filter(Submission.id == submission_id)
        .with_for_update()
        .first()
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )

    verification = db.query(Verification).filter(Verification.submission_id == submission_id).first()
    from app.database.models.user import User
    reviewer = db.query(User).filter(User.id == reviewer_id).first()
    admin_name = reviewer.username if reviewer else "admin"

    now_time = datetime.now(timezone.utc)
    decision = payload.status.lower().strip()

    if decision in ["approved", "verified"]:
        # Mandatory validation checks:
        if verification:
            validation_failed = (verification.validation_status == "FAILED")
            verification_unavailable = (
                verification.ai_status in ["UNAVAILABLE", "verification_unavailable"]
                or (verification.ai_results and verification.ai_results.get("service_unavailable"))
                or verification.status == "verification_unavailable"
            )

            if validation_failed or verification_unavailable:
                if not payload.admin_override:
                    if verification_unavailable:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail={
                                "code": "VERIFICATION_UNAVAILABLE",
                                "message": "Cannot approve submission: AI evidence verification is unavailable. Required checks must succeed before approval without an explicit administrator override.",
                            },
                        )
                    if validation_failed:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail={
                                "code": "DETERMINISTIC_VALIDATION_FAILED",
                                "message": "Cannot approve submission: Deterministic validation failed. Required checks must succeed before approval without an explicit administrator override.",
                            },
                        )
                else:
                    override_text = (payload.override_reason or payload.notes or "").strip()
                    if len(override_text) < 10:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail={
                                "code": "OVERRIDE_REASON_REQUIRED",
                                "message": "An explicit audited justification of at least 10 characters is required to override failed automated verification.",
                            },
                        )
                    payload.notes = f"[ADMIN OVERRIDE by @{admin_name}] {override_text}"

        decision_notes = payload.notes or "Approved by administrator."
        submission.status = "approved"

        if not verification:
            verification = Verification(
                submission_id=submission_id,
                reviewer_id=reviewer_id,
                status="approved",
                notes=decision_notes,
                ai_confidence_score=payload.ai_confidence_score,
            )
            db.add(verification)
        else:
            verification.reviewer_id = reviewer_id
            verification.status = "approved"
            verification.notes = decision_notes
            if payload.ai_confidence_score is not None:
                verification.ai_confidence_score = payload.ai_confidence_score

        # Authoritatively execute exactly-once token reward settlement & escrow stake release
        from app.database.models.consensus import ConsensusRecord
        from app.modules.consensus.service import get_or_create_consensus_record, settle_consensus

        consensus = db.query(ConsensusRecord).filter(ConsensusRecord.submission_id == submission_id).first()
        if not consensus:
            consensus = get_or_create_consensus_record(db, submission_id=submission.id)

        consensus.status = "APPROVED"
        consensus.resolution_notes = decision_notes
        consensus.resolved_by = reviewer_id
        consensus.resolved_at = now_time

        settle_consensus(
            db,
            consensus,
            stake_action="refund",
            admin_notes=decision_notes,
            admin_override=bool(payload.admin_override),
        )

    elif decision == "rejected":
        rejection_reason = (payload.notes or "").strip()
        if not rejection_reason or len(rejection_reason) < 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "REASON_REQUIRED", "message": "Rejection rationale of at least 5 characters is required."},
            )

        submission.status = "rejected"

        if not verification:
            verification = Verification(
                submission_id=submission_id,
                reviewer_id=reviewer_id,
                status="rejected",
                notes=rejection_reason,
            )
            db.add(verification)
        else:
            verification.reviewer_id = reviewer_id
            verification.status = "rejected"
            verification.notes = rejection_reason

        from app.database.models.consensus import ConsensusRecord
        from app.modules.consensus.service import get_or_create_consensus_record, settle_consensus

        consensus = db.query(ConsensusRecord).filter(ConsensusRecord.submission_id == submission_id).first()
        if not consensus:
            consensus = get_or_create_consensus_record(db, submission_id=submission.id)

        consensus.status = "REJECTED"
        consensus.resolution_notes = rejection_reason
        consensus.resolved_by = reviewer_id
        consensus.resolved_at = now_time

        stake_action = "slash" if (payload.stake_action == "slash") else "refund"
        settle_consensus(
            db,
            consensus,
            stake_action=stake_action,
            slashing_confirmed=(stake_action == "slash"),
            admin_notes=rejection_reason,
        )

    elif decision == "disputed":
        dispute_notes = (payload.notes or "").strip()
        if not dispute_notes or len(dispute_notes) < 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "REASON_REQUIRED", "message": "Dispute investigation rationale of at least 5 characters is required."},
            )

        submission.status = "disputed"

        dispute_summary = f"Dispute opened by @{admin_name}: {dispute_notes}"
        if not verification:
            verification = Verification(
                submission_id=submission_id,
                reviewer_id=reviewer_id,
                status="disputed",
                notes=dispute_summary,
            )
            db.add(verification)
        else:
            verification.reviewer_id = reviewer_id
            verification.status = "disputed"
            verification.notes = dispute_summary

        from app.database.models.consensus import ConsensusRecord
        from app.modules.consensus.service import get_or_create_consensus_record

        consensus = db.query(ConsensusRecord).filter(ConsensusRecord.submission_id == submission_id).first()
        if not consensus:
            consensus = get_or_create_consensus_record(db, submission_id=submission.id)

        consensus.status = "DISPUTED"
        consensus.dispute_reason = dispute_notes
        consensus.disputed_by = reviewer_id
        consensus.disputed_at = now_time
        consensus.settlement_status = "disputed"

    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_STATUS", "message": f"Unsupported decision '{payload.status}'. Must be 'approved', 'rejected', or 'disputed'."},
        )

    db.commit()
    db.refresh(verification)
    db.refresh(submission)
    return verification


def retry_submission_verification(
    db: Session,
    submission_id: uuid.UUID,
) -> Verification:
    """Re-run automated deterministic validation and AI evidence verification for a submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )

    from app.modules.validation.service import AutomatedValidationService
    from app.modules.validation.ai_service import AIValidationService

    val_result = AutomatedValidationService.validate_submission(db, submission)
    AutomatedValidationService.record_validation_result(db, submission, val_result)

    ai_result = AIValidationService.evaluate_submission_media(db, submission)
    verification = AIValidationService.record_ai_result(db, submission, ai_result)

    db.refresh(submission)
    return verification
