import uuid
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.database.models.user import User
from app.database.models.submission import Submission
from app.database.models.task import Task
from app.database.models.task_claim import TaskClaim
from app.database.models.verification import Verification
from app.database.models.reward import Reward
from app.database.models.token import TokenAccount, TokenTransaction
from app.database.models.reputation import Reputation
from app.database.models.consensus import PeerReviewAssignment, PeerReview, ConsensusRecord
from app.modules.consensus.schemas import PeerReviewCreateRequest


def get_or_create_consensus_record(
    db: Session,
    submission_id: uuid.UUID,
    pool_size: Optional[int] = None,
    quorum: Optional[int] = None,
) -> ConsensusRecord:
    """Retrieve or initialize the authoritative ConsensusRecord for a submission."""
    consensus = db.query(ConsensusRecord).filter(ConsensusRecord.submission_id == submission_id).first()
    if not consensus:
        p_size = pool_size if pool_size is not None else settings.CONSENSUS_POOL_SIZE
        q_size = quorum if quorum is not None else settings.CONSENSUS_QUORUM
        consensus = ConsensusRecord(
            submission_id=submission_id,
            pool_size=p_size,
            quorum=q_size,
            approval_threshold=settings.CONSENSUS_APPROVAL_THRESHOLD,
            rejection_threshold=settings.CONSENSUS_REJECTION_THRESHOLD,
            status="PENDING",
            settlement_status="unsettled",
        )
        db.add(consensus)
        db.flush()
    return consensus


def initialize_submission_consensus(
    db: Session,
    submission: Submission,
    pool_size: Optional[int] = None,
    quorum: Optional[int] = None,
) -> ConsensusRecord:
    """Initialize consensus record and optionally assign eligible reviewers when a submission is finalized."""
    consensus = get_or_create_consensus_record(db, submission.id, pool_size=pool_size, quorum=quorum)
    
    # Auto-assign available reviewers if none assigned yet
    existing_assignments = (
        db.query(PeerReviewAssignment)
        .filter(PeerReviewAssignment.submission_id == submission.id)
        .all()
    )
    if not existing_assignments:
        eligible_reviewers = (
            db.query(User)
            .filter(
                User.role.in_(["reviewer", "admin"]),
                User.id != submission.user_id,
                User.status == "active",
            )
            .limit(consensus.pool_size)
            .all()
        )
        for rev in eligible_reviewers:
            assign = PeerReviewAssignment(
                submission_id=submission.id,
                reviewer_id=rev.id,
                status="assigned",
            )
            db.add(assign)
        db.flush()

    return consensus


