import io
import sys
import base64
from pathlib import Path
import pytest
from unittest.mock import patch
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

# Ensure repo root is in sys.path
_p = Path(__file__).resolve()
_repo_root = next((str(parent) for parent in _p.parents if (parent / "tests" / "test_ai_evidence_verification.py").exists()), None)
if _repo_root and _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

import uuid
from app.database.models.submission import Submission
from app.database.models.verification import Verification
from app.database.models.consensus import ConsensusRecord
from app.database.models.pipeline import EtlPipelineRun
from app.database.models.task_schema import TaskFormSchema
from app.modules.validation.ai_service import AIValidationService
from app.modules.consensus.service import (
    evaluate_consensus_quorum,
    settle_consensus,
    resolve_submission_dispute,
)
from app.modules.pipeline.service import extract_approved_submissions
import importlib.util
_spec = importlib.util.spec_from_file_location(
    "root_ai_test_verification",
    str(Path(_repo_root) / "tests" / "test_ai_evidence_verification.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

generate_water_source_image = _mod.generate_water_source_image
generate_laptop_coding_image = _mod.generate_laptop_coding_image
generate_solar_panel_image = _mod.generate_solar_panel_image
img_to_b64 = _mod.img_to_b64


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _create_test_task_and_draft(
    client: TestClient,
    admin_headers: dict,
    prefix: str,
    title: str = "Community Water Source Survey",
    artifact_type: str = "water_source",
    db_session: Session = None,
):
    """Helper to register a task, contributor, and create a draft submission."""
    # 1. Admin creates task
    t_res = client.post(
        "/api/v1/admin/tasks",
        headers=admin_headers,
        json={
            "title": title,
            "description": f"Field observation for {title}",
            "artifact_type": artifact_type,
            "latitude": 18.52043,
            "longitude": 73.85674,
            "difficulty": 1.0,
            "scarcity": 1.0,
            "base_reward": 100,
            "commitment_stake": 20,
            "status": "published",
        },
    )
    assert t_res.status_code == 201
    task_id = t_res.json()["id"]

    if db_session:
        schema = TaskFormSchema(
            task_id=uuid.UUID(task_id),
            version=1,
            schema_definition={
                "fields": [
                    {"id": "operational_status", "label": "Operational Status", "type": "select", "options": ["operational", "broken"], "required": True},
                    {"id": "water_clarity", "label": "Water Clarity", "type": "select", "options": ["clear", "cloudy"], "required": True},
                    {"id": "panel_condition", "label": "Panel Condition", "type": "select", "options": ["intact", "microcracks"], "required": False},
                    {"id": "shading_obstructions", "label": "Canopy Shading", "type": "select", "options": ["none", "dense_overhang"], "required": False},
                ],
                "minimum_photos": 1,
            },
        )
        db_session.add(schema)
        db_session.commit()

    # 2. Contributor registers
    u_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{prefix}@horizon.dev",
            "username": prefix,
            "password": "Password123!",
            "role": "contributor",
        },
    )
    assert u_res.status_code == 201
    user_token = u_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 3. Contributor stakes task
    c_res = client.post(f"/api/v1/tasks/{task_id}/claim", headers=user_headers)
    assert c_res.status_code in (200, 201)

    # 4. Create draft
    d_res = client.post(
        f"/api/v1/tasks/{task_id}/submission",
        headers=user_headers,
        json={
            "latitude": 18.52044,
            "longitude": 73.85675,
            "gps_accuracy": 4.0,
            "form_data": {
                "operational_status": "operational",
                "water_clarity": "clear",
                "panel_condition": "intact",
                "shading_obstructions": "none",
                "flow_rate_estimate": 12.0,
                "operational_condition": "satisfactory",
                "verification_observations": "On-site verified ground truth observations.",
            },
        },
    )
    assert d_res.status_code == 201
    sub_id = d_res.json()["id"]

    return task_id, sub_id, user_headers


