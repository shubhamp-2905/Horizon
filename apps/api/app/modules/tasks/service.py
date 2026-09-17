import uuid
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, desc, asc
from geoalchemy2 import Geography
from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape, from_shape
from shapely.geometry import Point
from app.database.models.task import Task
from app.database.models.task_claim import TaskClaim
from app.database.models.user import User
from app.schemas.tasks import TaskCreateRequest, TaskUpdateRequest, TaskResponse
from app.modules.tokens.service import lock_task_stake
from app.utils.geo import haversine_distance_meters


def _extract_coordinates(location_point) -> Tuple[Optional[float], Optional[float]]:
    """Safely extract (latitude, longitude) from a PostGIS geometry column."""
    if location_point is None:
        return None, None
    try:
        shape = to_shape(location_point)
        if isinstance(shape, Point):
            return shape.y, shape.x
    except Exception:
        pass
    return None, None


def _task_to_response(task: Task, distance_meters: Optional[float] = None) -> TaskResponse:
    lat, lng = _extract_coordinates(task.location_point)
    return TaskResponse(
        id=str(task.id),
        title=task.title,
        description=task.description,
        artifact_type=task.artifact_type,
        status=task.status,
        difficulty=task.difficulty,
        scarcity=task.scarcity,
        base_reward=task.base_reward,
        commitment_stake=task.commitment_stake,
        estimated_effort_minutes=task.estimated_effort_minutes or 30,
        requirements=task.requirements or [],
        latitude=lat,
        longitude=lng,
        distance_meters=round(distance_meters, 1) if distance_meters is not None else None,
        created_at=task.created_at.isoformat() if task.created_at else "",
    )


def create_task_record(db: Session, payload: TaskCreateRequest) -> Task:
    """Create a new task with PostGIS spatial point."""
    point_geom = from_shape(Point(payload.longitude, payload.latitude), srid=4326)
    task = Task(
        title=payload.title,
        description=payload.description,
        artifact_type=payload.artifact_type,
        status=payload.status,
        difficulty=payload.difficulty,
        scarcity=payload.scarcity,
        base_reward=payload.base_reward,
        commitment_stake=payload.commitment_stake,
        estimated_effort_minutes=payload.estimated_effort_minutes,
        requirements=payload.requirements,
        location_point=point_geom,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task_record(db: Session, task_id: uuid.UUID, payload: TaskUpdateRequest) -> Task:
    """Update task metadata or change lifecycle status (e.g. publish/unpublish)."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": f"Task {task_id} not found"},
        )

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, val)

    db.commit()
    db.refresh(task)
    return task


def discover_tasks(
    db: Session,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: float = 5000.0,
    artifact_type: Optional[str] = None,
    difficulty: Optional[float] = None,
    page: int = 1,
    page_size: int = 20,
    is_admin: bool = False,
) -> Tuple[List[TaskResponse], int]:
    """Discover published tasks using PostGIS spatial queries with radius filtering and proximity ordering."""
    query = db.query(Task)
    
    # Non-admin contributors can ONLY discover published tasks
    if not is_admin:
        query = query.filter(Task.status == "published")

    if artifact_type:
        query = query.filter(Task.artifact_type == artifact_type)
    if difficulty:
        query = query.filter(Task.difficulty <= difficulty)

    is_sqlite = db.bind.dialect.name == "sqlite"

    if lat is not None and lng is not None:
        if not is_sqlite:
            # Native PostgreSQL + PostGIS spatial search
            point_geom = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)
            query = query.filter(
                func.ST_DWithin(
                    cast(Task.location_point, Geography),
                    cast(point_geom, Geography),
                    radius,
                )
            )
            # Order by geographic proximity
            query = query.order_by(
                func.ST_Distance(
                    cast(Task.location_point, Geography),
                    cast(point_geom, Geography),
                )
            )
            total = query.count()
            tasks = query.offset((page - 1) * page_size).limit(page_size).all()
            
            # Compute distance for display
            results = []
            for t in tasks:
                t_lat, t_lng = _extract_coordinates(t.location_point)
                dist = haversine_distance_meters(lat, lng, t_lat, t_lng) if (t_lat and t_lng) else None
                results.append(_task_to_response(t, distance_meters=dist))
            return results, total
        else:
            # Fallback for SQLite in-memory test environment
            all_tasks = query.all()
            filtered_with_dist = []
            for t in all_tasks:
                t_lat, t_lng = _extract_coordinates(t.location_point)
                if t_lat is not None and t_lng is not None:
                    dist = haversine_distance_meters(lat, lng, t_lat, t_lng)
                    if dist <= radius:
                        filtered_with_dist.append((t, dist))
            
            filtered_with_dist.sort(key=lambda x: x[1])
            total = len(filtered_with_dist)
            paginated = filtered_with_dist[(page - 1) * page_size : page * page_size]
            results = [_task_to_response(t, distance_meters=d) for t, d in paginated]
            return results, total

    # No coordinates provided: simple paginated list
    total = query.count()
    tasks = query.order_by(desc(Task.created_at)).offset((page - 1) * page_size).limit(page_size).all()
    return [_task_to_response(t) for t in tasks], total


def get_task_details(db: Session, task_id: uuid.UUID, lat: Optional[float] = None, lng: Optional[float] = None) -> TaskResponse:
    """Retrieve detailed task information for a contributor or admin."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": f"Task {task_id} not found"},
        )
    
    distance = None
    if lat is not None and lng is not None:
        t_lat, t_lng = _extract_coordinates(task.location_point)
        if t_lat and t_lng:
            distance = haversine_distance_meters(lat, lng, t_lat, t_lng)

    return _task_to_response(task, distance_meters=distance)


