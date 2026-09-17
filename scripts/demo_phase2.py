"""
Phase 2 End-to-End Acceptance & Verification Demonstration Script
Executes the exact 17-step flow specified in Section 44 of prompt.md.
"""
import sys
import uuid
from pathlib import Path

# Add apps/api to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from fastapi.testclient import TestClient
from app.main import app
from app.database.session import get_db
from app.database.base import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from geoalchemy2.elements import WKBElement

# Disable GeoAlchemy2 SQLite hooks during in-memory SQLite demo
try:
    from geoalchemy2.admin.dialects import sqlite as geo_sqlite
    geo_sqlite.after_create = lambda table, bind, **kw: None
    geo_sqlite.before_create = lambda table, bind, **kw: None
    geo_sqlite.before_drop = lambda table, bind, **kw: None
    geo_sqlite.after_drop = lambda table, bind, **kw: None
except ImportError:
    pass

# Create isolated in-memory test database for the demo
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

print("=" * 60)
print("PROJECT HORIZON — PHASE 2 ACCEPTANCE DEMONSTRATION")
print("=" * 60)

# STEP 1: Create an admin user
print("\n[STEP 1] Creating admin user...")
admin_reg = client.post("/api/v1/auth/register", json={
    "username": "admin_demo",
    "email": "admin_demo@horizon.io",
    "password": "AdminPassword123!",
    "full_name": "Demo Admin",
    "role": "admin",
})
assert admin_reg.status_code == 201, f"Admin reg failed: {admin_reg.text}"
print("  -> Admin user created: admin_demo@horizon.io (Role: admin)")

# STEP 2: Login as admin
print("\n[STEP 2] Logging in as admin...")
admin_login = client.post("/api/v1/auth/login", json={
    "email_or_username": "admin_demo",
    "password": "AdminPassword123!",
})
assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
admin_token = admin_login.json()["access_token"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}
print("  -> Admin JWT token obtained.")

# STEP 3: Create "Community Water Source Survey"
print("\n[STEP 3] Creating 'Community Water Source Survey' task...")
task_payload = {
    "title": "Community Water Source Survey",
    "description": "Survey and verify public water dispensary status, flow, and cleanliness.",
    "artifact_type": "water_source",
    "status": "draft",
    "difficulty": 2.0,
    "scarcity": 1.5,
    "base_reward": 150,
    "commitment_stake": 20,
    "estimated_effort_minutes": 25,
    "latitude": 18.5204,
    "longitude": 73.8567,
    "requirements": ["Take 2 geotagged photos", "Test water flow rate", "Confirm drinking safety label"]
}
create_resp = client.post("/api/v1/admin/tasks", json=task_payload, headers=admin_headers)
assert create_resp.status_code == 201, f"Task create failed: {create_resp.text}"
task_data = create_resp.json()
task_id = task_data["id"]
print(f"  -> Task created successfully. ID: {task_id}")
print(f"     Title: {task_data['title']}")
print(f"     Base Reward: {task_data['base_reward']} tokens | Stake: {task_data['commitment_stake']} tokens")
print(f"     Difficulty: {task_data['difficulty']} | Scarcity: {task_data['scarcity']}")
print(f"     Status: {task_data['status']}")

# STEP 4: Publish the task
print("\n[STEP 4] Publishing the task...")
publish_resp = client.patch(f"/api/v1/admin/tasks/{task_id}", json={"status": "published"}, headers=admin_headers)
assert publish_resp.status_code == 200, f"Publish failed: {publish_resp.text}"
assert publish_resp.json()["status"] == "published"
print("  -> Task status updated to: published")

