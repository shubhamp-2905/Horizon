import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ReviewerAssignmentResponse(BaseModel):
    assignment_id: str
    submission_id: str
    reviewer_id: str
    reviewer_username: Optional[str] = None
    reviewer_email: Optional[str] = None
    status: str
    assigned_at: str
    completed_at: Optional[str] = None


class AssignReviewersRequest(BaseModel):
    pool_size: Optional[int] = Field(None, ge=1, le=15, description="Number of reviewers in the pool")
    quorum: Optional[int] = Field(None, ge=1, le=15, description="Minimum votes required to reach consensus")
    reviewer_ids: Optional[List[uuid.UUID]] = Field(None, description="Explicit list of reviewer UUIDs")


class AssignReviewersResponse(BaseModel):
    submission_id: str
    assignments: List[ReviewerAssignmentResponse]
    pool_size: int
    quorum: int
    status: str


class PeerReviewCreateRequest(BaseModel):
    decision: str = Field(..., description="Decision: APPROVE, REJECT, or FLAG")
    notes: Optional[str] = Field(None, description="Review notes; required for REJECT and FLAG")
    evidence_references: Optional[Dict[str, Any]] = Field(default_factory=dict, description="References to verified photo IDs, GPS telemetry, or schema fields")
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Reviewer confidence assessment (0.0 - 1.0)")


class PeerReviewResponse(BaseModel):
    id: str
    submission_id: str
    reviewer_id: str
    reviewer_username: Optional[str] = None
    decision: str
    notes: Optional[str] = None
    evidence_references: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    created_at: str


class ConsensusStatusResponse(BaseModel):
    submission_id: str
    status: str  # PENDING, APPROVED, REJECTED, DISPUTED
    pool_size: int
    quorum: int
    approval_threshold: float
    rejection_threshold: float
    total_votes: int
    approve_votes: int
    reject_votes: int
    flag_votes: int
    settlement_status: str  # unsettled, settled, disputed
    settled_at: Optional[str] = None
    dispute_reason: Optional[str] = None
    disputed_by: Optional[str] = None
    disputed_at: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: str
    updated_at: str
    reviews: List[PeerReviewResponse] = []
    assignments: List[ReviewerAssignmentResponse] = []


class DisputeCreateRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Detailed basis for contesting or flagging the consensus outcome")


class DisputeResolveRequest(BaseModel):
    resolve_action: str = Field(..., description="Action: 'approve', 'reject_refund', or 'reject_slash'")
    notes: str = Field(..., min_length=5, description="Administrative audit findings justifying the resolution")