def claim_task_atomic(db: Session, task_id: uuid.UUID, user: User):
    """Atomically commit to and claim a published task, locking commitment stake in escrow."""
    # 1. Verify task exists and is published
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": "Task does not exist"},
        )

    if task.status != "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TASK_NOT_PUBLISHED", "message": f"Task cannot be claimed in '{task.status}' status"},
        )

    # 2. Check for duplicate active claim
    existing_claim = (
        db.query(TaskClaim)
        .filter(
            TaskClaim.task_id == task_id,
            TaskClaim.user_id == user.id,
            TaskClaim.status == "claimed",
        )
        .first()
    )
    if existing_claim:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "TASK_ALREADY_CLAIMED",
                "message": "You already have an active commitment on this task",
            },
        )

    # 3. Lock commitment stake tokens atomically
    account = lock_task_stake(db, user.id, task.id, task.commitment_stake)

    # 4. Create TaskClaim record
    claim = TaskClaim(
        task_id=task.id,
        user_id=user.id,
        stake_amount=task.commitment_stake,
        status="claimed",
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    db.refresh(account)

    return {
        "claim_id": str(claim.id),
        "task_id": str(task.id),
        "user_id": str(user.id),
        "stake_amount": claim.stake_amount,
        "status": claim.status,
        "claimed_at": claim.claimed_at.isoformat() if claim.claimed_at else datetime.now(timezone.utc).isoformat(),
        "available_tokens": account.available_balance,
        "locked_tokens": account.locked_balance,
    }


def get_user_claimed_tasks(db: Session, user_id: uuid.UUID):
    """Fetch tasks currently claimed by the authenticated contributor."""
    claims = (
        db.query(TaskClaim)
        .join(Task, TaskClaim.task_id == Task.id)
        .filter(TaskClaim.user_id == user_id)
        .order_by(desc(TaskClaim.claimed_at))
        .all()
    )

    results = []
    for c in claims:
        task_data = _task_to_response(c.task)
        results.append({
            "claim_id": str(c.id),
            "status": c.status,
            "stake_amount": c.stake_amount,
            "claimed_at": c.claimed_at.isoformat() if c.claimed_at else None,
            "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            "task": task_data.model_dump(),
        })
    return results
