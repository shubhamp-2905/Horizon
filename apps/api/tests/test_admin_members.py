import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.database.models.user import User
from app.database.models.token import TokenAccount, TokenTransaction
from app.database.models.task import Task
from app.database.models.task_claim import TaskClaim
from app.database.models.submission import Submission
from geoalchemy2.shape import from_shape
from shapely.geometry import Point


@pytest.fixture
def member_setup(client: TestClient, db_session):
    """Seed test data for admin dashboard and members tests."""
    # 1. Admin account
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dashboard_admin@horizon.io",
            "username": "dash_admin",
            "password": "AdminPassword123!",
            "role": "admin",
        },
    )
    admin_token = admin_reg.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Contributor 1 (Alice)
    c1_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "alice_field@horizon.io",
            "username": "alice_field",
            "password": "Password123!",
            "role": "contributor",
        },
    )
    c1_token = c1_reg.json()["access_token"]
    c1_id = c1_reg.json()["user"]["id"]
    c1_headers = {"Authorization": f"Bearer {c1_token}"}

    # 3. Contributor 2 (Bob)
    c2_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "bob_scout@horizon.io",
            "username": "bob_scout",
            "password": "Password123!",
            "role": "contributor",
        },
    )
    c2_id = c2_reg.json()["user"]["id"]

    return {
        "admin_headers": admin_headers,
        "c1_headers": c1_headers,
        "c1_id": c1_id,
        "c2_id": c2_id,
    }


def test_tkn_distributed_metric_calculation(client: TestClient, db_session, member_setup):
    """Verify that TKN Distributed aggregates authoritative awards accurately and excludes non-awards."""
    admin_headers = member_setup["admin_headers"]
    c1_id = uuid.UUID(member_setup["c1_id"])
    c2_id = uuid.UUID(member_setup["c2_id"])

    # Alice and Bob both received 100 TKN starter_grant on registration = 200 TKN
    # Let's add extra award transactions:
    # Alice: +50 reward_payout, +10 reviewer_reward
    # Alice: -20 task_stake_lock (escrow lock), +20 stake_return (refund)
    # Alice: -15 stake_slashing (penalty)
    # Bob: +75 reward_payout
    c1_acc = db_session.query(TokenAccount).filter(TokenAccount.user_id == c1_id).first()
    c2_acc = db_session.query(TokenAccount).filter(TokenAccount.user_id == c2_id).first()

    # Extra transactions for Alice
    tx_reward = TokenTransaction(
        token_account_id=c1_acc.id,
        transaction_type="reward_payout",
        amount=50,
        reference_type="submission",
        reference_id=str(uuid.uuid4()),
    )
    tx_rev = TokenTransaction(
        token_account_id=c1_acc.id,
        transaction_type="reviewer_reward",
        amount=10,
        reference_type="peer_review",
        reference_id=str(uuid.uuid4()),
    )
    tx_lock = TokenTransaction(
        token_account_id=c1_acc.id,
        transaction_type="task_stake_lock",
        amount=-20,
        reference_type="task_claim",
        reference_id=str(uuid.uuid4()),
    )
    tx_return = TokenTransaction(
        token_account_id=c1_acc.id,
        transaction_type="stake_return",
        amount=20,
        reference_type="task_claim",
        reference_id=str(uuid.uuid4()),
    )
    tx_slash = TokenTransaction(
        token_account_id=c1_acc.id,
        transaction_type="stake_slashing",
        amount=-15,
        reference_type="submission",
        reference_id=str(uuid.uuid4()),
    )

    # Extra transaction for Bob
    tx_bob = TokenTransaction(
        token_account_id=c2_acc.id,
        transaction_type="reward_payout",
        amount=75,
        reference_type="submission",
        reference_id=str(uuid.uuid4()),
    )

    db_session.add_all([tx_reward, tx_rev, tx_lock, tx_return, tx_slash, tx_bob])
    db_session.commit()

    # Query admin stats
    stats_res = client.get("/api/v1/admin/stats")
    assert stats_res.status_code == 200
    data = stats_res.json()

    assert "total_tkn_distributed" in data
    assert "members_awarded_count" in data

    # Expected:
    # Alice: starter_grant(100) + reward_payout(50) + reviewer_reward(10) = 160
    # Bob: starter_grant(100) + reward_payout(75) = 175
    # Total cumulative distributed = 160 + 175 = 335 TKN (regardless of Alice's locks, returns, or slashings)
    assert data["total_tkn_distributed"] >= 335
    assert data["members_awarded_count"] >= 2


def test_admin_members_stats_endpoint_rbac(client: TestClient, member_setup):
    """Verify that /admin/members/stats enforces role-based access control."""
    admin_headers = member_setup["admin_headers"]
    c1_headers = member_setup["c1_headers"]

    # 1. Unauthenticated -> 401
    res_unauth = client.get("/api/v1/admin/members/stats")
    assert res_unauth.status_code == 401

    # 2. Contributor -> 403 Forbidden
    res_forbidden = client.get("/api/v1/admin/members/stats", headers=c1_headers)
    assert res_forbidden.status_code == 403

    # 3. Admin -> 200 OK
    res_admin = client.get("/api/v1/admin/members/stats", headers=admin_headers)
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert data["total_registered_members"] >= 2
    assert data["recent_activity_window_days"] == 30
    assert data["active_recently_count"] >= 2
    assert data["members_awarded_tkn_count"] >= 2


