import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.models.submission import Submission
from app.database.models.task import Task
from app.database.models.verification import Verification

logger = logging.getLogger(__name__)


class AIValidationService:
    """Service bridge connecting Horizon backend API to the decoupled AI verification engine."""

    SIMULATE_FAILURE: bool = False  # Hook for failure recovery testing

    @classmethod
    def evaluate_submission_media(
        cls, db: Session, submission: Submission
    ) -> Dict[str, Any]:
        """Evaluate task relevance, image quality, and authenticity for all media attached to a submission.
        
        Guarantees defensive, task-aware evaluation and safe fallback if external AI service is offline.
        """
        if cls.SIMULATE_FAILURE:
            logger.warning("AIValidationService failure simulation triggered.")
            return cls._safe_fallback_result(
                submission_id=str(submission.id),
                reason="AI verification microservice error: Simulated service outage (fail-safe fallback).",
            )

        if not submission.media:
            return {
                "submission_id": str(submission.id),
                "overall_status": "FAIL",
                "overall_recommendation": "FAIL",
                "status": "FAIL",
                "relevance_status": "IRRELEVANT",
                "quality_status": "FAIL",
                "confidence": 0.95,
                "relevance_score": 0.0,
                "media_results": [],
                "reasons": ["No media evidence attached to submission for AI evaluation."],
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
            }

        # Resolve task context for semantic relevance checking
        task = submission.task
        if not task and submission.task_id:
            task = db.query(Task).filter(Task.id == submission.task_id).first()

        task_title = task.title if task else "Geospatial Field Survey"
        task_desc = task.description if task else None
        artifact_type = task.artifact_type if task else "water_source"
        requirements = task.requirements if task and task.requirements else []

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
            "task_id": str(submission.task_id) if submission.task_id else None,
            "task_title": task_title,
            "task_description": task_desc,
            "artifact_type": artifact_type,
            "requirements": requirements,
            "images": images_payload,
        }

        # Attempt 1: Call standalone AI microservice over HTTP with retries & configurable timeout
        timeout_sec = getattr(settings, "AI_SERVICE_TIMEOUT_SECONDS", 3.0)
        max_retries = getattr(settings, "AI_SERVICE_MAX_RETRIES", 1)
        base_url = settings.AI_SERVICE_URL.rstrip("/")
        headers = {"Content-Type": "application/json"}
        if getattr(settings, "AI_SERVICE_API_KEY", None):
            headers["X-API-Key"] = settings.AI_SERVICE_API_KEY

        for attempt in range(max_retries + 1):
            try:
                with httpx.Client(timeout=timeout_sec) as client:
                    # Prefer comprehensive evidence endpoint
                    resp = client.post(f"{base_url}/evidence/evaluate", json=request_body, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if "status" not in data and "overall_recommendation" in data:
                            data["status"] = data["overall_recommendation"]
                            data["overall_status"] = data["overall_recommendation"]
                        return data
                    elif resp.status_code == 404:
                        # Fallback to legacy quality endpoint if older AI microservice container
                        q_resp = client.post(f"{base_url}/quality/evaluate", json=request_body, headers=headers)
                        if q_resp.status_code == 200:
                            data = q_resp.json()
                            if "status" not in data and "overall_status" in data:
                                data["status"] = data["overall_status"]
                            return data
            except (httpx.ConnectError, httpx.ConnectTimeout) as conn_err:
                logger.info(f"AI microservice endpoint unreachable ({conn_err}). Engaging immediate fallback.")
                break
            except Exception as net_err:
                logger.info(
                    f"AI microservice HTTP call attempt {attempt+1}/{max_retries+1} failed ({net_err})."
                )

        logger.info("AI microservice HTTP attempts completed or bypassed. Attempting in-process evaluation fallback...")

        # Attempt 2: High-reliability in-process evaluation fallback
        try:
            import sys
            from pathlib import Path
            repo_root = str(Path(__file__).resolve().parents[5])
            if repo_root not in sys.path:
                sys.path.insert(0, repo_root)

            from services.ai.app.schemas.verification import SubmissionEvidenceEvaluationRequest
            from services.ai.app.services.evidence_evaluator import EvidenceEvaluator

            req = SubmissionEvidenceEvaluationRequest(**request_body)
            eval_result = EvidenceEvaluator.evaluate_submission(req)
            data = eval_result.model_dump()
            data["status"] = data.get("overall_recommendation")
            data["overall_status"] = data.get("overall_recommendation")
            return data
        except Exception as in_proc_err:
            logger.warning(
                f"In-process AI fallback unavailable or failed: {in_proc_err}. Engaging safe fallback."
            )

        # Attempt 3: Fail-safe fallback - defensive review flag, never auto-pass
        return cls._safe_fallback_result(
            submission_id=str(submission.id),
            reason="AI verification microservice temporarily unreachable; flagged for manual review.",
        )

    @classmethod
    def _safe_fallback_result(cls, submission_id: str, reason: str) -> Dict[str, Any]:
        """Generate safe fallback response when AI services are unreachable."""
        return {
            "submission_id": submission_id,
            "overall_status": "WARNING",
            "overall_recommendation": "WARNING",
            "status": "WARNING",
            "relevance_status": "NEEDS_REVIEW",
            "quality_status": "PASS",
            "confidence": 0.0,
            "relevance_score": 0.50,
            "media_results": [],
            "reasons": [reason],
            "service_unavailable": True,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    def record_ai_result(
        cls, db: Session, submission: Submission, ai_data: Dict[str, Any]
    ) -> Verification:
        """Persist AI evidence evaluation results into the Verification record and enforce defensive status flags."""
        verification = (
            db.query(Verification)
            .filter(Verification.submission_id == submission.id)
            .first()
        )
        overall_status = (
            ai_data.get("overall_recommendation")
            or ai_data.get("overall_status")
            or ai_data.get("status")
            or "PENDING"
        )
        confidence = float(ai_data.get("confidence", 0.0))
        relevance_status = ai_data.get("relevance_status")

        # Defensive rule: Irrelevant evidence or failed evaluation forces FLAGGED
        is_blocked = (overall_status == "FAIL") or (relevance_status == "IRRELEVANT")

        if not verification:
            initial_status = "flagged" if is_blocked else ("under_review" if overall_status == "WARNING" else "pending")
            verification = Verification(
                submission_id=submission.id,
                status=initial_status,
                ai_status=overall_status,
                ai_confidence_score=confidence,
                ai_results=ai_data,
            )
            db.add(verification)
        else:
            verification.ai_status = overall_status
            verification.ai_confidence_score = confidence
            verification.ai_results = ai_data
            if is_blocked and verification.status != "approved":
                verification.status = "flagged"

        # Reflect blocking status on submission model if not previously finalized
        if is_blocked and submission.status not in ["approved", "verified"]:
            submission.status = "flagged"

        db.commit()
        db.refresh(verification)
        return verification

