import os
import json
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from shapely.geometry import Point
from geoalchemy2.shape import from_shape

from app.core.config import settings
from app.core.security import hash_password, create_access_token
from app.database.models.user import User
from app.database.models.task import Task
from app.database.models.task_claim import TaskClaim
from app.database.models.submission import Submission
from app.database.models.submission_media import SubmissionMedia
from app.database.models.verification import Verification
from app.database.models.consensus import ConsensusRecord
from app.database.models.token import TokenAccount, TokenTransaction
from app.database.models.pipeline import (
    EtlPipelineRun,
    EtlBronzeRecord,
    EtlSilverRecord,
    DownstreamObservation,
    EtlDatasetArtifact,
)


def _create_user(db: Session, email: str, username: str, role: str = "contributor") -> User:
    u = User(
        email=email,
        username=username,
        hashed_password=hash_password("Pass1234!"),
        role=role,
        status="active",
    )
    db.add(u)
    db.flush()
    account = TokenAccount(user_id=u.id, available_balance=200, locked_balance=0)
    db.add(account)
    db.flush()
    db.commit()
    db.refresh(u)
    return u


def _create_task(db: Session, title: str, artifact_type: str = "solar_installation") -> Task:
    task = Task(
        title=title,
        artifact_type=artifact_type,
        status="published",
        difficulty=1.5,
        scarcity=1.2,
        base_reward=100,
        commitment_stake=20,
        requirements=["Panel photo", "Inverter reading"],
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _create_submission(
    db: Session,
    contributor: User,
    task: Task,
    status: str = "approved",
    consensus_status: str = "APPROVED",
    lat: float = 18.5204,
    lng: float = 73.8567,
    gps_accuracy: float = 5.0,
    form_data: dict = None,
) -> Submission:
    if form_data is None:
        form_data = {"panel_condition": "clean", "inverter_kw": 4.2}

    loc_geom = None
    try:
        loc_geom = from_shape(Point(lng, lat), srid=4326)
    except Exception:
        pass

    sub = Submission(
        task_id=task.id,
        user_id=contributor.id,
        location=loc_geom,
        gps_accuracy=gps_accuracy,
        captured_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
        status=status,
        form_data=form_data,
    )
    db.add(sub)
    db.flush()

    # Add media
    media = SubmissionMedia(
        submission_id=sub.id,
        storage_key=f"evidence/{sub.id}/panel_hd.jpg",
        media_type="image/jpeg",
        media_metadata={"width": 1920, "height": 1080},
    )
    db.add(media)

    # Verification
    ver_status = "verified" if status == "approved" else status
    ver = Verification(
        submission_id=sub.id,
        status=ver_status,
        ai_confidence_score=0.92,
        notes=f"Submission {status} in testing",
    )
    db.add(ver)

    # Consensus Record
    consensus = ConsensusRecord(
        submission_id=sub.id,
        status=consensus_status,
        pool_size=3,
        quorum=2,
        total_votes=2,
        approve_votes=2 if consensus_status == "APPROVED" else 0,
        reject_votes=2 if consensus_status == "REJECTED" else 0,
        flag_votes=1 if consensus_status == "DISPUTED" else 0,
        settlement_status="settled" if consensus_status in ["APPROVED", "REJECTED"] else "unsettled",
        settled_at=datetime.now(timezone.utc) if consensus_status == "APPROVED" else None,
    )
    db.add(consensus)

    db.commit()
    db.refresh(sub)
    return sub


def test_pipeline_auth_and_access_control(client: TestClient, db_session: Session):
    """Verify that external API Key and Admin Bearer token are authorized, while unauthorized is blocked."""
    admin = _create_user(db_session, "pipeline_admin@test.com", "p_admin", role="admin")
    admin_token = create_access_token(str(admin.id), role="admin")

    contrib = _create_user(db_session, "pipeline_contrib@test.com", "p_contrib", role="contributor")
    contrib_token = create_access_token(str(contrib.id), role="contributor")

    # 1. No auth -> 401
    res1 = client.get("/api/v1/pipeline/runs")
    assert res1.status_code == 401

    # 2. Contributor token -> 401 / 403
    res2 = client.get("/api/v1/pipeline/runs", headers={"Authorization": f"Bearer {contrib_token}"})
    assert res2.status_code == 401

    # 3. Admin token -> 200
    res3 = client.get("/api/v1/pipeline/runs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res3.status_code == 200

    # 4. External Loupe API Key -> 200
    res4 = client.get("/api/v1/pipeline/runs", headers={"X-Loupe-API-Key": settings.LOUPE_API_KEY})
    assert res4.status_code == 200


def test_approved_record_ingestion_and_bronze_silver_gold_flow(client: TestClient, db_session: Session):
    """Verify full ETL pipeline from extraction to Bronze, Silver, Gold, and Artifact packaging."""
    admin = _create_user(db_session, "etl_admin1@test.com", "etl_adm1", role="admin")
    contrib = _create_user(db_session, "etl_c1@test.com", "etl_c1", role="contributor")
    task = _create_task(db_session, "Solar Rooftop Survey 1", artifact_type="solar_installation")

    sub = _create_submission(db_session, contrib, task, status="approved", consensus_status="APPROVED", lat=18.5204, lng=73.8567)

    admin_token = create_access_token(str(admin.id), role="admin")

    res = client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "dataset_version": "v1.0.0",
            "run_type": "full_refresh",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["records_extracted"] >= 1
    assert data["records_loaded"] >= 1
    assert len(data["artifacts"]) == 3  # GeoJSON, JSON, CSV

    # Verify Bronze Record
    bronze = db_session.query(EtlBronzeRecord).filter(EtlBronzeRecord.submission_id == sub.id).first()
    assert bronze is not None
    assert bronze.raw_payload["task_title"] == "Solar Rooftop Survey 1"

    # Verify Silver Record
    silver = db_session.query(EtlSilverRecord).filter(EtlSilverRecord.submission_id == sub.id).first()
    assert silver is not None
    assert silver.validation_status == "VALID"
    assert silver.quality_score > 0.5

    # Verify Gold DownstreamObservation Record
    gold = db_session.query(DownstreamObservation).filter(DownstreamObservation.submission_id == sub.id).first()
    assert gold is not None
    assert gold.artifact_type == "solar_installation"
    assert round(gold.latitude, 4) == 18.5204
    assert round(gold.longitude, 4) == 73.8567
    assert gold.provenance["source_submission_id"] == str(sub.id)
    assert len(gold.media_references) == 1


def test_rejected_and_disputed_records_excluded(client: TestClient, db_session: Session):
    """Verify that rejected, disputed, and draft submissions are strictly excluded from the pipeline."""
    admin = _create_user(db_session, "etl_admin2@test.com", "etl_adm2", role="admin")
    contrib = _create_user(db_session, "etl_c2@test.com", "etl_c2", role="contributor")
    task = _create_task(db_session, "Forest Canopy Diagnostic", artifact_type="tree_canopy")

    # 1. Approved submission (should be extracted)
    sub_approved = _create_submission(db_session, contrib, task, status="approved", consensus_status="APPROVED", lat=18.5300, lng=73.8500)

    # 2. Rejected submission (must be excluded)
    sub_rejected = _create_submission(db_session, contrib, task, status="rejected", consensus_status="REJECTED", lat=18.5310, lng=73.8510)

    # 3. Disputed submission (must be excluded)
    sub_disputed = _create_submission(db_session, contrib, task, status="under_review", consensus_status="DISPUTED", lat=18.5320, lng=73.8520)

    admin_token = create_access_token(str(admin.id), role="admin")

    res = client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "dataset_version": "v1.0.1",
            "run_type": "full_refresh",
            "artifact_type": "tree_canopy",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "COMPLETED"

    # Verify only approved record reached Gold layer
    gold_records = db_session.query(DownstreamObservation).filter(DownstreamObservation.dataset_version == "v1.0.1").all()
    sub_ids = [str(g.submission_id) for g in gold_records]
    assert str(sub_approved.id) in sub_ids
    assert str(sub_rejected.id) not in sub_ids
    assert str(sub_disputed.id) not in sub_ids


def test_incremental_processing(client: TestClient, db_session: Session):
    """Verify that incremental mode only processes newly approved submissions."""
    admin = _create_user(db_session, "etl_admin3@test.com", "etl_adm3", role="admin")
    contrib = _create_user(db_session, "etl_c3@test.com", "etl_c3", role="contributor")
    task = _create_task(db_session, "Water Well Sensor", artifact_type="water_source")

    # First approved submission
    sub1 = _create_submission(db_session, contrib, task, status="approved", consensus_status="APPROVED", lat=18.5001, lng=73.8001)

    admin_token = create_access_token(str(admin.id), role="admin")

    # Run 1: processes sub1
    res1 = client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v1.2.0", "run_type": "incremental", "artifact_type": "water_source"},
    )
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["records_loaded"] == 1

    # Second approved submission added later
    sub2 = _create_submission(db_session, contrib, task, status="approved", consensus_status="APPROVED", lat=18.5020, lng=73.8020)

    # Run 2: incremental mode should only extract sub2
    res2 = client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v1.2.0", "run_type": "incremental", "artifact_type": "water_source"},
    )
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["records_extracted"] == 1
    assert data2["records_loaded"] == 1

    # Total gold observations for v1.2.0 should be 2
    total_gold = db_session.query(DownstreamObservation).filter(DownstreamObservation.dataset_version == "v1.2.0").count()
    assert total_gold == 2