def test_1_laptop_image_fails_water_source_relevance(client: TestClient, admin_headers: dict, db_session: Session):
    """Scenario 1: A laptop image submitted for a water-source survey fails relevance verification and blocks approval."""
    task_id, sub_id, user_headers = _create_test_task_and_draft(
        client, admin_headers, prefix="laptop_water_sub", title="Community Water Source Survey", artifact_type="water_source", db_session=db_session
    )

    laptop_b64 = img_to_b64(generate_laptop_coding_image())

    # Attach laptop image evidence
    m_res = client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": f"media/{sub_id}/laptop_coding.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": laptop_b64, "width": 1000, "height": 750},
        },
    )
    assert m_res.status_code == 201

    # Finalize observation submission (triggers deterministic + AI verification)
    s_res = client.post(f"/api/v1/submissions/{sub_id}/submit", headers=user_headers)
    assert s_res.status_code == 200

    # Query DB verification record
    sub = db_session.query(Submission).filter(Submission.id == sub_id).first()
    v = db_session.query(Verification).filter(Verification.submission_id == sub_id).first()

    assert v is not None
    # Real algorithms must flag irrelevant evidence with IRRELEVANT status requiring admin review
    assert v.ai_status == "WARNING"
    assert v.status == "under_review"
    assert sub.status == "under_review"
    assert v.ai_results.get("relevance_status") == "IRRELEVANT"
    assert any("not relevant" in r.lower() for r in v.ai_results.get("reasons", []))

    # Admin reviews and approves submission with standard authority
    review_res = client.post(
        f"/api/v1/admin/submissions/{sub_id}/review",
        headers=admin_headers,
        json={"status": "approved", "notes": "Admin reviewed and approved."},
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"


def test_2_genuine_water_source_image_passes(client: TestClient, admin_headers: dict, db_session: Session):
    """Scenario 2: A relevant water-source image passes when the actual model returns a successful passing result."""
    task_id, sub_id, user_headers = _create_test_task_and_draft(
        client, admin_headers, prefix="genuine_water_sub", title="Community Water Source Survey", artifact_type="water_source", db_session=db_session
    )

    water_b64 = img_to_b64(generate_water_source_image())

    m_res = client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": f"media/{sub_id}/water_source.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": water_b64, "width": 1000, "height": 750},
        },
    )
    assert m_res.status_code == 201

    s_res = client.post(f"/api/v1/submissions/{sub_id}/submit", headers=user_headers)
    assert s_res.status_code == 200

    v = db_session.query(Verification).filter(Verification.submission_id == sub_id).first()
    assert v is not None
    assert v.ai_status == "PASS"
    assert v.ai_results.get("relevance_status") == "RELEVANT"

    # Genuine submission can be approved
    review_res = client.post(
        f"/api/v1/admin/submissions/{sub_id}/review",
        headers=admin_headers,
        json={"status": "approved", "notes": "Genuine water source verified."},
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"


def test_3_ai_service_unavailability_does_not_produce_approval(client: TestClient, admin_headers: dict, db_session: Session):
    """Scenario 3: AI service timeout or unavailability does not produce approval and fails safely."""
    task_id, sub_id, user_headers = _create_test_task_and_draft(
        client, admin_headers, prefix="unavail_sub", title="Community Water Source Survey", artifact_type="water_source", db_session=db_session
    )

    water_b64 = img_to_b64(generate_water_source_image())
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": f"media/{sub_id}/field_photo.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": water_b64, "width": 1000, "height": 750},
        },
    )

    # Simulate AI microservice outage
    try:
        AIValidationService.SIMULATE_FAILURE = True
        s_res = client.post(f"/api/v1/submissions/{sub_id}/submit", headers=user_headers)
        assert s_res.status_code == 200
    finally:
        AIValidationService.SIMULATE_FAILURE = False

    sub = db_session.query(Submission).filter(Submission.id == sub_id).first()
    v = db_session.query(Verification).filter(Verification.submission_id == sub_id).first()

    assert v is not None
    assert v.status == "verification_unavailable"
    assert sub.status == "verification_unavailable"
    assert v.ai_confidence_score == 0.0
    assert v.ai_results.get("service_unavailable") is True

    # Admin approval MUST be blocked while verification is unavailable
    review_res = client.post(
        f"/api/v1/admin/submissions/{sub_id}/review",
        headers=admin_headers,
        json={"status": "approved", "notes": "Unsafe attempt to approve offline verification"},
    )
    assert review_res.status_code == 422
    assert review_res.json()["detail"]["code"] == "VERIFICATION_UNAVAILABLE"

    # Retry verification via new retry endpoint when service is back online
    retry_res = client.post(f"/api/v1/admin/submissions/{sub_id}/verify", headers=admin_headers)
    assert retry_res.status_code == 200
    assert retry_res.json()["ai_status"] == "PASS"

    # Now that verification succeeded, approval is permitted
    approved_res = client.post(
        f"/api/v1/admin/submissions/{sub_id}/review",
        headers=admin_headers,
        json={"status": "approved", "notes": "Approved after verification retry succeeded."},
    )
    assert approved_res.status_code == 200
    assert approved_res.json()["status"] == "approved"


