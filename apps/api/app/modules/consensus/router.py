import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Path, Query, status, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database.session import get_db
from app.database.models.user import User
from app.core.security import get_current_user, require_role
from app.modules.submissions.service import _submission_to_response
from app.schemas.submissions import SubmissionListResponse, VerificationReviewRequest
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
    """Peer reviewer queue is retired in favor of single Admin Review workflow."""
    return SubmissionListResponse(
        submissions=[],
        total=0,
        page=1,
        page_size=20,
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


@router.post(
    "/admin/reviews/{submission_id}/decision",
    summary="Direct administrator decision on a submission in the review queue",
    dependencies=[Depends(require_role(["admin"]))],
)
def admin_make_review_decision(
    payload: VerificationReviewRequest,
    submission_id: uuid.UUID = Path(..., description="Submission UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Direct administrator decision: approve (with reward settlement), reject, or dispute."""
    from app.modules.submissions.service import review_submission_record
    v = review_submission_record(db, submission_id=submission_id, reviewer_id=current_user.id, payload=payload)
    return {
        "status": "success",
        "decision": payload.status,
        "submission_id": str(submission_id),
        "verification_status": v.status,
        "notes": v.notes,
    }


@router.get(
    "/admin/reviews",
    response_model=AdminReviewListResponse,
    summary="Admin review queue with automated verification diagnostics, complete submission evidence, and final decision controls",
    dependencies=[Depends(require_role(["admin", "reviewer"]))],
)
def admin_list_reviews(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter: all, pending, failed, approved, rejected, disputed"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    List field submissions for Admin Review with complete evidence, dynamic form answers,
    automated verification diagnostics, and authoritative decision status.
    Strictly replaces peer consensus queue with single Admin Review.
    """
    import os
    from datetime import datetime, timezone
    from app.database.models.consensus import ConsensusRecord
    from app.database.models.submission import Submission
    from app.database.models.verification import Verification
    from app.database.models.task import Task
    from app.database.models.user import User
    from app.modules.submissions.service import _extract_coordinates
    from app.modules.consensus.schemas import AdminReviewSummaryCounts

    # Base query across all submitted observations (excluding unfinished drafts) with eager loaded relationships
    base_query = (
        db.query(Submission)
        .options(
            joinedload(Submission.task),
            joinedload(Submission.user),
            joinedload(Submission.verification),
            joinedload(Submission.consensus_record),
            selectinload(Submission.media),
        )
        .filter(Submission.status != "draft")
    )

    all_subs = base_query.all()

    # Calculate real operational counts from persisted database records
    cnt_pending = 0
    cnt_failed = 0
    cnt_approved = 0
    cnt_rejected = 0
    cnt_disputed = 0

    for s in all_subs:
        v = s.verification
        s_stat = (s.status or "").lower()
        v_stat = (v.status or "").lower() if v else ""
        val_stat = (v.validation_status or "").upper() if v else ""
        ai_stat = (v.ai_status or "").upper() if v else ""
        ai_res = v.ai_results or {} if v else {}
        is_irrelevant = ai_res.get("relevance_status") == "IRRELEVANT"
        is_unavail = ai_res.get("service_unavailable") is True or ai_stat in ["UNAVAILABLE", "VERIFICATION_UNAVAILABLE"]

        is_failed = (
            s_stat in ["flagged", "verification_failed", "verification_unavailable"]
            or v_stat in ["flagged", "verification_failed", "verification_unavailable"]
            or val_stat == "FAILED"
            or ai_stat == "FAIL"
            or is_irrelevant
            or is_unavail
        )

        if s_stat in ["approved", "verified"]:
            cnt_approved += 1
        elif s_stat == "rejected":
            cnt_rejected += 1
        elif s_stat == "disputed" or v_stat == "disputed":
            cnt_disputed += 1
        elif is_failed:
            cnt_failed += 1
        elif s_stat in ["under_review", "pending_admin_review", "submitted", "validating"]:
            cnt_pending += 1

    counts = AdminReviewSummaryCounts(
        pending_admin_review=cnt_pending,
        verification_failed=cnt_failed,
        approved=cnt_approved,
        rejected=cnt_rejected,
        disputed=cnt_disputed,
        total=len(all_subs),
    )

    # Filter according to requested category
    filtered_subs = []
    filter_norm = (status_filter or "all").lower().strip()

    for s in all_subs:
        v = s.verification
        s_stat = (s.status or "").lower()
        v_stat = (v.status or "").lower() if v else ""
        val_stat = (v.validation_status or "").upper() if v else ""
        ai_stat = (v.ai_status or "").upper() if v else ""
        ai_res = v.ai_results or {} if v else {}
        is_irrelevant = ai_res.get("relevance_status") == "IRRELEVANT"
        is_unavail = ai_res.get("service_unavailable") is True or ai_stat in ["UNAVAILABLE", "VERIFICATION_UNAVAILABLE"]

        is_failed = (
            s_stat in ["flagged", "verification_failed", "verification_unavailable"]
            or v_stat in ["flagged", "verification_failed", "verification_unavailable"]
            or val_stat == "FAILED"
            or ai_stat == "FAIL"
            or is_irrelevant
            or is_unavail
        )

        if filter_norm in ["pending", "pending_admin_review", "under_review"]:
            if not is_failed and s_stat in ["under_review", "pending_admin_review", "submitted", "validating"]:
                filtered_subs.append(s)
        elif filter_norm in ["failed", "verification_failed", "exception"]:
            if is_failed and s_stat not in ["approved", "verified"]:
                filtered_subs.append(s)
        elif filter_norm == "approved":
            if s_stat in ["approved", "verified"]:
                filtered_subs.append(s)
        elif filter_norm == "rejected":
            if s_stat == "rejected":
                filtered_subs.append(s)
        elif filter_norm == "disputed":
            if s_stat == "disputed" or v_stat == "disputed":
                filtered_subs.append(s)
        else:
            # "all"
            filtered_subs.append(s)

    # Sort descending by capture/submission time
    filtered_subs.sort(
        key=lambda x: x.captured_at or x.submitted_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    total = len(filtered_subs)
    page_items = filtered_subs[(page - 1) * page_size : page * page_size]

    items = []
    for sub in page_items:
        task = sub.task
        user = sub.user
        ver = sub.verification
        c = sub.consensus_record

        lat, lng = _extract_coordinates(sub.location)
        media_list = []
        if sub and sub.media:
            for m in sub.media:
                meta = m.media_metadata or {}
                is_link = (m.media_type == "link") or bool(meta.get("is_link"))
                link_url = meta.get("url") if is_link else None
                fname = meta.get("file_name") or meta.get("filename") or (os.path.basename(m.storage_key) if not is_link else meta.get("title", "Evidence Link"))
                fsize = meta.get("file_size_bytes") or meta.get("file_size")
                clean_meta = {k: v for k, v in meta.items() if k not in ("image_base64", "base64")}
                media_list.append({
                    "id": str(m.id),
                    "storage_key": m.storage_key,
                    "media_type": m.media_type,
                    "metadata": clean_meta,
                    "created_at": m.created_at.isoformat() if m.created_at else "",
                    "url": link_url,
                    "file_name": fname,
                    "file_size_bytes": fsize,
                    "is_link": is_link,
                })

        settlement_status = c.settlement_status if c else ("settled" if sub.status in ["approved", "verified", "rejected"] else "unsettled")
        settled_at = c.settled_at.isoformat() if (c and c.settled_at) else None
        dispute_reason = c.dispute_reason if c else None
        disputed_by = str(c.disputed_by) if (c and c.disputed_by) else None
        disputed_at = c.disputed_at.isoformat() if (c and c.disputed_at) else None
        resolution_notes = c.resolution_notes if c else (ver.notes if ver else None)
        resolved_by = str(c.resolved_by) if (c and c.resolved_by) else (str(ver.reviewer_id) if (ver and ver.reviewer_id) else None)
        resolved_at = c.resolved_at.isoformat() if (c and c.resolved_at) else None

        consensus_dto = _consensus_to_response(c, db) if c else ConsensusStatusResponse(
            submission_id=str(sub.id),
            status=sub.status.upper(),
            pool_size=1,
            quorum=1,
            approval_threshold=1.0,
            rejection_threshold=1.0,
            total_votes=0,
            approve_votes=0,
            reject_votes=0,
            flag_votes=0,
            settlement_status=settlement_status,
            settled_at=settled_at,
            dispute_reason=dispute_reason,
            disputed_by=disputed_by,
            disputed_at=disputed_at,
            resolution_notes=resolution_notes,
            resolved_by=resolved_by,
            resolved_at=resolved_at,
            created_at=sub.submitted_at.isoformat() if sub.submitted_at else "",
            updated_at=sub.submitted_at.isoformat() if sub.submitted_at else "",
            reviews=[],
            assignments=[],
        )

        item = AdminReviewItemResponse(
            id=str(c.id) if c else str(sub.id),
            submission_id=str(sub.id),
            task_id=str(sub.task_id),
            task_title=task.title if task else "Field Observation",
            task_description=task.description if task else None,
            artifact_type=task.artifact_type if task else "field_survey",
            task_requirements=task.requirements if task and task.requirements else [],
            base_reward=float(task.base_reward) if task and task.base_reward is not None else 50.0,
            commitment_stake=float(task.commitment_stake) if task and task.commitment_stake is not None else 10.0,
            contributor_email=user.email if user else None,
            contributor_username=user.username if user else None,
            submission_status=sub.status,
            submitted_at=sub.submitted_at.isoformat() if sub.submitted_at else None,
            captured_at=sub.captured_at.isoformat() if sub.captured_at else None,
            latitude=lat,
            longitude=lng,
            gps_accuracy=sub.gps_accuracy,
            media=media_list,
            form_data=sub.form_data or {},
            verification_status=ver.status if ver else None,
            verification_notes=ver.notes if ver else None,
            validation_status=ver.validation_status if ver else None,
            validation_results=ver.validation_results if ver else None,
            ai_status=ver.ai_status if ver else None,
            ai_confidence_score=ver.ai_confidence_score if ver else None,
            ai_results=ver.ai_results if ver else None,
            settlement_status=settlement_status,
            settled_at=settled_at,
            dispute_reason=dispute_reason,
            disputed_by=disputed_by,
            disputed_at=disputed_at,
            resolution_notes=resolution_notes,
            resolved_by=resolved_by,
            resolved_at=resolved_at,
            consensus=consensus_dto,
        )
        items.append(item)

    return AdminReviewListResponse(
        reviews=items,
        total=total,
        counts=counts,
    )

