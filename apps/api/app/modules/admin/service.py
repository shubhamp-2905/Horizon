import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_, desc, asc

from app.database.models.user import User
from app.database.models.token import TokenAccount, TokenTransaction
from app.database.models.task import Task
from app.database.models.task_claim import TaskClaim
from app.database.models.submission import Submission
from app.database.models.consensus import PeerReview
from app.schemas.admin import (
    MemberLocationInfo,
    MemberSummaryResponse,
    MemberListResponse,
    MemberOverviewStatsResponse,
    MemberDetailResponse,
    MemberTransactionItem,
    MemberClaimItem,
    MemberSubmissionItem,
)
from geoalchemy2.shape import to_shape
from shapely.geometry import Point

AWARD_TRANSACTION_TYPES = ["reward_payout", "reward", "reviewer_reward", "starter_grant"]


def _extract_coordinates(location_point) -> Tuple[Optional[float], Optional[float]]:
    """Safely extract (latitude, longitude) from a PostGIS / SpatiaLite geometry column."""
    if location_point is None:
        return None, None
    try:
        shape = to_shape(location_point)
        if isinstance(shape, Point):
            return round(shape.y, 6), round(shape.x, 6)
    except Exception:
        pass
    return None, None


def _resolve_member_location(user: User, latest_sub: Optional[Submission] = None) -> MemberLocationInfo:
    """
    Resolve member location following the strict hierarchy:
    1. Explicitly provided member profile location.
    2. Recent, permissioned location attached to a field activity or task submission.
    3. Fallback to 'Not available'.
    """
    profile = user.profile_data or {}
    
    # 1. Profile location
    profile_loc = profile.get("location") or profile.get("city")
    if profile_loc and str(profile_loc).strip():
        country = profile.get("country")
        text = f"{profile_loc}, {country}" if country else str(profile_loc)
        return MemberLocationInfo(
            type="profile",
            display_text=text,
            context="Member user profile",
        )

    # 2. Field observation location
    if latest_sub and latest_sub.location is not None:
        lat, lng = _extract_coordinates(latest_sub.location)
        if lat is not None and lng is not None:
            time_str = latest_sub.captured_at.strftime("%b %d, %Y") if latest_sub.captured_at else "recently"
            return MemberLocationInfo(
                type="field_observation",
                display_text=f"Last field location: {lat:.4f}, {lng:.4f} ({time_str})",
                latitude=lat,
                longitude=lng,
                updated_at=latest_sub.captured_at.isoformat() if latest_sub.captured_at else None,
                context="Last recorded field survey observation",
            )

    # 3. Fallback
    return MemberLocationInfo(
        type="none",
        display_text="Not available",
        context="No profile or field observation location recorded",
    )


def get_admin_member_stats(db: Session) -> MemberOverviewStatsResponse:
    """Top-level aggregate statistics across all registered non-admin community members."""
    total_registered = db.query(User).filter(User.role != "admin").count()

    cutoff_30d = datetime.now(timezone.utc) - timedelta(days=30)

    # Find users active in last 30 days across submissions, claims, peer reviews, or recent registration
    active_user_ids = set()

    # Submissions in last 30 days
    sub_users = (
        db.query(Submission.user_id)
        .join(User, Submission.user_id == User.id)
        .filter(User.role != "admin", Submission.submitted_at >= cutoff_30d)
        .distinct()
        .all()
    )
    for row in sub_users:
        active_user_ids.add(row[0])

    # Claims in last 30 days
    claim_users = (
        db.query(TaskClaim.user_id)
        .join(User, TaskClaim.user_id == User.id)
        .filter(User.role != "admin", TaskClaim.claimed_at >= cutoff_30d)
        .distinct()
        .all()
    )
    for row in claim_users:
        active_user_ids.add(row[0])

    # Peer reviews in last 30 days
    rev_users = (
        db.query(PeerReview.reviewer_id)
        .join(User, PeerReview.reviewer_id == User.id)
        .filter(User.role != "admin", PeerReview.created_at >= cutoff_30d)
        .distinct()
        .all()
    )
    for row in rev_users:
        active_user_ids.add(row[0])

    # Users registered in last 30 days
    recent_users = (
        db.query(User.id)
        .filter(User.role != "admin", User.created_at >= cutoff_30d)
        .all()
    )
    for row in recent_users:
        active_user_ids.add(row[0])

    # Members who have received TKN awards
    members_awarded_count = (
        db.query(func.count(func.distinct(TokenAccount.user_id)))
        .select_from(TokenAccount)
        .join(TokenTransaction, TokenAccount.id == TokenTransaction.token_account_id)
        .join(User, TokenAccount.user_id == User.id)
        .filter(
            User.role != "admin",
            TokenTransaction.transaction_type.in_(AWARD_TRANSACTION_TYPES),
            TokenTransaction.amount > 0,
        )
        .scalar()
    ) or 0

    return MemberOverviewStatsResponse(
        total_registered_members=total_registered,
        active_recently_count=len(active_user_ids),
        recent_activity_window_days=30,
        members_awarded_tkn_count=int(members_awarded_count),
        online_members_count=None,  # Real-time online heartbeat not implemented without WebSocket session tracking
    )


