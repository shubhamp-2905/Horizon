def test_register_and_receive_starter_tokens(client):
    payload = {
        "email": "test_contributor@horizon.dev",
        "username": "scout_bravo",
        "password": "Password123!",
        "display_name": "Scout Bravo",
        "role": "contributor",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    user = data["user"]
    assert user["email"] == "test_contributor@horizon.dev"
    assert user["username"] == "scout_bravo"
    assert user["role"] == "contributor"
    assert user["available_tokens"] == 100
    assert user["locked_tokens"] == 0
    assert user["total_tokens"] == 100
    assert user["reputation_score"] == 100.0


def test_register_duplicate_fails(client):
    payload = {
        "email": "duplicate@horizon.dev",
        "username": "dup_scout",
        "password": "Password123!",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert res2.json()["detail"]["code"] == "USER_ALREADY_EXISTS"


def test_login_and_me_profile(client):
    # Register user
    reg_payload = {
        "email": "login_test@horizon.dev",
        "username": "login_user",
        "password": "CorrectPassword123!",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    # Login with wrong password
    wrong_login = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "login_user", "password": "WrongPassword!"},
    )
    assert wrong_login.status_code == 401

    # Login with valid password
    valid_login = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "login_user", "password": "CorrectPassword123!"},
    )
    assert valid_login.status_code == 200
    token = valid_login.json()["access_token"]

    # Access /auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    profile = me_resp.json()
    assert profile["username"] == "login_user"
    assert profile["available_tokens"] == 100
