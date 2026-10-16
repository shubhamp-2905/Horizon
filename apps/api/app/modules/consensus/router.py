import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Path, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models.user import User
from app.core.security import get_current_user, require_role
from app.modules.submissions.service import _submission_to_response
from app.schemas.submissions import SubmissionListResponse
from app.modules.consensus.schemas import (
    AssignReviewersRequest,
    AssignReviewersResponse,
    ReviewerAssignmentResponse,
    PeerReviewCreateRequest,
    PeerReviewResponse,
    ConsensusStatusResponse,
    DisputeCreateRequest,
    DisputeResolveRequest,
    AdminReviewItemResponse,
    AdminReviewListResponse,
)
from app.modules.consensus.service import (
    assign_reviewers_to_submission,
    submit_peer_review,
    get_or_create_consensus_record,
    initialize_submission_consensus,
    raise_submission_dispute,
    resolve_submission_dispute,
    list_peer_reviews_for_submission,
    list_assignments_for_submission,
    list_assigned_submissions_for_user,
)

router = APIRouter(tags=["Peer Consensus & Verification Governance"])


def _assignment_to_response(a) -> ReviewerAssignmentResponse:
    return ReviewerAssignmentResponse(
        assignment_id=str(a.id),
        submission_id=str(a.submission_id),
        reviewer_id=str(a.reviewer_id),
        reviewer_username=a.reviewer.username if a.reviewer else None,
        reviewer_email=a.reviewer.email if a.reviewer else None,
        status=a.status,
        assigned_at=a.assigned_at.isoformat() if a.assigned_at else "",
        completed_at=a.completed_at.isoformat() if a.completed_at else None,
    )


def _peer_review_to_response(r) -> PeerReviewResponse:
    return PeerReviewResponse(
        id=str(r.id),
        submission_id=str(r.submission_id),
        reviewer_id=str(r.reviewer_id),
        reviewer_username=r.reviewer.username if r.reviewer else None,
        decision=r.decision,
        notes=r.notes,
        evidence_references=r.evidence_references or {},
        confidence_score=r.confidence_score,
        created_at=r.created_at.isoformat() if r.created_at else "",
    )


def _consensus_to_response(c, db: Session) -> ConsensusStatusResponse:
    reviews = list_peer_reviews_for_submission(db, c.submission_id)
    assignments = list_assignments_for_submission(db, c.submission_id)
    return ConsensusStatusResponse(
        submission_id=str(c.submission_id),
        status=c.status,
        pool_size=c.pool_size,
        quorum=c.quorum,
        approval_threshold=c.approval_threshold,
        rejection_threshold=c.rejection_threshold,
        total_votes=c.total_votes,
        approve_votes=c.approve_votes,
        reject_votes=c.reject_votes,
        flag_votes=c.flag_votes,
        settlement_status=c.settlement_status,
        settled_at=c.settled_at.isoformat() if c.settled_at else None,
        dispute_reason=c.dispute_reason,
        disputed_by=str(c.disputed_by) if c.disputed_by else None,
        disputed_at=c.disputed_at.isoformat() if c.disputed_at else None,
        resolution_notes=c.resolution_notes,
        resolved_by=str(c.resolved_by) if c.resolved_by else None,
        resolved_at=c.resolved_at.isoformat() if c.resolved_at else None,
        created_at=c.created_at.isoformat() if c.created_at else "",
        updated_at=c.updated_at.isoformat() if c.updated_at else "",
        reviews=[_peer_review_to_response(r) for r in reviews],
        assignments=[_assignment_to_response(a) for a in assignments],
    )


@router.post(
    "/submissions/{submission_id}/assign-reviewers",
    response_model=AssignReviewersResponse,
    status_code=status.HTTP_200_OK,
    summary="Assign designated or auto-selected eligible reviewers to submission",
    dependencies=[Depends(require_role(["admin", "reviewer"]))],
)
def assign_reviewers(
    payload: AssignReviewersRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    db: Session = Depends(get_db),
):
    """Designate reviewers with configurable pool size and quorum, preventing self-review."""
    assignments, consensus = assign_reviewers_to_submission(
        db,
        submission_id=submission_id,
        pool_size=payload.pool_size,
        quorum=payload.quorum,
        reviewer_ids=payload.reviewer_ids,
    )
    return AssignReviewersResponse(
        submission_id=str(submission_id),
        assignments=[_assignment_to_response(a) for a in assignments],
        pool_size=consensus.pool_size,
        quorum=consensus.quorum,
        status=consensus.status,
    )