def assign_reviewers_to_submission(
    db: Session,
    submission_id: uuid.UUID,
    pool_size: Optional[int] = None,
    quorum: Optional[int] = None,
    reviewer_ids: Optional[List[uuid.UUID]] = None,
) -> Tuple[List[PeerReviewAssignment], ConsensusRecord]:
    """Assign designated or auto-selected eligible reviewers to a contribution."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": f"Submission {submission_id} not found"},
        )

    target_pool_size = pool_size if pool_size is not None else settings.CONSENSUS_POOL_SIZE
    target_quorum = quorum if quorum is not None else settings.CONSENSUS_QUORUM
    if target_quorum > target_pool_size:
        target_quorum = target_pool_size

    selected_reviewers: List[User] = []

    if reviewer_ids is not None:
        # Check self-review prevention explicitly
        if submission.user_id in reviewer_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "CANNOT_REVIEW_OWN_SUBMISSION",
                    "message": "Submission author cannot be assigned as a reviewer to their own contribution",
                },
            )

        # Validate provided reviewer IDs
        candidates = db.query(User).filter(User.id.in_(reviewer_ids)).all()
        found_ids = {c.id for c in candidates}
        for rid in reviewer_ids:
            if rid not in found_ids:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "REVIEWER_NOT_FOUND", "message": f"Reviewer user {rid} not found"},
                )

        for c in candidates:
            if c.role not in ["reviewer", "admin"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "INELIGIBLE_REVIEWER",
                        "message": f"User {c.username} is role '{c.role}' and is not eligible for peer reviews",
                    },
                )
            if c.status != "active":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "INACTIVE_REVIEWER", "message": f"Reviewer {c.username} is not active"},
                )
        selected_reviewers = candidates
    else:
        # Auto-discover eligible reviewers (excluding submission author)
        selected_reviewers = (
            db.query(User)
            .filter(
                User.role.in_(["reviewer", "admin"]),
                User.id != submission.user_id,
                User.status == "active",
            )
            .limit(target_pool_size)
            .all()
        )

    # Initialize or update ConsensusRecord
    consensus = db.query(ConsensusRecord).filter(ConsensusRecord.submission_id == submission_id).first()
    if not consensus:
        consensus = ConsensusRecord(
            submission_id=submission_id,
            pool_size=target_pool_size,
            quorum=min(target_quorum, max(1, len(selected_reviewers))),
            status="PENDING",
            settlement_status="unsettled",
        )
        db.add(consensus)
    else:
        if pool_size is not None:
            consensus.pool_size = target_pool_size
        if quorum is not None:
            consensus.quorum = target_quorum

    # Create assignments idempotently
    assignments: List[PeerReviewAssignment] = []
    for rev in selected_reviewers:
        existing_assign = (
            db.query(PeerReviewAssignment)
            .filter(
                PeerReviewAssignment.submission_id == submission_id,
                PeerReviewAssignment.reviewer_id == rev.id,
            )
            .first()
        )
        if not existing_assign:
            new_assign = PeerReviewAssignment(
                submission_id=submission_id,
                reviewer_id=rev.id,
                status="assigned",
            )
            db.add(new_assign)
            assignments.append(new_assign)
        else:
            assignments.append(existing_assign)

    db.commit()
    db.refresh(consensus)
    for a in assignments:
        db.refresh(a)

    return assignments, consensus


def submit_peer_review(
    db: Session,
    submission_id: uuid.UUID,
    reviewer: User,
    payload: PeerReviewCreateRequest,
) -> Tuple[PeerReview, ConsensusRecord]:
    """Record a reviewer's inspection vote and trigger consensus evaluation."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": f"Submission {submission_id} not found"},
        )

    decision = payload.decision.upper().strip()
    if decision not in ["APPROVE", "REJECT", "FLAG"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_DECISION", "message": "Decision must be APPROVE, REJECT, or FLAG"},
        )

    # 1. Self-review prevention
    if submission.user_id == reviewer.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CANNOT_REVIEW_OWN_SUBMISSION", "message": "Contributors cannot review their own submissions"},
        )

    # 2. Authorization check
    if reviewer.role not in ["reviewer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "UNAUTHORIZED_REVIEWER", "message": "User does not have reviewer privileges"},
        )

    # 3. Notes required for REJECT and FLAG
    if decision in ["REJECT", "FLAG"]:
        if not payload.notes or not payload.notes.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "NOTES_REQUIRED", "message": "Review notes are required when rejecting or flagging a submission"},
            )

    # 4. Prevent duplicate voting
    existing_vote = (
        db.query(PeerReview)
        .filter(
            PeerReview.submission_id == submission_id,
            PeerReview.reviewer_id == reviewer.id,
        )
        .first()
    )
    if existing_vote:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "DUPLICATE_VOTE", "message": "Reviewer has already submitted a review for this submission"},
        )

    # 5. Update or complete assignment
    assignment = (
        db.query(PeerReviewAssignment)
        .filter(
            PeerReviewAssignment.submission_id == submission_id,
            PeerReviewAssignment.reviewer_id == reviewer.id,
        )
        .first()
    )
    if assignment:
        assignment.status = "completed"
        assignment.completed_at = datetime.now(timezone.utc)
    else:
        assignment = PeerReviewAssignment(
            submission_id=submission_id,
            reviewer_id=reviewer.id,
            status="completed",
            completed_at=datetime.now(timezone.utc),
        )
        db.add(assignment)

    # 6. Persist peer review
    peer_review = PeerReview(
        submission_id=submission_id,
        reviewer_id=reviewer.id,
        decision=decision,
        notes=payload.notes.strip() if payload.notes else None,
        evidence_references=payload.evidence_references or {},
        confidence_score=payload.confidence_score,
    )
    db.add(peer_review)
    db.flush()

    # 7. Evaluate consensus rules and settle tokens if quorum/majority reached
    consensus = evaluate_and_update_consensus(db, submission_id)

    db.commit()
    db.refresh(peer_review)
    db.refresh(consensus)
    return peer_review, consensus


