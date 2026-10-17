from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from typing import Optional

try:
    from services.ai.app.config.config import settings
    from services.ai.app.schemas.health import AIHealthResponse
    from services.ai.app.schemas.quality import (
        SubmissionQualityEvaluationRequest,
        SubmissionQualityEvaluationResponse,
        ImageQualityResult,
    )
    from services.ai.app.schemas.verification import (
        SubmissionEvidenceEvaluationRequest,
        SubmissionEvidenceEvaluationResponse,
        ComprehensiveEvidenceResult,
    )
    from services.ai.app.services.quality_evaluator import ImageQualityEvaluator
    from services.ai.app.services.evidence_evaluator import EvidenceEvaluator
except (ImportError, ModuleNotFoundError):
    from app.config.config import settings  # type: ignore
    from app.schemas.health import AIHealthResponse  # type: ignore
    from app.schemas.quality import (  # type: ignore
        SubmissionQualityEvaluationRequest,
        SubmissionQualityEvaluationResponse,
        ImageQualityResult,
    )
    from app.schemas.verification import (  # type: ignore
        SubmissionEvidenceEvaluationRequest,
        SubmissionEvidenceEvaluationResponse,
        ComprehensiveEvidenceResult,
    )
    from app.services.quality_evaluator import ImageQualityEvaluator  # type: ignore
    from app.services.evidence_evaluator import EvidenceEvaluator  # type: ignore


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Decoupled AI/ML verification and anti-spoofing service for Horizon geospatial submissions.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


@app.get("/health", response_model=AIHealthResponse, tags=["Health"])
@app.get("/healthz", response_model=AIHealthResponse, tags=["Health"])
@app.get("/readyz", response_model=AIHealthResponse, tags=["Health"])
def ai_health() -> AIHealthResponse:
    """Return health and runtime engine readiness of the isolated AI service."""
    return AIHealthResponse(
        status="ok",
        service="horizon-ai",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
        device=settings.DEVICE,
    )


@app.post(
    "/quality/evaluate",
    response_model=SubmissionQualityEvaluationResponse,
    tags=["Image Quality"],
)
@app.post(
    "/api/v1/quality/evaluate",
    response_model=SubmissionQualityEvaluationResponse,
    tags=["Image Quality"],
)
def evaluate_submission_quality(
    payload: SubmissionQualityEvaluationRequest,
) -> SubmissionQualityEvaluationResponse:
    """Evaluate computer-vision quality across all evidence media items for a submission."""
    return ImageQualityEvaluator.evaluate_submission(payload)


@app.post(
    "/quality/evaluate-file",
    response_model=ImageQualityResult,
    tags=["Image Quality"],
)
async def evaluate_single_file(
    file: UploadFile = File(...),
    media_id: Optional[str] = Form(None),
) -> ImageQualityResult:
    """Upload and evaluate a single image file for blur, exposure, and resolution."""
    try:
        content = await file.read()
        return ImageQualityEvaluator.evaluate_image_bytes(
            content,
            media_id=media_id,
            storage_key=file.filename,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to process image file: {str(e)}",
        )


@app.post(
    "/evidence/evaluate",
    response_model=SubmissionEvidenceEvaluationResponse,
    tags=["Evidence Verification"],
)
@app.post(
    "/api/v1/evidence/evaluate",
    response_model=SubmissionEvidenceEvaluationResponse,
    tags=["Evidence Verification"],
)
def evaluate_submission_evidence(
    payload: SubmissionEvidenceEvaluationRequest,
) -> SubmissionEvidenceEvaluationResponse:
    """Evaluate task-aware semantic relevance, image quality, and authenticity across evidence media."""
    return EvidenceEvaluator.evaluate_submission(payload)


@app.post(
    "/evidence/evaluate-file",
    response_model=ComprehensiveEvidenceResult,
    tags=["Evidence Verification"],
)
async def evaluate_single_evidence_file(
    file: UploadFile = File(...),
    artifact_type: Optional[str] = Form("water_source"),
    task_title: Optional[str] = Form("Geospatial Field Survey"),
    media_id: Optional[str] = Form(None),
) -> ComprehensiveEvidenceResult:
    """Upload and evaluate a single image file for both image quality and semantic task relevance."""
    try:
        content = await file.read()
        return EvidenceEvaluator.evaluate_image_bytes(
            content,
            task_context={"artifact_type": artifact_type, "task_title": task_title},
            media_id=media_id,
            storage_key=file.filename,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to process evidence image: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.AI_SERVICE_HOST, port=settings.AI_SERVICE_PORT)
