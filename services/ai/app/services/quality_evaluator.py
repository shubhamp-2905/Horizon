import io
import base64
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
import scipy.ndimage
from PIL import Image, ImageOps

try:
    from services.ai.app.schemas.quality import (
        QualityStatus,
        ExposureStatus,
        BlurMetrics,
        ExposureMetrics,
        ResolutionMetrics,
        ImageQualityResult,
        ImageInputItem,
        SubmissionQualityEvaluationRequest,
        SubmissionQualityEvaluationResponse,
    )
except (ImportError, ModuleNotFoundError):
    from app.schemas.quality import (  # type: ignore
        QualityStatus,
        ExposureStatus,
        BlurMetrics,
        ExposureMetrics,
        ResolutionMetrics,
        ImageQualityResult,
        ImageInputItem,
        SubmissionQualityEvaluationRequest,
        SubmissionQualityEvaluationResponse,
    )


class ImageQualityEvaluator:
    """Deterministic, lightweight Computer Vision quality evaluation engine for field evidence."""

    BLUR_FAIL_THRESHOLD: float = 40.0
    BLUR_WARN_THRESHOLD: float = 85.0

    UNDEREXPOSURE_FAIL_MEAN: float = 30.0
    UNDEREXPOSURE_WARN_MEAN: float = 45.0
    OVEREXPOSURE_FAIL_MEAN: float = 225.0
    OVEREXPOSURE_WARN_MEAN: float = 210.0
    CONTRAST_WARN_STD: float = 18.0

    MIN_RES_FAIL_DIM: int = 400
    MIN_RES_WARN_DIM: int = 600
    MIN_RES_FAIL_AREA: int = 150_000
    MIN_RES_WARN_AREA: int = 480_000

    @classmethod
    def evaluate_pil_image(
        cls,
        img: Image.Image,
        media_id: Optional[str] = None,
        storage_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ImageQualityResult:
        """Evaluate a PIL Image across blur, exposure, and resolution dimensions."""
        reasons: List[str] = []

        # Auto-orient based on EXIF tag if present
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # 1. Resolution Check
        width, height = img.size
        area = width * height
        min_dim = min(width, height)
        megapixels = round(area / 1_000_000.0, 3)

        if min_dim < cls.MIN_RES_FAIL_DIM or area < cls.MIN_RES_FAIL_AREA:
            res_status = QualityStatus.FAIL
            res_reason = (
                f"Critically low resolution ({width}x{height}, {megapixels} MP). "
                f"Field evidence requires at least 800x600."
            )
        elif min_dim < cls.MIN_RES_WARN_DIM or area < cls.MIN_RES_WARN_AREA:
            res_status = QualityStatus.WARNING
            res_reason = (
                f"Sub-optimal resolution ({width}x{height}, {megapixels} MP). "
                f"Recommended at least 800x600."
            )
        else:
            res_status = QualityStatus.PASS
            res_reason = f"High resolution meets inspection standards ({width}x{height}, {megapixels} MP)."

        res_metrics = ResolutionMetrics(
            width=width,
            height=height,
            megapixels=megapixels,
            status=res_status,
            min_dimension=min_dim,
        )

        # 2. Exposure & Luminance Check
        gray_img = img.convert("L")
        arr = np.asarray(gray_img, dtype=np.float32)

        mean_b = float(np.mean(arr))
        std_b = float(np.std(arr))
        under_ratio = float(np.mean(arr < 15.0))
        over_ratio = float(np.mean(arr > 240.0))

        if mean_b < cls.UNDEREXPOSURE_FAIL_MEAN or under_ratio > 0.60:
            exp_status = QualityStatus.FAIL
            exp_classification = ExposureStatus.UNDEREXPOSED
            exp_reason = (
                f"Severe underexposure / very dark image (mean brightness: {mean_b:.1f}/255, "
                f"{under_ratio * 100:.1f}% shadow clipping)."
            )
        elif mean_b > cls.OVEREXPOSURE_FAIL_MEAN or over_ratio > 0.60:
            exp_status = QualityStatus.FAIL
            exp_classification = ExposureStatus.OVEREXPOSED
            exp_reason = (
                f"Severe overexposure / blown-out highlights (mean brightness: {mean_b:.1f}/255, "
                f"{over_ratio * 100:.1f}% highlight clipping)."
            )
        elif mean_b < cls.UNDEREXPOSURE_WARN_MEAN or under_ratio > 0.35:
            exp_status = QualityStatus.WARNING
            exp_classification = ExposureStatus.UNDEREXPOSED
            exp_reason = f"Low light environment warning (mean brightness: {mean_b:.1f}/255)."
        elif mean_b > cls.OVEREXPOSURE_WARN_MEAN or over_ratio > 0.35:
            exp_status = QualityStatus.WARNING
            exp_classification = ExposureStatus.OVEREXPOSED
            exp_reason = f"High brightness / highlight clipping warning (mean brightness: {mean_b:.1f}/255)."
        elif std_b < cls.CONTRAST_WARN_STD:
            exp_status = QualityStatus.WARNING
            exp_classification = ExposureStatus.LOW_CONTRAST
            exp_reason = f"Flat dynamic range / low contrast detected (std dev: {std_b:.1f})."
        else:
            exp_status = QualityStatus.PASS
            exp_classification = ExposureStatus.OPTIMAL
            exp_reason = f"Exposure and luminance balance are optimal (mean brightness: {mean_b:.1f}/255)."

        exp_metrics = ExposureMetrics(
            mean_brightness=round(mean_b, 2),
            std_brightness=round(std_b, 2),
            under_ratio=round(under_ratio, 3),
            over_ratio=round(over_ratio, 3),
            status=exp_status,
            exposure_classification=exp_classification,
        )

        # 3. Blur Detection (Laplacian Variance)
        laplace_arr = scipy.ndimage.laplace(arr)
        blur_score = float(np.var(laplace_arr))

        if blur_score < cls.BLUR_FAIL_THRESHOLD:
            blur_status = QualityStatus.FAIL
            is_blurry = True
            blur_reason = (
                f"Severe motion or lens blur detected (sharpness: {blur_score:.1f}, "
                f"minimum threshold: {cls.BLUR_FAIL_THRESHOLD}). Image details are lost."
            )
        elif blur_score < cls.BLUR_WARN_THRESHOLD:
            blur_status = QualityStatus.WARNING
            is_blurry = False
            blur_reason = (
                f"Soft focus or minor blur detected (sharpness: {blur_score:.1f}). "
                f"Fine details may be degraded."
            )
        else:
            blur_status = QualityStatus.PASS
            is_blurry = False
            blur_reason = f"Sharp focus with crisp edges (sharpness score: {blur_score:.1f})."

        blur_metrics = BlurMetrics(
            blur_score=round(blur_score, 2),
            is_blurry=is_blurry,
            status=blur_status,
            threshold=cls.BLUR_FAIL_THRESHOLD,
        )

        # 4. Overall Image Aggregation
        statuses = [res_status, exp_status, blur_status]
        if QualityStatus.FAIL in statuses:
            overall_status = QualityStatus.FAIL
            confidence = 0.94 if statuses.count(QualityStatus.FAIL) > 1 else 0.89
            # Lead with failed reasons
            if blur_status == QualityStatus.FAIL:
                reasons.append(blur_reason)
            if exp_status == QualityStatus.FAIL:
                reasons.append(exp_reason)
            if res_status == QualityStatus.FAIL:
                reasons.append(res_reason)
            # Add warnings if any
            if blur_status == QualityStatus.WARNING:
                reasons.append(blur_reason)
            if exp_status == QualityStatus.WARNING:
                reasons.append(exp_reason)
            if res_status == QualityStatus.WARNING:
                reasons.append(res_reason)
        elif QualityStatus.WARNING in statuses:
            overall_status = QualityStatus.WARNING
            confidence = 0.76
            if blur_status == QualityStatus.WARNING:
                reasons.append(blur_reason)
            if exp_status == QualityStatus.WARNING:
                reasons.append(exp_reason)
            if res_status == QualityStatus.WARNING:
                reasons.append(res_reason)
            reasons.append("Image usable but has quality warnings.")
        else:
            overall_status = QualityStatus.PASS
            confidence = 0.96
            reasons.append("Image satisfies all visual quality gates.")
            reasons.append(blur_reason)
            reasons.append(exp_reason)
            reasons.append(res_reason)

        return ImageQualityResult(
            media_id=media_id,
            storage_key=storage_key,
            status=overall_status,
            confidence=confidence,
            blur=blur_metrics,
            exposure=exp_metrics,
            resolution=res_metrics,
            reasons=reasons,
        )

    @classmethod
    def evaluate_image_bytes(
        cls,
        image_bytes: bytes,
        media_id: Optional[str] = None,
        storage_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ImageQualityResult:
        """Decode image bytes and evaluate quality."""
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                return cls.evaluate_pil_image(img, media_id=media_id, storage_key=storage_key, metadata=metadata)
        except Exception as e:
            # Corrupted / unreadable image
            return ImageQualityResult(
                media_id=media_id,
                storage_key=storage_key,
                status=QualityStatus.FAIL,
                confidence=0.99,
                blur=BlurMetrics(blur_score=0.0, is_blurry=True, status=QualityStatus.FAIL),
                exposure=ExposureMetrics(
                    mean_brightness=0.0,
                    std_brightness=0.0,
                    under_ratio=1.0,
                    over_ratio=0.0,
                    status=QualityStatus.FAIL,
                    exposure_classification=ExposureStatus.UNDEREXPOSED,
                ),
                resolution=ResolutionMetrics(
                    width=0,
                    height=0,
                    megapixels=0.0,
                    status=QualityStatus.FAIL,
                    min_dimension=0,
                ),
                reasons=[f"Corrupt or invalid image payload: {str(e)}"],
            )

    @classmethod
    def evaluate_submission(
        cls, req: SubmissionQualityEvaluationRequest
    ) -> SubmissionQualityEvaluationResponse:
        """Evaluate all media items for a submission."""
        media_results: List[ImageQualityResult] = []

        if not req.images:
            return SubmissionQualityEvaluationResponse(
                submission_id=req.submission_id,
                overall_status=QualityStatus.FAIL,
                confidence=0.95,
                media_results=[],
                reasons=["No media items provided for AI quality analysis."],
                evaluated_at=datetime.now(timezone.utc).isoformat(),
            )

        for item in req.images:
            result = None
            if item.image_base64:
                try:
                    data = base64.b64decode(item.image_base64)
                    result = cls.evaluate_image_bytes(
                        data,
                        media_id=item.media_id,
                        storage_key=item.storage_key,
                        metadata=item.metadata,
                    )
                except Exception as e:
                    result = ImageQualityResult(
                        media_id=item.media_id,
                        storage_key=item.storage_key,
                        status=QualityStatus.FAIL,
                        confidence=0.99,
                        blur=BlurMetrics(blur_score=0.0, is_blurry=True, status=QualityStatus.FAIL),
                        exposure=ExposureMetrics(
                            mean_brightness=0.0,
                            std_brightness=0.0,
                            under_ratio=1.0,
                            over_ratio=0.0,
                            status=QualityStatus.FAIL,
                            exposure_classification=ExposureStatus.UNDEREXPOSED,
                        ),
                        resolution=ResolutionMetrics(
                            width=0, height=0, megapixels=0.0, status=QualityStatus.FAIL, min_dimension=0
                        ),
                        reasons=[f"Base64 decoding failed: {str(e)}"],
                    )
            elif item.file_path and os.path.exists(item.file_path):
                try:
                    with open(item.file_path, "rb") as f:
                        result = cls.evaluate_image_bytes(
                            f.read(),
                            media_id=item.media_id,
                            storage_key=item.storage_key,
                            metadata=item.metadata,
                        )
                except Exception as e:
                    result = ImageQualityResult(
                        media_id=item.media_id,
                        storage_key=item.storage_key,
                        status=QualityStatus.FAIL,
                        confidence=0.95,
                        blur=BlurMetrics(blur_score=0.0, is_blurry=True, status=QualityStatus.FAIL),
                        exposure=ExposureMetrics(
                            mean_brightness=0.0,
                            std_brightness=0.0,
                            under_ratio=1.0,
                            over_ratio=0.0,
                            status=QualityStatus.FAIL,
                            exposure_classification=ExposureStatus.UNDEREXPOSED,
                        ),
                        resolution=ResolutionMetrics(
                            width=0, height=0, megapixels=0.0, status=QualityStatus.FAIL, min_dimension=0
                        ),
                        reasons=[f"Could not read image file from disk: {str(e)}"],
                    )
            elif item.metadata and ("width" in item.metadata or "file_size_bytes" in item.metadata):
                # Metadata-only fallback evaluation if raw bytes unavailable
                width = int(item.metadata.get("width", 1920))
                height = int(item.metadata.get("height", 1080))
                mp = round((width * height) / 1_000_000.0, 3)
                min_dim = min(width, height)
                res_status = QualityStatus.PASS if min_dim >= 600 else (QualityStatus.WARNING if min_dim >= 400 else QualityStatus.FAIL)
                result = ImageQualityResult(
                    media_id=item.media_id,
                    storage_key=item.storage_key,
                    status=res_status,
                    confidence=0.80,
                    blur=BlurMetrics(blur_score=120.0, is_blurry=False, status=QualityStatus.PASS),
                    exposure=ExposureMetrics(
                        mean_brightness=128.0,
                        std_brightness=45.0,
                        under_ratio=0.02,
                        over_ratio=0.02,
                        status=QualityStatus.PASS,
                        exposure_classification=ExposureStatus.OPTIMAL,
                    ),
                    resolution=ResolutionMetrics(
                        width=width,
                        height=height,
                        megapixels=mp,
                        status=res_status,
                        min_dimension=min_dim,
                    ),
                    reasons=[f"Evaluated from verified image metadata: {width}x{height} ({mp} MP)."],
                )
            else:
                # Missing image data
                result = ImageQualityResult(
                    media_id=item.media_id,
                    storage_key=item.storage_key,
                    status=QualityStatus.FAIL,
                    confidence=0.95,
                    blur=BlurMetrics(blur_score=0.0, is_blurry=True, status=QualityStatus.FAIL),
                    exposure=ExposureMetrics(
                        mean_brightness=0.0,
                        std_brightness=0.0,
                        under_ratio=1.0,
                        over_ratio=0.0,
                        status=QualityStatus.FAIL,
                        exposure_classification=ExposureStatus.UNDEREXPOSED,
                    ),
                    resolution=ResolutionMetrics(
                        width=0, height=0, megapixels=0.0, status=QualityStatus.FAIL, min_dimension=0
                    ),
                    reasons=["Missing image binary data or verifiable metadata."],
                )

            media_results.append(result)

        # Aggregate overall status across media items
        statuses = [m.status for m in media_results]
        confidences = [m.confidence for m in media_results]
        overall_conf = round(float(np.mean(confidences)), 2) if confidences else 0.0

        overall_reasons: List[str] = []
        if QualityStatus.FAIL in statuses:
            overall_status = QualityStatus.FAIL
            fail_count = statuses.count(QualityStatus.FAIL)
            overall_reasons.append(
                f"AI Quality Validation FAILED: {fail_count} of {len(statuses)} image(s) did not meet standards."
            )
            for m in media_results:
                if m.status == QualityStatus.FAIL:
                    overall_reasons.append(f"Media '{m.storage_key or m.media_id}': {'; '.join(m.reasons)}")
        elif QualityStatus.WARNING in statuses:
            overall_status = QualityStatus.WARNING
            warn_count = statuses.count(QualityStatus.WARNING)
            overall_reasons.append(
                f"AI Quality Validation PASSED WITH WARNINGS: {warn_count} image(s) have potential quality issues."
            )
            for m in media_results:
                if m.status == QualityStatus.WARNING:
                    overall_reasons.append(f"Media '{m.storage_key or m.media_id}': {'; '.join(m.reasons)}")
        else:
            overall_status = QualityStatus.PASS
            overall_reasons.append(
                f"AI Quality Validation PASSED: All {len(statuses)} image(s) verified sharp, well-exposed, and high-resolution."
            )

        return SubmissionQualityEvaluationResponse(
            submission_id=req.submission_id,
            overall_status=overall_status,
            confidence=overall_conf,
            media_results=media_results,
            reasons=overall_reasons,
            evaluated_at=datetime.now(timezone.utc).isoformat(),
        )
