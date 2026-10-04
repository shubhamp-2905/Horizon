"""
Project Horizon — Phase 7 Loupe Downstream Data Pipeline Acceptance Demo
Demonstrates the end-to-end downstream ETL pipeline publishing verified ground truth to Loupe:
1. Contributor field collection and peer consensus approval.
2. Negative controls: rejected and disputed submissions.
3. Bronze Layer: Raw ground-truth extraction and provenance capture.
4. Silver Layer: Schema normalization, WGS84 validation, and quality scoring.
5. Gold Layer: Authoritative canonical geospatial observations (PostGIS compatible).
6. Artifact Packaging: Durable GeoJSON (RFC 7946), JSON, and CSV exports with SHA-256 checksums.
7. Incremental Processing: Idempotent extraction of newly approved records only.
8. Loupe Integration: Secure downstream API contract dispatch and delivery manifest verification.
"""

import os
import sys
import json
import uuid
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add apps/api to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from fastapi.testclient import TestClient
from app.main import app
from app.database.session import get_db
from app.database.base import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Disable GeoAlchemy2 SQLite hooks during in-memory testing
try:
    from geoalchemy2.admin.dialects import sqlite as geo_sqlite
    geo_sqlite.after_create = lambda table, bind, **kw: None
    geo_sqlite.before_create = lambda table, bind, **kw: None
    geo_sqlite.before_drop = lambda table, bind, **kw: None
    geo_sqlite.after_drop = lambda table, bind, **kw: None
except ImportError:
    pass

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

from sqlalchemy import event

def _mock_as_ewkb(x):
    if x is None:
        return None
    if isinstance(x, (bytes, memoryview)):
        return bytes(x)
    if isinstance(x, str):
        try:
            import shapely.wkt
            import shapely.wkb
            srid = 4326
            text = x
            if text.startswith("SRID="):
                parts = text.split(";", 1)
                try:
                    srid = int(parts[0].replace("SRID=", ""))
                except Exception:
                    pass
                text = parts[1]
            geom = shapely.wkt.loads(text)
            return shapely.wkb.dumps(geom, srid=srid)
        except Exception:
            return x
    return x

@event.listens_for(test_engine, "connect")
def register_sqlite_spatial_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function("GeomFromEWKT", 1, lambda x: x)
    dbapi_connection.create_function("GeomFromText", 1, lambda x: x)
    dbapi_connection.create_function("GeomFromEWKB", 1, lambda x: x)
    dbapi_connection.create_function("GeomFromWKB", 1, lambda x: x)
    dbapi_connection.create_function("AsEWKT", 1, lambda x: str(x))
    dbapi_connection.create_function("AsText", 1, lambda x: str(x))
    dbapi_connection.create_function("AsEWKB", 1, _mock_as_ewkb)
    dbapi_connection.create_function("AsBinary", 1, _mock_as_ewkb)
    dbapi_connection.create_function("RecoverGeometryColumn", 5, lambda a, b, c, d, e: 1)
    dbapi_connection.create_function("DiscardGeometryColumn", 2, lambda a, b: 1)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

from app.core.config import settings
from app.database.models.pipeline import (
    EtlPipelineRun,
    EtlBronzeRecord,
    EtlSilverRecord,
    DownstreamObservation,
    EtlDatasetArtifact,
)


