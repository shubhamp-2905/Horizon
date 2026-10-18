"""
Horizon — AI Evidence Verification, Submission Validation & Admin Transparency
Reproducible Evaluation Suite for the 10 Mandatory Scenarios (Section 9)

Scenarios Evaluated:
1. Water-source task with a genuine water-source image -> PASS / RELEVANT
2. Water-source task with a laptop/coding image -> FAIL / IRRELEVANT
3. Water-source task with a generic indoor image -> FAIL / IRRELEVANT
4. Water-source task with a blurry water-source image -> WARNING (Blur failure)
5. Solar installation task with a genuine solar-panel image -> PASS / RELEVANT
6. Solar installation task with an unrelated image (laptop/code) -> FAIL / IRRELEVANT
7. Reused/duplicate image -> WARNING (Perceptual hash collision)
8. Ambiguous image where model requests human review -> NEEDS_REVIEW
9. AI service unavailable -> WARNING (Defensive fail-safe, never auto-pass)
10. Image upload or decoding failure -> FAIL (Corrupt binary handling)
"""

import sys
import io
import os
import base64
from pathlib import Path
import numpy as np
import scipy.ndimage
from PIL import Image, ImageDraw

# Add repository root and services to path
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "services" / "ai") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "services" / "ai"))
if str(REPO_ROOT / "apps" / "api") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "apps" / "api"))

from services.ai.app.schemas.quality import QualityStatus
from services.ai.app.schemas.verification import (
    RelevanceStatus,
    SubmissionEvidenceEvaluationRequest,
    ImageInputItem,
)
from services.ai.app.services.relevance_evaluator import TaskRelevanceEvaluator
from services.ai.app.services.quality_evaluator import ImageQualityEvaluator
from services.ai.app.services.evidence_evaluator import (
    EvidenceEvaluator,
    compute_phash_64bit,
    phash_hamming_distance,
)


# =============================================================================
# Image Synthesis Helpers for Deterministic, Reproducible Field Evidence
# =============================================================================

def generate_water_source_image() -> Image.Image:
    """Generate realistic physical water source evidence: outdoor ground, concrete well base, pump handle."""
    w, h = 1000, 750
    # Earth / soil / concrete background (r ~ 110, g ~ 95, b ~ 70)
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :, 0] = np.random.randint(100, 130, (h, w), dtype=np.uint8)
    arr[:, :, 1] = np.random.randint(90, 115, (h, w), dtype=np.uint8)
    arr[:, :, 2] = np.random.randint(60, 85, (h, w), dtype=np.uint8)

    img = Image.fromarray(arr, mode="RGB")
    draw = ImageDraw.Draw(img)

    # Concrete platform (gray circular / octagonal pad)
    draw.ellipse([250, 200, 750, 650], fill=(145, 145, 140), outline=(100, 100, 95), width=4)
    # Metallic pump cylinder
    draw.rectangle([460, 260, 540, 520], fill=(70, 75, 80), outline=(40, 45, 50), width=3)
    # Water pump mechanical arm / handle
    draw.line([(500, 300), (320, 220)], fill=(50, 55, 60), width=12)
    # Spout
    draw.rectangle([540, 380, 620, 410], fill=(65, 70, 75), outline=(35, 40, 45), width=2)
    # Water basin
    draw.ellipse([580, 410, 680, 470], fill=(80, 110, 130), outline=(50, 70, 90), width=2)

    return img