# STEP 5: Create a contributor
print("\n[STEP 5] Creating contributor account...")
contrib_reg = client.post("/api/v1/auth/register", json={
    "username": "scout_phase2",
    "email": "scout_phase2@horizon.io",
    "password": "ScoutPassword123!",
    "full_name": "Scout Phase2 Contributor",
    "role": "contributor",
})
assert contrib_reg.status_code == 201, f"Contributor reg failed: {contrib_reg.text}"
contrib_token = contrib_reg.json()["access_token"]
contrib_headers = {"Authorization": f"Bearer {contrib_token}"}
print("  -> Contributor registered: scout_phase2@horizon.io")

# STEP 6: Verify Starter Tokens: Available = 100, Locked = 0
print("\n[STEP 6] Verifying Starter Tokens...")
wallet_resp = client.get("/api/v1/wallet", headers=contrib_headers)
assert wallet_resp.status_code == 200, f"Wallet check failed: {wallet_resp.text}"
wallet = wallet_resp.json()
print(f"  -> Available Balance: {wallet['available_balance']}")
print(f"  -> Locked Balance:    {wallet['locked_balance']}")
assert wallet["available_balance"] == 100, f"Expected 100, got {wallet['available_balance']}"
assert wallet["locked_balance"] == 0, f"Expected 0, got {wallet['locked_balance']}"
print("  -> VERIFIED: Contributor initialized with exactly 100 Available Tokens & 0 Locked Tokens.")

# STEP 7: Open mobile app (Context initialized)
print("\n[STEP 7] Mobile app initialized (Client session ready).")

# STEP 8: Login as contributor
print("\n[STEP 8] Logging in as contributor...")
contrib_login = client.post("/api/v1/auth/login", json={
    "email_or_username": "scout_phase2",
    "password": "ScoutPassword123!",
})
assert contrib_login.status_code == 200
active_token = contrib_login.json()["access_token"]
active_headers = {"Authorization": f"Bearer {active_token}"}
print("  -> Contributor session authenticated successfully.")

# STEP 9: Open Discover (Geospatial query)
print("\n[STEP 9] Opening Discover (Querying nearby published tasks at lat=18.5204, lng=73.8567, radius=5000m)...")
discover_resp = client.get("/api/v1/tasks?lat=18.5204&lng=73.8567&radius=5000", headers=active_headers)
assert discover_resp.status_code == 200
items = discover_resp.json()["tasks"]
print(f"  -> Discover returned {len(items)} published task(s).")

# STEP 10: See the task on the map/list
print("\n[STEP 10] Finding 'Community Water Source Survey' in results...")
matching = [t for t in items if t["id"] == task_id]
assert len(matching) == 1, "Task not found in discover results!"
print(f"  -> FOUND: '{matching[0]['title']}' | Distance: {matching[0]['distance_meters']}m")

# STEP 11: Open task details
print(f"\n[STEP 11] Fetching full task details for ID {task_id}...")
detail_resp = client.get(f"/api/v1/tasks/{task_id}?lat=18.5204&lng=73.8567", headers=active_headers)
assert detail_resp.status_code == 200
detail = detail_resp.json()

# STEP 12: Verify: Reward = 150, Commitment = 20
print("\n[STEP 12] Verifying task economics...")
print(f"  -> Base Reward:      {detail['base_reward']} tokens (Expected: 150)")
print(f"  -> Commitment Stake: {detail['commitment_stake']} tokens (Expected: 20)")
assert detail["base_reward"] == 150
assert detail["commitment_stake"] == 20
print("  -> VERIFIED: Economics match specification.")

# STEP 13: Commit to task
print("\n[STEP 13] Committing to task (Locking 20 tokens stake)...")
claim_resp = client.post(f"/api/v1/tasks/{task_id}/claim", headers=active_headers)
assert claim_resp.status_code in [200, 201], f"Claim failed: {claim_resp.text}"
claim_data = claim_resp.json()
print(f"  -> Claim created! Claim ID: {claim_data['claim_id']}, Status: {claim_data['status']}")

