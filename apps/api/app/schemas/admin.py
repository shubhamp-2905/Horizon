from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class MemberLocationInfo(BaseModel):
    """Safe, context-aware member location description."""
    type: str = Field(..., description="Source of location: 'profile', 'field_observation', or 'none'")
    display_text: str = Field(..., description="Human-readable location or 'Not available'")
    latitude: Optional[float] = Field(None, description="Latitude if authorized and available")
    longitude: Optional[float] = Field(None, description="Longitude if authorized and available")
    updated_at: Optional[str] = Field(None, description="ISO timestamp when location was recorded")
    context: Optional[str] = Field(None, description="Contextual note e.g. task name or source")


class MemberSummaryResponse(BaseModel):
    """Summary item for the admin members management table."""
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    status: str
    role: str
    avatar_url: Optional[str] = None
    joined_at: str
    tkn_balance: int = 0
    available_balance: int = 0
    locked_balance: int = 0
    tasks_claimed_count: int = 0
    tasks_completed_count: int = 0
    submissions_count: int = 0
    approved_submissions_count: int = 0
    last_active_at: Optional[str] = None
    last_active_source: Optional[str] = None
    location: MemberLocationInfo


class MemberListResponse(BaseModel):
    """Paginated response for the admin members directory."""
    members: List[MemberSummaryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class MemberOverviewStatsResponse(BaseModel):
    """Top-level member participation and activity KPIs."""
    total_registered_members: int
    active_recently_count: int
    recent_activity_window_days: int = 30
    members_awarded_tkn_count: int
    online_members_count: Optional[int] = None


class MemberTransactionItem(BaseModel):
    """Item in member's audit token ledger."""
    id: str
    transaction_type: str
    amount: int
    direction: str  # "in" or "out"
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    created_at: Optional[str] = None
    description: Optional[str] = None


class MemberClaimItem(BaseModel):
    """Task claim associated with member."""
    id: str
    task_id: str
    task_title: str
    status: str
    stake_amount: int
    claimed_at: str
    completed_at: Optional[str] = None


class MemberSubmissionItem(BaseModel):
    """Geospatial submission created by member."""
    id: str
    task_id: str
    task_title: str
    status: str
    gps_accuracy: float
    captured_at: str
    submitted_at: Optional[str] = None
    verification_status: Optional[str] = None


class MemberDetailResponse(BaseModel):
    """Complete detail view for inspecting a specific member."""
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    status: str
    role: str
    avatar_url: Optional[str] = None
    joined_at: str
    updated_at: Optional[str] = None
    profile_data: Dict[str, Any] = Field(default_factory=dict)
    tkn_balance: int = 0
    available_balance: int = 0
    locked_balance: int = 0
    tasks_claimed_count: int = 0
    tasks_completed_count: int = 0
    submissions_count: int = 0
    approved_submissions_count: int = 0
    last_active_at: Optional[str] = None
    last_active_source: Optional[str] = None
    location: MemberLocationInfo
    transactions: List[MemberTransactionItem] = Field(default_factory=list)
    claims: List[MemberClaimItem] = Field(default_factory=list)
    submissions: List[MemberSubmissionItem] = Field(default_factory=list)
