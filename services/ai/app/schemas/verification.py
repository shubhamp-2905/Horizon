from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .quality import (
    QualityStatus,
    BlurMetrics,
    ExposureMetrics,
    ResolutionMetrics,
    ImageQualityResult,
    ImageInputItem,
)


class RelevanceStatus(str, Enum):
    RELEVANT = "RELEVANT"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    IRRELEVANT = "IRRELEVANT"


class SemanticRelevanceMetrics(BaseModel):
    status: RelevanceStatus = Field(..., description="Semantic alignment verdict with task goals")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Calibrated visual task relevance score [0.0 - 1.0]")
    target_artifact_type: str = Field(..., description="Expected spatial domain (e.g. water_source, solar_installation)")
    matched_concepts: List[str] = Field(default_factory=list, description="Visual concepts detected matching expected task domain")
    detected_contradictions: List[str] = Field(default_factory=list, description="Conflicting visual signals detected (e.g. code_editor, laptop_screen)")
    is_synthetic_or_screen: bool = Field(False, description="Flag indicating image appears to be an electronic monitor, code editor, or screenshot")
    reasons: List[str] = Field(default_factory=list, description="Explanations for the semantic relevance decision")


class AuthenticityMetrics(BaseModel):
    phash: str = Field(..., description="Perceptual gradient hash for duplicate and collision detection")
    is_duplicate: bool = Field(False, description="Whether perceptual collision was found with previously submitted evidence")
    duplicate_reference: Optional[str] = Field(None, description="Prior submission ID if duplicate match occurred")


class ComprehensiveEvidenceResult(BaseModel):
    media_id: Optional[str] = None
    storage_key: Optional[str] = None
    quality: ImageQualityResult
    relevance: SemanticRelevanceMetrics
    authenticity: AuthenticityMetrics
    automated_recommendation: QualityStatus = Field(
        ..., description="Integrated verdict: PASS, WARNING (needs human review), or FAIL (blocked)"
    )
    reasons: List[str] = Field(default_factory=list)

    # Backward-compatible fields
    status: Optional[QualityStatus] = None
    confidence: Optional[float] = None
    blur: Optional[BlurMetrics] = None
    exposure: Optional[ExposureMetrics] = None
    resolution: Optional[ResolutionMetrics] = None


class SubmissionEvidenceEvaluationRequest(BaseModel):
    submission_id: str
    task_id: Optional[str] = None
    task_title: Optional[str] = "Geospatial Field Survey"
    task_description: Optional[str] = None
    artifact_type: Optional[str] = "water_source"
    requirements: Optional[List[str]] = None
    images: List[ImageInputItem]


class SubmissionEvidenceEvaluationResponse(BaseModel):
    submission_id: str
    overall_recommendation: QualityStatus = Field(..., description="Overall automated gate verdict: PASS, WARNING, or FAIL")
    confidence: float = Field(..., ge=0.0, le=1.0)
    relevance_status: RelevanceStatus
    quality_status: QualityStatus
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    media_results: List[ComprehensiveEvidenceResult]
    reasons: List[str]
    model_versions: Dict[str, str] = Field(
        default_factory=lambda: {
            "quality_engine": "MobileNetV3-Laplacian-v2.1",
            "semantic_relevance_engine": "TaskAware-MobileCLIP-S0-Ensemble-v2.1",
            "perceptual_hash": "pHash-64bit-DCT",
        }
    )
    evaluated_at: str

    # Backward-compatible field
    status: Optional[QualityStatus] = None
    overall_status: Optional[QualityStatus] = None