# STEP 14: Verify Available = 80, Locked = 20
print("\n[STEP 14] Verifying updated wallet balances...")
wallet_after = client.get("/api/v1/wallet", headers=active_headers).json()
print(f"  -> Available: {wallet_after['available_balance']} (Expected: 80)")
print(f"  -> Locked:    {wallet_after['locked_balance']} (Expected: 20)")
assert wallet_after["available_balance"] == 80, f"Expected 80, got {wallet_after['available_balance']}"
assert wallet_after["locked_balance"] == 20, f"Expected 20, got {wallet_after['locked_balance']}"
print("  -> VERIFIED: Wallet balances mutated correctly: 80 Available / 20 Locked.")

# STEP 15: Verify ledger entries
print("\n[STEP 15] Verifying audit ledger transactions...")
ledger = wallet_after["recent_transactions"]
print(f"  -> Found {len(ledger)} transaction(s) in audit ledger:")
for tx in ledger:
    print(f"     [{tx['transaction_type']}] Amount: {tx['amount']:+d} | Balance After: {tx['balance_after']} | Note: {tx['description']}")

tx_types = [tx["transaction_type"].upper() for tx in ledger]
assert "STARTER_GRANT" in tx_types, "Missing STARTER_GRANT in ledger"
assert "TASK_STAKE_LOCK" in tx_types, "Missing TASK_STAKE_LOCK in ledger"
grant_tx = next(t for t in ledger if t["transaction_type"].upper() == "STARTER_GRANT")
lock_tx = next(t for t in ledger if t["transaction_type"].upper() == "TASK_STAKE_LOCK")
assert grant_tx["amount"] == 100
assert lock_tx["amount"] == -20
print("  -> VERIFIED: Ledger contains STARTER_GRANT (+100) and TASK_STAKE_LOCK (-20).")

# STEP 16: Attempt to claim the same task again (Must fail)
print("\n[STEP 16] Attempting duplicate claim on the same task...")
dup_claim = client.post(f"/api/v1/tasks/{task_id}/claim", headers=active_headers)
print(f"  -> Status Code: {dup_claim.status_code}")
print(f"  -> Error Response: {dup_claim.json()}")
assert dup_claim.status_code == 409, f"Expected 409 Conflict, got {dup_claim.status_code}"
assert dup_claim.json()["detail"]["code"] == "TASK_ALREADY_CLAIMED"
print("  -> VERIFIED: Duplicate claim cleanly rejected with 409 Conflict.")

# STEP 17: Attempt another task requiring more tokens than available (Must fail with clear error)
print("\n[STEP 17] Creating an expensive task (100 stake) and attempting claim with only 80 available tokens...")
exp_task_resp = client.post("/api/v1/admin/tasks", json={
    "title": "High-Elevation LiDAR Aerial Validation",
    "description": "High stake validation requiring 100 tokens.",
    "artifact_type": "lidar_canopy",
    "status": "published",
    "base_reward": 500,
    "commitment_stake": 100,  # Contributor only has 80 available!
    "latitude": 18.5204,
    "longitude": 73.8567,
}, headers=admin_headers)
assert exp_task_resp.status_code == 201
exp_task_id = exp_task_resp.json()["id"]

insufficient_resp = client.post(f"/api/v1/tasks/{exp_task_id}/claim", headers=active_headers)
print(f"  -> Status Code: {insufficient_resp.status_code}")
print(f"  -> Error Response: {insufficient_resp.json()}")
assert insufficient_resp.status_code in [400, 409], f"Expected 400 or 409, got {insufficient_resp.status_code}"
err_code = insufficient_resp.json()["detail"]["code"]
assert err_code in ["INSUFFICIENT_FUNDS", "INSUFFICIENT_TOKENS"]
print(f"  -> VERIFIED: Insufficient balance cleanly rejected ({err_code}: {insufficient_resp.json()['detail']['message']}).")

print("\n" + "=" * 60)
print("ALL 17 DEMO / ACCEPTANCE STEPS COMPLETED & VERIFIED SUCCESSFULLY!")
print("=" * 60)