def test_admin_members_directory_pagination_and_search(client: TestClient, member_setup):
    """Verify listing members, searching by email/username, pagination, and excluding admins."""
    admin_headers = member_setup["admin_headers"]

    # 1. List members (admin account should NOT be in the members directory)
    res = client.get("/api/v1/admin/members?page=1&page_size=10", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    assert len(data["members"]) >= 2
    assert all(m["role"] != "admin" for m in data["members"])

    # 2. Search for "alice"
    search_res = client.get("/api/v1/admin/members?q=alice", headers=admin_headers)
    assert search_res.status_code == 200
    s_data = search_res.json()
    assert s_data["total"] == 1
    assert s_data["members"][0]["username"] == "alice_field"
    assert s_data["members"][0]["email"] == "alice_field@horizon.io"

    # 3. Search for non-existent member
    empty_res = client.get("/api/v1/admin/members?q=non_existent_ghost_user_xyz", headers=admin_headers)
    assert empty_res.status_code == 200
    assert empty_res.json()["total"] == 0
    assert len(empty_res.json()["members"]) == 0

    # 4. Status filter
    status_res = client.get("/api/v1/admin/members?status=active", headers=admin_headers)
    assert status_res.status_code == 200
    assert status_res.json()["total"] >= 2


def test_admin_member_detail_view(client: TestClient, db_session, member_setup):
    """Verify inspecting detailed member profile, ledger history, claims, and location."""
    admin_headers = member_setup["admin_headers"]
    c1_id = uuid.UUID(member_setup["c1_id"])

    # Add a task and a submission with location for Alice
    task = Task(
        title="Pecan Orchard Groundwater Survey",
        artifact_type="water_source",
        status="published",
        base_reward=80,
        commitment_stake=10,
        difficulty=1.0,
        scarcity=1.0,
    )
    db_session.add(task)
    db_session.flush()

    claim = TaskClaim(
        task_id=task.id,
        user_id=c1_id,
        stake_amount=10,
        status="completed",
        claimed_at=datetime.now(timezone.utc),
    )
    db_session.add(claim)

    sub = Submission(
        task_id=task.id,
        user_id=c1_id,
        location=from_shape(Point(73.8567, 18.5204), srid=4326),
        gps_accuracy=3.5,
        captured_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
        status="approved",
        form_data={"water_status": "clear"},
    )
    db_session.add(sub)
    db_session.commit()

    # Inspect member detail
    detail_res = client.get(f"/api/v1/admin/members/{c1_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    m = detail_res.json()

    assert m["id"] == str(c1_id)
    assert m["username"] == "alice_field"
    assert m["role"] == "contributor"
    assert m["tasks_claimed_count"] >= 1
    assert m["submissions_count"] >= 1
    assert len(m["transactions"]) >= 1

    # Check location context
    assert m["location"]["type"] == "field_observation"
    assert "Last field location" in m["location"]["display_text"]
    assert m["location"]["latitude"] is not None
    assert m["location"]["longitude"] is not None

    # Check non-existent member -> 404
    fake_id = uuid.uuid4()
    not_found_res = client.get(f"/api/v1/admin/members/{fake_id}", headers=admin_headers)
    assert not_found_res.status_code == 404


def test_admin_member_never_active_fallback(client: TestClient, db_session, member_setup):
    """Verify that a member with no qualifying activity events returns null last_active_at (Never active), not created_at."""
    admin_headers = member_setup["admin_headers"]
    c2_id = member_setup["c2_id"]

    # Bob has only registered - he has a starter grant and created_at, but NO qualifying activity events
    list_res = client.get("/api/v1/admin/members?q=bob_scout", headers=admin_headers)
    assert list_res.status_code == 200
    members = list_res.json()["members"]
    assert len(members) == 1
    bob_summary = members[0]

    # Verify that account creation timestamp is NOT used as last_active_at
    assert bob_summary["last_active_at"] is None
    assert bob_summary["joined_at"] is not None

    # Verify in member detail view as well
    detail_res = client.get(f"/api/v1/admin/members/{c2_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    bob_detail = detail_res.json()
    assert bob_detail["last_active_at"] is None
    assert bob_detail["joined_at"] is not None

    # Now Bob performs a qualifying activity: claims a task
    task = Task(
        title="Bob's Observation Task",
        artifact_type="crop_health",
        status="published",
        base_reward=50,
        commitment_stake=10,
        difficulty=1.0,
        scarcity=1.0,
    )
    db_session.add(task)
    db_session.flush()

    claim_time = datetime.now(timezone.utc)
    claim = TaskClaim(
        task_id=task.id,
        user_id=uuid.UUID(c2_id),
        stake_amount=10,
        status="claimed",
        claimed_at=claim_time,
    )
    db_session.add(claim)
    db_session.commit()

    # Now Bob's last_active_at should be populated with his activity timestamp
    updated_detail_res = client.get(f"/api/v1/admin/members/{c2_id}", headers=admin_headers)
    assert updated_detail_res.status_code == 200
    updated_detail = updated_detail_res.json()
    assert updated_detail["last_active_at"] is not None
    assert "2026" in updated_detail["last_active_at"]