def evaluate_and_update_consensus(db: Session, submission_id: uuid.UUID) -> ConsensusRecord:
    """Evaluate consensus tallies, majority/quorum rules, and trigger token settlement upon resolution."""
    consensus = (
        db.query(ConsensusRecord)
        .filter(ConsensusRecord.submission_id == submission_id)
        .with_for_update()
        .first()
    )
    if not consensus:
        consensus = get_or_create_consensus_record(db, submission_id)

    # If already settled or disputed, keep dispute/settlement intact
    if consensus.status == "DISPUTED":
        return consensus

    # Calculate review tallies
    reviews = db.query(PeerReview).filter(PeerReview.submission_id == submission_id).all()
    total_votes = len(reviews)
    approve_votes = sum(1 for r in reviews if r.decision == "APPROVE")
    reject_votes = sum(1 for r in reviews if r.decision == "REJECT")
    flag_votes = sum(1 for r in reviews if r.decision == "FLAG")

    consensus.total_votes = total_votes
    consensus.approve_votes = approve_votes
    consensus.reject_votes = reject_votes
    consensus.flag_votes = flag_votes

    submission = db.query(Submission).filter(Submission.id == submission_id).first()

    # Quorum check
    if total_votes < consensus.quorum:
        consensus.status = "PENDING"
        if submission and total_votes > 0 and submission.status == "submitted":
            submission.status = "under_review"
        return consensus

    # Quorum is met! Apply majority & conflict rules
    # Check for FLAG or conflicting votes:
    if flag_votes > 0:
        # Flag indicates suspected anomaly, spoofing, or fraud
        # If there are conflicting opinions or severe flags, consensus becomes DISPUTED
        consensus.status = "DISPUTED"
    else:
        # Pure APPROVE / REJECT votes
        approve_ratio = approve_votes / total_votes
        reject_ratio = reject_votes / total_votes

        if approve_ratio > consensus.approval_threshold and approve_votes > reject_votes:
            consensus.status = "APPROVED"
        elif reject_ratio > consensus.rejection_threshold and reject_votes > approve_votes:
            consensus.status = "REJECTED"
        else:
            # Tie or insufficient majority (e.g. 1-1 split)
            consensus.status = "DISPUTED"

    # Synchronize submission and verification status
    verification = db.query(Verification).filter(Verification.submission_id == submission_id).first()

    if consensus.status == "APPROVED":
        if submission:
            submission.status = "approved"
        if verification:
            verification.status = "verified"
            verification.notes = f"Consensus Approved ({approve_votes}/{total_votes} votes)"
        else:
            verification = Verification(
                submission_id=submission_id,
                status="verified",
                notes=f"Consensus Approved ({approve_votes}/{total_votes} votes)",
            )
            db.add(verification)
        # Settle tokens (release escrow + mint reward)
        settle_consensus(db, consensus, stake_action="refund", slashing_confirmed=False)

    elif consensus.status == "REJECTED":
        if submission:
            submission.status = "rejected"
        if verification:
            verification.status = "rejected"
            verification.notes = f"Consensus Rejected ({reject_votes}/{total_votes} votes)"
        else:
            verification = Verification(
                submission_id=submission_id,
                status="rejected",
                notes=f"Consensus Rejected ({reject_votes}/{total_votes} votes)",
            )
            db.add(verification)
        # Standard rejection: stake refund policy, no reward
        settle_consensus(db, consensus, stake_action="refund", slashing_confirmed=False)

    elif consensus.status == "DISPUTED":
        if submission:
            submission.status = "disputed"
        if verification:
            verification.status = "disputed"
            verification.notes = f"Consensus Disputed ({flag_votes} flags, {approve_votes} approve, {reject_votes} reject)"
        else:
            verification = Verification(
                submission_id=submission_id,
                status="disputed",
                notes=f"Consensus Disputed ({flag_votes} flags, {approve_votes} approve, {reject_votes} reject)",
            )
            db.add(verification)

    return consensus


