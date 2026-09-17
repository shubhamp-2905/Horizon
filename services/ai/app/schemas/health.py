from pydantic import BaseModel, Field


class AIHealthResponse(BaseModel):
    status: str = Field(..., examples=["ok"])
    service: str = Field(..., examples=["horizon-ai"])
    environment: str = Field(..., examples=["development"])
    version: str = Field(..., examples=["0.1.0"])
    device: str = Field(..., examples=["cpu"])