def test_4_mixed_submission_fails_all_images_relevance_policy(client: TestClient, admin_headers: dict, db_session: Session):
    """Scenario 4: A mixed submission containing 1 relevant and 1 irrelevant image fails all-images policy."""
    task_id, sub_id, user_headers = _create_test_task_and_draft(
        client, admin_headers, prefix="mixed_sub", title="Community Water Source Survey", artifact_type="water_source", db_session=db_session
    )

    water_b64 = img_to_b64(generate_water_source_image())
    laptop_b64 = img_to_b64(generate_laptop_coding_image())

    # Photo 1: Relevant water source
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": f"media/{sub_id}/photo1_water.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": water_b64, "width": 1000, "height": 750},
        },
    )
    # Photo 2: Irrelevant laptop
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": f"media/{sub_id}/photo2_laptop.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": laptop_b64, "width": 1000, "height": 750},
        },
    )

    s_res = client.post(f"/api/v1/submissions/{sub_id}/submit", headers=user_headers)
    assert s_res.status_code == 200

    v = db_session.query(Verification).filter(Verification.submission_id == sub_id).first()
    sub = db_session.query(Submission).filter(Submission.id == sub_id).first()

    assert v.ai_status == "WARNING"
    assert v.ai_results.get("relevance_status") == "IRRELEVANT"
    assert v.status == "under_review"
    assert sub.status == "under_review"

    # Admin can review and approve mixed submission
    review_res = client.post(
        f"/api/v1/admin/submissions/{sub_id}/review",
        headers=admin_headers,
        json={"status": "approved", "notes": "Approved mixed submission upon admin review"},
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"


def test_5_peer_consensus_cannot_override_mandatory_relevance_failure(client: TestClient, admin_headers: dict, db_session: Session):
    """Scenario 5: Peer consensus quorum cannot override a mandatory relevance failure."""
    task_id, sub_id, user_headers = _create_test_task_and_draft(
        client, admin_headers, prefix="consensus_override_test", title="Community Water Source Survey", artifact_type="water_source", db_session=db_session
    )

    laptop_b64 = img_to_b64(generate_laptop_coding_image())
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": f"media/{sub_id}/laptop.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": laptop_b64, "width": 1000, "height": 750},
        },
    )
    client.post(f"/api/v1/submissions/{sub_id}/submit", headers=user_headers)

    # Register 3 reviewers to form an approving consensus quorum
    for i in range(3):
        rev_prefix = f"reviewer_override_{i}"
        reg_res = client.post(
            "/api/v1/auth/register",
            json={"email": f"{rev_prefix}@horizon.dev", "username": rev_prefix, "password": "Password123!", "role": "reviewer"},
        )
        assert reg_res.status_code == 201
        rev_token = reg_res.json()["access_token"]
        rev_headers = {"Authorization": f"Bearer {rev_token}"}

        # Cast positive APPROVE ballot
        ballot_res = client.post(
            f"/api/v1/submissions/{sub_id}/peer-reviews",
            headers=rev_headers,
            json={"decision": "APPROVE", "notes": "Blind positive vote by peer reviewer."},
        )
        assert ballot_res.status_code == 201

    # Check consensus record in DB
    consensus = db_session.query(ConsensusRecord).filter(ConsensusRecord.submission_id == sub_id).first()
    sub = db_session.query(Submission).filter(Submission.id == sub_id).first()
    v = db_session.query(Verification).filter(Verification.submission_id == sub_id).first()

    # Consensus must NEVER be APPROVED when AI relevance failed!
    assert consensus.status == "DISPUTED"
    assert sub.status == "flagged"
    assert v.status == "flagged"

    # Dispute resolution with action='approve' succeeds because admin has human decision authority
    dispute_res = client.post(
        f"/api/v1/submissions/{sub_id}/dispute/resolve",
        headers=admin_headers,
        json={"resolve_action": "approve", "notes": "Admin approved dispute upon manual inspection"},
    )
    assert dispute_res.status_code == 200


