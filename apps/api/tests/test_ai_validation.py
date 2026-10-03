import io
import base64
import pytest
import numpy as np
import scipy.ndimage
from PIL import Image
from fastapi.testclient import TestClient

from app.modules.validation.ai_service import AIValidationService


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _create_synthetic_image_b64(
    width: int = 1200,
    height: int = 900,
    pattern: str = "sharp",
) -> str:
    """Generate deterministic synthetic test images and return base64 string."""
    if pattern == "sharp":
        arr = np.zeros((height, width), dtype=np.uint8)
        arr[::30, :] = 255
        arr[:, ::30] = 255
        for i in range(0, min(width, height), 25):
            arr[i, :min(width, height)] = 255
        arr = np.clip((arr.astype(np.float32) * 0.7) + 60.0, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr, mode="L").convert("RGB")
    elif pattern == "blurry":
        arr = np.zeros((height, width), dtype=np.float32)
        arr[::20, :] = 255.0
        arr[:, ::20] = 255.0
        blurred = scipy.ndimage.gaussian_filter(arr, sigma=15.0)
        img = Image.fromarray(np.clip(blurred + 70.0, 0, 255).astype(np.uint8), mode="L").convert("RGB")
    elif pattern == "dark":
        arr = np.random.randint(5, 20, size=(height, width), dtype=np.uint8)
        img = Image.fromarray(arr, mode="L").convert("RGB")
    elif pattern == "overexposed":
        arr = np.random.randint(238, 255, size=(height, width), dtype=np.uint8)
        img = Image.fromarray(arr, mode="L").convert("RGB")
    elif pattern == "low_res":
        arr = np.zeros((150, 200), dtype=np.uint8)
        arr[::10, :] = 255
        img = Image.fromarray(arr, mode="L").convert("RGB")
    else:
        arr = np.ones((height, width), dtype=np.uint8) * 128
        img = Image.fromarray(arr, mode="L").convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _setup_task_and_draft(client: TestClient, admin_headers: dict, contributor_prefix: str):
    """Helper to publish task, register contributor, stake, and create draft."""
    # 1. Create task
    t_res = client.post(
        "/api/v1/admin/tasks",
        headers=admin_headers,
        json={
            "title": f"Solar Quality Audit {contributor_prefix}",
            "description": "Inspect canopy and panel clarity.",
            "artifact_type": "solar_installation",
            "latitude": 18.52043,
            "longitude": 73.85674,
            "difficulty": 2.0,
            "scarcity": 1.2,
            "base_reward": 150,
            "commitment_stake": 20,
            "status": "published",
        },
    )
    assert t_res.status_code == 201
    task_id = t_res.json()["id"]

    # 2. Register contributor
    u_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{contributor_prefix}@horizon.io",
            "username": contributor_prefix,
            "password": "Password123!",
            "role": "contributor",
        },
    )
    assert u_res.status_code == 201
    token = u_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {token}"}

    # 3. Stake task
    c_res = client.post(f"/api/v1/tasks/{task_id}/claim", headers=user_headers)
    assert c_res.status_code in (200, 201)

    # 4. Create draft
    d_res = client.post(
        f"/api/v1/tasks/{task_id}/submission",
        headers=user_headers,
        json={
            "latitude": 18.52044,
            "longitude": 73.85675,
            "gps_accuracy": 5.0,
            "form_data": {"panel_condition": "clean", "inverter_reading": 4.5},
        },
    )
    assert d_res.status_code == 201
    sub_id = d_res.json()["id"]

    return task_id, sub_id, user_headers


def test_ai_clear_image_passes(client: TestClient, admin_headers: dict):
    task_id, sub_id, user_headers = _setup_task_and_draft(client, admin_headers, "ai_contributor_sharp")

    # Attach clear sharp photo
    b64 = _create_synthetic_image_b64(width=1200, height=900, pattern="sharp")
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": "evidence/sharp_canopy.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": b64, "width": 1200, "height": 900},
        },
    )

    # Run AI evaluation
    res = client.post(f"/api/v1/submissions/{sub_id}/ai-validate", headers=user_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["overall_status"] == "PASS"
    assert data["confidence"] >= 0.85
    assert len(data["media_results"]) == 1
    assert data["media_results"][0]["status"] == "PASS"
    assert data["media_results"][0]["blur"]["is_blurry"] is False


def test_ai_blurry_image_fails(client: TestClient, admin_headers: dict):
    task_id, sub_id, user_headers = _setup_task_and_draft(client, admin_headers, "ai_contributor_blur")

    # Attach blurry photo
    b64 = _create_synthetic_image_b64(width=1200, height=900, pattern="blurry")
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": "evidence/blurry_canopy.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": b64, "width": 1200, "height": 900},
        },
    )

    res = client.post(f"/api/v1/submissions/{sub_id}/ai-validate", headers=user_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["overall_status"] == "FAIL"
    assert data["media_results"][0]["blur"]["is_blurry"] is True
    assert any("blur" in r.lower() for r in data["reasons"])


def test_ai_dark_and_overexposed_image_fails(client: TestClient, admin_headers: dict):
    # Dark image
    _, sub_dark, dark_headers = _setup_task_and_draft(client, admin_headers, "ai_contributor_dark")
    dark_b64 = _create_synthetic_image_b64(width=1000, height=800, pattern="dark")
    client.post(
        f"/api/v1/submissions/{sub_dark}/media",
        headers=dark_headers,
        json={
            "storage_key": "evidence/night_dark.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": dark_b64, "width": 1000, "height": 800},
        },
    )
    dark_res = client.post(f"/api/v1/submissions/{sub_dark}/ai-validate", headers=dark_headers)
    assert dark_res.status_code == 200
    assert dark_res.json()["overall_status"] == "FAIL"
    assert "underexposed" in dark_res.json()["media_results"][0]["exposure"]["exposure_classification"]

    # Overexposed image
    _, sub_bright, bright_headers = _setup_task_and_draft(client, admin_headers, "ai_contributor_bright")
    bright_b64 = _create_synthetic_image_b64(width=1000, height=800, pattern="overexposed")
    client.post(
        f"/api/v1/submissions/{sub_bright}/media",
        headers=bright_headers,
        json={
            "storage_key": "evidence/blown_out.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": bright_b64, "width": 1000, "height": 800},
        },
    )
    bright_res = client.post(f"/api/v1/submissions/{sub_bright}/ai-validate", headers=bright_headers)
    assert bright_res.status_code == 200
    assert bright_res.json()["overall_status"] == "FAIL"
    assert "overexposed" in bright_res.json()["media_results"][0]["exposure"]["exposure_classification"]


