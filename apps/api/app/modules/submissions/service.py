import uuid
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from geoalchemy2.shape import to_shape, from_shape
from shapely.geometry import Point
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
            media_list.append(
                SubmissionMediaResponse(
                    id=str(m.id),
                    submission_id=str(m.submission_id),
                    storage_key=m.storage_key,
                    media_type=m.media_type,
                    metadata=m.media_metadata or {},
                    created_at=m.created_at.isoformat() if m.created_at else "",
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
    """Get the dynamic schema definition for task observation forms."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": "Task not found"},
        )

    schema_record = db.query(TaskFormSchema).filter(TaskFormSchema.task_id == task_id).first()
    if schema_record and "fields" in schema_record.schema_definition:
        fields = [TaskFormFieldDefinition(**f) for f in schema_record.schema_definition.get("fields", [])]
        return TaskFormSchemaResponse(
            task_id=str(task_id),
            version=schema_record.version,
            fields=fields,
            minimum_photos=schema_record.schema_definition.get("minimum_photos", 2),
            instructions=schema_record.schema_definition.get("instructions"),
        )

    # Build standard dynamic schema based on artifact_type
    fields: List[TaskFormFieldDefinition] = []
    if task.artifact_type == "water_source":
        fields = [
            TaskFormFieldDefinition(
                id="operational_status",
                label="Operational Status",
                type="select",
                options=["operational", "partially_functional", "broken", "dry"],
                required=True,
            ),
            TaskFormFieldDefinition(
                id="water_clarity",
                label="Water Clarity",
                type="select",
                options=["clear", "moderate_turbidity", "cloudy", "discolored"],
                required=True,
            ),
            TaskFormFieldDefinition(
                id="flow_rate_estimate",
                label="Estimated Flow Rate (Liters/min)",
                type="number",
                required=False,
                placeholder="e.g. 15",
            ),
            TaskFormFieldDefinition(
                id="field_notes",
                label="Condition Notes & Hazards",
                type="textarea",
                required=False,
                placeholder="Describe physical integrity, leaks, contamination risks...",
            ),
        ]
    elif task.artifact_type == "solar_installation":
        fields = [
            TaskFormFieldDefinition(
                id="panel_condition",
                label="Panel Physical Integrity",
                type="select",
                options=["intact", "microcracks", "heavy_soiling", "shattered"],
                required=True,
            ),
            TaskFormFieldDefinition(
                id="inverter_reading",
                label="Inverter Display Power (kW)",
                type="number",
                required=False,
                placeholder="e.g. 4.2",
            ),
            TaskFormFieldDefinition(
                id="shading_obstructions",
                label="Canopy Shading",
                type="select",
                options=["none", "partial_morning", "partial_afternoon", "dense_overhang"],
                required=True,
            ),
            TaskFormFieldDefinition(
                id="field_notes",
                label="Installation Notes",
                type="textarea",
                required=False,
            ),
        ]
    else:
        fields = [
            TaskFormFieldDefinition(
                id="operational_condition",
                label="Site Condition",
                type="select",
                options=["excellent", "satisfactory", "degraded", "critical_hazard"],
                required=True,
            ),
            TaskFormFieldDefinition(
                id="verification_observations",
                label="Ground-Truth Observations",
                type="textarea",
                required=True,
                placeholder="Enter detailed site observations adhering to task requirements...",
            ),
            TaskFormFieldDefinition(
                id="public_access_status",
                label="Public Access Status",
                type="select",
                options=["open_access", "restricted_permit", "gated_locked"],
                required=False,
            ),
        ]

    return TaskFormSchemaResponse(
        task_id=str(task_id),
        version=1,
        fields=fields,
        minimum_photos=2,
        instructions=f"Complete all required fields and capture evidence photos matching task specifications: {', '.join(task.requirements or [])}",
    )


def get_submission_details(db: Session, submission_id: uuid.UUID) -> Submission:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
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
    query = (
        db.query(Submission)
        .filter(Submission.user_id == user_id)
        .order_by(desc(Submission.captured_at))
    )
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_all_submissions(
    db: Session,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[Submission], int]:
    query = db.query(Submission)
    if status_filter:
        query = query.filter(Submission.status == status_filter)
    query = query.order_by(desc(Submission.captured_at))
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def review_submission_record(
    db: Session,
    submission_id: uuid.UUID,
    reviewer_id: uuid.UUID,
    payload: VerificationReviewRequest,
) -> Verification:
    """Review and record verification outcome for a contributor submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )

    verification = db.query(Verification).filter(Verification.submission_id == submission_id).first()
    if not verification:
        verification = Verification(
            submission_id=submission_id,
            reviewer_id=reviewer_id,
            status=payload.status,
            notes=payload.notes,
            ai_confidence_score=payload.ai_confidence_score,
        )
        db.add(verification)
    else:
        verification.reviewer_id = reviewer_id
        verification.status = payload.status
        verification.notes = payload.notes
        verification.ai_confidence_score = payload.ai_confidence_score

    submission.status = payload.status

    claim = (
        db.query(TaskClaim)
        .filter(TaskClaim.task_id == submission.task_id, TaskClaim.user_id == submission.user_id)
        .first()
    )
    if claim:
        if payload.status in ["approved", "verified"]:
            claim.status = "released"
            claim.completed_at = datetime.now(timezone.utc)
        elif payload.status == "rejected":
            claim.status = "forfeited"
            claim.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(verification)
    return verification
