def test_admin_task_lifecycle_and_discovery(client):
    # 1. Register admin
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "task_admin@horizon.dev",
            "username": "task_admin",
            "password": "AdminPassword123!",
            "role": "admin",
        },
    )
    admin_token = admin_reg.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Register contributor
    user_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "task_scout@horizon.dev",
            "username": "task_scout",
            "password": "UserPassword123!",
            "role": "contributor",
        },
    )
    user_token = user_reg.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 3. Contributor cannot create task
    forbidden_resp = client.post(
        "/api/v1/admin/tasks",
        json={
            "title": "Hacker Task",
            "artifact_type": "exploit",
            "latitude": 18.52,
            "longitude": 73.85,
        },
        headers=user_headers,
    )
    assert forbidden_resp.status_code == 403

    # 4. Admin creates draft task
    create_payload = {
        "title": "Community Water Source Survey",
        "description": "Document water pump operational status.",
        "artifact_type": "water_source",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "difficulty": 2.0,
        "scarcity": 1.5,
        "base_reward": 150,
        "commitment_stake": 20,
        "estimated_effort_minutes": 25,
        "requirements": ["Photo of pump", "Operational reading"],
        "status": "draft",
    }
    create_resp = client.post("/api/v1/admin/tasks", json=create_payload, headers=admin_headers)
    assert create_resp.status_code == 201
    task_id = create_resp.json()["id"]

    # 5. Draft task is NOT discoverable by contributors
    list_draft = client.get("/api/v1/tasks")
    assert list_draft.status_code == 200
    assert not any(t["id"] == task_id for t in list_draft.json()["tasks"])

    # 6. Admin publishes the task
    publish_resp = client.patch(
        f"/api/v1/admin/tasks/{task_id}",
        json={"status": "published"},
        headers=admin_headers,
    )
    assert publish_resp.status_code == 200
    assert publish_resp.json()["status"] == "published"

    # 7. Published task is now discoverable
    list_pub = client.get("/api/v1/tasks")
    assert list_pub.status_code == 200
    found = next((t for t in list_pub.json()["tasks"] if t["id"] == task_id), None)
    assert found is not None
    assert found["title"] == "Community Water Source Survey"
    assert found["base_reward"] == 150
    assert found["commitment_stake"] == 20
    assert found["estimated_effort_minutes"] == 25

    # 8. Detail view
    detail_resp = client.get(f"/api/v1/tasks/{task_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert len(detail["requirements"]) == 2


def test_geospatial_proximity_discovery(client):
    # Register admin
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={"email": "geo_admin@horizon.dev", "username": "geo_admin", "password": "Password123!", "role": "admin"},
    )
    headers = {"Authorization": f"Bearer {admin_reg.json()['access_token']}"}

    # Create Task A in Pune, India (18.5204, 73.8567) - Published
    client.post(
        "/api/v1/admin/tasks",
        json={
            "title": "Pune Water Task",
            "artifact_type": "water",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "base_reward": 100,
            "commitment_stake": 10,
            "status": "published",
        },
        headers=headers,
    )

    # Create Task B in Mumbai, India (~120 km away: 19.0760, 72.8777) - Published
    client.post(
        "/api/v1/admin/tasks",
        json={
            "title": "Mumbai Flood Task",
            "artifact_type": "flood",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "base_reward": 200,
            "commitment_stake": 20,
            "status": "published",
        },
        headers=headers,
    )

    # Query near Pune center (radius 10,000 meters / 10 km)
    pune_search = client.get("/api/v1/tasks?lat=18.5204&lng=73.8567&radius=10000")
    assert pune_search.status_code == 200
    pune_tasks = pune_search.json()["tasks"]
    
    # Pune task must be included, Mumbai task must be excluded
    pune_titles = [t["title"] for t in pune_tasks]
    assert "Pune Water Task" in pune_titles
    assert "Mumbai Flood Task" not in pune_titles
