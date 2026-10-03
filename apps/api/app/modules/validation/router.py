import uuid
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models.user import User
from app.core.security import get_current_user
from app.modules.validation.schemas import ValidationResultResponse
from app.modules.validation.service import AutomatedValidationService

router = APIRouter(tags=["Automated Data Validation"])


@router.post(
    "/submissions/{submission_id}/validate",
    response_model=ValidationResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Run deterministic automated validation on field submission",
)
def run_submission_validation(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute deterministic automated validation rules before human/AI review."""
    is_admin = current_user.role in ("admin", "reviewer")
    return AutomatedValidationService.run_automated_validation(
        db, submission_id=submission_id, user_id=current_user.id, is_admin=is_admin
    )


@router.get(
    "/submissions/{submission_id}/validation",
    response_model=ValidationResultResponse,
    summary="Get recorded validation audit result for a submission",
)
def get_submission_validation(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve existing validation results for a submission."""
    is_admin = current_user.role in ("admin", "reviewer")
    return AutomatedValidationService.run_automated_validation(
        db, submission_id=submission_id, user_id=current_user.id, is_admin=is_admin
    )


@router.post(
    "/submissions/{submission_id}/ai-validate",
    status_code=status.HTTP_200_OK,
    summary="Run AI image quality validation on field submission evidence",
)
def run_submission_ai_validation(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute AI image quality checks across submission media and record verification results."""
    from app.database.models.submission import Submission
    from app.modules.validation.ai_service import AIValidationService
    from fastapi import HTTPException

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )

    is_admin = current_user.role in ("admin", "reviewer")
    if submission.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not authorized to trigger AI validation on this submission"},
        )

    ai_result = AIValidationService.evaluate_submission_media(db, submission)
    AIValidationService.record_ai_result(db, submission, ai_result)
    return ai_result


@router.get(
    "/submissions/{submission_id}/ai-validation",
    status_code=status.HTTP_200_OK,
    summary="Get recorded AI image quality results for a submission",
)
def get_submission_ai_validation(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve recorded AI image quality results for a submission."""
    from app.database.models.submission import Submission
    from app.database.models.verification import Verification
    from fastapi import HTTPException

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": "Submission not found"},
        )

    is_admin = current_user.role in ("admin", "reviewer")
    if submission.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not authorized to view AI validation on this submission"},
        )

    verification = db.query(Verification).filter(Verification.submission_id == submission_id).first()
    if not verification or not verification.ai_results:
        return {
            "submission_id": str(submission_id),
            "overall_status": verification.ai_status if verification else "PENDING",
            "confidence": verification.ai_confidence_score if verification else 0.0,
            "media_results": [],
            "reasons": ["AI evaluation has not been executed yet."],
        }

    return verification.ai_results
