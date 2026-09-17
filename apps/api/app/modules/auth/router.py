from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models.user import User
from app.database.models.reputation import Reputation
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, TokenResponse, UserProfileResponse
from app.modules.tokens.service import grant_starter_tokens_idempotent

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_profile_response(user: User, db: Session) -> UserProfileResponse:
    account = user.token_account
    available = account.available_balance if account else 0
    locked = account.locked_balance if account else 0
    rep = db.query(Reputation).filter(Reputation.user_id == user.id).first()
    reputation_score = rep.score if rep else 100.0

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        status=user.status,
        available_tokens=available,
        locked_tokens=locked,
        total_tokens=available + locked,
        reputation_score=reputation_score,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """Register a new platform contributor or admin, granting initial Starter Tokens."""
    # Check uniqueness
    existing_user = (
        db.query(User)
        .filter((User.email == payload.email) | (User.username == payload.username))
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "USER_ALREADY_EXISTS", "message": "Email or username is already registered"},
        )

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        display_name=payload.display_name or payload.username,
        role=payload.role or "contributor",
        status="active",
    )
    db.add(user)
    db.flush()

    # Idempotently grant initial Starter Tokens (creates TokenAccount + Ledger entry)
    grant_starter_tokens_idempotent(db, user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_build_profile_response(user, db),
    )


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticate contributor or admin credentials and return signed JWT."""
    user = (
        db.query(User)
        .filter((User.email == payload.email_or_username) | (User.username == payload.email_or_username))
        .first()
    )
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email/username or password"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ACCOUNT_INACTIVE", "message": "User account is suspended or inactive"},
        )

    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_build_profile_response(user, db),
    )


@router.post("/logout")
def logout_user():
    """Client-side token invalidation acknowledgment for MVP."""
    return {"status": "ok", "message": "Successfully logged out"}


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve current authenticated user profile with real-time token balances."""
    return _build_profile_response(current_user, db)
