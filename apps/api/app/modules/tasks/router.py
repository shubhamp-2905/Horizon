import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models.user import User
from app.core.security import get_current_user
from app.schemas.tasks import TaskResponse, TaskListResponse, TaskClaimResponse
from app.modules.tasks.service import (
    discover_tasks,
    get_task_details,
    claim_task_atomic,
    get_user_claimed_tasks,
)

router = APIRouter(tags=["Tasks"])


@router.get("/tasks", response_model=TaskListResponse)
def list_and_discover_tasks(
    lat: Optional[float] = Query(None, ge=-90, le=90, description="Contributor latitude for spatial search"),
    lng: Optional[float] = Query(None, ge=-180, le=180, description="Contributor longitude for spatial search"),
    radius: float = Query(10000.0, ge=100.0, le=100000.0, description="Search radius in meters"),
    artifact_type: Optional[str] = Query(None, description="Filter by artifact category"),
    difficulty: Optional[float] = Query(None, ge=1.0, le=5.0, description="Maximum difficulty"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Discover published geospatial tasks using PostGIS proximity search."""
    tasks, total = discover_tasks(
        db,
        lat=lat,
        lng=lng,
        radius=radius,
        artifact_type=artifact_type,
        difficulty=difficulty,
        page=page,
        page_size=page_size,
        is_admin=False,
    )
    return TaskListResponse(
        tasks=tasks,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task_by_id(
    task_id: uuid.UUID = Path(..., description="Unique UUID of the task"),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    db: Session = Depends(get_db),
):
    """Get detailed requirements, reward parameters, and commitment stake for a task."""
    return get_task_details(db, task_id, lat=lat, lng=lng)


@router.post("/tasks/{task_id}/claim", response_model=TaskClaimResponse)
def claim_task(
    task_id: uuid.UUID = Path(..., description="Task UUID to commit to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Atomically commit to a task, locking the commitment stake in server-side escrow."""
    return claim_task_atomic(db, task_id, current_user)


@router.get("/me/tasks")
def list_my_claimed_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List tasks currently claimed / committed by the authenticated contributor."""
    return get_user_claimed_tasks(db, current_user.id)
