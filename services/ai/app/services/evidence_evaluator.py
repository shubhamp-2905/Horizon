import io
import base64
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
from PIL import Image, ImageOps
from scipy.fftpack import dct

try:
    from services.ai.app.schemas.quality import (
        QualityStatus,
        BlurMetrics,
        ExposureMetrics,
        ResolutionMetrics,
        ImageQualityResult,
        ImageInputItem,
    )
    from services.ai.app.schemas.verification import (
        RelevanceStatus,
        SemanticRelevanceMetrics,
        AuthenticityMetrics,
        ComprehensiveEvidenceResult,
        SubmissionEvidenceEvaluationRequest,
        SubmissionEvidenceEvaluationResponse,
    )
    from services.ai.app.services.quality_evaluator import ImageQualityEvaluator
    from services.ai.app.services.relevance_evaluator import TaskRelevanceEvaluator
except (ImportError, ModuleNotFoundError):
    from app.schemas.quality import (  # type: ignore
        QualityStatus,
        BlurMetrics,
        ExposureMetrics,
        ResolutionMetrics,
        ImageQualityResult,
        ImageInputItem,
    )
    from app.schemas.verification import (  # type: ignore
        RelevanceStatus,
        SemanticRelevanceMetrics,
        AuthenticityMetrics,
        ComprehensiveEvidenceResult,
        SubmissionEvidenceEvaluationRequest,
        SubmissionEvidenceEvaluationResponse,
    )
    from app.services.quality_evaluator import ImageQualityEvaluator  # type: ignore
    from app.services.relevance_evaluator import TaskRelevanceEvaluator  # type: ignore


def compute_phash_64bit(img: Image.Image) -> str:
    """Compute 64-bit DCT perceptual hash for duplicate detection."""
    try:
        # Resize to 32x32 grayscale
        img_gray = img.convert("L").resize((32, 32), Image.Resampling.LANCZOS)
        pixels = np.asarray(img_gray, dtype=np.float32)

        # 2D discrete cosine transform (ortho normalized)
        dct_rows = dct(pixels, axis=0, norm="ortho")
        dct_2d = dct(dct_rows, axis=1, norm="ortho")

        # Top-left 8x8 frequency matrix (excluding DC baseline term at [0,0])
        dct_low = dct_2d[0:8, 0:8]
        dct_coeffs = dct_low.flatten()[1:]  # 63 coefficients

        med = float(np.median(dct_coeffs))
        diff = dct_low > med
        bit_str = "".join("1" if b else "0" for b in diff.flatten())
        return f"{int(bit_str, 2):016x}"
    except Exception:
        # Fallback difference hash
        try:
            resized = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
            arr = np.asarray(resized)
            diff = arr[:, 1:] > arr[:, :-1]
            bit_str = "".join("1" if b else "0" for b in diff.flatten())
            return f"{int(bit_str, 2):016x}"
        except Exception:
            return "0000000000000000"


def phash_hamming_distance(hash1: str, hash2: str) -> int:
    """Compute hamming distance between two 64-bit hexadecimal perceptual hashes."""
    try:
        v1 = int(hash1, 16)
        v2 = int(hash2, 16)
        return bin(v1 ^ v2).count("1")
    except Exception:
        return 64


