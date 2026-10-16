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
        import os
        images_payload: List[Dict[str, Any]] = []
        for m in submission.media:
            meta = m.media_metadata or {}
            f_path = meta.get("file_path")
            if not f_path and m.storage_key:
                try:
                    from app.core.storage import get_safe_local_path
                    local_p = get_safe_local_path(m.storage_key)
                    if local_p.exists():
                        f_path = str(local_p)
                except Exception:
                    pass
            img_b64 = meta.get("image_base64") or meta.get("base64")
            if not img_b64 and f_path and os.path.exists(f_path):
                try:
                    import base64
                    with open(f_path, "rb") as f:
                        img_b64 = base64.b64encode(f.read()).decode("utf-8")
                except Exception:
                    pass

            images_payload.append(
                {
                    "media_id": str(m.id),
                    "storage_key": m.storage_key,
                    "image_base64": img_b64,
                    "file_path": f_path,
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
            p = Path(__file__).resolve()
            repo_root = next((str(parent) for parent in p.parents if (parent / "services" / "ai").exists()), None)
            if repo_root and repo_root not in sys.path:
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
            "relevance_status": "UNAVAILABLE",
            "quality_status": "UNAVAILABLE",
            "confidence": 0.0,
            "relevance_score": 0.0,
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
        service_unavailable = bool(ai_data.get("service_unavailable", False)) or (overall_status in ["UNAVAILABLE", "verification_unavailable"])

        # Fail-safe and relevance enforcement
        if overall_status == "FAIL" or relevance_status == "IRRELEVANT":
            is_blocked = True
            target_status = "flagged"
        elif service_unavailable:
            is_blocked = True
            target_status = "verification_unavailable"
        elif overall_status == "WARNING" or relevance_status == "NEEDS_REVIEW":
            is_blocked = False
            target_status = "under_review"
        else:
            is_blocked = False
            target_status = "pending"

        if not verification:
            verification = Verification(
                submission_id=submission.id,
                status=target_status,
                ai_status=overall_status,
                ai_confidence_score=confidence,
                ai_results=ai_data,
            )
            db.add(verification)
        else:
            verification.ai_status = overall_status
            verification.ai_confidence_score = confidence
            verification.ai_results = ai_data
            if is_blocked and verification.status not in ["approved", "verified"]:
                verification.status = target_status
            elif not is_blocked and verification.status in ["verification_unavailable", "flagged"]:
                verification.status = target_status
            elif verification.status == "pending" and target_status == "under_review":
                verification.status = "under_review"

        # Reflect blocking status on submission model if not previously finalized
        if is_blocked and submission.status not in ["approved", "verified"]:
            submission.status = target_status
        elif not is_blocked and submission.status in ["verification_unavailable", "flagged"]:
            submission.status = "under_review" if target_status == "under_review" else "submitted"
        elif submission.status == "submitted" and target_status == "under_review":
            submission.status = "under_review"

        db.commit()
        db.refresh(verification)
        return verification

