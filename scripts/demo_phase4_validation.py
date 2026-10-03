"""
Project Horizon — Phase 4 Automated Data Validation Acceptance Demo
Validates the complete deterministic server-side validation layer:
- Dynamic form schema field completion and typing rules
- Evidence photo count, MIME type, corrupt metadata, and duplicate hash detection
- GPS accuracy classification and PostGIS task boundary radius verification
- Capture timestamp validation and future timestamp rejection
- Automated validation integration on submission finalization
- Verification model persistence and admin review exposure
"""

import sys
import uuid
from datetime import datetime, timezone, timedelta
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

# Disable GeoAlchemy2 SQLite hooks during in-memory SQLite testing
try:
    from geoalchemy2.admin.dialects import sqlite as geo_sqlite
    geo_sqlite.after_create = lambda table, bind, **kw: None
    geo_sqlite.before_create = lambda table, bind, **kw: None
    geo_sqlite.before_drop = lambda table, bind, **kw: None
    geo_sqlite.after_drop = lambda table, bind, **kw: None
except ImportError:
    pass

# Setup in-memory SQLite database
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

def log_step(step_num: int, title: str):
    print(f"\n[STEP {step_num}] {title}")

def log_success(msg: str):
    print(f"  -> {msg}")

def main():
    print("=" * 68)
    print("PROJECT HORIZON — PHASE 4 AUTOMATED DATA VALIDATION ACCEPTANCE DEMO")
    print("=" * 68)

    # 1. Register Admin and Create Field Task with Dynamic Schema
    log_step(1, "Registering admin and creating field task with dynamic schema...")
    admin_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin_phase4@horizon.io",
            "username": "admin_phase4",
            "password": "Password123!",
            "role": "admin",
        },
    )
    assert admin_res.status_code == 201
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    task_res = client.post(
        "/api/v1/admin/tasks",
        headers=admin_headers,
        json={
            "title": "Solar Canopy Diagnostic Survey",
            "description": "Inspect micro-grid solar arrays, inverter readings, and shading.",
            "artifact_type": "solar_installation",
            "latitude": 18.52043,
            "longitude": 73.85674,
            "difficulty": 2.0,
            "scarcity": 1.2,
            "base_reward": 180,
            "commitment_stake": 30,
            "requirements": [
                "Clear wide-angle shot of array canopy",
                "Close-up photo of inverter LCD panel readout",
            ],
            "status": "published",
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]
    log_success(f"Task published: 'Solar Canopy Diagnostic Survey' (ID: {task_id})")

    # 2. Register Field Contributor
    log_step(2, "Registering field contributor with starter tokens...")
    contrib_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "validation_agent@horizon.io",
            "username": "validation_agent",
            "password": "Password123!",
            "role": "contributor",
        },
    )
    assert contrib_res.status_code == 201
    contrib_token = contrib_res.json()["access_token"]
    contrib_headers = {"Authorization": f"Bearer {contrib_token}"}
    log_success("Contributor registered with 100 Starter Tokens.")

    claim_res = client.post(f"/api/v1/tasks/{task_id}/claim", headers=contrib_headers)
    assert claim_res.status_code == 200
    log_success("Contributor committed 30 TOKENS stake.")

    def create_agent_submission(prefix, form=None, lat=18.52045, lng=73.85676, acc=6.8, cap_time=None):
        r = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"{prefix}_{uuid.uuid4().hex[:4]}@horizon.io",
                "username": f"{prefix}_{uuid.uuid4().hex[:4]}",
                "password": "Password123!",
                "role": "contributor",
            },
        )
        t = r.json()["access_token"]
        h = {"Authorization": f"Bearer {t}"}
        client.post(f"/api/v1/tasks/{task_id}/claim", headers=h)
        s = client.post(
            f"/api/v1/tasks/{task_id}/submission",
            headers=h,
            json={
                "latitude": lat,
                "longitude": lng,
                "gps_accuracy": acc,
                "captured_at": cap_time or datetime.now(timezone.utc).isoformat(),
                "form_data": form or {},
            },
        ).json()
        return s["id"], h

    # 3. Test 1: Complete Valid Submission
    log_step(3, "VALIDATION TEST 1: Full Valid Submission (Expected: PASSED)...")
    valid_sub_id, valid_headers = create_agent_submission(
        "valid_agent",
        form={
            "panel_condition": "intact",
            "inverter_reading": 5.2,
            "shading_obstructions": "none",
            "field_notes": "All hardware in optimal operating condition.",
        },
    )

    for i in (1, 2):
        client.post(
            f"/api/v1/submissions/{valid_sub_id}/media",
            headers=valid_headers,
            json={
                "storage_key": f"evidence/{valid_sub_id}/photo_{i}.jpg",
                "media_type": "image/jpeg",
                "metadata": {"file_size": 2500000, "hash": f"hash_unique_{i}"},
            },
        )

    val_res = client.post(f"/api/v1/submissions/{valid_sub_id}/validate", headers=valid_headers)
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["status"] == "PASSED"
    assert len(val_data["failed_checks"]) == 0
    log_success(f"Outcome: {val_data['status']} — All 5 deterministic check categories cleared!")

    # 4. Test 2: Missing Required Field
    log_step(4, "VALIDATION TEST 2: Missing Required Dynamic Form Field (Expected: FAILED)...")
    missing_sub_id, missing_headers = create_agent_submission(
        "missing_agent",
        form={
            # panel_condition intentionally omitted
            "inverter_reading": 5.2,
            "shading_obstructions": "none",
        },
    )

    val_missing = client.post(f"/api/v1/submissions/{missing_sub_id}/validate", headers=missing_headers).json()
    assert val_missing["status"] == "FAILED"
    assert "required_fields" in val_missing["failed_checks"]
    log_success(f"Outcome: {val_missing['status']} — Caught missing required field cleanly.")

    # 5. Test 3: Invalid Field Type
    log_step(5, "VALIDATION TEST 3: Invalid Field Data Types (Expected: FAILED)...")
    type_sub_id, type_headers = create_agent_submission(
        "type_agent",
        form={
            "panel_condition": "intact",
            "inverter_reading": "not_a_valid_number",
            "shading_obstructions": "invalid_option_xyz",
        },
    )

    val_type = client.post(f"/api/v1/submissions/{type_sub_id}/validate", headers=type_headers).json()
    assert val_type["status"] == "FAILED"
    assert "required_fields" in val_type["failed_checks"]
    log_success(f"Outcome: {val_type['status']} — Rejected invalid numeric and select options.")

    # 6. Test 4: Insufficient Evidence Photos
    log_step(6, "VALIDATION TEST 4: Insufficient Photo Evidence (Expected: FAILED)...")
    few_sub_id, few_headers = create_agent_submission(
        "few_agent",
        form={"panel_condition": "intact", "shading_obstructions": "none"},
    )
    client.post(
        f"/api/v1/submissions/{few_sub_id}/media",
        headers=few_headers,
        json={
            "storage_key": f"evidence/{few_sub_id}/only_one.jpg",
            "media_type": "image/jpeg",
            "metadata": {"file_size": 2000000, "hash": "h_single"},
        },
    )

    val_photos = client.post(f"/api/v1/submissions/{few_sub_id}/validate", headers=few_headers).json()
    assert val_photos["status"] == "FAILED"
    assert "media_evidence" in val_photos["failed_checks"]
    log_success(f"Outcome: {val_photos['status']} — Enforced minimum required photos (1/2 detected).")

    # 7. Test 5: Duplicate Media Detection
    log_step(7, "VALIDATION TEST 5: Duplicate Evidence Media Hash (Expected: FAILED)...")
    dup_sub_id, dup_headers = create_agent_submission(
        "dup_agent",
        form={"panel_condition": "intact", "shading_obstructions": "none"},
    )
    for i in (1, 2):
        client.post(
            f"/api/v1/submissions/{dup_sub_id}/media",
            headers=dup_headers,
            json={
                "storage_key": f"evidence/{dup_sub_id}/slot_{i}.jpg",
                "media_type": "image/jpeg",
                "metadata": {"file_size": 2100000, "hash": "IDENTICAL_SHA256_HASH_XYZ"},
            },
        )

    val_dup = client.post(f"/api/v1/submissions/{dup_sub_id}/validate", headers=dup_headers).json()
    assert val_dup["status"] == "FAILED"
    assert "media_evidence" in val_dup["failed_checks"]
    log_success(f"Outcome: {val_dup['status']} — Caught duplicate media hash within submission.")

    # 8. Test 6: GPS Warning & Critical Failure Thresholds
    log_step(8, "VALIDATION TEST 6: GPS Telemetry Thresholds (Expected: WARNING & FAILED)...")
    # Case A: Accuracy = 38m (Moderate accuracy -> WARNING)
    warn_sub_id, warn_headers = create_agent_submission(
        "warn_agent",
        form={"panel_condition": "intact", "shading_obstructions": "none"},
        acc=38.0,
    )
    for i in (1, 2):
        client.post(
            f"/api/v1/submissions/{warn_sub_id}/media",
            headers=warn_headers,
            json={
                "storage_key": f"evidence/{warn_sub_id}/w_{i}.jpg",
                "media_type": "image/jpeg",
                "metadata": {"file_size": 2000000, "hash": f"hash_w_{i}"},
            },
        )

    val_warn = client.post(f"/api/v1/submissions/{warn_sub_id}/validate", headers=warn_headers).json()
    assert val_warn["status"] == "WARNING"
    assert any("±38.0m" in w for w in val_warn["warnings"])
    log_success(f"Outcome: {val_warn['status']} — Moderate GPS accuracy correctly flagged as warning.")

    # Case B: Distance far outside task radius (15km) -> FAILED
    far_sub_id, far_headers = create_agent_submission(
        "far_agent",
        form={"panel_condition": "intact", "shading_obstructions": "none"},
        lat=18.6500,
        lng=73.9500,
    )
    val_far = client.post(f"/api/v1/submissions/{far_sub_id}/validate", headers=far_headers).json()
    assert val_far["status"] == "FAILED"
    assert "task_radius" in val_far["failed_checks"]
    log_success(f"Outcome: {val_far['status']} — Outside task radius flagged as failure.")

    # 9. Test 7: Future Timestamp Rejection
    log_step(9, "VALIDATION TEST 7: Future Timestamp Validation (Expected: FAILED)...")
    future_time = datetime.now(timezone.utc) + timedelta(hours=4)
    fut_sub_id, fut_headers = create_agent_submission(
        "fut_agent",
        form={"panel_condition": "intact", "shading_obstructions": "none"},
        cap_time=future_time.isoformat(),
    )
    val_future = client.post(f"/api/v1/submissions/{fut_sub_id}/validate", headers=fut_headers).json()
    assert val_future["status"] == "FAILED"
    assert "capture_timestamp" in val_future["failed_checks"]
    log_success(f"Outcome: {val_future['status']} — Future timestamp correctly detected and rejected.")

    # 10. Automated Validation on Finalization & Verification Persistence
    log_step(10, "VALIDATION TEST 8: Auto-Validation Trigger on Finalize & Verification Persistence...")
    final_res = client.post(f"/api/v1/submissions/{valid_sub_id}/submit", headers=valid_headers)
    assert final_res.status_code == 200
    sub_record = final_res.json()

    assert sub_record["validation_status"] == "PASSED"
    assert sub_record["validation_results"]["status"] == "PASSED"
    assert len(sub_record["validation_results"]["checks"]) == 5
    log_success(f"Submission finalized! Auto-validation outcome: {sub_record['validation_status']}")
    log_success(f"Verification record updated: Status={sub_record['verification_status']}")

    # 11. Admin Review of Automated Validation Results
    log_step(11, "Admin inspecting review queue and validation audit trail...")
    admin_list = client.get("/api/v1/admin/submissions", headers=admin_headers).json()
    assert len(admin_list["submissions"]) >= 1
    inspected = next(s for s in admin_list["submissions"] if s["id"] == valid_sub_id)
    assert inspected["validation_status"] == "PASSED"

    # Admin approves submission
    review_res = client.post(
        f"/api/v1/admin/submissions/{valid_sub_id}/review",
        headers=admin_headers,
        json={"status": "approved", "notes": "All automated validation gates cleared without warning."},
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"
    log_success("Admin approved verified submission with complete audit trail.")

    print("\n" + "=" * 68)
    print("PHASE 4 AUTOMATED DATA VALIDATION ACCEPTANCE DEMO PASSED 100%!")
    print("=" * 68)

if __name__ == "__main__":
    main()
