import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models.user import User
from app.core.security import require_role
from app.schemas.tasks import TaskCreateRequest, TaskUpdateRequest, TaskResponse, TaskListResponse
from app.schemas.admin import (
    MemberOverviewStatsResponse,
    MemberListResponse,
    MemberDetailResponse,
)
from app.modules.tasks.service import (
    create_task_record,
    update_task_record,
    discover_tasks,
    get_task_details,
)
from app.modules.admin.service import (
    AWARD_TRANSACTION_TYPES,
    get_admin_member_stats,
    list_admin_members,
    get_admin_member_detail,
)
from app.database.models.token import TokenAccount, TokenTransaction
from sqlalchemy import func

router = APIRouter(prefix="/admin/tasks", tags=["Admin Tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def admin_create_task(
    payload: TaskCreateRequest,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Create a new geospatial data collection task with location, reward, and stake rules."""
    task = create_task_record(db, payload)
    return get_task_details(db, task.id)


@router.get("", response_model=TaskListResponse)
def admin_list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    artifact_type: Optional[str] = Query(None),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """List all platform tasks across all statuses (draft, published, completed, archived)."""
    tasks, total = discover_tasks(
        db,
        page=page,
        page_size=page_size,
        artifact_type=artifact_type,
        is_admin=True,
    )
    return TaskListResponse(
        tasks=tasks,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{task_id}", response_model=TaskResponse)
def admin_update_task(
    payload: TaskUpdateRequest,
    task_id: uuid.UUID = Path(..., description="Task UUID to update"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Update task parameters or toggle publication status (e.g. status='published')."""
    task = update_task_record(db, task_id, payload)
    return get_task_details(db, task.id)


stats_router = APIRouter(prefix="/admin", tags=["Admin System"])


@stats_router.get("/stats")
def admin_get_system_stats(
    db: Session = Depends(get_db),
):
    """
    Get live system metrics aggregated from real Supabase database:
    - total tasks, active/published tasks
    - submissions breakdown: pending, awaiting review, approved, rejected, flagged
    - active contributors count
    - circulating token volume
    """
    from app.database.models.task import Task
    from app.database.models.submission import Submission
    from app.database.models.verification import Verification
    from app.database.models.user import User
    from app.database.models.token import TokenAccount
    from sqlalchemy import func

    task_counts_raw = (
        db.query(Task.status, func.count(Task.id))
        .group_by(Task.status)
        .all()
    )
    task_counts = {st: cnt for st, cnt in task_counts_raw}
    total_tasks = sum(task_counts.values())
    active_tasks = task_counts.get("published", 0)

    sub_counts_raw = (
        db.query(Submission.status, func.count(Submission.id))
        .group_by(Submission.status)
        .all()
    )
    sub_counts = {st: cnt for st, cnt in sub_counts_raw}
    total_submissions = sum(sub_counts.values())
    pending_submissions = (
        sub_counts.get("submitted", 0)
        + sub_counts.get("validating", 0)
        + sub_counts.get("pending_verification", 0)
    )
    awaiting_review = (
        sub_counts.get("under_review", 0)
        + sub_counts.get("pending_admin_review", 0)
    )
    approved_count = (
        sub_counts.get("approved", 0)
        + sub_counts.get("verified", 0)
    )
    rejected_count = sub_counts.get("rejected", 0)
    flagged_count = (
        sub_counts.get("flagged", 0)
        + sub_counts.get("verification_failed", 0)
        + sub_counts.get("verification_unavailable", 0)
    )

    # Check verification records if approved or rejected count is zero
    if approved_count == 0 or rejected_count == 0:
        ver_counts_raw = (
            db.query(Verification.status, func.count(Verification.id))
            .filter(Verification.status.in_(["approved", "rejected"]))
            .group_by(Verification.status)
            .all()
        )
        ver_counts = {st: cnt for st, cnt in ver_counts_raw}
        if approved_count == 0:
            approved_count = ver_counts.get("approved", 0)
        if rejected_count == 0:
            rejected_count = ver_counts.get("rejected", 0)

    total_contributors = db.query(func.count(User.id)).filter(User.role == "contributor").scalar() or 0
    total_tokens = db.query(func.coalesce(func.sum(TokenAccount.available_balance + TokenAccount.locked_balance), 0)).scalar() or 0

    # Calculate authoritative cumulative TKN distributed to non-admin members
    tkn_distributed_val = (
        db.query(func.coalesce(func.sum(TokenTransaction.amount), 0))
        .select_from(TokenTransaction)
        .join(TokenAccount, TokenTransaction.token_account_id == TokenAccount.id)
        .join(User, TokenAccount.user_id == User.id)
        .filter(
            User.role != "admin",
            TokenTransaction.transaction_type.in_(AWARD_TRANSACTION_TYPES),
            TokenTransaction.amount > 0,
        )
        .scalar()
    ) or 0

    members_awarded_val = (
        db.query(func.count(func.distinct(TokenAccount.user_id)))
        .select_from(TokenTransaction)
        .join(TokenAccount, TokenTransaction.token_account_id == TokenAccount.id)
        .join(User, TokenAccount.user_id == User.id)
        .filter(
            User.role != "admin",
            TokenTransaction.transaction_type.in_(AWARD_TRANSACTION_TYPES),
            TokenTransaction.amount > 0,
        )
        .scalar()
    ) or 0

    return {
        "total_tasks": total_tasks,
        "active_tasks": active_tasks,
        "total_submissions": total_submissions,
        "pending_submissions": pending_submissions,
        "awaiting_review": awaiting_review,
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "flagged_count": flagged_count,
        "total_contributors": total_contributors,
        "total_tokens_circulating": float(total_tokens),
        "total_tkn_distributed": int(tkn_distributed_val),
        "members_awarded_count": int(members_awarded_val),
    }


# -------------------------------------------------------------------------
# Admin Members Management Endpoints (Admin Authorization Enforced)
# -------------------------------------------------------------------------


@stats_router.get("/members/stats", response_model=MemberOverviewStatsResponse)
def admin_get_members_overview_stats(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Aggregate statistics for the admin Members management overview."""
    return get_admin_member_stats(db)


@stats_router.get("/members", response_model=MemberListResponse)
def admin_get_members_directory(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="Search by username, email, or display name"),
    query: Optional[str] = Query(None, description="Alias for q"),
    status: Optional[str] = Query(None, description="Filter by account status (e.g. active)"),
    sort_by: str = Query("created_at", description="Sort field: created_at, username, email"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """List registered Horizon community members with server-side pagination, search, and pre-aggregated activity."""
    search_term = q or query
    return list_admin_members(
        db,
        page=page,
        page_size=page_size,
        q=search_term,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@stats_router.get("/members/{member_id}", response_model=MemberDetailResponse)
def admin_get_member_profile_detail(
    member_id: uuid.UUID = Path(..., description="Target member UUID"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Inspect full member profile, authoritative TKN ledger history, task claims, and ground observations."""
    return get_admin_member_detail(db, member_id)

