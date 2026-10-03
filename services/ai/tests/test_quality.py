import io
import base64
import numpy as np
import scipy.ndimage
from PIL import Image
from app.schemas.quality import QualityStatus


def create_test_image(
    width: int = 1200,
    height: int = 900,
    pattern: str = "sharp",
    brightness_offset: float = 0.0,
) -> bytes:
    """Generate deterministic synthetic test images for validation."""
    if pattern == "sharp":
        # Create image with high-frequency edges/grid
        arr = np.zeros((height, width), dtype=np.uint8)
        arr[::30, :] = 255
        arr[:, ::30] = 255
        # Add diagonal lines
        min_dim = min(width, height)
        for i in range(0, min_dim, 20):
            arr[i, :min_dim] = 255
        # Modulate brightness to realistic indoor/outdoor level (~128)
        arr = np.clip((arr.astype(np.float32) * 0.7) + 50.0 + brightness_offset, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr, mode="L").convert("RGB")
    elif pattern == "blurry":
        # Create sharp base then heavily Gaussian blur it
        arr = np.zeros((height, width), dtype=np.float32)
        arr[::20, :] = 255.0
        arr[:, ::20] = 255.0
        blurred = scipy.ndimage.gaussian_filter(arr, sigma=12.0)
        img = Image.fromarray(np.clip(blurred + 60.0, 0, 255).astype(np.uint8), mode="L").convert("RGB")
    elif pattern == "dark":
        # Low light / underexposed: values strictly below 25
        arr = np.random.randint(5, 22, size=(height, width), dtype=np.uint8)
        img = Image.fromarray(arr, mode="L").convert("RGB")
    elif pattern == "overexposed":
        # Overexposed / blown-out highlights: values near 250
        arr = np.random.randint(235, 255, size=(height, width), dtype=np.uint8)
        img = Image.fromarray(arr, mode="L").convert("RGB")
    elif pattern == "low_res":
        # Small thumbnail: 200x150
        arr = np.zeros((150, 200), dtype=np.uint8)
        arr[::10, :] = 255
        img = Image.fromarray(arr, mode="L").convert("RGB")
    else:
        arr = np.ones((height, width), dtype=np.uint8) * 128
        img = Image.fromarray(arr, mode="L").convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_clear_image_passes(client):
    img_bytes = create_test_image(pattern="sharp")
    b64 = base64.b64encode(img_bytes).decode("utf-8")

    payload = {
        "submission_id": "sub_test_clear_01",
        "images": [
            {
                "media_id": "med_01",
                "storage_key": "evidence/sharp_array.jpg",
                "image_base64": b64,
            }
        ],
    }

    res = client.post("/quality/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == QualityStatus.PASS.value
    assert data["confidence"] >= 0.85
    assert len(data["media_results"]) == 1
    assert data["media_results"][0]["blur"]["is_blurry"] is False
    assert data["media_results"][0]["blur"]["blur_score"] > 85.0
    assert data["media_results"][0]["exposure"]["status"] == QualityStatus.PASS.value
    assert data["media_results"][0]["resolution"]["status"] == QualityStatus.PASS.value


def test_blurry_image_fails(client):
    img_bytes = create_test_image(pattern="blurry")
    b64 = base64.b64encode(img_bytes).decode("utf-8")

    payload = {
        "submission_id": "sub_test_blur_01",
        "images": [
            {
                "media_id": "med_02",
                "storage_key": "evidence/blurry_array.jpg",
                "image_base64": b64,
            }
        ],
    }

    res = client.post("/quality/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == QualityStatus.FAIL.value
    assert data["media_results"][0]["blur"]["is_blurry"] is True
    assert data["media_results"][0]["blur"]["status"] == QualityStatus.FAIL.value
    assert any("blur" in r.lower() for r in data["reasons"])


def test_dark_underexposed_image_fails(client):
    img_bytes = create_test_image(pattern="dark")
    b64 = base64.b64encode(img_bytes).decode("utf-8")

    payload = {
        "submission_id": "sub_test_dark_01",
        "images": [
            {
                "media_id": "med_03",
                "storage_key": "evidence/dark_array.jpg",
                "image_base64": b64,
            }
        ],
    }

    res = client.post("/quality/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == QualityStatus.FAIL.value
    assert data["media_results"][0]["exposure"]["status"] == QualityStatus.FAIL.value
    assert "underexposed" in data["media_results"][0]["exposure"]["exposure_classification"]


def test_overexposed_image_fails(client):
    img_bytes = create_test_image(pattern="overexposed")
    b64 = base64.b64encode(img_bytes).decode("utf-8")

    payload = {
        "submission_id": "sub_test_bright_01",
        "images": [
            {
                "media_id": "med_04",
                "storage_key": "evidence/bright_array.jpg",
                "image_base64": b64,
            }
        ],
    }

    res = client.post("/quality/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == QualityStatus.FAIL.value
    assert data["media_results"][0]["exposure"]["status"] == QualityStatus.FAIL.value
    assert "overexposed" in data["media_results"][0]["exposure"]["exposure_classification"]


def test_low_resolution_image_fails(client):
    img_bytes = create_test_image(pattern="low_res")
    b64 = base64.b64encode(img_bytes).decode("utf-8")

    payload = {
        "submission_id": "sub_test_lowres_01",
        "images": [
            {
                "media_id": "med_05",
                "storage_key": "evidence/thumbnail.jpg",
                "image_base64": b64,
            }
        ],
    }

    res = client.post("/quality/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == QualityStatus.FAIL.value
    assert data["media_results"][0]["resolution"]["status"] == QualityStatus.FAIL.value
    assert data["media_results"][0]["resolution"]["width"] == 200
    assert data["media_results"][0]["resolution"]["height"] == 150


def test_multiple_images_batch_evaluation(client):
    sharp_bytes = create_test_image(pattern="sharp")
    blur_bytes = create_test_image(pattern="blurry")

    payload = {
        "submission_id": "sub_test_multi_01",
        "images": [
            {
                "media_id": "med_10",
                "storage_key": "evidence/sharp.jpg",
                "image_base64": base64.b64encode(sharp_bytes).decode("utf-8"),
            },
            {
                "media_id": "med_11",
                "storage_key": "evidence/blurry.jpg",
                "image_base64": base64.b64encode(blur_bytes).decode("utf-8"),
            },
        ],
    }

    res = client.post("/quality/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    # If one of the images fails quality standards, the overall submission status is FAIL
    assert data["overall_status"] == QualityStatus.FAIL.value
    assert len(data["media_results"]) == 2
    assert data["media_results"][0]["status"] == QualityStatus.PASS.value
    assert data["media_results"][1]["status"] == QualityStatus.FAIL.value


def test_corrupt_image_fails_gracefully(client):
    payload = {
        "submission_id": "sub_test_corrupt_01",
        "images": [
            {
                "media_id": "med_corrupt",
                "storage_key": "evidence/corrupted.jpg",
                "image_base64": base64.b64encode(b"NOT_A_VALID_JPEG_BYTES").decode("utf-8"),
            }
        ],
    }

    res = client.post("/quality/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == QualityStatus.FAIL.value
    assert "corrupt" in data["media_results"][0]["reasons"][0].lower()
