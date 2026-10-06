import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models.user import User
from app.core.security import require_role
from app.schemas.tasks import TaskCreateRequest, TaskUpdateRequest, TaskResponse, TaskListResponse
from app.modules.tasks.service import (
    create_task_record,
    update_task_record,
    discover_tasks,
    get_task_details,
)

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

    total_tasks = db.query(Task).count()
    active_tasks = db.query(Task).filter(Task.status == "published").count()

    total_submissions = db.query(Submission).count()
    pending_submissions = db.query(Submission).filter(Submission.status.in_(["submitted", "validating", "under_review", "pending"])).count()
    awaiting_review = db.query(Submission).filter(Submission.status.in_(["submitted", "under_review"])).count()
    approved_count = db.query(Submission).filter(Submission.status.in_(["approved", "verified"])).count()
    rejected_count = db.query(Submission).filter(Submission.status == "rejected").count()
    flagged_count = db.query(Submission).filter(Submission.status == "flagged").count()

    # Also check verification records
    if approved_count == 0:
        approved_count = db.query(Verification).filter(Verification.status == "approved").count()
    if rejected_count == 0:
        rejected_count = db.query(Verification).filter(Verification.status == "rejected").count()

    total_contributors = db.query(User).filter(User.role == "contributor").count()
    total_tokens = db.query(func.coalesce(func.sum(TokenAccount.available_balance + TokenAccount.locked_balance), 0)).scalar() or 0

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
    }
