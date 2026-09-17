from app.modules.tokens.service import grant_starter_tokens_idempotent
from app.database.models.user import User


def test_starter_grant_idempotency(db_session):
    user = User(
        email="idempotent_test@horizon.dev",
        username="idempotent_user",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()

    # First call grants 100
    account1 = grant_starter_tokens_idempotent(db_session, user)
    assert account1.available_balance == 100

    # Second call must NOT grant another 100
    account2 = grant_starter_tokens_idempotent(db_session, user)
    assert account2.available_balance == 100
    assert len(account2.transactions) == 1


def test_wallet_api_endpoint(client):
    # Register contributor
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "wallet_user@horizon.dev",
            "username": "wallet_user",
            "password": "Password123!",
        },
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch wallet
    wallet_resp = client.get("/api/v1/wallet", headers=headers)
    assert wallet_resp.status_code == 200
    data = wallet_resp.json()
    assert data["available_tokens"] == 100
    assert data["locked_tokens"] == 0
    assert data["total_tokens"] == 100
    assert len(data["transactions"]) == 1
    assert data["transactions"][0]["type"] == "starter_grant"
    assert data["transactions"][0]["amount"] == 100
