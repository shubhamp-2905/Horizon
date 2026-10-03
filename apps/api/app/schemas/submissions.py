from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SubmissionDraftCreateRequest(BaseModel):
    latitude: Optional[float] = Field(None, ge=-90, le=90, examples=[18.5204])
    longitude: Optional[float] = Field(None, ge=-180, le=180, examples=[73.8567])
    gps_accuracy: float = Field(5.0, ge=0.1, le=500.0, examples=[3.5])
    captured_at: Optional[datetime] = None
    form_data: Dict[str, Any] = Field(default_factory=dict, examples=[{"condition": "operational", "flow_rate": 12.5}])


class SubmissionDraftUpdateRequest(BaseModel):
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    gps_accuracy: Optional[float] = Field(None, ge=0.1, le=500.0)
    captured_at: Optional[datetime] = None
    form_data: Optional[Dict[str, Any]] = None


class SubmissionMediaCreateRequest(BaseModel):
    storage_key: str = Field(..., examples=["submissions/2026/10/water_source_01.jpg"])
    media_type: str = Field("image/jpeg", examples=["image/jpeg", "image/png"])
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        examples=[{"width": 4032, "height": 3024, "hash": "a1b2c3d4e5f6", "file_size_bytes": 2450000}],
    )


class SubmissionMediaResponse(BaseModel):
    id: str
    submission_id: str
    storage_key: str
    media_type: str
    metadata: Dict[str, Any]
    created_at: str


class TaskFormFieldDefinition(BaseModel):
    id: str
    label: str
    type: str  # text, number, select, boolean, textarea
    required: bool = True
    options: Optional[List[str]] = None
    placeholder: Optional[str] = None


class TaskFormSchemaResponse(BaseModel):
    task_id: str
    version: int
    fields: List[TaskFormFieldDefinition]
    minimum_photos: int = 1
    instructions: Optional[str] = None


class SubmissionResponse(BaseModel):
    id: str
    task_id: str
    task_title: Optional[str] = None
    artifact_type: Optional[str] = None
    user_id: str
    contributor_email: Optional[str] = None
    status: str
    gps_accuracy: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    captured_at: str
    submitted_at: Optional[str] = None
    form_data: Dict[str, Any] = Field(default_factory=dict)
    media: List[SubmissionMediaResponse] = Field(default_factory=list)
    verification_status: Optional[str] = None
    verification_notes: Optional[str] = None
    ai_confidence_score: Optional[float] = None
    created_at: Optional[str] = None
    validation_status: Optional[str] = None
    validation_results: Optional[Dict[str, Any]] = None
    ai_status: Optional[str] = None
    ai_results: Optional[Dict[str, Any]] = None


class SubmissionListResponse(BaseModel):
    submissions: List[SubmissionResponse]
    total: int
    page: int
    page_size: int


class VerificationReviewRequest(BaseModel):
    status: str = Field(..., examples=["approved", "rejected", "under_review"])
    notes: Optional[str] = Field(None, examples=["Ground-truth evidence matches required parameters."])
    ai_confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0, examples=[0.95])


class VerificationResponse(BaseModel):
    id: str
    submission_id: str
    status: str
    reviewer_id: Optional[str] = None
    notes: Optional[str] = None
    ai_confidence_score: Optional[float] = None
    validation_status: Optional[str] = None
    validation_results: Optional[Dict[str, Any]] = None
    ai_status: Optional[str] = None
    ai_results: Optional[Dict[str, Any]] = None
    created_at: str