def test_duplicate_prevention_and_idempotency(client: TestClient, db_session: Session):
    """Verify that multiple pipeline executions do not produce duplicate downstream records."""
    admin = _create_user(db_session, "etl_admin4@test.com", "etl_adm4", role="admin")
    contrib = _create_user(db_session, "etl_c4@test.com", "etl_c4", role="contributor")
    task = _create_task(db_session, "Idempotent Solar Survey", artifact_type="solar_array")

    sub = _create_submission(db_session, contrib, task, status="approved", consensus_status="APPROVED", lat=18.5111, lng=73.8111)

    admin_token = create_access_token(str(admin.id), role="admin")

    # Run 1
    res1 = client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v1.3.0", "run_type": "full_refresh", "artifact_type": "solar_array"},
    )
    assert res1.status_code == 201

    # Run 2 (immediately re-run full refresh)
    res2 = client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v1.3.0", "run_type": "full_refresh", "artifact_type": "solar_array"},
    )
    assert res2.status_code == 201

    # Exactly 1 Gold record must exist for this submission
    count = db_session.query(DownstreamObservation).filter(
        DownstreamObservation.submission_id == sub.id,
        DownstreamObservation.dataset_version == "v1.3.0",
    ).count()
    assert count == 1


def test_schema_validation_and_coordinate_anomaly(client: TestClient, db_session: Session):
    """Verify that submissions with out-of-range coordinates are flagged as INVALID and excluded from Gold layer."""
    admin = _create_user(db_session, "etl_admin5@test.com", "etl_adm5", role="admin")
    contrib = _create_user(db_session, "etl_c5@test.com", "etl_c5", role="contributor")
    task = _create_task(db_session, "Invalid Geo Survey", artifact_type="bad_geo")

    # Invalid latitude 195.0 (> 90.0)
    sub = Submission(
        task_id=task.id,
        user_id=contrib.id,
        gps_accuracy=5.0,
        captured_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
        status="approved",
        form_data={"latitude": 195.0, "longitude": 73.0, "notes": "broken sensor"},
    )
    db_session.add(sub)
    db_session.flush()

    ver = Verification(submission_id=sub.id, status="verified", notes="Auto test")
    db_session.add(ver)

    consensus = ConsensusRecord(
        submission_id=sub.id,
        status="APPROVED",
        total_votes=2,
        approve_votes=2,
        settlement_status="settled",
    )
    db_session.add(consensus)
    db_session.commit()

    admin_token = create_access_token(str(admin.id), role="admin")

    res = client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v1.4.0", "run_type": "full_refresh", "artifact_type": "bad_geo"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["records_failed"] >= 1

    # Verify Silver record marked INVALID
    silver = db_session.query(EtlSilverRecord).filter(EtlSilverRecord.submission_id == sub.id).first()
    assert silver is not None
    assert silver.validation_status == "INVALID"

    # Verify not in Gold layer
    gold = db_session.query(DownstreamObservation).filter(DownstreamObservation.submission_id == sub.id).first()
    assert gold is None


