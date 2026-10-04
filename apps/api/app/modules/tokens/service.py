import uuid
from typing import Tuple, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.models.user import User
from app.database.models.token import TokenAccount, TokenTransaction
from app.database.models.reputation import Reputation


def grant_starter_tokens_idempotent(db: Session, user: User) -> TokenAccount:
    """Idempotently bootstrap a user's token wallet with the configured Starter Token grant."""
    # 1. Fetch or create TokenAccount
    account = db.query(TokenAccount).filter(TokenAccount.user_id == user.id).first()
    grant_amount = settings.STARTER_TOKEN_GRANT

    if not account:
        account = TokenAccount(
            user_id=user.id,
            available_balance=grant_amount,
            locked_balance=0,
        )
        db.add(account)
        db.flush()

        # Record starter grant ledger transaction
        tx = TokenTransaction(
            token_account_id=account.id,
            transaction_type="starter_grant",
            amount=grant_amount,
            reference_type="system_bootstrap",
            reference_id="welcome_starter_grant",
        )
        db.add(tx)
    else:
        # Check if grant transaction already exists
        existing_tx = (
            db.query(TokenTransaction)
            .filter(
                TokenTransaction.token_account_id == account.id,
                TokenTransaction.transaction_type == "starter_grant",
            )
            .first()
        )
        if not existing_tx:
            account.available_balance += grant_amount
            tx = TokenTransaction(
                token_account_id=account.id,
                transaction_type="starter_grant",
                amount=grant_amount,
                reference_type="system_bootstrap",
                reference_id="welcome_starter_grant",
            )
            db.add(tx)

    # 2. Ensure initial Reputation record exists
    rep = db.query(Reputation).filter(Reputation.user_id == user.id).first()
    if not rep:
        rep = Reputation(user_id=user.id, score=100.0)
        db.add(rep)

    db.flush()
    return account


def lock_task_stake(db: Session, user_id: uuid.UUID, task_id: uuid.UUID, stake_amount: int) -> TokenAccount:
    """Atomically locks the commitment stake tokens for a claimed task using row-level locking."""
    # Acquire row-level lock on the contributor's token account
    account = (
        db.query(TokenAccount)
        .filter(TokenAccount.user_id == user_id)
        .with_for_update()
        .first()
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ACCOUNT_NOT_FOUND", "message": "Token account does not exist"},
        )

    if account.available_balance < stake_amount:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INSUFFICIENT_TOKENS",
                "message": f"You do not have enough available tokens. Required: {stake_amount}, Available: {account.available_balance}",
            },
        )

    # Apply atomic state mutations
    account.available_balance -= stake_amount
    account.locked_balance += stake_amount

    # Create immutable audit ledger entry
    tx = TokenTransaction(
        token_account_id=account.id,
        transaction_type="task_stake_lock",
        amount=-stake_amount,
        reference_type="task_claim",
        reference_id=str(task_id),
    )
    db.add(tx)
    db.flush()
    return account


def get_wallet_summary(db: Session, user_id: uuid.UUID):
    """Retrieve full wallet balance summary and transaction audit history."""
    account = db.query(TokenAccount).filter(TokenAccount.user_id == user_id).first()
    if not account:
        return {
            "available_tokens": 0,
            "locked_tokens": 0,
            "total_tokens": 0,
            "transactions": [],
        }

    transactions = (
        db.query(TokenTransaction)
        .filter(TokenTransaction.token_account_id == account.id)
        .order_by(TokenTransaction.created_at.desc())
        .all()
    )

    tx_list = [
        {
            "id": str(t.id),
            "type": t.transaction_type,
            "transaction_type": t.transaction_type,
            "amount": t.amount,
            "balance_after": None,
            "description": f"{t.transaction_type}: {t.amount:+d}",
            "reference_type": t.reference_type,
            "reference_id": t.reference_id,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in transactions
    ]

    return {
        "available_balance": account.available_balance,
        "available_tokens": account.available_balance,
        "locked_balance": account.locked_balance,
        "locked_tokens": account.locked_balance,
        "total_tokens": account.available_balance + account.locked_balance,
        "transactions": tx_list,
        "recent_transactions": tx_list,
    }


def audit_token_ledger_integrity(db: Session) -> dict:
    """
    Audits the platform-wide token ledger for mathematical integrity, consistency,
    and double-spend anomalies.
    
    Checks performed:
    1. Negative balance check: available_balance >= 0 and locked_balance >= 0.
    2. Zero-value transactions: transactions with amount == 0.
    3. Orphaned transactions: transactions with non-existent token_account_id.
    4. Account-level balance verification: ensures all accounts have non-negative balances.
    5. Aggregate circulation metrics: total circulating tokens across the system.
    """
    accounts = db.query(TokenAccount).all()
    transactions = db.query(TokenTransaction).all()

    anomalies: List[dict] = []
    account_ids = {a.id for a in accounts}

    # 1. Check for orphaned transactions and zero-amount entries
    for tx in transactions:
        if tx.token_account_id not in account_ids:
            anomalies.append({
                "type": "ORPHANED_TRANSACTION",
                "transaction_id": str(tx.id),
                "token_account_id": str(tx.token_account_id),
                "amount": tx.amount,
                "message": "Transaction references a non-existent token account",
            })
        if tx.amount == 0:
            anomalies.append({
                "type": "ZERO_AMOUNT_TRANSACTION",
                "transaction_id": str(tx.id),
                "token_account_id": str(tx.token_account_id),
                "message": "Zero amount transaction detected in audit trail",
            })

    total_available = 0
    total_locked = 0

    # 2. Check each account for balance validity
    for acc in accounts:
        total_available += acc.available_balance
        total_locked += acc.locked_balance

        if acc.available_balance < 0:
            anomalies.append({
                "type": "NEGATIVE_AVAILABLE_BALANCE",
                "account_id": str(acc.id),
                "user_id": str(acc.user_id),
                "available_balance": acc.available_balance,
                "message": "Account has negative available balance",
            })
        if acc.locked_balance < 0:
            anomalies.append({
                "type": "NEGATIVE_LOCKED_BALANCE",
                "account_id": str(acc.id),
                "user_id": str(acc.user_id),
                "locked_balance": acc.locked_balance,
                "message": "Account has negative locked balance",
            })

    return {
        "status": "HEALTHY" if len(anomalies) == 0 else "ANOMALIES_DETECTED",
        "is_healthy": len(anomalies) == 0,
        "total_accounts_audited": len(accounts),
        "total_transactions_audited": len(transactions),
        "total_circulating_available": total_available,
        "total_circulating_locked": total_locked,
        "total_circulating_supply": total_available + total_locked,
        "anomaly_count": len(anomalies),
        "anomalies": anomalies,
    }
