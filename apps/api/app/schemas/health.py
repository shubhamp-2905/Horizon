from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", examples=["ok"])
    service: str = Field(default="horizon-backend-api", examples=["horizon-backend-api"])
    environment: str = Field(default="production", examples=["production"])
    version: str = Field(default="0.1.0", examples=["0.1.0"])
    database: str = Field(default="connected", examples=["connected"])
    database_connected: Optional[bool] = None


class SubsystemStatus(BaseModel):
    status: str = Field(..., examples=["healthy", "degraded", "unavailable"])
    latency_ms: Optional[float] = None
    details: Optional[Dict[str, Any]] = None


class ReadinessResponse(BaseModel):
    status: str = Field(..., examples=["ready", "not_ready"])
    service: str = Field(..., examples=["horizon-api"])
    version: str = Field(..., examples=["0.1.0"])
    environment: str = Field(..., examples=["development"])
    timestamp: str
    subsystems: Dict[str, SubsystemStatus]