def generate_laptop_coding_image() -> Image.Image:
    """Generate authentic laptop/code editor screen: dark theme (#1e1e1e), syntax highlighted code lines."""
    w, h = 1000, 750
    img = Image.new("RGB", (w, h), color=(30, 30, 30))  # Dark IDE background
    draw = ImageDraw.Draw(img)

    # Sidebar file tree
    draw.rectangle([0, 0, 180, h], fill=(37, 37, 38))
    # Tab bar
    draw.rectangle([180, 0, w, 40], fill=(45, 45, 45))
    draw.text((200, 12), "water_survey_handler.ts", fill=(204, 204, 204))

    # Code lines with colorful syntax tokens
    syntax_colors = [
        (86, 156, 214),   # Blue: import, const, function
        (220, 220, 170),  # Yellow: method calls
        (206, 145, 120),  # Orange: strings
        (106, 153, 85),   # Green: comments
        (156, 220, 254),  # Cyan: variables
    ]

    y = 60
    line_count = 28
    for line_idx in range(line_count):
        x = 220
        # Line number
        draw.text((190, y), f"{line_idx+1:2d}", fill=(110, 110, 110))
        # Indented code blocks
        indent = (line_idx % 4) * 25
        x += indent
        words_in_line = np.random.randint(3, 7)
        for _ in range(words_in_line):
            token_len = np.random.randint(30, 90)
            col = syntax_colors[np.random.randint(0, len(syntax_colors))]
            draw.rectangle([x, y + 2, x + token_len, y + 14], fill=col)
            x += token_len + 12
        y += 24

    return img


def generate_indoor_domestic_image() -> Image.Image:
    """Generate generic indoor room: warm incandescent lighting, carpet/walls, no civil infrastructure."""
    w, h = 1000, 750
    # Warm monochrome indoor tones (mean_r > 165, mean_g > 145, mean_b < 100)
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :, 0] = np.random.randint(180, 200, (h, w), dtype=np.uint8)
    arr[:, :, 1] = np.random.randint(155, 175, (h, w), dtype=np.uint8)
    arr[:, :, 2] = np.random.randint(85, 105, (h, w), dtype=np.uint8)

    img = Image.fromarray(arr, mode="RGB")
    draw = ImageDraw.Draw(img)
    # Wooden furniture / table edge
    draw.rectangle([0, 500, w, h], fill=(130, 90, 55))
    # Wall picture frame
    draw.rectangle([350, 120, 650, 350], fill=(210, 195, 170), outline=(80, 50, 30), width=6)
    return img


def generate_blurry_water_source_image() -> Image.Image:
    """Generate genuine water source evidence with heavy out-of-focus motion blur."""
    sharp_img = generate_water_source_image()
    arr = np.asarray(sharp_img, dtype=np.float32)
    # Apply severe Gaussian blur
    blurred = scipy.ndimage.gaussian_filter(arr, sigma=(18.0, 18.0, 0))
    return Image.fromarray(np.clip(blurred, 0, 255).astype(np.uint8), mode="RGB")


def generate_solar_panel_image() -> Image.Image:
    """Generate authentic solar panel installation: deep blue photovoltaic silicon cells and grid."""
    w, h = 1000, 750
    img = Image.new("RGB", (w, h), color=(140, 170, 210))  # Sky / outdoor background
    draw = ImageDraw.Draw(img)

    # Rooftop / ground frame
    draw.polygon([(150, 600), (850, 600), (750, 250), (250, 250)], fill=(30, 45, 75))

    # Photovoltaic grid cells (deep blue silicon panels with high contrast busbars)
    for col in range(6):
        x1 = 280 + (col * 75)
        x2 = x1 + 65
        for row in range(4):
            y1 = 280 + (row * 70)
            y2 = y1 + 60
            draw.rectangle([x1, y1, x2, y2], fill=(15, 30, 70), outline=(180, 195, 215), width=2)
            # Silicon busbars
            draw.line([(x1 + 20, y1), (x1 + 20, y2)], fill=(200, 215, 230), width=1)
            draw.line([(x1 + 45, y1), (x1 + 45, y2)], fill=(200, 215, 230), width=1)

    return img


