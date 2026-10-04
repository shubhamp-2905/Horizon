"""
Project Horizon — Phase 6 Distributed Peer Consensus & Slashing Acceptance Demo
Validates the complete multi-reviewer consensus and token settlement layer:
1. Contributor claims task with commitment stake locked in escrow.
2. Field observation submitted and queued for consensus review.
3. Configurable reviewer assignment (pool_size=3, quorum=2).
4. Self-review prevention (contributor cannot review their own contribution).
5. Duplicate voting prevention (one vote per reviewer).
6. Quorum tracking and state progression (PENDING -> APPROVED).
7. Authoritative token settlement: commitment stake returned + reward bounty minted.
8. Reviewer participation incentives disbursed.
9. Dispute escalation and administrative resolution.
10. Stake slashing on confirmed fraudulent contributions with immutable ledger audit.
"""

import sys
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
    print(f"\n[{step_num:02d}] {title}")
    print("-" * 65)

def main():
    print("=" * 65)
    print("PROJECT HORIZON — PHASE 6 PEER CONSENSUS & SLASHING DEMO")
    print("=" * 65)

    # Step 1: Contributor and Reviewer Registration
    log_step(1, "User Onboarding: Contributor & Reviewer Accounts")
    reg_contrib = client.post("/api/v1/auth/register", json={
        "email": "scout_phase6@horizon.dev",
        "username": "scout_phase6",
        "password": "Password123!",
        "role": "contributor",
    })
    assert reg_contrib.status_code == 201
    contrib_token = reg_contrib.json()["access_token"]
    contrib_id = reg_contrib.json()["user"]["id"]
    print("✓ Contributor registered: scout_phase6 (100 Starter Tokens)")

    reviewers = []
    for i in range(1, 4):
        reg_rev = client.post("/api/v1/auth/register", json={
            "email": f"reviewer_{i}@horizon.dev",
            "username": f"reviewer_{i}",
            "password": "Password123!",
            "role": "reviewer",
        })
        assert reg_rev.status_code == 201
        reviewers.append({
            "id": reg_rev.json()["user"]["id"],
            "token": reg_rev.json()["access_token"],
            "username": f"reviewer_{i}",
        })
        print(f"✓ Reviewer registered: reviewer_{i}")

    reg_admin = client.post("/api/v1/auth/register", json={
        "email": "admin_phase6@horizon.dev",
        "username": "admin_phase6",
        "password": "Password123!",
        "role": "admin",
    })
    assert reg_admin.status_code == 201
    admin_token = reg_admin.json()["access_token"]
    print("✓ Admin registered: admin_phase6")

    # Step 2: Admin Publishes Task
    log_step(2, "Task Creation & Commitment Staking")
    task_res = client.post(
        "/api/v1/admin/tasks",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "Community Borehole Telemetry Survey",
            "description": "Inspect and verify solar pump pressure and water clarity.",
            "artifact_type": "water_source",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "difficulty": 1.0,
            "scarcity": 1.0,
            "base_reward": 150,
            "commitment_stake": 20,
            "requirements": ["Photo of solar array", "Reading gauge photo"],
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # Publish task
    client.patch(
        f"/api/v1/admin/tasks/{task_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "published"},
    )

    # Contributor claims task
    claim_res = client.post(
        f"/api/v1/tasks/{task_id}/claim",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert claim_res.status_code == 200
    print("✓ Task claimed by contributor: 20 tokens locked into escrow")

    # Check wallet: Available = 80, Locked = 20
    wallet = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {contrib_token}"}).json()
    assert wallet["available_tokens"] == 80
    assert wallet["locked_tokens"] == 20
    print(f"✓ Wallet verified: Available={wallet['available_tokens']}, Locked={wallet['locked_tokens']}")

    # Step 3: Field Submission & Finalization
    log_step(3, "Field Data Collection & Final Submission")
    sub_init = client.post(
        f"/api/v1/tasks/{task_id}/submission",
        headers={"Authorization": f"Bearer {contrib_token}"},
        json={
            "latitude": 18.52041,
            "longitude": 73.85672,
            "gps_accuracy": 4.5,
            "form_data": {"site_condition": "excellent", "water_clarity": "clear"},
        },
    )
    assert sub_init.status_code == 201
    sub_id = sub_init.json()["id"]

    # Attach evidence
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers={"Authorization": f"Bearer {contrib_token}"},
        json={
            "storage_key": "photos/pump_wide.jpg",
            "media_type": "image/jpeg",
            "metadata": {"width": 1920, "height": 1080, "hash": "sha256_mock_wide_001"},
        },
    )
    client.post(
        f"/api/v1/submissions/{sub_id}/media",
        headers={"Authorization": f"Bearer {contrib_token}"},
        json={
            "storage_key": "photos/pump_gauge.jpg",
            "media_type": "image/jpeg",
            "metadata": {"width": 1920, "height": 1080, "hash": "sha256_mock_gauge_002"},
        },
    )

    # Finalize
    sub_final = client.post(
        f"/api/v1/submissions/{sub_id}/submit",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert sub_final.status_code == 200
    print("✓ Submission finalized and queued for distributed peer review")

    # Step 4: Reviewer Assignment
    log_step(4, "Reviewer Pool Assignment & Self-Review Prevention")
    # Verify contributor CANNOT review their own contribution
    self_rev_res = client.post(
        f"/api/v1/submissions/{sub_id}/peer-reviews",
        headers={"Authorization": f"Bearer {contrib_token}"},
        json={"decision": "APPROVE", "notes": "Self approval attempt"},
    )
    assert self_rev_res.status_code in [400, 403]
    print("✓ Self-review attempt blocked: Contributors cannot evaluate their own work")

    # Admin assigns 3 reviewers with quorum=2
    assign_res = client.post(
        f"/api/v1/submissions/{sub_id}/assign-reviewers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "pool_size": 3,
            "quorum": 2,
            "reviewer_ids": [r["id"] for r in reviewers],
        },
    )
    assert assign_res.status_code == 200
    assign_data = assign_res.json()
    print(f"✓ Assigned {len(assign_data['assignments'])} reviewers (Pool Size: {assign_data['pool_size']}, Quorum: {assign_data['quorum']})")

    # Step 5: Peer Reviews & Quorum Progression
    log_step(5, "Peer Reviews, Duplicate Vote Prevention & Consensus Quorum")
    # Reviewer 1 votes APPROVE
    v1 = client.post(
        f"/api/v1/submissions/{sub_id}/peer-reviews",
        headers={"Authorization": f"Bearer {reviewers[0]['token']}"},
        json={
            "decision": "APPROVE",
            "notes": "Evidence matches solar installation criteria. Coordinates confirmed accurate.",
            "confidence_score": 0.95,
        },
    )
    assert v1.status_code == 201
    print("✓ Reviewer 1 voted APPROVE")

    # Duplicate voting prevention
    dup_res = client.post(
        f"/api/v1/submissions/{sub_id}/peer-reviews",
        headers={"Authorization": f"Bearer {reviewers[0]['token']}"},
        json={"decision": "APPROVE", "notes": "Duplicate vote attempt"},
    )
    assert dup_res.status_code == 409
    print("✓ Duplicate voting blocked: Reviewer cannot vote multiple times")

    # Check status: Total Votes = 1 < Quorum 2 -> Status PENDING
    c_status1 = client.get(f"/api/v1/submissions/{sub_id}/consensus", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert c_status1["status"] == "PENDING"
    assert c_status1["total_votes"] == 1
    print(f"✓ Consensus status: {c_status1['status']} ({c_status1['total_votes']}/{c_status1['quorum']} votes toward quorum)")

    # Reviewer 2 votes APPROVE
    v2 = client.post(
        f"/api/v1/submissions/{sub_id}/peer-reviews",
        headers={"Authorization": f"Bearer {reviewers[1]['token']}"},
        json={
            "decision": "APPROVE",
            "notes": "Borehole clarity confirmed and operational telemetry matches expectations.",
            "confidence_score": 0.92,
        },
    )
    assert v2.status_code == 201
    print("✓ Reviewer 2 voted APPROVE -> Quorum reached (2/2)")

    # Check status: Quorum met with 2 APPROVE -> APPROVED
    c_status2 = client.get(f"/api/v1/submissions/{sub_id}/consensus", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert c_status2["status"] == "APPROVED"
    assert c_status2["settlement_status"] == "settled"
    print(f"✓ Consensus achieved: {c_status2['status']} ({c_status2['approve_votes']}/{c_status2['total_votes']} Approvals)")

    # Step 6: Authoritative Token Settlement
    log_step(6, "Token Ledger Settlement & Escrow Release")
    wallet_settled = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {contrib_token}"}).json()
    # Initial 100 - 20 stake + 20 stake returned + 150 bounty = 250 tokens
    assert wallet_settled["available_tokens"] == 250
    assert wallet_settled["locked_tokens"] == 0
    print("✓ Contributor Escrow Released: 20 tokens returned to Available Balance")
    print(f"✓ Contributor Bounty Minted: +150 tokens disbursed (Total Balance: {wallet_settled['available_tokens']})")

    # Reviewer bounties
    r1_wallet = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {reviewers[0]['token']}"}).json()
    assert r1_wallet["available_tokens"] == 105
    print("✓ Reviewer participation bounty credited: +5 tokens to consensus reviewers")

    # Step 7: Fraud Detection, Dispute & Slashing Demonstration
    log_step(7, "Dispute Resolution & Stake Slashing Governance")
    # Contributor claims another task
    task2_res = client.post(
        "/api/v1/admin/tasks",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "Restricted Boundary Mapping",
            "artifact_type": "heritage_site",
            "latitude": 18.528,
            "longitude": 73.852,
            "difficulty": 2.0,
            "scarcity": 1.5,
            "base_reward": 200,
            "commitment_stake": 25,
            "requirements": ["Boundary stone photo"],
        },
    )
    task2_id = task2_res.json()["id"]
    client.patch(f"/api/v1/admin/tasks/{task2_id}", headers={"Authorization": f"Bearer {admin_token}"}, json={"status": "published"})

    # Claim task 2
    client.post(f"/api/v1/tasks/{task2_id}/claim", headers={"Authorization": f"Bearer {contrib_token}"})
    print("✓ Contributor claimed high-value task with 25 commitment stake locked")

    # Submit fraudulent data
    sub2_res = client.post(
        f"/api/v1/tasks/{task2_id}/submission",
        headers={"Authorization": f"Bearer {contrib_token}"},
        json={"latitude": 18.528, "longitude": 73.852, "gps_accuracy": 30.0, "form_data": {"site_condition": "falsified"}},
    )
    sub2_id = sub2_res.json()["id"]
    client.post(f"/api/v1/submissions/{sub2_id}/submit", headers={"Authorization": f"Bearer {contrib_token}"})

    # Raise dispute on fraudulent submission
    disp_res = client.post(
        f"/api/v1/submissions/{sub2_id}/dispute",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"reason": "Audit detected GPS spoofing and fabricated observation fields."},
    )
    assert disp_res.status_code == 200
    print("✓ Contribution flagged and escalated to DISPUTED status")

    # Admin issues binding FRAUD SLASH resolution
    resolve_res = client.post(
        f"/api/v1/submissions/{sub2_id}/dispute/resolve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "resolve_action": "reject_slash",
            "notes": "Verified intentional geolocation spoofing. Stake slashed under platform governance.",
        },
    )
    assert resolve_res.status_code == 200
    print("✓ Administrator resolved dispute: Confirmed Fraud -> Stake Slashed")

    # Verify slashing in wallet: Contributor's 25 locked tokens are burned!
    wallet_post_slash = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {contrib_token}"}).json()
    assert wallet_post_slash["locked_tokens"] == 0
    # The 25 stake was burned, available remains 225 (250 - 25 = 225)
    assert wallet_post_slash["available_tokens"] == 225
    print(f"✓ Slashed Stake Confirmed: Locked balance cleared without refund (Available: {wallet_post_slash['available_tokens']})")

    slash_tx = next(t for t in wallet_post_slash["transactions"] if t["type"] == "stake_slashing")
    assert slash_tx["amount"] == -25
    print(f"✓ Immutable Ledger Audit: Transaction '{slash_tx['type']}' of {slash_tx['amount']} tokens recorded")

    print("\n" + "=" * 65)
    print("PHASE 6 DISTRIBUTED CONSENSUS & SLASHING DEMO: 10/10 STEPS PASSED")
    print("=" * 65)


if __name__ == "__main__":
    main()