def settle_consensus(
    db: Session,
    consensus: ConsensusRecord,
    stake_action: str = "refund",
    slashing_confirmed: bool = False,
    admin_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute exactly-once token ledger settlement with row-level transaction safety."""
    if consensus.settlement_status == "settled":
        return {"status": "already_settled", "message": "Consensus has already been settled"}

    submission = (
        db.query(Submission)
        .filter(Submission.id == consensus.submission_id)
        .with_for_update()
        .first()
    )
    if not submission:
        return {"status": "error", "message": "Submission not found"}

    task = db.query(Task).filter(Task.id == submission.task_id).first()
    claim = (
        db.query(TaskClaim)
        .filter(TaskClaim.task_id == submission.task_id, TaskClaim.user_id == submission.user_id)
        .with_for_update()
        .first()
    )
    token_account = (
        db.query(TokenAccount)
        .filter(TokenAccount.user_id == submission.user_id)
        .with_for_update()
        .first()
    )

    if not token_account:
        return {"status": "error", "message": "Token account not found"}

    now_time = datetime.now(timezone.utc)

    if consensus.status == "APPROVED":
        # 1. Unlock commitment stake from escrow back to available balance
        if claim and claim.status in ["claimed", "in_progress", "submitted"]:
            stake_to_unlock = claim.stake_amount
            token_account.locked_balance = max(0, token_account.locked_balance - stake_to_unlock)
            token_account.available_balance += stake_to_unlock

            tx_stake = TokenTransaction(
                token_account_id=token_account.id,
                transaction_type="stake_return",
                amount=stake_to_unlock,
                reference_type="task_claim",
                reference_id=str(claim.id),
            )
            db.add(tx_stake)
            claim.status = "released"
            claim.completed_at = now_time

        # 2. Mint dynamic reward
        base = task.base_reward if task else 50
        diff = task.difficulty if task else 1.0
        scarcity = task.scarcity if task else 1.0
        quality = 1.0
        calculated_reward = int(round(base * diff * scarcity * quality))

        reward = db.query(Reward).filter(Reward.submission_id == submission.id).first()
        if not reward:
            reward = Reward(
                submission_id=submission.id,
                base_value=base,
                difficulty_factor=diff,
                scarcity_factor=scarcity,
                quality_factor=quality,
                calculated_reward=calculated_reward,
                status="granted",
            )
            db.add(reward)
        else:
            reward.status = "granted"
            reward.calculated_reward = calculated_reward

        token_account.available_balance += calculated_reward
        tx_reward = TokenTransaction(
            token_account_id=token_account.id,
            transaction_type="reward_payout",
            amount=calculated_reward,
            reference_type="submission",
            reference_id=str(submission.id),
        )
        db.add(tx_reward)

        # 3. Disburse reviewer bounties to majority approving reviewers
        bounty = settings.CONSENSUS_REVIEWER_BOUNTY
        approving_reviews = (
            db.query(PeerReview)
            .filter(PeerReview.submission_id == submission.id, PeerReview.decision == "APPROVE")
            .all()
        )
        for r in approving_reviews:
            rev_account = (
                db.query(TokenAccount)
                .filter(TokenAccount.user_id == r.reviewer_id)
                .with_for_update()
                .first()
            )
            if rev_account:
                rev_account.available_balance += bounty
                tx_rev = TokenTransaction(
                    token_account_id=rev_account.id,
                    transaction_type="reviewer_reward",
                    amount=bounty,
                    reference_type="peer_review",
                    reference_id=str(r.id),
                )
                db.add(tx_rev)

        # 4. Improve contributor reputation
        rep = db.query(Reputation).filter(Reputation.user_id == submission.user_id).first()
        if rep:
            rep.score = min(100.0, rep.score + 5.0)

        consensus.settlement_status = "settled"
        consensus.settled_at = now_time
        if admin_notes:
            consensus.resolution_notes = admin_notes

    elif consensus.status == "REJECTED":
        if slashing_confirmed or stake_action == "slash":
            # CONFIRMED FRAUDULENT SLASHING
            if claim and claim.status in ["claimed", "in_progress", "submitted"]:
                slash_amount = claim.stake_amount
                token_account.locked_balance = max(0, token_account.locked_balance - slash_amount)
                
                tx_slash = TokenTransaction(
                    token_account_id=token_account.id,
                    transaction_type="stake_slashing",
                    amount=-slash_amount,
                    reference_type="submission",
                    reference_id=str(submission.id),
                )
                db.add(tx_slash)
                claim.status = "forfeited"
                claim.completed_at = now_time

            # Penalize reputation
            rep = db.query(Reputation).filter(Reputation.user_id == submission.user_id).first()
            if rep:
                rep.score = max(0.0, rep.score - settings.CONSENSUS_SLASH_PENALTY_SCORE)
        else:
            # STANDARD QUALITY REJECTION: Refund commitment stake in good faith
            if claim and claim.status in ["claimed", "in_progress", "submitted"]:
                stake_to_refund = claim.stake_amount
                token_account.locked_balance = max(0, token_account.locked_balance - stake_to_refund)
                token_account.available_balance += stake_to_refund

                tx_stake = TokenTransaction(
                    token_account_id=token_account.id,
                    transaction_type="stake_return",
                    amount=stake_to_refund,
                    reference_type="task_claim",
                    reference_id=str(claim.id),
                )
                db.add(tx_stake)
                claim.status = "released"
                claim.completed_at = now_time

        # Disburse reviewer bounties to majority rejecting reviewers
        bounty = settings.CONSENSUS_REVIEWER_BOUNTY
        rejecting_reviews = (
            db.query(PeerReview)
            .filter(PeerReview.submission_id == submission.id, PeerReview.decision == "REJECT")
            .all()
        )
        for r in rejecting_reviews:
            rev_account = (
                db.query(TokenAccount)
                .filter(TokenAccount.user_id == r.reviewer_id)
                .with_for_update()
                .first()
            )
            if rev_account:
                rev_account.available_balance += bounty
                tx_rev = TokenTransaction(
                    token_account_id=rev_account.id,
                    transaction_type="reviewer_reward",
                    amount=bounty,
                    reference_type="peer_review",
                    reference_id=str(r.id),
                )
                db.add(tx_rev)

        consensus.settlement_status = "settled"
        consensus.settled_at = now_time
        if admin_notes:
            consensus.resolution_notes = admin_notes

    db.flush()
    return {"status": "settled", "consensus_status": consensus.status}


def raise_submission_dispute(
    db: Session,
    submission_id: uuid.UUID,
    user: User,
    reason: str,
) -> ConsensusRecord:
    """Flag a contribution or consensus outcome for administrative review and dispute resolution."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": f"Submission {submission_id} not found"},
        )

    # Submitter, assigned reviewer, or admin can raise dispute
    is_author = (submission.user_id == user.id)
    is_admin = (user.role == "admin")
    is_reviewer = (user.role == "reviewer")

    if not (is_author or is_admin or is_reviewer):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only the contributor, reviewer, or admin may raise a dispute"},
        )

    if not reason or len(reason.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "REASON_REQUIRED", "message": "Dispute reason must be at least 5 characters"},
        )

    consensus = (
        db.query(ConsensusRecord)
        .filter(ConsensusRecord.submission_id == submission_id)
        .with_for_update()
        .first()
    )
    if not consensus:
        consensus = get_or_create_consensus_record(db, submission_id)

    now_time = datetime.now(timezone.utc)
    consensus.status = "DISPUTED"
    consensus.dispute_reason = reason.strip()
    consensus.disputed_by = user.id
    consensus.disputed_at = now_time
    consensus.settlement_status = "disputed"

    submission.status = "disputed"

    verification = db.query(Verification).filter(Verification.submission_id == submission_id).first()
    if verification:
        verification.status = "disputed"
        verification.notes = f"Dispute opened by {user.username}: {reason.strip()}"
    else:
        verification = Verification(
            submission_id=submission_id,
            status="disputed",
            notes=f"Dispute opened by {user.username}: {reason.strip()}",
        )
        db.add(verification)

    db.commit()
    db.refresh(consensus)
    return consensus


