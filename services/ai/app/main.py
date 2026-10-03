from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from typing import Optional
from app.config.config import settings
from app.schemas.health import AIHealthResponse
from app.schemas.quality import (
    SubmissionQualityEvaluationRequest,
    SubmissionQualityEvaluationResponse,
    ImageQualityResult,
)
from app.services.quality_evaluator import ImageQualityEvaluator

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Decoupled AI/ML verification and anti-spoofing service for Horizon geospatial submissions.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


@app.get("/health", response_model=AIHealthResponse, tags=["Health"])
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.AI_SERVICE_HOST, port=settings.AI_SERVICE_PORT, reload=True)
