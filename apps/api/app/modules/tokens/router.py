from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models.user import User
from app.core.security import get_current_user
from app.modules.tokens.service import get_wallet_summary

router = APIRouter(prefix="/wallet", tags=["Wallet & Tokens"])


@router.get("")
def get_user_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve contributor's authoritative wallet balance and ledger history."""
    return get_wallet_summary(db, current_user.id)