@router.get(
    "/submissions/{submission_id}/assignments",
    response_model=List[ReviewerAssignmentResponse],
    summary="List all reviewer assignments for a submission",
)
def get_submission_assignments(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve list of assigned reviewers and their progress status."""
    assignments = list_assignments_for_submission(db, submission_id=submission_id)
    return [_assignment_to_response(a) for a in assignments]


@router.get(
    "/me/assigned-reviews",
    response_model=SubmissionListResponse,
    summary="List contributions currently assigned to authenticated reviewer",
    dependencies=[Depends(require_role(["reviewer", "admin"]))],
)
def get_my_assigned_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve contributions awaiting inspection by current reviewer."""
    subs = list_assigned_submissions_for_user(db, user_id=current_user.id)
    return SubmissionListResponse(
        submissions=[_submission_to_response(s) for s in subs],
        total=len(subs),
        page=1,
        page_size=len(subs) or 20,
    )


@router.post(
    "/submissions/{submission_id}/peer-reviews",
    response_model=PeerReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cast a peer review ballot for a contribution",
    dependencies=[Depends(require_role(["reviewer", "admin"]))],
)
def submit_review(
    payload: PeerReviewCreateRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit an APPROVE, REJECT, or FLAG decision with notes and evidence audit."""
    review, _ = submit_peer_review(
        db,
        submission_id=submission_id,
        reviewer=current_user,
        payload=payload,
    )
    return _peer_review_to_response(review)


@router.get(
    "/submissions/{submission_id}/peer-reviews",
    response_model=List[PeerReviewResponse],
    summary="List all cast peer reviews for a submission",
)
def list_submission_peer_reviews(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inspect all submitted reviewer decisions, notes, and evidence references."""
    reviews = list_peer_reviews_for_submission(db, submission_id=submission_id)
    return [_peer_review_to_response(r) for r in reviews]


@router.get(
    "/submissions/{submission_id}/consensus",
    response_model=ConsensusStatusResponse,
    summary="Get real-time consensus status, vote tallies, and quorum progress",
)
def get_consensus_status(
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check whether a contribution has achieved quorum, is disputed, or has settled."""
    consensus = get_or_create_consensus_record(db, submission_id=submission_id)
    return _consensus_to_response(consensus, db)


@router.post(
    "/submissions/{submission_id}/dispute",
    response_model=ConsensusStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Raise a formal dispute or appeal on a contribution or consensus decision",
)
def raise_dispute(
    payload: DisputeCreateRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Contributor or reviewer escalates a contribution to DISPUTED status with appeal notes."""
    consensus = raise_submission_dispute(
        db,
        submission_id=submission_id,
        user=current_user,
        reason=payload.reason,
    )
    return _consensus_to_response(consensus, db)


@router.post(
    "/submissions/{submission_id}/dispute/resolve",
    response_model=ConsensusStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Administrator resolves a disputed contribution",
    dependencies=[Depends(require_role(["admin"]))],
)
def resolve_dispute(
    payload: DisputeResolveRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Administrator issues final binding ruling with stake refund or fraud slashing."""
    consensus = resolve_submission_dispute(
        db,
        submission_id=submission_id,
        admin_user=current_user,
        resolve_action=payload.resolve_action,
        notes=payload.notes,
    )
    return _consensus_to_response(consensus, db)


@router.get(
    "/admin/reviews",
    response_model=AdminReviewListResponse,
    summary="Admin review queue with peer consensus records, reviewer votes, and settlement tracking",
    dependencies=[Depends(require_role(["admin", "reviewer"]))],
)
def admin_list_reviews(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by consensus status: PENDING, APPROVED, REJECTED, DISPUTED"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    List review records with full peer-review ballots, quorum status,
    and consensus states for administrative decision management.
    """
    from app.database.models.consensus import ConsensusRecord
    from app.database.models.submission import Submission
    from app.modules.submissions.service import _extract_coordinates

    # Ensure any submitted/under_review/flagged submissions have consensus records initialized
    uninitialized = (
        db.query(Submission)
        .outerjoin(ConsensusRecord, Submission.id == ConsensusRecord.submission_id)
        .filter(
            Submission.status.in_(["submitted", "validating", "under_review", "flagged"]),
            ConsensusRecord.id.is_(None),
        )
        .all()
    )
    if uninitialized:
        for sub_uninit in uninitialized:
            initialize_submission_consensus(db, sub_uninit)
        db.commit()

    query = (
        db.query(ConsensusRecord)
        .join(Submission, ConsensusRecord.submission_id == Submission.id)
    )

    if status_filter:
        query = query.filter(ConsensusRecord.status == status_filter.upper())

    query = query.order_by(ConsensusRecord.updated_at.desc())
    total = query.count()
    records = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for c in records:
        sub = c.submission
        task = sub.task if sub else None
        user = sub.user if sub else None
        ver = sub.verification if sub else None

        lat, lng = _extract_coordinates(sub.location) if sub else (None, None)
        media_list = []
        if sub and sub.media:
            for m in sub.media:
                media_list.append({
                    "id": str(m.id),
                    "storage_key": m.storage_key,
                    "media_type": m.media_type,
                    "metadata": m.media_metadata or {},
                    "created_at": m.created_at.isoformat() if m.created_at else "",
                })

        item = AdminReviewItemResponse(
            id=str(c.id),
            submission_id=str(c.submission_id),
            task_id=str(sub.task_id) if sub else "",
            task_title=task.title if task else "Field Observation",
            artifact_type=task.artifact_type if task else "field_survey",
            base_reward=float(task.base_reward) if task and task.base_reward is not None else 50.0,
            commitment_stake=float(task.commitment_stake) if task and task.commitment_stake is not None else 10.0,
            contributor_email=user.email if user else None,
            contributor_username=user.username if user else None,
            submission_status=sub.status if sub else "submitted",
            submitted_at=sub.submitted_at.isoformat() if sub and sub.submitted_at else None,
            captured_at=sub.captured_at.isoformat() if sub and sub.captured_at else None,
            latitude=lat,
            longitude=lng,
            gps_accuracy=sub.gps_accuracy if sub else 5.0,
            media=media_list,
            form_data=sub.form_data if sub and sub.form_data else {},
            verification_status=ver.status if ver else None,
            verification_notes=ver.notes if ver else None,
            validation_status=ver.validation_status if ver else None,
            validation_results=ver.validation_results if ver else None,
            ai_status=ver.ai_status if ver else None,
            ai_confidence_score=ver.ai_confidence_score if ver else None,
            ai_results=ver.ai_results if ver else None,
            consensus=_consensus_to_response(c, db),
        )
        items.append(item)

    return AdminReviewListResponse(
        reviews=items,
        total=total,
    )