def test_ai_low_resolution_image_fails(client: TestClient, admin_headers: dict):
    task_id, sub_id, user_headers = _setup_task_and_draft(client, admin_headers, "ai_contributor_lowres")

    b64 = _create_synthetic_image_b64(width=200, height=150, pattern="low_res")
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": "evidence/low_res_thumb.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": b64, "width": 200, "height": 150},
        },
    )

    res = client.post(f"/api/v1/submissions/{sub_id}/ai-validate", headers=user_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == "FAIL"
    all_reasons = data["reasons"] + data["media_results"][0]["reasons"]
    assert any("low resolution" in r.lower() or "resolution" in r.lower() for r in all_reasons)


def test_ai_multiple_images_evaluation(client: TestClient, admin_headers: dict):
    task_id, sub_id, user_headers = _setup_task_and_draft(client, admin_headers, "ai_contributor_multi")

    # Image 1: Sharp
    sharp_b64 = _create_synthetic_image_b64(width=1200, height=900, pattern="sharp")
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": "evidence/img1_sharp.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": sharp_b64, "width": 1200, "height": 900},
        },
    )

    # Image 2: Blurry
    blur_b64 = _create_synthetic_image_b64(width=1200, height=900, pattern="blurry")
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": "evidence/img2_blurry.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": blur_b64, "width": 1200, "height": 900},
        },
    )

    res = client.post(f"/api/v1/submissions/{sub_id}/ai-validate", headers=user_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["media_results"]) == 2
    assert data["media_results"][0]["status"] == "PASS"
    assert data["media_results"][1]["status"] == "FAIL"
    # One failure causes overall submission failure
    assert data["overall_status"] == "FAIL"


def test_ai_service_failure_safe_fallback(client: TestClient, admin_headers: dict):
    task_id, sub_id, user_headers = _setup_task_and_draft(client, admin_headers, "ai_contributor_fallback")

    sharp_b64 = _create_synthetic_image_b64(pattern="sharp")
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": "evidence/img_fallback.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": sharp_b64, "width": 1200, "height": 900},
        },
    )

    try:
        AIValidationService.SIMULATE_FAILURE = True
        res = client.post(f"/api/v1/submissions/{sub_id}/ai-validate", headers=user_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["overall_status"] == "WARNING"
        assert data["confidence"] == 0.0
        assert data.get("service_unavailable") is True
        assert any("fallback" in r.lower() or "outage" in r.lower() for r in data["reasons"])
    finally:
        AIValidationService.SIMULATE_FAILURE = False


def test_ai_unauthorized_access(client: TestClient, admin_headers: dict):
    # Setup submission by user 1
    task_id, sub_id, user1_headers = _setup_task_and_draft(client, admin_headers, "ai_owner_user")

    # Register user 2
    u2_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "ai_intruder_user@horizon.io",
            "username": "ai_intruder_user",
            "password": "Password123!",
            "role": "contributor",
        },
    )
    user2_token = u2_res.json()["access_token"]
    user2_headers = {"Authorization": f"Bearer {user2_token}"}

    # Unauthenticated request fails (401)
    res_no_auth = client.post(f"/api/v1/submissions/{sub_id}/ai-validate")
    assert res_no_auth.status_code == 401

    # Unauthorized user request fails (403)
    res_forbidden = client.post(f"/api/v1/submissions/{sub_id}/ai-validate", headers=user2_headers)
    assert res_forbidden.status_code == 403

    # Admin request succeeds (200)
    res_admin = client.post(f"/api/v1/submissions/{sub_id}/ai-validate", headers=admin_headers)
    assert res_admin.status_code == 200


def test_ai_integrated_into_submission_finalize(client: TestClient, admin_headers: dict):
    task_id, sub_id, user_headers = _setup_task_and_draft(client, admin_headers, "ai_contributor_finalize")

    # Attach clear sharp photo
    sharp_b64 = _create_synthetic_image_b64(pattern="sharp")
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": "evidence/sharp_evidence.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": sharp_b64, "width": 1200, "height": 900},
        },
    )

    # Finalize observation draft
    fin_res = client.post(f"/api/v1/submissions/{sub_id}/submit", headers=user_headers)
    assert fin_res.status_code == 200
    sub_data = fin_res.json()

    assert sub_data["status"] == "submitted"
    assert sub_data["ai_status"] == "PASS"
    assert sub_data["ai_confidence_score"] >= 0.85
    assert sub_data["ai_results"] is not None
    assert sub_data["ai_results"]["overall_status"] == "PASS"

    # Verify GET /ai-validation endpoint returns recorded results
    get_ai_res = client.get(f"/api/v1/submissions/{sub_id}/ai-validation", headers=user_headers)
    assert get_ai_res.status_code == 200
    assert get_ai_res.json()["overall_status"] == "PASS"
