import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.models.submission import Submission
from app.database.models.verification import Verification

logger = logging.getLogger(__name__)


class AIValidationService:
    """Service bridge connecting Horizon backend API to the decoupled AI image quality engine."""

    SIMULATE_FAILURE: bool = False  # Hook for failure recovery testing

    @classmethod
    def evaluate_submission_media(
        cls, db: Session, submission: Submission
    ) -> Dict[str, Any]:
        """Evaluate image quality for all media records attached to a submission.
        
        Guarantees deterministic output and safe fallback if AI service is offline.
        """
        if cls.SIMULATE_FAILURE:
            logger.warning("AIValidationService failure simulation triggered.")
            return cls._safe_fallback_result(
                submission_id=str(submission.id),
                reason="AI quality microservice error: Simulated service outage (fail-safe fallback).",
            )

        if not submission.media:
            return {
                "submission_id": str(submission.id),
                "overall_status": "FAIL",
                "status": "FAIL",
                "confidence": 0.95,
                "media_results": [],
                "reasons": ["No media evidence attached to submission for AI evaluation."],
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
            }

        # Build image payload for AI service
        images_payload: List[Dict[str, Any]] = []
        for m in submission.media:
            meta = m.media_metadata or {}
            images_payload.append(
                {
                    "media_id": str(m.id),
                    "storage_key": m.storage_key,
                    "image_base64": meta.get("image_base64") or meta.get("base64"),
                    "file_path": meta.get("file_path"),
                    "metadata": meta,
                }
            )

        request_body = {
            "submission_id": str(submission.id),
            "images": images_payload,
        }

        # Attempt 1: Call standalone AI microservice over HTTP
        try:
            url = f"{settings.AI_SERVICE_URL.rstrip('/')}/quality/evaluate"
            with httpx.Client(timeout=0.5) as client:
                headers = {"Content-Type": "application/json"}
                if getattr(settings, "AI_SERVICE_API_KEY", None):
                    headers["X-API-Key"] = settings.AI_SERVICE_API_KEY
                
                resp = client.post(url, json=request_body, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    # Standardize fields
                    if "status" not in data and "overall_status" in data:
                        data["status"] = data["overall_status"]
                    return data
                else:
                    logger.warning(
                        f"AI service returned non-200 code: {resp.status_code} - {resp.text}"
                    )
        except Exception as net_err:
            logger.info(
                f"AI microservice HTTP call failed ({net_err}). Attempting in-process evaluation fallback..."
            )

        # Attempt 2: High-reliability in-process evaluation fallback
        try:
            import sys
            from pathlib import Path
            repo_root = str(Path(__file__).resolve().parents[5])
            if repo_root not in sys.path:
                sys.path.insert(0, repo_root)

            from services.ai.app.schemas.quality import SubmissionQualityEvaluationRequest
            from services.ai.app.services.quality_evaluator import ImageQualityEvaluator

            req = SubmissionQualityEvaluationRequest(**request_body)
            eval_result = ImageQualityEvaluator.evaluate_submission(req)
            data = eval_result.model_dump()
            data["status"] = data.get("overall_status")
            return data
        except Exception as in_proc_err:
            logger.warning(
                f"In-process AI fallback unavailable or failed: {in_proc_err}. Engaging safe fallback."
            )

        # Attempt 3: Fail-safe fallback - never crash or block submission lifecycle
        return cls._safe_fallback_result(
            submission_id=str(submission.id),
            reason="AI quality microservice temporarily unreachable; flagged for manual review.",
        )

    @classmethod
    def _safe_fallback_result(cls, submission_id: str, reason: str) -> Dict[str, Any]:
        """Generate safe fallback response when AI services are unreachable."""
        return {
            "submission_id": submission_id,
            "overall_status": "WARNING",
            "status": "WARNING",
            "confidence": 0.0,
            "media_results": [],
            "reasons": [reason],
            "service_unavailable": True,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    def record_ai_result(
        cls, db: Session, submission: Submission, ai_data: Dict[str, Any]
    ) -> Verification:
        """Persist AI quality evaluation results into the Verification record."""
        verification = (
            db.query(Verification)
            .filter(Verification.submission_id == submission.id)
            .first()
        )
        overall_status = ai_data.get("overall_status") or ai_data.get("status") or "PENDING"
        confidence = float(ai_data.get("confidence", 0.0))

        if not verification:
            verification = Verification(
                submission_id=submission.id,
                status="pending",
                ai_status=overall_status,
                ai_confidence_score=confidence,
                ai_results=ai_data,
            )
            db.add(verification)
        else:
            verification.ai_status = overall_status
            verification.ai_confidence_score = confidence
            verification.ai_results = ai_data

        db.commit()
        db.refresh(verification)
        return verification
