import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.database.models.task_schema import TaskFormSchema


def _create_sample_task(client: TestClient, admin_headers: dict, min_photos: int = 2) -> str:
    """Helper to create a published task for validation testing."""
    res = client.post(
        "/api/v1/admin/tasks",
        headers=admin_headers,
        json={
            "title": "Substation Sensor Audit",
            "description": "Inspect transmission insulator rings and record telemetry.",
            "artifact_type": "solar_installation",
            "latitude": 18.52043,
            "longitude": 73.85674,
            "difficulty": 2.0,
            "scarcity": 1.2,
            "base_reward": 150,
            "commitment_stake": 20,
            "requirements": ["Canopy overview photo", "Inverter display photo"],
            "status": "published",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def _register_contributor(client: TestClient, email_prefix: str) -> dict:
    """Helper to register and authenticate a field contributor."""
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{email_prefix}@horizon.io",
            "username": email_prefix,
            "password": "Password123!",
            "role": "contributor",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestAutomatedDataValidation:
    """Phase 4 Automated Data Validation Test Suite."""

    def test_valid_submission_passes_all_checks(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers, min_photos=2)
        contrib_headers = _register_contributor(client, "valid_scout")

        # Claim task
        claim_res = client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)
        assert claim_res.status_code == 200

        # Create valid draft within target radius with high-precision GPS
        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52045,
                "longitude": 73.85676,
                "gps_accuracy": 6.8,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {
                    "panel_condition": "intact",
                    "inverter_reading": 5.2,
                    "shading_obstructions": "none",
                    "field_notes": "All hardware in optimal operating condition.",
                },
            },
        )
        assert draft_res.status_code == 201
        sub_id = draft_res.json()["id"]

        # Attach 2 unique evidence photos
        client.post(
            f"/api/v1/submissions/{sub_id}/media",
            headers=contrib_headers,
            json={
                "storage_key": f"evidence/{sub_id}/photo_1.jpg",
                "media_type": "image/jpeg",
                "metadata": {"file_size": 2500000, "hash": "hash_valid_photo_1"},
            },
        )
        client.post(
            f"/api/v1/submissions/{sub_id}/media",
            headers=contrib_headers,
            json={
                "storage_key": f"evidence/{sub_id}/photo_2.jpg",
                "media_type": "image/jpeg",
                "metadata": {"file_size": 2800000, "hash": "hash_valid_photo_2"},
            },
        )

        # Run automated validation
        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        assert data["status"] == "PASSED"
        assert len(data["failed_checks"]) == 0
        assert "required_fields" in data["passed_checks"]
        assert "media_evidence" in data["passed_checks"]
        assert "gps_accuracy" in data["passed_checks"]
        assert "task_radius" in data["passed_checks"]
        assert "capture_timestamp" in data["passed_checks"]

    def test_missing_required_field_fails(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "missing_field_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        # Form data missing panel_condition and shading_obstructions
        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 5.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {
                    "inverter_reading": 4.1,
                    # required fields omitted
                },
            },
        )
        sub_id = draft_res.json()["id"]

        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        assert data["status"] == "FAILED"
        assert "required_fields" in data["failed_checks"]

    def test_invalid_field_value_fails(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "invalid_type_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        # Non-numeric string for number field and invalid select option
        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 5.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {
                    "panel_condition": "INVALID_OPTION_NOT_IN_ENUM",
                    "inverter_reading": "not-a-number",
                    "shading_obstructions": "none",
                },
            },
        )
        sub_id = draft_res.json()["id"]

        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        assert data["status"] == "FAILED"
        assert "required_fields" in data["failed_checks"]

    def test_insufficient_photos_fails(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "few_photos_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 5.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {"panel_condition": "intact", "shading_obstructions": "none"},
            },
        )
        sub_id = draft_res.json()["id"]

        # Only attach 1 photo when schema requires 2
        client.post(
            f"/api/v1/submissions/{sub_id}/media",
            headers=contrib_headers,
            json={
                "storage_key": f"evidence/{sub_id}/photo_single.jpg",
                "media_type": "image/jpeg",
                "metadata": {"file_size": 2000000, "hash": "hash_single"},
            },
        )

        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        assert data["status"] == "FAILED"
        assert "media_evidence" in data["failed_checks"]

    def test_duplicate_media_fails(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "dup_photo_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 5.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {"panel_condition": "intact", "shading_obstructions": "none"},
            },
        )
        sub_id = draft_res.json()["id"]

        # Attach 2 photos sharing the EXACT same hash
        client.post(
            f"/api/v1/submissions/{sub_id}/media",
            headers=contrib_headers,
            json={
                "storage_key": f"evidence/{sub_id}/slot1.jpg",
                "media_type": "image/jpeg",
                "metadata": {"file_size": 2000000, "hash": "duplicate_sha256_hash"},
            },
        )
        client.post(
            f"/api/v1/submissions/{sub_id}/media",
            headers=contrib_headers,
            json={
                "storage_key": f"evidence/{sub_id}/slot2.jpg",
                "media_type": "image/jpeg",
                "metadata": {"file_size": 2000000, "hash": "duplicate_sha256_hash"},
            },
        )

        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        assert data["status"] == "FAILED"
        assert "media_evidence" in data["failed_checks"]
        check = next(c for c in data["checks"] if c["name"] == "media_evidence")
        assert "Duplicate image detected" in check["message"]

    def test_poor_gps_accuracy_thresholds(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "poor_gps_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        # GPS accuracy of 74m (>50m -> WARNING)
        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 74.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {"panel_condition": "intact", "shading_obstructions": "none"},
            },
        )
        sub_id = draft_res.json()["id"]

        # Attach 2 photos
        for i in (1, 2):
            client.post(
                f"/api/v1/submissions/{sub_id}/media",
                headers=contrib_headers,
                json={
                    "storage_key": f"evidence/{sub_id}/photo_{i}.jpg",
                    "media_type": "image/jpeg",
                    "metadata": {"file_size": 1000000, "hash": f"hash_p_{i}"},
                },
            )

        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        # Should be WARNING status due to 74m GPS accuracy
        assert data["status"] == "WARNING"
        assert any("Low GPS accuracy ±74.0m" in w for w in data["warnings"])

    def test_critically_poor_gps_fails(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "critical_gps_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        # Accuracy > 150m is critically unviable
        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 280.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {"panel_condition": "intact", "shading_obstructions": "none"},
            },
        )
        sub_id = draft_res.json()["id"]

        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        assert data["status"] == "FAILED"
        assert "gps_accuracy" in data["failed_checks"]

    def test_outside_task_radius_fails(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "distance_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        # Submission coordinates ~15km away from task origin (18.52, 73.85)
        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.65000,
                "longitude": 73.95000,
                "gps_accuracy": 5.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {"panel_condition": "intact", "shading_obstructions": "none"},
            },
        )
        sub_id = draft_res.json()["id"]

        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        assert data["status"] == "FAILED"
        assert "task_radius" in data["failed_checks"]

    def test_future_timestamp_fails(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "time_travel_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        # Timestamp 3 hours into the future
        future_time = datetime.now(timezone.utc) + timedelta(hours=3)
        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 5.0,
                "captured_at": future_time.isoformat(),
                "form_data": {"panel_condition": "intact", "shading_obstructions": "none"},
            },
        )
        sub_id = draft_res.json()["id"]

        val_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=contrib_headers)
        assert val_res.status_code == 200
        data = val_res.json()

        assert data["status"] == "FAILED"
        assert "capture_timestamp" in data["failed_checks"]

    def test_unauthorized_validation(self, client: TestClient, admin_token, db_session):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        owner_headers = _register_contributor(client, "owner_scout")
        stranger_headers = _register_contributor(client, "stranger_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=owner_headers)
        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=owner_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 5.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {"panel_condition": "intact"},
            },
        )
        sub_id = draft_res.json()["id"]

        # Stranger attempting to run validation on owner's submission -> 403 Forbidden
        forbidden_res = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=stranger_headers)
        assert forbidden_res.status_code == 403

        # Admin attempting to run validation -> 200 OK
        admin_val = client.post(f"/api/v1/submissions/{sub_id}/validate", headers=admin_headers)
        assert admin_val.status_code == 200

    def test_finalization_automatically_records_validation(
        self, client: TestClient, admin_token, db_session
    ):
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        task_id = _create_sample_task(client, admin_headers)
        contrib_headers = _register_contributor(client, "auto_val_scout")

        client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)

        draft_res = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=contrib_headers,
            json={
                "latitude": 18.52043,
                "longitude": 73.85674,
                "gps_accuracy": 8.0,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "form_data": {
                    "panel_condition": "intact",
                    "inverter_reading": 4.5,
                    "shading_obstructions": "none",
                },
            },
        )
        sub_id = draft_res.json()["id"]

        # Attach 2 photos
        for i in (1, 2):
            client.post(
                f"/api/v1/submissions/{sub_id}/media",
                headers=contrib_headers,
                json={
                    "storage_key": f"evidence/{sub_id}/auto_photo_{i}.jpg",
                    "media_type": "image/jpeg",
                    "metadata": {"file_size": 2500000, "hash": f"hash_auto_{i}"},
                },
            )

        # Finalize submission (this calls transition_submission_to_submitted)
        sub_res = client.post(f"/api/v1/submissions/{sub_id}/submit", headers=contrib_headers)
        assert sub_res.status_code == 200
        sub_data = sub_res.json()

        # Validation results must be automatically populated on response
        assert sub_data["validation_status"] == "PASSED"
        assert sub_data["validation_results"] is not None
        assert sub_data["validation_results"]["status"] == "PASSED"
        assert len(sub_data["validation_results"]["checks"]) == 5