def generate_ambiguous_image() -> Image.Image:
    """Generate visually ambiguous outdoor image: neutral gray concrete surface without distinct water or solar features."""
    w, h = 1000, 750
    # Neutral gray tones (r==g==b, not earth tones, not greenery, not sky blue)
    arr = np.ones((h, w, 3), dtype=np.uint8) * 128
    # Moderate texture gradient without sharp mechanical contours
    for i in range(0, h, 32):
        arr[i : i + 16, :, :] = 142
    for j in range(0, w, 32):
        arr[:, j : j + 16, :] = 118
    img = Image.fromarray(arr, mode="RGB")
    return img




def img_to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# =============================================================================
# Reproducible 10-Scenario Test Suite Execution
# =============================================================================

def run_all_scenarios():
    print("=" * 78)
    print("HORIZON — AI EVIDENCE VERIFICATION & SUBMISSION CALIBRATION TEST SUITE")
    print("=" * 78)
    print("Executing 10 mandatory evaluation scenarios against real visual algorithms...\n")

    results = []

    # Scenario 1: Water-source task with a genuine water-source image
    print("[1/10] Water-source task with genuine water-source image...")
    img1 = generate_water_source_image()
    eval1 = EvidenceEvaluator.evaluate_pil_image(
        img1, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    passed1 = eval1.automated_recommendation == QualityStatus.PASS and eval1.relevance.status == RelevanceStatus.RELEVANT
    print(f"       -> Recommendation: {eval1.automated_recommendation.value} | Relevance: {eval1.relevance.status.value} (score: {eval1.relevance.relevance_score})")
    print(f"       -> Matched Concepts: {eval1.relevance.matched_concepts[:2]}")
    results.append(("1. Genuine Water Source", passed1, f"Expected PASS / RELEVANT -> Got {eval1.automated_recommendation.value}"))

    # Scenario 2: Water-source task with a laptop/coding image
    print("\n[2/10] Water-source task with laptop/coding screen image...")
    img2 = generate_laptop_coding_image()
    eval2 = EvidenceEvaluator.evaluate_pil_image(
        img2, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    passed2 = (
        eval2.automated_recommendation in [QualityStatus.WARNING, QualityStatus.FAIL]
        and eval2.relevance.status == RelevanceStatus.IRRELEVANT
        and eval2.relevance.is_synthetic_or_screen
    )
    print(f"       -> Recommendation: {eval2.automated_recommendation.value} | Relevance: {eval2.relevance.status.value} (score: {eval2.relevance.relevance_score})")
    print(f"       -> Contradictions: {eval2.relevance.detected_contradictions}")
    results.append(("2. Water Task with Laptop/Code", passed2, f"Expected WARNING/FAIL / IRRELEVANT -> Got {eval2.automated_recommendation.value}"))

    # Scenario 3: Water-source task with a generic indoor image
    print("\n[3/10] Water-source task with generic indoor domestic image...")
    img3 = generate_indoor_domestic_image()
    eval3 = EvidenceEvaluator.evaluate_pil_image(
        img3, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    passed3 = eval3.automated_recommendation in [QualityStatus.WARNING, QualityStatus.FAIL] and eval3.relevance.status == RelevanceStatus.IRRELEVANT
    print(f"       -> Recommendation: {eval3.automated_recommendation.value} | Relevance: {eval3.relevance.status.value} (score: {eval3.relevance.relevance_score})")
    print(f"       -> Contradictions: {eval3.relevance.detected_contradictions}")
    results.append(("3. Water Task with Indoor Image", passed3, f"Expected WARNING/FAIL / IRRELEVANT -> Got {eval3.automated_recommendation.value}"))

    # Scenario 4: Water-source task with a blurry water-source image
    print("\n[4/10] Water-source task with blurry water-source image...")
    img4 = generate_blurry_water_source_image()
    eval4 = EvidenceEvaluator.evaluate_pil_image(
        img4, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    # Quality must catch blur: QualityStatus.WARNING or FAIL
    passed4 = (
        eval4.quality.status in [QualityStatus.WARNING, QualityStatus.FAIL]
        and eval4.quality.blur.is_blurry
        and eval4.automated_recommendation != QualityStatus.PASS
    )
    print(f"       -> Recommendation: {eval4.automated_recommendation.value} | Quality: {eval4.quality.status.value} | Blur Score: {eval4.quality.blur.blur_score:.1f}")
    results.append(("4. Blurry Water Source", passed4, f"Expected Non-PASS / Blurry -> Got {eval4.automated_recommendation.value}"))

    # Scenario 5: Solar installation task with genuine solar-panel image
    print("\n[5/10] Solar installation task with genuine solar-panel image...")
    img5 = generate_solar_panel_image()
    eval5 = EvidenceEvaluator.evaluate_pil_image(
        img5, task_context={"artifact_type": "solar_installation", "task_title": "Rooftop Solar Array Inspection"}
    )
    passed5 = eval5.automated_recommendation == QualityStatus.PASS and eval5.relevance.status == RelevanceStatus.RELEVANT
    print(f"       -> Recommendation: {eval5.automated_recommendation.value} | Relevance: {eval5.relevance.status.value} (score: {eval5.relevance.relevance_score})")
    print(f"       -> Matched Concepts: {eval5.relevance.matched_concepts[:2]}")
    results.append(("5. Genuine Solar Panel", passed5, f"Expected PASS / RELEVANT -> Got {eval5.automated_recommendation.value}"))

    # Scenario 6: Solar installation task with an unrelated image (laptop code)
    print("\n[6/10] Solar installation task with unrelated laptop/coding image...")
    img6 = generate_laptop_coding_image()
    eval6 = EvidenceEvaluator.evaluate_pil_image(
        img6, task_context={"artifact_type": "solar_installation", "task_title": "Rooftop Solar Array Inspection"}
    )
    passed6 = eval6.automated_recommendation in [QualityStatus.WARNING, QualityStatus.FAIL] and eval6.relevance.status == RelevanceStatus.IRRELEVANT
    print(f"       -> Recommendation: {eval6.automated_recommendation.value} | Relevance: {eval6.relevance.status.value} (score: {eval6.relevance.relevance_score})")
    print(f"       -> Contradictions: {eval6.relevance.detected_contradictions}")
    results.append(("6. Solar Task with Unrelated Image", passed6, f"Expected FAIL / IRRELEVANT -> Got {eval6.automated_recommendation.value}"))

    # Scenario 7: Reused/duplicate image
    print("\n[7/10] Reused / duplicate image detection (64-bit DCT pHash collision)...")
    img7_a = generate_water_source_image()
    img7_b = img7_a.copy()  # Exact duplicate
    hash_a = compute_phash_64bit(img7_a)
    hash_b = compute_phash_64bit(img7_b)
    dist = phash_hamming_distance(hash_a, hash_b)

    # Evaluate submission with duplicate images
    sub_req = SubmissionEvidenceEvaluationRequest(
        submission_id="sub-test-dup",
        artifact_type="water_source",
        task_title="Water Source Survey",
        images=[
            ImageInputItem(image_base64=img_to_b64(img7_a), storage_key="photo1.jpg"),
            ImageInputItem(image_base64=img_to_b64(img7_b), storage_key="photo2.jpg"),
        ],
    )
    sub_eval = EvidenceEvaluator.evaluate_submission(sub_req)
    has_dup_flag = any(m.authenticity.is_duplicate for m in sub_eval.media_results)
    passed7 = dist == 0 and has_dup_flag
    print(f"       -> pHash Distance: {dist} | Duplicate Flagged in Submission: {has_dup_flag}")
    results.append(("7. Duplicate Image Detection", passed7, f"Expected Distance 0 & is_duplicate=True -> Got dist={dist}, is_dup={has_dup_flag}"))

    # Scenario 8: Ambiguous image where model requests human review
    print("\n[8/10] Ambiguous image routing to human review (NEEDS_REVIEW)...")
    img8 = generate_ambiguous_image()
    eval8 = EvidenceEvaluator.evaluate_pil_image(
        img8, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    passed8 = eval8.relevance.status == RelevanceStatus.NEEDS_REVIEW or eval8.automated_recommendation == QualityStatus.WARNING
    print(f"       -> Recommendation: {eval8.automated_recommendation.value} | Relevance: {eval8.relevance.status.value} (score: {eval8.relevance.relevance_score})")
    results.append(("8. Ambiguous Image Review Routing", passed8, f"Expected NEEDS_REVIEW / WARNING -> Got {eval8.relevance.status.value}"))

    # Scenario 9: AI service unavailable
    print("\n[9/10] AI service unavailable handling (fail-safe fallback)...")
    from apps.api.app.modules.validation.ai_service import AIValidationService
    safe_fallback = AIValidationService._safe_fallback_result(
        submission_id="sub-offline-test",
        reason="AI verification microservice temporarily unreachable; flagged for manual review.",
    )
    # Critical rule: NEVER return PASS or auto-approval score when service is down!
    passed9 = (
        safe_fallback["overall_status"] == "WARNING"
        and safe_fallback["confidence"] == 0.0
        and safe_fallback["service_unavailable"] is True
    )
    print(f"       -> Overall Status: {safe_fallback['overall_status']} | Confidence: {safe_fallback['confidence']} | Service Unavailable: {safe_fallback.get('service_unavailable')}")
    results.append(("9. AI Service Unavailable", passed9, f"Expected WARNING / 0.0 Conf -> Got {safe_fallback['overall_status']}"))

    # Scenario 10: Image upload or decoding failure
    print("\n[10/10] Image upload or decoding failure handling...")
    corrupt_bytes = b"CORRUPTED_NON_IMAGE_BINARY_DATA_PAYLOAD"
    eval10 = EvidenceEvaluator.evaluate_image_bytes(
        corrupt_bytes,
        task_context={"artifact_type": "water_source"},
        storage_key="corrupt_upload.png",
    )
    passed10 = eval10.automated_recommendation == QualityStatus.FAIL and eval10.quality.status == QualityStatus.FAIL
    print(f"       -> Recommendation: {eval10.automated_recommendation.value} | Quality: {eval10.quality.status.value} | Reason: {eval10.reasons[0]}")
    results.append(("10. Corrupt / Invalid Image Payload", passed10, f"Expected FAIL -> Got {eval10.automated_recommendation.value}"))

    # Summary
    print("\n" + "=" * 78)
    print("TEST SUITE RESULTS SUMMARY")
    print("=" * 78)
    all_passed = True
    for name, passed, detail in results:
        status_str = "[PASS]" if passed else "[FAIL]"
        if not passed:
            all_passed = False
        print(f"{status_str:8} | {name:36} | {detail}")

    print("=" * 78)
    print(f"Final Outcome: {len([r for r in results if r[1]])}/10 Scenarios Passed")
    print("=" * 78)

    assert all_passed, "One or more calibration test scenarios failed!"
    return all_passed


# =============================================================================
# Pytest Test Functions for Individual Scenario Execution & CI Automation
# =============================================================================

def test_scenario_1_genuine_water_source():
    img = generate_water_source_image()
    eval_res = EvidenceEvaluator.evaluate_pil_image(
        img, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    assert eval_res.automated_recommendation == QualityStatus.PASS
    assert eval_res.relevance.status == RelevanceStatus.RELEVANT
    assert eval_res.relevance.relevance_score >= 0.70


def test_scenario_2_water_source_with_laptop_coding_screen():
    img = generate_laptop_coding_image()
    eval_res = EvidenceEvaluator.evaluate_pil_image(
        img, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    assert eval_res.automated_recommendation in [QualityStatus.WARNING, QualityStatus.FAIL]
    assert eval_res.relevance.status == RelevanceStatus.IRRELEVANT
    assert eval_res.relevance.is_synthetic_or_screen is True
    assert len(eval_res.relevance.detected_contradictions) > 0


def test_scenario_3_water_source_with_generic_indoor_image():
    img = generate_indoor_domestic_image()
    eval_res = EvidenceEvaluator.evaluate_pil_image(
        img, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    assert eval_res.automated_recommendation in [QualityStatus.WARNING, QualityStatus.FAIL]
    assert eval_res.relevance.status == RelevanceStatus.IRRELEVANT


def test_scenario_4_water_source_with_blurry_image():
    img = generate_blurry_water_source_image()
    eval_res = EvidenceEvaluator.evaluate_pil_image(
        img, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    assert eval_res.quality.status in [QualityStatus.WARNING, QualityStatus.FAIL]
    assert eval_res.quality.blur.is_blurry is True
    assert eval_res.automated_recommendation != QualityStatus.PASS


def test_scenario_5_genuine_solar_panel():
    img = generate_solar_panel_image()
    eval_res = EvidenceEvaluator.evaluate_pil_image(
        img, task_context={"artifact_type": "solar_installation", "task_title": "Rooftop Solar Array Inspection"}
    )
    assert eval_res.automated_recommendation == QualityStatus.PASS
    assert eval_res.relevance.status == RelevanceStatus.RELEVANT


def test_scenario_6_solar_installation_with_unrelated_image():
    img = generate_laptop_coding_image()
    eval_res = EvidenceEvaluator.evaluate_pil_image(
        img, task_context={"artifact_type": "solar_installation", "task_title": "Rooftop Solar Array Inspection"}
    )
    assert eval_res.automated_recommendation in [QualityStatus.WARNING, QualityStatus.FAIL]
    assert eval_res.relevance.status == RelevanceStatus.IRRELEVANT


def test_scenario_7_duplicate_image_detection():
    img_a = generate_water_source_image()
    img_b = img_a.copy()
    hash_a = compute_phash_64bit(img_a)
    hash_b = compute_phash_64bit(img_b)
    dist = phash_hamming_distance(hash_a, hash_b)
    assert dist == 0

    sub_req = SubmissionEvidenceEvaluationRequest(
        submission_id="sub-test-dup",
        artifact_type="water_source",
        task_title="Water Source Survey",
        images=[
            ImageInputItem(image_base64=img_to_b64(img_a), storage_key="photo1.jpg"),
            ImageInputItem(image_base64=img_to_b64(img_b), storage_key="photo2.jpg"),
        ],
    )
    sub_eval = EvidenceEvaluator.evaluate_submission(sub_req)
    assert any(m.authenticity.is_duplicate for m in sub_eval.media_results)


def test_scenario_8_ambiguous_image_routing():
    img = generate_ambiguous_image()
    eval_res = EvidenceEvaluator.evaluate_pil_image(
        img, task_context={"artifact_type": "water_source", "task_title": "Community Water Source Survey"}
    )
    assert eval_res.relevance.status == RelevanceStatus.NEEDS_REVIEW or eval_res.automated_recommendation == QualityStatus.WARNING


def test_scenario_9_ai_service_unavailable():
    from apps.api.app.modules.validation.ai_service import AIValidationService
    safe_fallback = AIValidationService._safe_fallback_result(
        submission_id="sub-offline-test",
        reason="AI verification microservice temporarily unreachable; flagged for manual review.",
    )
    assert safe_fallback["overall_status"] == "WARNING"
    assert safe_fallback["confidence"] == 0.0
    assert safe_fallback["service_unavailable"] is True


def test_scenario_10_corrupt_invalid_image():
    corrupt_bytes = b"CORRUPTED_NON_IMAGE_BINARY_DATA_PAYLOAD"
    eval_res = EvidenceEvaluator.evaluate_image_bytes(
        corrupt_bytes,
        task_context={"artifact_type": "water_source"},
        storage_key="corrupt_upload.png",
    )
    assert eval_res.automated_recommendation == QualityStatus.FAIL
    assert eval_res.quality.status == QualityStatus.FAIL


if __name__ == "__main__":
    success = run_all_scenarios()
    sys.exit(0 if success else 1)
