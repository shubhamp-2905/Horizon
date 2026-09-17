from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., examples=["ok"])
    service: str = Field(..., examples=["horizon-api"])
    environment: str = Field(..., examples=["development"])
    version: str = Field(..., examples=["0.1.0"])
    database: str = Field(..., examples=["connected"])
