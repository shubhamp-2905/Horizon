from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class QualityStatus(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"


class ExposureStatus(str, Enum):
    OPTIMAL = "optimal"
    UNDEREXPOSED = "underexposed"
    OVEREXPOSED = "overexposed"
    LOW_CONTRAST = "low_contrast"


class BlurMetrics(BaseModel):
    blur_score: float = Field(..., description="Laplacian variance sharpness measure")
    is_blurry: bool
    status: QualityStatus
    threshold: float = 50.0


class ExposureMetrics(BaseModel):
    mean_brightness: float = Field(..., description="Average pixel luminance (0-255)")
    std_brightness: float = Field(..., description="Standard deviation of pixel luminance")
    under_ratio: float = Field(..., description="Fraction of near-black pixels")
    over_ratio: float = Field(..., description="Fraction of clipped white pixels")
    status: QualityStatus
    exposure_classification: ExposureStatus


class ResolutionMetrics(BaseModel):
    width: int
    height: int
    megapixels: float
    status: QualityStatus
    min_dimension: int


class ImageQualityResult(BaseModel):
    media_id: Optional[str] = None
    storage_key: Optional[str] = None
    status: QualityStatus
    confidence: float = Field(..., ge=0.0, le=1.0)
    blur: BlurMetrics
    exposure: ExposureMetrics
    resolution: ResolutionMetrics
    reasons: List[str]


class ImageInputItem(BaseModel):
    media_id: Optional[str] = None
    storage_key: Optional[str] = None
    image_base64: Optional[str] = None
    file_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SubmissionQualityEvaluationRequest(BaseModel):
    submission_id: str
    images: List[ImageInputItem]


class SubmissionQualityEvaluationResponse(BaseModel):
    submission_id: str
    overall_status: QualityStatus
    confidence: float = Field(..., ge=0.0, le=1.0)
    media_results: List[ImageQualityResult]
    reasons: List[str]
    evaluated_at: str
