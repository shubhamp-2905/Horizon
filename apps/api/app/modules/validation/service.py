import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from geoalchemy2.shape import to_shape
from shapely.geometry import Point

from app.database.models.submission import Submission
from app.database.models.submission_media import SubmissionMedia
from app.database.models.task import Task
from app.database.models.verification import Verification
from app.modules.submissions.service import get_task_form_schema
from app.modules.validation.schemas import (
    CheckStatus,
    ValidationCheck,
    ValidationResultResponse,
)


def _extract_coords(location_point) -> Tuple[Optional[float], Optional[float]]:
    if location_point is None:
        return None, None
    try:
        shape = to_shape(location_point)
        if isinstance(shape, Point):
            return shape.y, shape.x
    except Exception:
        pass
    return None, None


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in meters on Earth."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class AutomatedValidationService:
    """Deterministic server-side validation layer for ground-truth field submissions."""

    ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
    MAX_CLOCK_DRIFT_MINUTES = 5.0
    DEFAULT_MAX_SURVEY_RADIUS_METERS = 500.0
    MAX_TOLERABLE_DISTANCE_METERS = 1000.0

    @classmethod
    def validate_submission(
        cls, db: Session, submission: Submission
    ) -> ValidationResultResponse:
        checks: List[ValidationCheck] = []
        passed_checks: List[str] = []
        failed_checks: List[str] = []
        warnings: List[str] = []

        task = db.query(Task).filter(Task.id == submission.task_id).first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "TASK_NOT_FOUND", "message": "Associated task not found"},
            )

        # Retrieve dynamic schema for task
        schema = get_task_form_schema(db, task.id)
        form_data = submission.form_data or {}

        # -------------------------------------------------------------
        # 1. REQUIRED FIELDS & TYPE VALIDATION
        # -------------------------------------------------------------
        field_errors = []
        for f in schema.fields:
            val = form_data.get(f.id)

            # Required check
            if f.required:
                if val is None or val == "":
                    field_errors.append(f"Missing required field '{f.label}' ({f.id})")
                    continue

            # Value type & constraint validation if present
            if val is not None and val != "":
                if f.type == "number":
                    try:
                        num_val = float(val)
                        if math.isnan(num_val) or math.isinf(num_val):
                            field_errors.append(f"Field '{f.label}' has invalid numeric value")
                    except (ValueError, TypeError):
                        field_errors.append(f"Field '{f.label}' expected a valid number, got '{val}'")
                elif f.type == "select":
                    if f.options and str(val) not in f.options:
                        field_errors.append(
                            f"Field '{f.label}' has invalid option '{val}'. Allowed options: {f.options}"
                        )
                elif f.type == "boolean":
                    if not isinstance(val, bool) and str(val).lower() not in ("true", "false", "1", "0"):
                        field_errors.append(f"Field '{f.label}' expected a boolean value")

        if field_errors:
            checks.append(
                ValidationCheck(
                    name="required_fields",
                    status=CheckStatus.FAILED,
                    message="; ".join(field_errors),
                    details={"errors": field_errors},
                )
            )
            failed_checks.append("required_fields")
        else:
            checks.append(
                ValidationCheck(
                    name="required_fields",
                    status=CheckStatus.PASSED,
                    message=f"All {len(schema.fields)} dynamic form schema fields verified successfully.",
                )
            )
            passed_checks.append("required_fields")

        # -------------------------------------------------------------
        # 2. MEDIA CHECKS (Count, MIME, Corrupt metadata, Duplicates)
        # -------------------------------------------------------------
        media_list = submission.media or []
        media_errors = []
        media_warnings = []
        seen_hashes = set()

        # 2a. Photo count
        if len(media_list) < schema.minimum_photos:
            media_errors.append(
                f"Insufficient photos: captured {len(media_list)}, required minimum {schema.minimum_photos}"
            )

        # 2b. Inspect each media item
        for idx, m in enumerate(media_list):
            # MIME type
            if m.media_type.lower() not in cls.ALLOWED_MIME_TYPES:
                media_errors.append(
                    f"Media #{idx+1} ({m.storage_key}) has unsupported MIME type '{m.media_type}'"
                )

            # Metadata integrity
            meta = m.media_metadata or {}
            file_size = meta.get("file_size") or meta.get("file_size_bytes")
            if file_size is not None:
                try:
                    if int(file_size) <= 0:
                        media_errors.append(f"Media #{idx+1} has invalid or zero file size ({file_size} bytes)")
                except (ValueError, TypeError):
                    media_errors.append(f"Media #{idx+1} has non-numeric file size metadata")

            # Duplicate hash check within same submission
            h = meta.get("hash") or meta.get("sha256")
            if h:
                if h in seen_hashes:
                    media_errors.append(f"Duplicate image detected within submission (hash: {h})")
                else:
                    seen_hashes.add(h)

                # Cross-submission duplicate check
                prior_dup = (
                    db.query(SubmissionMedia)
                    .join(Submission, SubmissionMedia.submission_id == Submission.id)
                    .filter(
                        SubmissionMedia.submission_id != submission.id,
                        Submission.status.in_(["submitted", "under_review", "approved", "verified"]),
                    )
                    .all()
                )
                for prior_m in prior_dup:
                    p_hash = (prior_m.media_metadata or {}).get("hash") or (prior_m.media_metadata or {}).get("sha256")
                    if p_hash and p_hash == h:
                        media_warnings.append(
                            f"Image hash '{h}' was previously submitted in submission {prior_m.submission_id}"
                        )
                        break

        # Record media checks
        if media_errors:
            checks.append(
                ValidationCheck(
                    name="media_evidence",
                    status=CheckStatus.FAILED,
                    message="; ".join(media_errors),
                    details={"media_count": len(media_list), "required_minimum": schema.minimum_photos},
                )
            )
            failed_checks.append("media_evidence")
        elif media_warnings:
            checks.append(
                ValidationCheck(
                    name="media_evidence",
                    status=CheckStatus.WARNING,
                    message=f"Photo count ({len(media_list)}) satisfied. Warning: {'; '.join(media_warnings)}",
                    details={"media_count": len(media_list)},
                )
            )
            warnings.extend(media_warnings)
            passed_checks.append("media_evidence")
        else:
            checks.append(
                ValidationCheck(
                    name="media_evidence",
                    status=CheckStatus.PASSED,
                    message=f"Photo count ({len(media_list)}/{schema.minimum_photos}) and metadata verified.",
                    details={"media_count": len(media_list)},
                )
            )
            passed_checks.append("media_evidence")

        # -------------------------------------------------------------
        # 3. GPS COORDINATES & ACCURACY CHECKS
        # -------------------------------------------------------------
        sub_lat, sub_lng = _extract_coords(submission.location)
        gps_errors = []
        gps_warnings = []

        if sub_lat is None or sub_lng is None:
            gps_errors.append("Geospatial coordinates missing from submission")
        else:
            if not (-90.0 <= sub_lat <= 90.0):
                gps_errors.append(f"Latitude out of valid range [-90, 90]: {sub_lat}")
            if not (-180.0 <= sub_lng <= 180.0):
                gps_errors.append(f"Longitude out of valid range [-180, 180]: {sub_lng}")

        # Accuracy classification
        acc = submission.gps_accuracy
        if acc is None or acc > 150.0:
            gps_errors.append(f"GPS accuracy ±{acc}m exceeds maximum allowable tolerance of 150m")
        elif acc > 50.0:
            gps_warnings.append(f"Low GPS accuracy ±{round(acc, 1)}m exceeds 50m threshold")
        elif acc > 15.0:
            gps_warnings.append(f"Moderate GPS accuracy ±{round(acc, 1)}m exceeds optimal 15m threshold")

        if gps_errors:
            checks.append(
                ValidationCheck(
                    name="gps_accuracy",
                    status=CheckStatus.FAILED,
                    message="; ".join(gps_errors),
                    details={"accuracy": acc, "latitude": sub_lat, "longitude": sub_lng},
                )
            )
            failed_checks.append("gps_accuracy")
        elif gps_warnings:
            checks.append(
                ValidationCheck(
                    name="gps_accuracy",
                    status=CheckStatus.WARNING,
                    message="; ".join(gps_warnings),
                    details={"accuracy": acc, "latitude": sub_lat, "longitude": sub_lng},
                )
            )
            warnings.extend(gps_warnings)
            passed_checks.append("gps_accuracy")
        else:
            checks.append(
                ValidationCheck(
                    name="gps_accuracy",
                    status=CheckStatus.PASSED,
                    message=f"High precision GPS fix acquired (±{round(acc, 1)}m).",
                    details={"accuracy": acc, "latitude": sub_lat, "longitude": sub_lng},
                )
            )
            passed_checks.append("gps_accuracy")

        # -------------------------------------------------------------
        # 4. TASK PROXIMITY & RADIUS CHECK
        # -------------------------------------------------------------
        task_lat, task_lng = _extract_coords(task.location_point)
        if sub_lat is not None and sub_lng is not None and task_lat is not None and task_lng is not None:
            dist = calculate_haversine_distance(sub_lat, sub_lng, task_lat, task_lng)
            max_radius = cls.DEFAULT_MAX_SURVEY_RADIUS_METERS

            if dist > cls.MAX_TOLERABLE_DISTANCE_METERS:
                msg = f"Submission distance ({round(dist, 1)}m) is far outside task boundary ({max_radius}m limit)"
                checks.append(
                    ValidationCheck(
                        name="task_radius",
                        status=CheckStatus.FAILED,
                        message=msg,
                        details={"distance_meters": round(dist, 1), "max_radius_meters": max_radius},
                    )
                )
                failed_checks.append("task_radius")
            elif dist > max_radius:
                msg = f"Submission distance ({round(dist, 1)}m) slightly exceeds recommended survey radius ({max_radius}m)"
                checks.append(
                    ValidationCheck(
                        name="task_radius",
                        status=CheckStatus.WARNING,
                        message=msg,
                        details={"distance_meters": round(dist, 1), "max_radius_meters": max_radius},
                    )
                )
                warnings.append(msg)
                passed_checks.append("task_radius")
            else:
                checks.append(
                    ValidationCheck(
                        name="task_radius",
                        status=CheckStatus.PASSED,
                        message=f"Distance to task target is {round(dist, 1)}m (within {max_radius}m limit).",
                        details={"distance_meters": round(dist, 1), "max_radius_meters": max_radius},
                    )
                )
                passed_checks.append("task_radius")
        else:
            checks.append(
                ValidationCheck(
                    name="task_radius",
                    status=CheckStatus.PASSED,
                    message="Task has no fixed geospatial origin pin; location radius check skipped.",
                )
            )
            passed_checks.append("task_radius")

        # -------------------------------------------------------------
        # 5. TIMESTAMP VALIDITY CHECKS
        # -------------------------------------------------------------
        time_errors = []
        now = datetime.now(timezone.utc)
        captured_at = submission.captured_at
        if captured_at is None:
            time_errors.append("Capture timestamp is missing")
        else:
            if captured_at.tzinfo is None:
                captured_at = captured_at.replace(tzinfo=timezone.utc)

            # Future timestamp check (with tolerance)
            if captured_at > (now + timedelta(minutes=cls.MAX_CLOCK_DRIFT_MINUTES)):
                time_errors.append(
                    f"Capture timestamp ({captured_at.isoformat()}) is in the future relative to server time ({now.isoformat()})"
                )

        if time_errors:
            checks.append(
                ValidationCheck(
                    name="capture_timestamp",
                    status=CheckStatus.FAILED,
                    message="; ".join(time_errors),
                )
            )
            failed_checks.append("capture_timestamp")
        else:
            checks.append(
                ValidationCheck(
                    name="capture_timestamp",
                    status=CheckStatus.PASSED,
                    message=f"Valid capture timestamp preserved: {captured_at.isoformat()}.",
                )
            )
            passed_checks.append("capture_timestamp")

        # -------------------------------------------------------------
        # Overall Status Determination
        # -------------------------------------------------------------
        if failed_checks:
            overall_status = CheckStatus.FAILED
        elif warnings:
            overall_status = CheckStatus.WARNING
        else:
            overall_status = CheckStatus.PASSED

        return ValidationResultResponse(
            submission_id=str(submission.id),
            status=overall_status,
            checks=checks,
            passed_checks=passed_checks,
            failed_checks=failed_checks,
            warnings=warnings,
            validated_at=now.isoformat(),
        )

    @classmethod
    def record_validation_result(
        cls, db: Session, submission: Submission, result: ValidationResultResponse
    ) -> Verification:
        """Store automated validation audit output onto the submission's Verification record."""
        verification = (
            db.query(Verification)
            .filter(Verification.submission_id == submission.id)
            .first()
        )
        if not verification:
            verification = Verification(
                submission_id=submission.id,
                status="flagged" if result.status == CheckStatus.FAILED else "pending",
                validation_status=result.status.value,
                validation_results=result.model_dump(),
            )
            db.add(verification)
        else:
            verification.validation_status = result.status.value
            verification.validation_results = result.model_dump()
            if result.status == CheckStatus.FAILED and verification.status != "approved":
                verification.status = "flagged"

        db.commit()
        db.refresh(verification)
        return verification

    @classmethod
    def run_automated_validation(
        cls, db: Session, submission_id: uuid.UUID, user_id: uuid.UUID, is_admin: bool = False
    ) -> ValidationResultResponse:
        """Authoritatively run deterministic validation checks and record results."""
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
            )

        # Authorization: Contributor owner or Admin/Reviewer
        if not is_admin and submission.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Not authorized to validate this submission"},
            )

        result = cls.validate_submission(db, submission)
        cls.record_validation_result(db, submission, result)
        return result
