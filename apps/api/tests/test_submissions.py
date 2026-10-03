import pytest
from fastapi.testclient import TestClient


def test_get_task_form_schema(client: TestClient, admin_token: str):
    # 1. Create a task as admin
    task_res = client.post(
        "/api/v1/admin/tasks",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "Water Point Verification",
            "description": "Inspect municipal water point",
            "artifact_type": "water_source",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "difficulty": 1.5,
            "scarcity": 1.0,
            "base_reward": 100,
            "commitment_stake": 15,
            "requirements": ["Inspect valve", "Record clarity"],
            "status": "published",
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # 2. Fetch dynamic form schema
    schema_res = client.get(f"/api/v1/tasks/{task_id}/form-schema")
    assert schema_res.status_code == 200
    schema_data = schema_res.json()
    assert schema_data["task_id"] == task_id
    assert len(schema_data["fields"]) >= 2
    field_ids = [f["id"] for f in schema_data["fields"]]
    assert "operational_status" in field_ids
    assert "water_clarity" in field_ids
    assert schema_data["minimum_photos"] >= 1


def test_cannot_create_submission_without_claim(client: TestClient, contributor_token: str, admin_token: str):
    # 1. Create published task
    task_res = client.post(
        "/api/v1/admin/tasks",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "Unclaimed Solar Array",
            "artifact_type": "solar_installation",
            "latitude": 18.5300,
            "longitude": 73.8500,
            "difficulty": 2.0,
            "scarcity": 1.5,
            "base_reward": 150,
            "commitment_stake": 20,
            "status": "published",
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # 2. Attempt to create submission without claiming
    sub_res = client.post(
        f"/api/v1/tasks/{task_id}/submission",
        headers={"Authorization": f"Bearer {contributor_token}"},
        json={
            "latitude": 18.5301,
            "longitude": 73.8502,
            "gps_accuracy": 4.2,
            "form_data": {"panel_condition": "intact"},
        },
    )
    assert sub_res.status_code == 403
    assert sub_res.json()["detail"]["code"] == "NO_ACTIVE_CLAIM"


def test_submission_lifecycle_and_draft_updates(client: TestClient, contributor_token: str, admin_token: str):
    # 1. Create published task
    task_res = client.post(
        "/api/v1/admin/tasks",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "Substation Transformer Check",
            "artifact_type": "telecom_tower",
            "latitude": 18.5200,
            "longitude": 73.8600,
            "difficulty": 1.5,
            "scarcity": 1.2,
            "base_reward": 120,
            "commitment_stake": 20,
            "status": "published",
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # 2. Contributor claims the task
    claim_res = client.post(
        f"/api/v1/tasks/{task_id}/claim",
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert claim_res.status_code == 200

    # 3. Contributor starts draft submission
    draft_res = client.post(
        f"/api/v1/tasks/{task_id}/submission",
        headers={"Authorization": f"Bearer {contributor_token}"},
        json={
            "latitude": 18.5202,
            "longitude": 73.8601,
            "gps_accuracy": 3.8,
            "form_data": {"site_condition": "satisfactory"},
        },
    )
    assert draft_res.status_code == 201
    draft_data = draft_res.json()
    submission_id = draft_data["id"]
    assert draft_data["status"] == "draft"
    assert draft_data["latitude"] is not None
    assert draft_data["form_data"]["site_condition"] == "satisfactory"

    # 4. Contributor updates ongoing draft
    update_res = client.put(
        f"/api/v1/submissions/{submission_id}/draft",
        headers={"Authorization": f"Bearer {contributor_token}"},
        json={
            "gps_accuracy": 2.5,
            "form_data": {"site_condition": "satisfactory", "safety_labels": "verified_visible"},
        },
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["gps_accuracy"] == 2.5
    assert updated_data["form_data"]["safety_labels"] == "verified_visible"

    # 5. Attach evidence media
    media_res = client.post(
        f"/api/v1/submissions/{submission_id}/media",
        headers={"Authorization": f"Bearer {contributor_token}"},
        json={
            "storage_key": "evidence/2026/10/substation_front.jpg",
            "media_type": "image/jpeg",
            "metadata": {"width": 4032, "height": 3024, "hash": "sha256_mock_hash_123"},
        },
    )
    assert media_res.status_code == 201
    assert media_res.json()["storage_key"] == "evidence/2026/10/substation_front.jpg"

    # 6. Finalize submission
    submit_res = client.post(
        f"/api/v1/submissions/{submission_id}/submit",
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert submit_res.status_code == 200
    final_data = submit_res.json()
    assert final_data["status"] == "submitted"
    assert final_data["submitted_at"] is not None
    assert len(final_data["media"]) == 1

    # 7. Attempting to edit after submission must fail
    re_edit = client.put(
        f"/api/v1/submissions/{submission_id}/draft",
        headers={"Authorization": f"Bearer {contributor_token}"},
        json={"form_data": {"site_condition": "altered"}},
    )
    assert re_edit.status_code == 400
    assert re_edit.json()["detail"]["code"] == "SUBMISSION_LOCKED"

    # 8. Contributor lists their submissions
    me_subs = client.get(
        "/api/v1/me/submissions",
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert me_subs.status_code == 200
    assert me_subs.json()["total"] >= 1

    # 9. Admin inspects review queue and approves submission
    admin_list = client.get(
        "/api/v1/admin/submissions",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_list.status_code == 200
    assert admin_list.json()["total"] >= 1

    review_res = client.post(
        f"/api/v1/admin/submissions/{submission_id}/review",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "status": "approved",
            "notes": "Evidence verified against geographic requirements.",
            "ai_confidence_score": 0.94,
        },
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"
    assert review_res.json()["notes"] == "Evidence verified against geographic requirements."

    # 10. Verify submission status updated to approved
    detail_res = client.get(
        f"/api/v1/submissions/{submission_id}",
        headers={"Authorization": f"Bearer {contributor_token}"},
    )
    assert detail_res.status_code == 200
    assert detail_res.json()["status"] == "approved"
    assert detail_res.json()["verification_status"] == "approved"