def test_failed_job_retry(client: TestClient, db_session: Session):
    """Verify that a failed pipeline run can be retried and succeeds."""
    admin = _create_user(db_session, "etl_admin6@test.com", "etl_adm6", role="admin")
    admin_token = create_access_token(str(admin.id), role="admin")

    # Create a dummy FAILED pipeline run
    run = EtlPipelineRun(
        pipeline_name="loupe_downstream_etl",
        dataset_version="v1.5.0",
        run_type="incremental",
        status="FAILED",
        error_message="Network glitch during export",
        retry_count=0,
        max_retries=3,
    )
    db_session.add(run)
    db_session.commit()
    db_session.refresh(run)

    res = client.post(
        f"/api/v1/pipeline/runs/{run.id}/retry",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["retry_count"] == 1


def test_dataset_versioning_and_summaries(client: TestClient, db_session: Session):
    """Verify that different dataset versions are tracked independently and summarized."""
    admin = _create_user(db_session, "etl_admin7@test.com", "etl_adm7", role="admin")
    contrib = _create_user(db_session, "etl_c7@test.com", "etl_c7", role="contributor")
    task = _create_task(db_session, "Multi Version Survey", artifact_type="solar_canopy")

    _create_submission(db_session, contrib, task, status="approved", consensus_status="APPROVED", lat=18.52, lng=73.85)

    admin_token = create_access_token(str(admin.id), role="admin")

    # Ingest under v1.0.0
    client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v1.0.0", "run_type": "full_refresh"},
    )

    # Ingest under v2.0.0
    client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v2.0.0", "run_type": "full_refresh"},
    )

    # Query summaries
    res = client.get("/api/v1/pipeline/datasets", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    summaries = res.json()
    versions = [s["dataset_version"] for s in summaries]
    assert "v1.0.0" in versions
    assert "v2.0.0" in versions


def test_geojson_export_correctness(client: TestClient, db_session: Session):
    """Verify that GeoJSON export adheres to RFC 7946 specification."""
    admin = _create_user(db_session, "etl_admin8@test.com", "etl_adm8", role="admin")
    contrib = _create_user(db_session, "etl_c8@test.com", "etl_c8", role="contributor")
    task = _create_task(db_session, "GeoJSON Validation Task", artifact_type="geotag_site")

    _create_submission(db_session, contrib, task, status="approved", consensus_status="APPROVED", lat=18.5555, lng=73.8888)

    admin_token = create_access_token(str(admin.id), role="admin")

    client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v3.0.0", "run_type": "full_refresh", "artifact_type": "geotag_site"},
    )

    # Download GeoJSON
    res = client.get(
        "/api/v1/pipeline/datasets/v3.0.0/export?format=geojson",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert "application/geo+json" in res.headers.get("content-type", "")

    geojson = res.json()
    assert geojson["type"] == "FeatureCollection"
    assert "features" in geojson
    assert len(geojson["features"]) >= 1

    feature = geojson["features"][0]
    assert feature["type"] == "Feature"
    assert feature["geometry"]["type"] == "Point"
    coords = feature["geometry"]["coordinates"]
    assert len(coords) == 2
    assert round(coords[0], 4) == 73.8888  # Longitude
    assert round(coords[1], 4) == 18.5555  # Latitude
    assert "quality_score" in feature["properties"]
    assert "provenance" in feature["properties"]


def test_loupe_sync_dispatch(client: TestClient, db_session: Session):
    """Verify that Loupe sync delivers dataset delivery manifest with checksums."""
    admin = _create_user(db_session, "etl_admin9@test.com", "etl_adm9", role="admin")
    contrib = _create_user(db_session, "etl_c9@test.com", "etl_c9", role="contributor")
    task = _create_task(db_session, "Loupe Sync Task", artifact_type="loupe_target")

    _create_submission(db_session, contrib, task, status="approved", consensus_status="APPROVED", lat=18.50, lng=73.80)

    admin_token = create_access_token(str(admin.id), role="admin")

    # Run ETL
    client.post(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dataset_version": "v4.0.0", "run_type": "full_refresh", "artifact_type": "loupe_target"},
    )

    # 1. Dry run
    res_dry = client.post(
        "/api/v1/pipeline/datasets/v4.0.0/sync-loupe",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"dry_run": True},
    )
    assert res_dry.status_code == 200
    dry_data = res_dry.json()
    assert dry_data["status"] == "DRY_RUN_VALIDATED"
    assert dry_data["dispatch_mode"] == "dry_run"

    # 2. Live / Mock dispatch
    res_sync = client.post(
        "/api/v1/pipeline/datasets/v4.0.0/sync-loupe",
        headers={"X-Loupe-API-Key": settings.LOUPE_API_KEY},
        json={"dry_run": False},
    )
    assert res_sync.status_code == 200
    sync_data = res_sync.json()
    assert sync_data["status"] in ["DELIVERED", "DELIVERED_MOCK"]
    assert sync_data["record_count"] >= 1
    assert len(sync_data["checksum_sha256"]) == 64  # SHA-256 length