class EvidenceEvaluator:
    """Integrated evidence evaluator combining:
    1. Independent Image Quality (MobileNetV3/Laplacian blur, exposure, resolution)
    2. Independent Semantic Task Relevance (MobileCLIP/Spectral Domain Classifier)
    3. Authenticity & Duplicate Detection (64-bit DCT Perceptual Hashing)
    4. Defensive Validation Policy synthesis
    """

    DUPLICATE_HAMMING_THRESHOLD = 8  # Distances <= 8 indicate visually duplicate images

    @classmethod
    def evaluate_pil_image(
        cls,
        img: Image.Image,
        task_context: Optional[Dict[str, Any]] = None,
        media_id: Optional[str] = None,
        storage_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ComprehensiveEvidenceResult:
        """Run independent quality, relevance, and authenticity evaluations on a PIL Image."""
        # 1. Quality evaluation
        quality_res = ImageQualityEvaluator.evaluate_pil_image(
            img, media_id=media_id, storage_key=storage_key, metadata=metadata
        )

        # 2. Semantic relevance evaluation
        relevance_res = TaskRelevanceEvaluator.evaluate_pil_image(img, task_context=task_context)

        # 3. Authenticity / Perceptual Hash
        phash_str = compute_phash_64bit(img)
        authenticity_res = AuthenticityMetrics(
            phash=phash_str,
            is_duplicate=False,
            duplicate_reference=None,
        )

        # 4. Integrate Defensive Decision for this media item
        reasons: List[str] = []

        # 4. Integrate Defensive Decision for this media item
        reasons: List[str] = []

        if quality_res.status == QualityStatus.FAIL:
            recommendation = QualityStatus.FAIL
            reasons.append("QUALITY FAILURE: Image quality is insufficient for inspection.")
            reasons.extend(quality_res.reasons)
        elif quality_res.status == QualityStatus.WARNING:
            recommendation = QualityStatus.WARNING
            reasons.append("QUALITY WARNING: Sub-optimal capture conditions detected.")
            reasons.extend(quality_res.reasons)
        else:
            recommendation = QualityStatus.PASS

        if relevance_res.status == RelevanceStatus.IRRELEVANT:
            # Semantic contradiction forces overall recommendation to FAIL
            recommendation = QualityStatus.FAIL
            reasons.append(
                f"RELEVANCE FAILURE: Evidence does not depict required '{relevance_res.target_artifact_type}' observation. "
                + (f"Contradictions: {', '.join(relevance_res.detected_contradictions)}" if relevance_res.detected_contradictions else "")
            )
            reasons.extend(relevance_res.reasons)
        elif relevance_res.status == RelevanceStatus.NEEDS_REVIEW:
            if recommendation != QualityStatus.FAIL:
                recommendation = QualityStatus.WARNING
            reasons.append("AMBIGUOUS RELEVANCE: Visual evidence requires human reviewer verification.")
            reasons.extend(relevance_res.reasons)
        elif recommendation == QualityStatus.PASS:
            reasons.append(
                f"VERIFIED: Evidence is high-quality and verified relevant to '{relevance_res.target_artifact_type}'."
            )
            reasons.extend(relevance_res.reasons)

        return ComprehensiveEvidenceResult(
            media_id=media_id,
            storage_key=storage_key,
            quality=quality_res,
            relevance=relevance_res,
            authenticity=authenticity_res,
            automated_recommendation=recommendation,
            reasons=reasons,
            status=recommendation,
            confidence=min(quality_res.confidence, relevance_res.relevance_score) if recommendation == QualityStatus.PASS else quality_res.confidence,
            blur=quality_res.blur,
            exposure=quality_res.exposure,
            resolution=quality_res.resolution,
        )

    @classmethod
    def evaluate_image_bytes(
        cls,
        image_bytes: bytes,
        task_context: Optional[Dict[str, Any]] = None,
        media_id: Optional[str] = None,
        storage_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ComprehensiveEvidenceResult:
        """Decode image bytes and perform comprehensive evaluation."""
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                return cls.evaluate_pil_image(
                    img,
                    task_context=task_context,
                    media_id=media_id,
                    storage_key=storage_key,
                    metadata=metadata,
                )
        except Exception as e:
            # Corrupted image bytes
            failed_quality = ImageQualityEvaluator.evaluate_image_bytes(
                image_bytes, media_id=media_id, storage_key=storage_key, metadata=metadata
            )
            failed_relevance = SemanticRelevanceMetrics(
                status=RelevanceStatus.IRRELEVANT,
                relevance_score=0.0,
                target_artifact_type=str((task_context or {}).get("artifact_type") or "unknown"),
                matched_concepts=[],
                detected_contradictions=["corrupt_or_undecodable_image"],
                is_synthetic_or_screen=False,
                reasons=[f"Image decode failed: {str(e)}"],
            )
            return ComprehensiveEvidenceResult(
                media_id=media_id,
                storage_key=storage_key,
                quality=failed_quality,
                relevance=failed_relevance,
                authenticity=AuthenticityMetrics(phash="0000000000000000", is_duplicate=False),
                automated_recommendation=QualityStatus.FAIL,
                reasons=[f"Corrupt or invalid image payload: {str(e)}"],
                status=QualityStatus.FAIL,
                confidence=0.99,
                blur=failed_quality.blur,
                exposure=failed_quality.exposure,
                resolution=failed_quality.resolution,
            )

    @classmethod
    def evaluate_submission(
        cls, req: SubmissionEvidenceEvaluationRequest
    ) -> SubmissionEvidenceEvaluationResponse:
        """Evaluate all evidence items for a submission against task requirements."""
        task_context = {
            "task_id": req.task_id,
            "task_title": req.task_title,
            "task_description": req.task_description,
            "artifact_type": req.artifact_type,
            "requirements": req.requirements or [],
        }

        media_results: List[ComprehensiveEvidenceResult] = []

        if not req.images:
            return SubmissionEvidenceEvaluationResponse(
                submission_id=req.submission_id,
                overall_recommendation=QualityStatus.FAIL,
                confidence=0.95,
                relevance_status=RelevanceStatus.IRRELEVANT,
                quality_status=QualityStatus.FAIL,
                relevance_score=0.0,
                media_results=[],
                reasons=["No media items provided for evidence evaluation."],
                evaluated_at=datetime.now(timezone.utc).isoformat(),
            )

        # 1. Evaluate each media item
        for item in req.images:
            res: Optional[ComprehensiveEvidenceResult] = None
            if item.image_base64:
                try:
                    data = base64.b64decode(item.image_base64)
                    res = cls.evaluate_image_bytes(
                        data,
                        task_context=task_context,
                        media_id=item.media_id,
                        storage_key=item.storage_key,
                        metadata=item.metadata,
                    )
                except Exception as e:
                    res = None

            if not res and item.file_path and os.path.exists(item.file_path):
                try:
                    with open(item.file_path, "rb") as f:
                        data = f.read()
                    res = cls.evaluate_image_bytes(
                        data,
                        task_context=task_context,
                        media_id=item.media_id,
                        storage_key=item.storage_key,
                        metadata=item.metadata,
                    )
                except Exception:
                    res = None

            if not res:
                # Missing or undecodable image binary
                res = cls.evaluate_image_bytes(
                    b"",
                    task_context=task_context,
                    media_id=item.media_id,
                    storage_key=item.storage_key,
                    metadata=item.metadata,
                )

            media_results.append(res)

        # 2. Check for duplicate hashes among media items
        hashes = [m.authenticity.phash for m in media_results if m.authenticity.phash != "0000000000000000"]
        for i in range(len(hashes)):
            for j in range(i + 1, len(hashes)):
                dist = phash_hamming_distance(hashes[i], hashes[j])
                if dist <= cls.DUPLICATE_HAMMING_THRESHOLD:
                    media_results[j].authenticity.is_duplicate = True
                    media_results[j].reasons.append(
                        f"Perceptual duplicate detected: Visual similarity hash matches photo #{i+1} (distance: {dist})"
                    )
                    if media_results[j].automated_recommendation == QualityStatus.PASS:
                        media_results[j].automated_recommendation = QualityStatus.WARNING

        # 3. Overall Decision Synthesis
        recommendations = [m.automated_recommendation for m in media_results]
        relevance_statuses = [m.relevance.status for m in media_results]
        quality_statuses = [m.quality.status for m in media_results]
        relevance_scores = [m.relevance.relevance_score for m in media_results]

        avg_relevance = round(float(np.mean(relevance_scores)), 3) if relevance_scores else 0.0

        overall_reasons: List[str] = []

        has_semantic_contradiction = any(
            m.relevance.status == RelevanceStatus.IRRELEVANT
            and any(c != "corrupt_or_undecodable_image" for c in m.relevance.detected_contradictions)
            for m in media_results
        )
        has_corrupt_payload = any(
            "corrupt_or_undecodable_image" in m.relevance.detected_contradictions
            for m in media_results
        )

        if has_semantic_contradiction:
            overall_rec = QualityStatus.FAIL
            overall_rel = RelevanceStatus.IRRELEVANT
            overall_qual = (
                QualityStatus.FAIL if QualityStatus.FAIL in quality_statuses else QualityStatus.PASS
            )
            overall_conf = round(1.0 - avg_relevance, 2)
            overall_reasons.append(
                f"IRRELEVANT EVIDENCE REJECTED: One or more evidence photos contradicted target '{req.artifact_type}' observation."
            )
            for m in media_results:
                if m.relevance.status == RelevanceStatus.IRRELEVANT:
                    overall_reasons.append(f"Media '{m.storage_key or m.media_id}': {'; '.join(m.reasons)}")

        elif has_corrupt_payload or QualityStatus.FAIL in recommendations:
            overall_rec = QualityStatus.FAIL
            overall_rel = (
                RelevanceStatus.IRRELEVANT
                if has_corrupt_payload
                else (RelevanceStatus.NEEDS_REVIEW if RelevanceStatus.NEEDS_REVIEW in relevance_statuses else RelevanceStatus.RELEVANT)
            )
            overall_qual = QualityStatus.FAIL
            overall_conf = 0.90
            overall_reasons.append(
                "EVIDENCE INTEGRITY / QUALITY FAILED: Media payload was corrupt or quality metrics did not meet verification criteria."
            )
            for m in media_results:
                if m.quality.status == QualityStatus.FAIL or m.automated_recommendation == QualityStatus.FAIL:
                    overall_reasons.append(f"Media '{m.storage_key or m.media_id}': {'; '.join(m.reasons)}")

        elif QualityStatus.WARNING in recommendations or RelevanceStatus.NEEDS_REVIEW in relevance_statuses:
            overall_rec = QualityStatus.WARNING
            overall_rel = RelevanceStatus.NEEDS_REVIEW
            overall_qual = (
                QualityStatus.WARNING if QualityStatus.WARNING in quality_statuses else QualityStatus.PASS
            )
            overall_conf = avg_relevance
            overall_reasons.append(
                "MANUAL REVIEW REQUIRED: Evidence contains quality warnings or ambiguous relevance."
            )
            for m in media_results:
                if m.automated_recommendation == QualityStatus.WARNING:
                    overall_reasons.append(f"Media '{m.storage_key or m.media_id}': {'; '.join(m.reasons)}")

        else:
            overall_rec = QualityStatus.PASS
            overall_rel = RelevanceStatus.RELEVANT
            overall_qual = QualityStatus.PASS
            overall_conf = avg_relevance
            overall_reasons.append(
                f"AUTOMATED VERIFICATION PASSED: Evidence satisfies quality standards and confirms '{req.artifact_type}' requirements."
            )

        return SubmissionEvidenceEvaluationResponse(
            submission_id=req.submission_id,
            overall_recommendation=overall_rec,
            overall_status=overall_rec,
            status=overall_rec,
            confidence=overall_conf,
            relevance_status=overall_rel,
            quality_status=overall_qual,
            relevance_score=avg_relevance,
            media_results=media_results,
            reasons=overall_reasons,
            evaluated_at=datetime.now(timezone.utc).isoformat(),
        )