def resolve_submission_dispute(
    db: Session,
    submission_id: uuid.UUID,
    admin_user: User,
    resolve_action: str,
    notes: str,
) -> ConsensusRecord:
    """Administrator issues final authoritative resolution on a disputed contribution."""
    if admin_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_REQUIRED", "message": "Only an administrator can resolve submission disputes"},
        )

    action = resolve_action.lower().strip()
    if action not in ["approve", "reject_refund", "reject_slash"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INVALID_ACTION",
                "message": "Resolution action must be 'approve', 'reject_refund', or 'reject_slash'",
            },
        )

    if not notes or len(notes.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "NOTES_REQUIRED", "message": "Resolution notes must be at least 5 characters"},
        )

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SUBMISSION_NOT_FOUND", "message": f"Submission {submission_id} not found"},
        )

    consensus = (
        db.query(ConsensusRecord)
        .filter(ConsensusRecord.submission_id == submission_id)
        .with_for_update()
        .first()
    )
    if not consensus:
        consensus = get_or_create_consensus_record(db, submission_id)

    now_time = datetime.now(timezone.utc)
    consensus.resolved_by = admin_user.id
    consensus.resolved_at = now_time
    consensus.resolution_notes = notes.strip()

    verification = db.query(Verification).filter(Verification.submission_id == submission_id).first()

    if action == "approve":
        consensus.status = "APPROVED"
        submission.status = "approved"
        if verification:
            verification.status = "verified"
            verification.reviewer_id = admin_user.id
            verification.notes = f"Dispute resolved (Approved): {notes.strip()}"
        settle_consensus(db, consensus, stake_action="refund", slashing_confirmed=False, admin_notes=notes)

    elif action == "reject_refund":
        consensus.status = "REJECTED"
        submission.status = "rejected"
        if verification:
            verification.status = "rejected"
            verification.reviewer_id = admin_user.id
            verification.notes = f"Dispute resolved (Rejected, Stake Refunded): {notes.strip()}"
        settle_consensus(db, consensus, stake_action="refund", slashing_confirmed=False, admin_notes=notes)

    elif action == "reject_slash":
        consensus.status = "REJECTED"
        submission.status = "rejected"
        if verification:
            verification.status = "rejected"
            verification.reviewer_id = admin_user.id
            verification.notes = f"Dispute resolved (FRAUD CONFIRMED & SLASHED): {notes.strip()}"
        settle_consensus(db, consensus, stake_action="slash", slashing_confirmed=True, admin_notes=notes)

    db.commit()
    db.refresh(consensus)
    return consensus


