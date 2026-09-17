def test_task_claiming_and_commitment_stake_locking(client):
    # 1. Admin creates and publishes a task
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "claim_admin@horizon.dev", "username": "claim_admin", "password": "Password123!", "role": "admin"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_reg.json()['access_token']}"}

    task_resp = client.post(
        "/api/v1/admin/tasks",
        json={
            "title": "Community Water Source Survey",
            "description": "Document water pump status",
            "artifact_type": "water_source",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "difficulty": 2.0,
            "scarcity": 1.5,
            "base_reward": 150,
            "commitment_stake": 20,
            "estimated_effort_minutes": 25,
            "status": "published",
        },
        headers=admin_headers,
    )
    task_id = task_resp.json()["id"]

    # 2. Contributor registers with 100 Starter Tokens
    user_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "scout_claim@horizon.dev", "username": "scout_claim", "password": "Password123!"},
    )
    user_token = user_reg.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Verify initial wallet
    wallet_init = client.get("/api/v1/wallet", headers=user_headers).json()
    assert wallet_init["available_tokens"] == 100
    assert wallet_init["locked_tokens"] == 0

    # 3. Contributor claims the task
    claim_resp = client.post(f"/api/v1/tasks/{task_id}/claim", headers=user_headers)
    assert claim_resp.status_code == 200
    claim_data = claim_resp.json()
    assert claim_data["task_id"] == task_id
    assert claim_data["stake_amount"] == 20
    assert claim_data["status"] == "claimed"
    assert claim_data["available_tokens"] == 80
    assert claim_data["locked_tokens"] == 20

    # 4. Verify wallet and ledger transaction
    wallet_post = client.get("/api/v1/wallet", headers=user_headers).json()
    assert wallet_post["available_tokens"] == 80
    assert wallet_post["locked_tokens"] == 20
    assert wallet_post["total_tokens"] == 100
    
    # Check ledger entries: STARTER_GRANT (+100) and TASK_STAKE_LOCK (-20)
    tx_types = [t["type"] for t in wallet_post["transactions"]]
    assert "starter_grant" in tx_types
    assert "task_stake_lock" in tx_types
    stake_tx = next(t for t in wallet_post["transactions"] if t["type"] == "task_stake_lock")
    assert stake_tx["amount"] == -20

    # 5. Attempt duplicate claim on same task -> Must fail with 409
    dup_claim = client.post(f"/api/v1/tasks/{task_id}/claim", headers=user_headers)
    assert dup_claim.status_code == 409
    assert dup_claim.json()["detail"]["code"] == "TASK_ALREADY_CLAIMED"

    # 6. Attempt claim on unpublished draft task -> Must fail with 400
    draft_task = client.post(
        "/api/v1/admin/tasks",
        json={
            "title": "Secret Draft Task",
            "artifact_type": "draft",
            "latitude": 18.52,
            "longitude": 73.85,
            "base_reward": 50,
            "commitment_stake": 10,
            "status": "draft",
        },
        headers=admin_headers,
    ).json()
    draft_claim = client.post(f"/api/v1/tasks/{draft_task['id']}/claim", headers=user_headers)
    assert draft_claim.status_code == 400

    # 7. Attempt claim requiring more tokens than available -> Must fail with 409
    expensive_task = client.post(
        "/api/v1/admin/tasks",
        json={
            "title": "Expensive Satellite Ground Station",
            "artifact_type": "telecom",
            "latitude": 18.52,
            "longitude": 73.85,
            "base_reward": 1000,
            "commitment_stake": 150,  # Contributor only has 80 available
            "status": "published",
        },
        headers=admin_headers,
    ).json()
    exp_claim = client.post(f"/api/v1/tasks/{expensive_task['id']}/claim", headers=user_headers)
    assert exp_claim.status_code == 409
    assert exp_claim.json()["detail"]["code"] == "INSUFFICIENT_TOKENS"

    # 8. Check GET /api/v1/me/tasks
    my_tasks = client.get("/api/v1/me/tasks", headers=user_headers)
    assert my_tasks.status_code == 200
    my_tasks_data = my_tasks.json()
    assert len(my_tasks_data) == 1
    assert my_tasks_data[0]["task"]["title"] == "Community Water Source Survey"
    assert my_tasks_data[0]["status"] == "claimed"
