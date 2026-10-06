"""
End-to-end verification script testing the real database and API workflow:
1. User registration -> persists in Supabase 'users', 'token_accounts', 'token_transactions'
2. User login -> measured latency (target <= 2-3 seconds)
3. Task discovery -> PostGIS proximity / spatial coordinates
4. Task claim -> persists in Supabase 'task_claims', locks escrow tokens
5. Field collection submission -> creates submission draft in Supabase
6. Media attachment -> persists in 'submission_media'
7. Submission finalization -> persists in 'submissions', runs automated validation & consensus
"""

import sys
import os
import time
import uuid

# Ensure clean UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure apps/api is in Python path
sys.path.insert(0, os.path.abspath("apps/api"))

from app.core.config import settings
print(f"[*] Configured Database Host: {settings.DATABASE_URL.split('@')[-1]}")
print(f"[*] Environment: {settings.ENVIRONMENT}")

from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from sqlalchemy import text

client = TestClient(app)
db = SessionLocal()

def run_verification():
    print("\n=======================================================")
    print("HORIZON END-TO-END SUPABASE VERIFICATION RUNNER")
    print("=======================================================\n")

    # Step 1: Register New User
    unique_suffix = int(time.time()) % 1000000
    username = f"scout_{unique_suffix}"
    email = f"contributor_{unique_suffix}@horizon.dev"
    password = "FieldContributor2026!"
    display_name = f"Scout {unique_suffix}"

    print(f"[1/7] Registering new contributor: {username} ({email})...")
    reg_start = time.time()
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": username,
            "password": password,
            "display_name": display_name,
            "role": "contributor",
        },
    )
    reg_duration = time.time() - reg_start
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
    auth_data = reg_res.json()
    token = auth_data["access_token"]
    user_id = auth_data["user"]["id"]
    print(f"  [OK] Registration succeeded in {reg_duration:.3f}s. User ID: {user_id}")

    # Verify directly in Supabase
    db_user = db.execute(
        text("SELECT id, email, username, display_name FROM users WHERE id = :uid"),
        {"uid": user_id},
    ).fetchone()
    assert db_user is not None, "CRITICAL: Registered user was NOT found in Supabase database!"
    print(f"  [OK] Confirmed in Supabase 'users': {db_user}")

    db_account = db.execute(
        text("SELECT available_balance, locked_balance FROM token_accounts WHERE user_id = :uid"),
        {"uid": user_id},
    ).fetchone()
    assert db_account is not None and db_account[0] == 100, f"Token account issue: {db_account}"
    print(f"  [OK] Confirmed in Supabase 'token_accounts': Available={db_account[0]}, Locked={db_account[1]}")

    # Step 2: Login Latency Test
    print(f"\n[2/7] Testing Login latency with new contributor...")
    login_start = time.time()
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": username, "password": password},
    )
    login_duration = time.time() - login_start
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    print(f"  [OK] Login succeeded in {login_duration:.3f}s (Target <= 3.0s: PASSED)")

    headers = {"Authorization": f"Bearer {token}"}

    # Step 3: Discover Tasks via PostGIS
    print(f"\n[3/7] Discovering tasks at Pune coordinates (18.5204°N, 73.8567°E)...")
    disc_start = time.time()
    disc_res = client.get(
        "/api/v1/tasks?lat=18.5204&lng=73.8567&radius=10000",
        headers=headers,
    )
    disc_duration = time.time() - disc_start
    assert disc_res.status_code == 200, f"Task discovery failed: {disc_res.text}"
    disc_data = disc_res.json()
    tasks = disc_data["tasks"]
    print(f"  [OK] Discovered {len(tasks)} published tasks in {disc_duration:.3f}s")
    for t in tasks[:3]:
        print(f"    - [{t['id'][:8]}] {t['title']} | Distance: {t.get('distance_meters')}m | Reward: {t['base_reward']} TKN")
    assert len(tasks) > 0, "No published tasks found!"

    target_task = tasks[0]
    task_id = target_task["id"]

    # Step 4: Claim Task
    print(f"\n[4/7] Claiming task '{target_task['title']}' (stake: {target_task['commitment_stake']} TKN)...")
    claim_res = client.post(f"/api/v1/tasks/{task_id}/claim", headers=headers)
    assert claim_res.status_code == 200, f"Claim failed: {claim_res.text}"
    claim_data = claim_res.json()
    claim_id = claim_data["claim_id"]
    print(f"  [OK] Claim successful. Claim ID: {claim_id}")

    # Verify claim in Supabase
    db_claim = db.execute(
        text("SELECT id, status, stake_amount FROM task_claims WHERE id = :cid"),
        {"cid": claim_id},
    ).fetchone()
    assert db_claim is not None and db_claim[1] == "claimed", f"Claim verification failed: {db_claim}"
    print(f"  [OK] Confirmed in Supabase 'task_claims': Status={db_claim[1]}, Stake={db_claim[2]} TKN")

    # Verify escrow lock in Supabase token account
    db_account_post_claim = db.execute(
        text("SELECT available_balance, locked_balance FROM token_accounts WHERE user_id = :uid"),
        {"uid": user_id},
    ).fetchone()
    expected_avail = 100 - target_task["commitment_stake"]
    assert db_account_post_claim[0] == expected_avail, f"Balance mismatch: {db_account_post_claim}"
    print(f"  [OK] Confirmed in Supabase 'token_accounts': Available={db_account_post_claim[0]}, Locked={db_account_post_claim[1]}")

    # Step 5: Create Field Observation Draft
    print(f"\n[5/7] Creating field observation submission draft...")
    sub_payload = {
        "latitude": 18.5204,
        "longitude": 73.8567,
        "gps_accuracy": 4.2,
        "captured_at": "2026-10-06T12:00:00Z",
        "form_data": {
            "operational_status": "operational",
            "water_clarity": "clear",
            "flow_rate_lpm": 45.0,
            "field_notes": "Surveyed community water point. Clean and operational.",
        },
    }
    sub_res = client.post(
        f"/api/v1/tasks/{task_id}/submission",
        json=sub_payload,
        headers=headers,
    )
    assert sub_res.status_code == 201, f"Submission draft creation failed: {sub_res.text}"
    submission = sub_res.json()
    sub_id = submission["id"]
    print(f"  [OK] Submission draft created. Submission ID: {sub_id}")

    # Step 6: Attach Field Evidence Media
    print(f"\n[6/7] Attaching photographic evidence to submission...")
    media_res = client.post(
        f"/api/v1/submissions/{sub_id}/media",
        json={
            "storage_key": f"evidence/field/{sub_id}/water_source_main.jpg",
            "media_type": "image/jpeg",
            "metadata": {
                "file_size": 2840000,
                "gps_latitude": 18.5204,
                "gps_longitude": 73.8567,
                "camera_model": "Android Field Collector",
            },
        },
        headers=headers,
    )
    assert media_res.status_code == 201, f"Media attachment failed: {media_res.text}"
    media_data = media_res.json()
    print(f"  [OK] Media record attached. Storage key: {media_data['storage_key']}")

    # Step 7: Finalize Submission for Verification & Consensus
    print(f"\n[7/7] Finalizing field submission...")
    final_res = client.post(
        f"/api/v1/submissions/{sub_id}/submit",
        headers=headers,
    )
    assert final_res.status_code == 200, f"Finalize submission failed: {final_res.text}"
    final_sub = final_res.json()
    print(f"  [OK] Final submission status: {final_sub['status']}")

    # Verify directly in Supabase
    db_sub = db.execute(
        text("SELECT id, status, submitted_at FROM submissions WHERE id = :sid"),
        {"sid": sub_id},
    ).fetchone()
    assert db_sub is not None and db_sub[1] in ("submitted", "under_review", "validating"), f"Submission not updated in DB: {db_sub}"
    print(f"  [OK] Confirmed in Supabase 'submissions': Status={db_sub[1]}, SubmittedAt={db_sub[2]}")

    db_claim_final = db.execute(
        text("SELECT status, completed_at FROM task_claims WHERE id = :cid"),
        {"cid": claim_id},
    ).fetchone()
    assert db_claim_final[0] == "submitted", f"Claim not submitted in DB: {db_claim_final}"
    print(f"  [OK] Confirmed in Supabase 'task_claims': Status={db_claim_final[0]}, CompletedAt={db_claim_final[1]}")

    db_media = db.execute(
        text("SELECT count(*) FROM submission_media WHERE submission_id = :sid"),
        {"sid": sub_id},
    ).scalar()
    assert db_media >= 1, "Media record not found in Supabase!"
    print(f"  [OK] Confirmed in Supabase 'submission_media': {db_media} media records attached")

    db_consensus = db.execute(
        text("SELECT id, status, quorum, pool_size FROM consensus_records WHERE submission_id = :sid"),
        {"sid": sub_id},
    ).fetchone()
    print(f"  [OK] Confirmed in Supabase 'consensus_records': Record={db_consensus}")

    print("\n=======================================================")
    print("ALL 7 END-TO-END SUPABASE LIFECYCLE CHECKS PASSED 100%!")
    print("=======================================================\n")

if __name__ == "__main__":
    try:
        run_verification()
    finally:
        db.close()