def list_peer_reviews_for_submission(db: Session, submission_id: uuid.UUID) -> List[PeerReview]:
    """Retrieve all peer review ballots cast for a submission."""
    return (
        db.query(PeerReview)
        .filter(PeerReview.submission_id == submission_id)
        .order_by(PeerReview.created_at.asc())
        .all()
    )


def list_assignments_for_submission(db: Session, submission_id: uuid.UUID) -> List[PeerReviewAssignment]:
    """Retrieve all reviewer assignments for a submission."""
    return (
        db.query(PeerReviewAssignment)
        .filter(PeerReviewAssignment.submission_id == submission_id)
        .order_by(PeerReviewAssignment.assigned_at.asc())
        .all()
    )


def list_assigned_submissions_for_user(db: Session, user_id: uuid.UUID) -> List[Submission]:
    """Retrieve all submissions pending peer review by the authenticated reviewer."""
    assignments = (
        db.query(PeerReviewAssignment)
        .filter(PeerReviewAssignment.reviewer_id == user_id, PeerReviewAssignment.status == "assigned")
        .all()
    )
    sub_ids = [a.submission_id for a in assignments]
    if not sub_ids:
        return []
    return db.query(Submission).filter(Submission.id.in_(sub_ids)).order_by(desc(Submission.captured_at)).all()
