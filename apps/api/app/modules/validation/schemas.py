from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class CheckStatus(str, Enum):
    PASSED = "PASSED"
    WARNING = "WARNING"
    FAILED = "FAILED"


class ValidationCheck(BaseModel):
    name: str = Field(..., examples=["required_fields", "media_count", "gps_accuracy", "task_radius", "capture_timestamp"])
    status: CheckStatus = Field(..., examples=["PASSED", "WARNING", "FAILED"])
    message: str = Field(..., examples=["All 4 required dynamic form fields completed with valid types."])
    details: Optional[Dict[str, Any]] = Field(default=None, examples=[{"distance_meters": 14.2, "threshold_meters": 500.0}])


class ValidationResultResponse(BaseModel):
    submission_id: str
    status: CheckStatus = Field(..., examples=["PASSED", "WARNING", "FAILED"])
    checks: List[ValidationCheck]
    passed_checks: List[str]
    failed_checks: List[str]
    warnings: List[str]
    validated_at: str
