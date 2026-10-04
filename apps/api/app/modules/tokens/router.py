from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models.user import User
from app.core.security import get_current_user, require_role
from app.modules.tokens.service import get_wallet_summary, audit_token_ledger_integrity

router = APIRouter(prefix="/wallet", tags=["Wallet & Tokens"])


@router.get("")
def get_user_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve contributor's authoritative wallet balance and ledger history."""
    return get_wallet_summary(db, current_user.id)


@router.get("/admin/audit", summary="Audit immutable token ledger integrity")
def audit_wallet_ledger(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only audit of token accounts and immutable ledger transactions for mathematical integrity."""
    return audit_token_ledger_integrity(db)


# Dedicated admin router for /admin/tokens/audit
admin_router = APIRouter(prefix="/admin/tokens", tags=["Admin Tokens & Ledger"])


@admin_router.get("/audit", summary="Audit immutable token ledger integrity")
def admin_audit_ledger(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Audit token accounts and immutable ledger transactions for mathematical integrity."""
    return audit_token_ledger_integrity(db)