def list_admin_members(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    q: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> MemberListResponse:
    """List and paginate non-admin members with search, filters, and pre-aggregated statistics."""
    query = db.query(User).filter(User.role != "admin")

    # Search filter
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.username.ilike(term),
                User.email.ilike(term),
                User.display_name.ilike(term),
            )
        )

    # Status filter
    if status and status.strip() and status != "all":
        query = query.filter(User.status == status.strip())

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    # Sorting
    if sort_by == "username":
        order_col = User.username.desc() if sort_order == "desc" else User.username.asc()
        query = query.order_by(order_col)
    elif sort_by == "email":
        order_col = User.email.desc() if sort_order == "desc" else User.email.asc()
        query = query.order_by(order_col)
    else:  # default "created_at"
        order_col = User.created_at.desc() if sort_order == "desc" else User.created_at.asc()
        query = query.order_by(order_col)

    users = query.offset((page - 1) * page_size).limit(page_size).all()
    if not users:
        return MemberListResponse(
            members=[],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    user_ids = [u.id for u in users]

    # Pre-fetch token accounts (1 query)
    accounts = db.query(TokenAccount).filter(TokenAccount.user_id.in_(user_ids)).all()
    account_map = {a.user_id: a for a in accounts}

    # Pre-fetch claims stats (1 query)
    claims_data = (
        db.query(
            TaskClaim.user_id,
            func.count(TaskClaim.id).label("claimed_count"),
            func.sum(case((TaskClaim.status.in_(["completed", "released"]), 1), else_=0)).label("completed_count"),
            func.max(TaskClaim.claimed_at).label("last_claimed_at"),
        )
        .filter(TaskClaim.user_id.in_(user_ids))
        .group_by(TaskClaim.user_id)
        .all()
    )
    claims_map = {
        row[0]: {
            "claimed": int(row[1] or 0),
            "completed": int(row[2] or 0),
            "last_claim": row[3],
        }
        for row in claims_data
    }

    # Pre-fetch submissions stats (1 query)
    subs_data = (
        db.query(
            Submission.user_id,
            func.count(Submission.id).label("total_count"),
            func.sum(case((Submission.status.in_(["approved", "verified"]), 1), else_=0)).label("approved_count"),
            func.max(Submission.submitted_at).label("last_submitted_at"),
        )
        .filter(Submission.user_id.in_(user_ids))
        .group_by(Submission.user_id)
        .all()
    )
    subs_map = {
        row[0]: {
            "total": int(row[1] or 0),
            "approved": int(row[2] or 0),
            "last_sub": row[3],
        }
        for row in subs_data
    }

    # Pre-fetch latest submission location per user (1 query)
    geo_subs = (
        db.query(Submission)
        .filter(Submission.user_id.in_(user_ids), Submission.location.isnot(None))
        .order_by(Submission.user_id, Submission.captured_at.desc())
        .all()
    )
    latest_geo_sub_map: Dict[uuid.UUID, Submission] = {}
    for s in geo_subs:
        if s.user_id not in latest_geo_sub_map:
            latest_geo_sub_map[s.user_id] = s

    # Pre-fetch latest peer reviews (1 query)
    rev_data = (
        db.query(
            PeerReview.reviewer_id,
            func.max(PeerReview.created_at).label("last_rev_at"),
        )
        .filter(PeerReview.reviewer_id.in_(user_ids))
        .group_by(PeerReview.reviewer_id)
        .all()
    )
    rev_map = {row[0]: row[1] for row in rev_data}

    # Assemble response items
    members_list: List[MemberSummaryResponse] = []
    for u in users:
        acc = account_map.get(u.id)
        avail = acc.available_balance if acc else 0
        locked = acc.locked_balance if acc else 0
        total_balance = avail + locked

        c_info = claims_map.get(u.id, {"claimed": 0, "completed": 0, "last_claim": None})
        s_info = subs_map.get(u.id, {"total": 0, "approved": 0, "last_sub": None})
        last_rev = rev_map.get(u.id)

        # Determine last activity
        activity_candidates = []
        if s_info.get("last_sub"):
            activity_candidates.append((s_info["last_sub"], "submission"))
        if c_info.get("last_claim"):
            activity_candidates.append((c_info["last_claim"], "task_claim"))
        if last_rev:
            activity_candidates.append((last_rev, "peer_review"))
        if u.updated_at and u.updated_at != u.created_at:
            activity_candidates.append((u.updated_at, "profile_update"))

        if activity_candidates:
            # Sort by datetime desc
            activity_candidates.sort(key=lambda x: x[0] if x[0] else datetime.min.replace(tzinfo=timezone.utc), reverse=True)
            last_act_dt, last_act_source = activity_candidates[0]
            last_act_str = last_act_dt.isoformat() if last_act_dt else None
        else:
            last_act_str = None
            last_act_source = "never_active"

        loc = _resolve_member_location(u, latest_geo_sub_map.get(u.id))

        members_list.append(
            MemberSummaryResponse(
                id=str(u.id),
                email=u.email,
                username=u.username,
                display_name=u.display_name,
                status=u.status,
                role=u.role,
                avatar_url=u.avatar_url,
                joined_at=u.created_at.isoformat() if u.created_at else "",
                tkn_balance=total_balance,
                available_balance=avail,
                locked_balance=locked,
                tasks_claimed_count=c_info["claimed"],
                tasks_completed_count=c_info["completed"],
                submissions_count=s_info["total"],
                approved_submissions_count=s_info["approved"],
                last_active_at=last_act_str,
                last_active_source=last_act_source,
                location=loc,
            )
        )

    return MemberListResponse(
        members=members_list,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


def get_admin_member_detail(db: Session, member_id: uuid.UUID) -> MemberDetailResponse:
    """Retrieve in-depth member profile, ledger transactions, claims, submissions, and locations."""
    user = db.query(User).filter(User.id == member_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "MEMBER_NOT_FOUND", "message": "Member record does not exist"},
        )
    if user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_ACCOUNT", "message": "Administrator accounts are excluded from member management"},
        )

    # 1. Token account & transactions
    acc = db.query(TokenAccount).filter(TokenAccount.user_id == user.id).first()
    avail = acc.available_balance if acc else 0
    locked = acc.locked_balance if acc else 0
    total_balance = avail + locked

    transactions_list: List[MemberTransactionItem] = []
    if acc:
        txs = (
            db.query(TokenTransaction)
            .filter(TokenTransaction.token_account_id == acc.id)
            .order_by(TokenTransaction.created_at.desc())
            .all()
        )
        for t in txs:
            direction = "in" if t.amount > 0 else "out"
            transactions_list.append(
                MemberTransactionItem(
                    id=str(t.id),
                    transaction_type=t.transaction_type,
                    amount=abs(t.amount),
                    direction=direction,
                    reference_type=t.reference_type,
                    reference_id=t.reference_id,
                    created_at=t.created_at.isoformat() if t.created_at else None,
                    description=f"{t.transaction_type}: {'+' if t.amount > 0 else '-'}{abs(t.amount)} TKN",
                )
            )

    # 2. Task claims
    claims = (
        db.query(TaskClaim)
        .join(Task, TaskClaim.task_id == Task.id)
        .filter(TaskClaim.user_id == user.id)
        .order_by(TaskClaim.claimed_at.desc())
        .all()
    )
    claims_list: List[MemberClaimItem] = []
    completed_claims_count = 0
    for c in claims:
        if c.status in ["completed", "released"]:
            completed_claims_count += 1
        claims_list.append(
            MemberClaimItem(
                id=str(c.id),
                task_id=str(c.task_id),
                task_title=c.task.title if c.task else "Task Observation",
                status=c.status,
                stake_amount=c.stake_amount,
                claimed_at=c.claimed_at.isoformat() if c.claimed_at else "",
                completed_at=c.completed_at.isoformat() if c.completed_at else None,
            )
        )

    # 3. Submissions
    subs = (
        db.query(Submission)
        .join(Task, Submission.task_id == Task.id)
        .filter(Submission.user_id == user.id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    subs_list: List[MemberSubmissionItem] = []
    approved_subs_count = 0
    latest_geo_sub: Optional[Submission] = None

    for s in subs:
        if s.status in ["approved", "verified"]:
            approved_subs_count += 1
        if s.location is not None and latest_geo_sub is None:
            latest_geo_sub = s

        subs_list.append(
            MemberSubmissionItem(
                id=str(s.id),
                task_id=str(s.task_id),
                task_title=s.task.title if s.task else "Geospatial Observation",
                status=s.status,
                gps_accuracy=s.gps_accuracy,
                captured_at=s.captured_at.isoformat() if s.captured_at else "",
                submitted_at=s.submitted_at.isoformat() if s.submitted_at else None,
                verification_status=s.status,
            )
        )

    # 4. Resolve location
    loc = _resolve_member_location(user, latest_geo_sub)

    # 5. Last active calculation
    activity_candidates = []
    if subs:
        latest_sub_dt = max(
            [s.submitted_at or s.captured_at for s in subs if s.submitted_at or s.captured_at],
            default=None,
        )
        if latest_sub_dt:
            activity_candidates.append((latest_sub_dt, "submission"))
    if claims:
        latest_claim_dt = max([c.claimed_at for c in claims if c.claimed_at], default=None)
        if latest_claim_dt:
            activity_candidates.append((latest_claim_dt, "task_claim"))
    # Check user-initiated token transactions (exclude system bootstrap starter grant)
    user_txs = [t for t in txs if t.transaction_type != "starter_grant" and t.reference_type != "system_bootstrap"]
    if user_txs and user_txs[0].created_at:
        activity_candidates.append((user_txs[0].created_at, "token_transaction"))

    # Check peer reviews
    latest_rev_dt = (
        db.query(func.max(PeerReview.created_at))
        .filter(PeerReview.reviewer_id == user.id)
        .scalar()
    )
    if latest_rev_dt:
        activity_candidates.append((latest_rev_dt, "peer_review"))

    if user.updated_at and user.updated_at != user.created_at:
        activity_candidates.append((user.updated_at, "profile_update"))

    if activity_candidates:
        activity_candidates.sort(key=lambda x: x[0] if x[0] else datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        last_act_dt, last_act_source = activity_candidates[0]
        last_act_str = last_act_dt.isoformat() if last_act_dt else None
    else:
        last_act_str = None
        last_act_source = "never_active"

    return MemberDetailResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        status=user.status,
        role=user.role,
        avatar_url=user.avatar_url,
        joined_at=user.created_at.isoformat() if user.created_at else "",
        updated_at=user.updated_at.isoformat() if user.updated_at else None,
        profile_data=user.profile_data or {},
        tkn_balance=total_balance,
        available_balance=avail,
        locked_balance=locked,
        tasks_claimed_count=len(claims),
        tasks_completed_count=completed_claims_count,
        submissions_count=len(subs),
        approved_submissions_count=approved_subs_count,
        last_active_at=last_act_str,
        last_active_source=last_act_source,
        location=loc,
        transactions=transactions_list,
        claims=claims_list,
        submissions=subs_list,
    )
