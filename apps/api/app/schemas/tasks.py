from typing import Optional, List
from pydantic import BaseModel, Field


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, examples=["Community Water Source Survey"])
    description: Optional[str] = Field(None, examples=["Document water quality and pump condition."])
    artifact_type: str = Field(..., examples=["water_source"])
    latitude: float = Field(..., ge=-90, le=90, examples=[18.5204])
    longitude: float = Field(..., ge=-180, le=180, examples=[73.8567])
    difficulty: float = Field(1.0, ge=1.0, le=5.0, examples=[2.0])
    scarcity: float = Field(1.0, ge=1.0, le=3.0, examples=[1.5])
    base_reward: int = Field(50, ge=1, examples=[150])
    commitment_stake: int = Field(10, ge=0, examples=[20])
    estimated_effort_minutes: int = Field(30, ge=5, examples=[25])
    requirements: List[str] = Field(
        default_factory=list,
        examples=[["Wide-angle photo of water point", "Close-up of valve hardware", "Record operational status"]]
    )
    status: str = Field("draft", examples=["draft", "published"])


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    artifact_type: Optional[str] = None
    status: Optional[str] = None
    base_reward: Optional[int] = None
    commitment_stake: Optional[int] = None
    difficulty: Optional[float] = None
    scarcity: Optional[float] = None
    estimated_effort_minutes: Optional[int] = None
    requirements: Optional[List[str]] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    artifact_type: str
    status: str
    difficulty: float
    scarcity: float
    base_reward: int
    commitment_stake: int
    estimated_effort_minutes: Optional[int] = 30
    requirements: List[str] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_meters: Optional[float] = None
    created_at: str


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
    page: int
    page_size: int


class TaskClaimResponse(BaseModel):
    claim_id: str
    task_id: str
    user_id: str
    stake_amount: int
    status: str
    claimed_at: str
    available_tokens: int
    locked_tokens: int