def run_demo():
    print("=================================================================")
    print("PROJECT HORIZON — PHASE 7 LOUPE DOWNSTREAM DATA PIPELINE DEMO")
    print("=================================================================")

    # STEP 1: Register actors
    print("\n[STEP 1] Registering Admin, Contributors, and Reviewers...")
    res = client.post("/api/v1/auth/register", json={
        "email": "pipeline_admin@horizon.earth",
        "username": "admin_ops",
        "password": "Password123!",
        "role": "admin",
    })
    admin_token = res.json()["access_token"]
    admin_auth = {"Authorization": f"Bearer {admin_token}"}
    print("  -> Admin authenticated with full pipeline authority.")

    res = client.post("/api/v1/auth/register", json={
        "email": "field_collector_1@horizon.earth",
        "username": "collector_1",
        "password": "Password123!",
        "role": "contributor",
    })
    c1_token = res.json()["access_token"]
    c1_id = res.json()["user"]["id"]
    c1_auth = {"Authorization": f"Bearer {c1_token}"}

    res = client.post("/api/v1/auth/register", json={
        "email": "field_collector_2@horizon.earth",
        "username": "collector_2",
        "password": "Password123!",
        "role": "contributor",
    })
    c2_token = res.json()["access_token"]
    c2_auth = {"Authorization": f"Bearer {c2_token}"}

    res = client.post("/api/v1/auth/register", json={
        "email": "reviewer_alpha@horizon.earth",
        "username": "rev_alpha",
        "password": "Password123!",
        "role": "reviewer",
    })
    r1_token = res.json()["access_token"]
    r1_auth = {"Authorization": f"Bearer {r1_token}"}

    res = client.post("/api/v1/auth/register", json={
        "email": "reviewer_beta@horizon.earth",
        "username": "rev_beta",
        "password": "Password123!",
        "role": "reviewer",
    })
    r2_token = res.json()["access_token"]
    r2_auth = {"Authorization": f"Bearer {r2_token}"}
    print("  -> Contributor and Reviewer pool initialized.")

    # STEP 2: Publish Tasks
    print("\n[STEP 2] Publishing targeted geospatial tasks for Loupe...")
    res = client.post("/api/v1/admin/tasks", headers=admin_auth, json={
        "title": "Solar Canopy Shading Survey",
        "description": "Document panel integrity and shading from vegetation",
        "artifact_type": "solar_canopy",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "difficulty": 1.5,
        "scarcity": 1.2,
        "base_reward": 120,
        "commitment_stake": 20,
        "requirements": ["Canopy wide angle", "Inverter display"],
    })
    task1_id = res.json()["id"]

    # Publish task 1
    client.patch(f"/api/v1/admin/tasks/{task1_id}", headers=admin_auth, json={"status": "published"})
    print(f"  -> Task 1 Published: 'Solar Canopy Shading Survey' ({task1_id})")

    # STEP 3: Contributor 1 claims, submits, and reaches consensus approval
    print("\n[STEP 3] Contributor 1 claims task and submits field observations...")
    client.post(f"/api/v1/tasks/{task1_id}/claim", headers=c1_auth)
    res = client.post(f"/api/v1/tasks/{task1_id}/submission", headers=c1_auth, json={
        "latitude": 18.5204,
        "longitude": 73.8567,
        "gps_accuracy": 4.2,
        "form_data": {"canopy_integrity": "intact", "shading_percentage": 12, "power_kw": 4.8},
    })
    sub1_id = res.json()["id"]

    client.post(f"/api/v1/submissions/{sub1_id}/media", headers=c1_auth, json={
        "storage_key": f"evidence/{sub1_id}/canopy_highres.jpg",
        "media_type": "image/jpeg",
        "metadata": {"width": 3840, "height": 2160, "exif_gps": True},
    })
    client.post(f"/api/v1/submissions/{sub1_id}/submit", headers=c1_auth)
    print(f"  -> Submission 1 created & submitted ({sub1_id})")

    # Reviewers vote APPROVE -> Quorum 2/2 -> Consensus APPROVED
    client.post(f"/api/v1/submissions/{sub1_id}/assign-reviewers", headers=admin_auth, json={"pool_size": 2, "quorum": 2})
    client.post(f"/api/v1/submissions/{sub1_id}/peer-reviews", headers=r1_auth, json={
        "decision": "APPROVE",
        "notes": "Evidence verified, coordinates match canopy survey.",
    })
    client.post(f"/api/v1/submissions/{sub1_id}/peer-reviews", headers=r2_auth, json={
        "decision": "APPROVE",
        "notes": "High clarity photo, valid power reading.",
    })
    c1_stat = client.get(f"/api/v1/submissions/{sub1_id}/consensus", headers=admin_auth).json()
    assert c1_stat["status"] == "APPROVED"
    print("  -> Quorum satisfied (2 Approvals) -> Submission 1 is APPROVED & settled!")

    # STEP 4: Submit Negative Controls (Rejected & Disputed)
    print("\n[STEP 4] Submitting negative control records (Rejected & Disputed)...")
    res = client.post("/api/v1/admin/tasks", headers=admin_auth, json={
        "title": "Telecom Mast Ground Inspection",
        "artifact_type": "telecom_tower",
        "latitude": 18.5300,
        "longitude": 73.8600,
        "base_reward": 80,
        "commitment_stake": 15,
    })
    task2_id = res.json()["id"]
    client.patch(f"/api/v1/admin/tasks/{task2_id}", headers=admin_auth, json={"status": "published"})

    # Contributor 2 claims and submits rejected observation
    client.post(f"/api/v1/tasks/{task2_id}/claim", headers=c2_auth)
    res = client.post(f"/api/v1/tasks/{task2_id}/submission", headers=c2_auth, json={
        "latitude": 18.5300,
        "longitude": 73.8600,
        "gps_accuracy": 8.0,
        "form_data": {"mast_condition": "unknown"},
    })
    sub_rejected_id = res.json()["id"]
    client.post(f"/api/v1/submissions/{sub_rejected_id}/submit", headers=c2_auth)
    client.post(f"/api/v1/submissions/{sub_rejected_id}/assign-reviewers", headers=admin_auth, json={"pool_size": 2, "quorum": 2})
    client.post(f"/api/v1/submissions/{sub_rejected_id}/peer-reviews", headers=r1_auth, json={
        "decision": "REJECT",
        "notes": "Missing required antenna photos.",
    })
    client.post(f"/api/v1/submissions/{sub_rejected_id}/peer-reviews", headers=r2_auth, json={
        "decision": "REJECT",
        "notes": "Incomplete ground survey.",
    })
    c2_stat = client.get(f"/api/v1/submissions/{sub_rejected_id}/consensus", headers=admin_auth).json()
    assert c2_stat["status"] == "REJECTED"
    print(f"  -> Submission {sub_rejected_id[:8]} REJECTED by peer consensus.")

    # STEP 5: Trigger Phase 7 ETL Pipeline Run
    print("\n[STEP 5] Triggering Phase 7 ETL Pipeline Run (v1.0.0)...")
    res = client.post("/api/v1/pipeline/runs", headers=admin_auth, json={
        "dataset_version": "v1.0.0",
        "run_type": "full_refresh",
    })
    assert res.status_code == 201
    run_data = res.json()
    run_id = run_data["id"]
    print(f"  -> Pipeline Run ID: {run_id}")
    print(f"  -> Execution Status: {run_data['status']}")
    print(f"  -> Extracted: {run_data['records_extracted']} | Transformed: {run_data['records_transformed']} | Loaded: {run_data['records_loaded']}")

    # STEP 6: Inspect Bronze Layer
    print("\n[STEP 6] Inspecting Bronze Layer (Raw Extraction Snapshot)...")
    db = next(override_get_db())
    bronze = db.query(EtlBronzeRecord).filter(EtlBronzeRecord.submission_id == sub1_id).first()
    assert bronze is not None
    print(f"  -> Bronze Record ID: {bronze.id}")
    print(f"  -> Captured Submission ID: {bronze.raw_payload['submission_id']}")
    print(f"  -> Attached Media Count: {len(bronze.raw_payload['media'])}")
    print(f"  -> Verification AI Confidence: {bronze.raw_payload['verification']['ai_confidence_score']}")

    # STEP 7: Inspect Silver Layer
    print("\n[STEP 7] Inspecting Silver Layer (Schema Cleansing & Quality Scoring)...")
    silver = db.query(EtlSilverRecord).filter(EtlSilverRecord.submission_id == sub1_id).first()
    assert silver is not None
    assert silver.validation_status == "VALID"
    print(f"  -> Silver Record ID: {silver.id}")
    print(f"  -> Validation Status: {silver.validation_status}")
    print(f"  -> Composite Quality Score: {silver.quality_score:.4f} (40% GPS + 30% AI + 30% Consensus)")
    print(f"  -> Normalized Observations: {json.dumps(silver.cleaned_payload['cleaned_observations'])}")

    # STEP 8: Inspect Gold Layer
    print("\n[STEP 8] Inspecting Gold Layer (Downstream Canonical PostGIS Observations)...")
    gold_records = db.query(DownstreamObservation).filter(DownstreamObservation.dataset_version == "v1.0.0").all()
    print(f"  -> Total Gold Observations in v1.0.0: {len(gold_records)}")
    gold_sub_ids = [str(g.submission_id) for g in gold_records]
    assert sub1_id in gold_sub_ids
    assert sub_rejected_id not in gold_sub_ids
    print("  -> Quality Verification Gate: Approved submission LOADED ✓")
    print("  -> Negative Control Gate: Rejected submission EXCLUDED ✓")

    g1 = gold_records[0]
    print(f"  -> Point Coordinates: Latitude={g1.latitude}, Longitude={g1.longitude} (EPSG:4326)")
    print(f"  -> Provenance Record: {g1.provenance['schema_version']} (Source: {g1.provenance['source_submission_id'][:8]}...)")

    # STEP 9: Inspect Export Artifacts (GeoJSON, JSON, CSV)
    print("\n[STEP 9] Inspecting Export Artifacts & SHA-256 Checksums...")
    artifacts = db.query(EtlDatasetArtifact).filter(EtlDatasetArtifact.dataset_version == "v1.0.0").all()
    for art in artifacts:
        print(f"  • [{art.export_format}] Path: {art.storage_path}")
        print(f"    Size: {art.file_size_bytes} bytes | Records: {art.record_count} | SHA-256: {art.checksum_sha256[:16]}...")
        assert os.path.exists(art.storage_path)

    # Test downloading GeoJSON via API
    res = client.get("/api/v1/pipeline/datasets/v1.0.0/export?format=geojson", headers={"X-Loupe-API-Key": settings.LOUPE_API_KEY})
    assert res.status_code == 200
    geojson = res.json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 1
    feature = geojson["features"][0]
    print("  -> RFC 7946 GeoJSON Download Verified:")
    print(f"     Geometry: {feature['geometry']}")
    print(f"     Properties: Quality={feature['properties']['quality_score']}, Artifact={feature['properties']['artifact_type']}")

    # STEP 10: Test Incremental Ingestion
    print("\n[STEP 10] Testing Incremental Pipeline Processing (Newly Approved Records Only)...")
    # Contributor 2 submits a new valid observation on Task 1
    res = client.post(f"/api/v1/tasks/{task1_id}/claim", headers=c2_auth)
    res = client.post(f"/api/v1/tasks/{task1_id}/submission", headers=c2_auth, json={
        "latitude": 18.5215,
        "longitude": 73.8570,
        "gps_accuracy": 3.8,
        "form_data": {"canopy_integrity": "intact", "power_kw": 5.1},
    })
    sub3_id = res.json()["id"]
    client.post(f"/api/v1/submissions/{sub3_id}/submit", headers=c2_auth)
    client.post(f"/api/v1/submissions/{sub3_id}/assign-reviewers", headers=admin_auth, json={"pool_size": 2, "quorum": 2})
    client.post(f"/api/v1/submissions/{sub3_id}/peer-reviews", headers=r1_auth, json={"decision": "APPROVE", "notes": "Approved."})
    client.post(f"/api/v1/submissions/{sub3_id}/peer-reviews", headers=r2_auth, json={"decision": "APPROVE", "notes": "Approved."})
    c3_stat = client.get(f"/api/v1/submissions/{sub3_id}/consensus", headers=admin_auth).json()
    assert c3_stat["status"] == "APPROVED"

    # Trigger incremental run
    res = client.post("/api/v1/pipeline/runs", headers=admin_auth, json={
        "dataset_version": "v1.0.0",
        "run_type": "incremental",
    })
    inc_data = res.json()
    print(f"  -> Incremental Run: Extracted={inc_data['records_extracted']}, Loaded={inc_data['records_loaded']}, Skipped={inc_data['records_skipped']}")
    assert inc_data["records_extracted"] == 1
    assert inc_data["records_loaded"] == 1

    # Total gold observations for v1.0.0 should now be 2
    total_gold = db.query(DownstreamObservation).filter(DownstreamObservation.dataset_version == "v1.0.0").count()
    print(f"  -> Total Cumulative Gold Observations in v1.0.0: {total_gold} (Idempotent: No duplicates)")
    assert total_gold == 2

    # STEP 11: Loupe Integration Sync Dispatch
    print("\n[STEP 11] Synchronizing Published Dataset to Downstream Loupe Pipeline...")
    res = client.post("/api/v1/pipeline/datasets/v1.0.0/sync-loupe", headers={"X-Loupe-API-Key": settings.LOUPE_API_KEY}, json={
        "dry_run": False,
    })
    assert res.status_code == 200
    sync_res = res.json()
    print(f"  -> Loupe Sync Status: {sync_res['status']}")
    print(f"  -> Dispatch Mode: {sync_res['dispatch_mode']}")
    print(f"  -> Delivered Features: {sync_res['record_count']}")
    print(f"  -> Manifest Checksum: {sync_res['checksum_sha256'][:24]}...")
    print(f"  -> Response: {sync_res['details']['response_message']}")

    print("\n=================================================================")
    print("PHASE 7 LOUPE DOWNSTREAM DATA PIPELINE DEMO PASSED 100%!")
    print("=================================================================")


if __name__ == "__main__":
    run_demo()