def test_6_blocked_submissions_cannot_receive_tkn_or_enter_verified_data(client: TestClient, admin_headers: dict, db_session: Session):
    """Scenario 6: Blocked submissions cannot receive approval-dependent TKN rewards or enter verified-data output."""
    task_id, sub_id, user_headers = _create_test_task_and_draft(
        client, admin_headers, prefix="tkn_blocked_test", title="Community Water Source Survey", artifact_type="water_source", db_session=db_session
    )

    laptop_b64 = img_to_b64(generate_laptop_coding_image())
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": f"media/{sub_id}/laptop.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": laptop_b64, "width": 1000, "height": 750},
        },
    )
    client.post(f"/api/v1/submissions/{sub_id}/submit", headers=user_headers)

    from app.modules.consensus.service import get_or_create_consensus_record
    consensus = get_or_create_consensus_record(db_session, submission_id=sub_id)
    v = db_session.query(Verification).filter(Verification.submission_id == sub_id).first()
    v.validation_status = "FAILED"
    db_session.commit()

    # Even if consensus status is artificially set to APPROVED, settle_consensus must block token payout!
    consensus.status = "APPROVED"
    settle_res = settle_consensus(db_session, consensus, stake_action="refund")
    assert settle_res["status"] == "blocked"
    assert "Token reward payout blocked" in settle_res["message"]

    # ETL verified-data pipeline extraction: Ensure blocked submission is completely excluded
    pipeline_run = EtlPipelineRun(
        dataset_version="v2.0.0-test",
        run_type="full",
        status="RUNNING",
    )
    db_session.add(pipeline_run)
    db_session.commit()

    extracted = extract_approved_submissions(db_session, pipeline_run, artifact_type="water_source")
    extracted_ids = [str(s.id) for s in extracted]
    assert sub_id not in extracted_ids


def test_7_existing_valid_submissions_continue_to_behave_correctly(client: TestClient, admin_headers: dict, db_session: Session):
    """Scenario 7: Existing unrelated task types and valid submissions continue to behave correctly."""
    task_id, sub_id, user_headers = _create_test_task_and_draft(
        client, admin_headers, prefix="solar_valid_test", title="Solar Farm Canopy Inspection", artifact_type="solar_installation", db_session=db_session
    )

    solar_b64 = img_to_b64(generate_solar_panel_image())
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers=user_headers,
        json={
            "storage_key": f"media/{sub_id}/solar_panel.jpg",
            "media_type": "image/jpeg",
            "metadata": {"image_base64": solar_b64, "width": 1000, "height": 750},
        },
    )
    s_res = client.post(f"/api/v1/submissions/{sub_id}/submit", headers=user_headers)
    assert s_res.status_code == 200

    v = db_session.query(Verification).filter(Verification.submission_id == sub_id).first()
    assert v.ai_status == "PASS"
    assert v.ai_results.get("relevance_status") == "RELEVANT"

    # Legitimate submission receives approval and settles tokens
    review_res = client.post(
        f"/api/v1/admin/submissions/{sub_id}/review",
        headers=admin_headers,
        json={"status": "approved", "notes": "Approved valid solar evidence."},
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"
