import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.models.user import User
from app.database.models.task import Task
from app.database.models.task_claim import TaskClaim
from app.database.models.submission import Submission
from app.database.models.submission_media import SubmissionMedia
from app.database.models.token import TokenAccount, TokenTransaction
from app.database.models.consensus import PeerReviewAssignment, PeerReview, ConsensusRecord
from app.core.security import hash_password, create_access_token


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
    account = TokenAccount(user_id=u.id, available_balance=100, locked_balance=0)
    db.add(account)
    db.flush()
    tx = TokenTransaction(
        token_account_id=account.id,
        transaction_type="starter_grant",
        amount=100,
        reference_type="system_bootstrap",
        reference_id="welcome_starter_grant",
    )
    db.add(tx)
    db.commit()
    db.refresh(u)
    return u


def _create_task(db: Session, title: str = "Consensus Test Task") -> Task:
    t = Task(
        title=title,
        artifact_type="water_source",
        status="published",
        difficulty=1.0,
        scarcity=1.0,
        base_reward=100,
        commitment_stake=20,
        requirements=["Photo of site", "Status report"],
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


from typing import Tuple


def _create_claimed_submission(db: Session, contributor: User, task: Task) -> Tuple[Submission, TaskClaim]:
    # 1. Lock stake in token account
    acct = db.query(TokenAccount).filter(TokenAccount.user_id == contributor.id).first()
    acct.available_balance -= task.commitment_stake
    acct.locked_balance += task.commitment_stake
    tx = TokenTransaction(
        token_account_id=acct.id,
        transaction_type="task_stake_lock",
        amount=-task.commitment_stake,
        reference_type="task_claim",
        reference_id=str(task.id),
    )
    db.add(tx)

    # 2. Claim task
    claim = TaskClaim(
        task_id=task.id,
        user_id=contributor.id,
        stake_amount=task.commitment_stake,
        status="submitted",
    )
    db.add(claim)
    db.flush()

    # 3. Create submission
    sub = Submission(
        task_id=task.id,
        user_id=contributor.id,
        gps_accuracy=5.0,
        captured_at=datetime.now(timezone.utc),
        status="submitted",
        form_data={"site_condition": "good", "water_clarity": "clear"},
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    db.refresh(claim)
    return sub, claim


def test_peer_consensus_majority_approval(client: TestClient, db_session: Session):
    """Verify that a 2-of-3 majority APPROVE releases escrow and mints rewards."""
    contributor = _create_user(db_session, "contrib1@test.com", "contrib1", role="contributor")
    rev1 = _create_user(db_session, "rev1@test.com", "reviewer1", role="reviewer")
    rev2 = _create_user(db_session, "rev2@test.com", "reviewer2", role="reviewer")
    rev3 = _create_user(db_session, "rev3@test.com", "reviewer3", role="reviewer")
    admin = _create_user(db_session, "admin1@test.com", "admin1", role="admin")

    task = _create_task(db_session, "Water Well Verification")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    admin_token = create_access_token(str(admin.id), role="admin")
    rev1_token = create_access_token(str(rev1.id), role="reviewer")
    rev2_token = create_access_token(str(rev2.id), role="reviewer")

    # 1. Assign reviewers with pool_size=3, quorum=2
    assign_res = client.post(
        f"/api/v1/submissions/{sub.id}/assign-reviewers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"pool_size": 3, "quorum": 2, "reviewer_ids": [str(rev1.id), str(rev2.id), str(rev3.id)]},
    )
    assert assign_res.status_code == 200
    assign_data = assign_res.json()
    assert assign_data["pool_size"] == 3
    assert assign_data["quorum"] == 2
    assert len(assign_data["assignments"]) == 3

    # 2. Check consensus status is initially PENDING
    status_res = client.get(
        f"/api/v1/submissions/{sub.id}/consensus",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "PENDING"
    assert status_res.json()["total_votes"] == 0

    # 3. Reviewer 1 votes APPROVE (total_votes=1 < quorum=2 -> still PENDING)
    v1_res = client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev1_token}"},
        json={"decision": "APPROVE", "notes": "Clear photos and accurate GPS coordinates"},
    )
    assert v1_res.status_code == 201
    assert v1_res.json()["decision"] == "APPROVE"

    status_mid = client.get(
        f"/api/v1/submissions/{sub.id}/consensus",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert status_mid.json()["status"] == "PENDING"
    assert status_mid.json()["total_votes"] == 1
    assert status_mid.json()["approve_votes"] == 1

    # 4. Reviewer 2 votes APPROVE (total_votes=2 >= quorum=2 -> 2/2 approvals -> APPROVED)
    v2_res = client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev2_token}"},
        json={"decision": "APPROVE", "notes": "All checks pass cleanly"},
    )
    assert v2_res.status_code == 201

    status_final = client.get(
        f"/api/v1/submissions/{sub.id}/consensus",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    final_data = status_final.json()
    assert final_data["status"] == "APPROVED"
    assert final_data["settlement_status"] == "settled"
    assert final_data["approve_votes"] == 2

    # 5. Verify Token Settlement
    # Contributor had 80 available, 20 locked.
    # On APPROVE: 20 locked stake returned to available, and 100 reward minted -> 80 + 20 + 100 = 200.
    c_acct = db_session.query(TokenAccount).filter(TokenAccount.user_id == contributor.id).first()
    assert c_acct.locked_balance == 0
    assert c_acct.available_balance == 200

    # Reviewers 1 and 2 received reviewer bounties (+5 tokens each: 100 + 5 = 105)
    r1_acct = db_session.query(TokenAccount).filter(TokenAccount.user_id == rev1.id).first()
    assert r1_acct.available_balance == 105

    # Claim is marked released
    db_session.refresh(claim)
    assert claim.status == "released"


def test_peer_consensus_majority_rejection(client: TestClient, db_session: Session):
    """Verify that a 2-of-2 majority REJECT refunds commitment stake and grants no reward."""
    contributor = _create_user(db_session, "contrib2@test.com", "contrib2", role="contributor")
    rev1 = _create_user(db_session, "rev2_1@test.com", "reviewer2_1", role="reviewer")
    rev2 = _create_user(db_session, "rev2_2@test.com", "reviewer2_2", role="reviewer")
    admin = _create_user(db_session, "admin2@test.com", "admin2", role="admin")

    task = _create_task(db_session, "Solar Array Inspection")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    admin_token = create_access_token(str(admin.id), role="admin")
    rev1_token = create_access_token(str(rev1.id), role="reviewer")
    rev2_token = create_access_token(str(rev2.id), role="reviewer")

    # Assign pool_size=2, quorum=2
    client.post(
        f"/api/v1/submissions/{sub.id}/assign-reviewers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"pool_size": 2, "quorum": 2, "reviewer_ids": [str(rev1.id), str(rev2.id)]},
    )

    # Reviewer 1 votes REJECT with notes
    client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev1_token}"},
        json={"decision": "REJECT", "notes": "Panel photos are blurry and serial numbers unreadable"},
    )

    # Reviewer 2 votes REJECT with notes
    client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev2_token}"},
        json={"decision": "REJECT", "notes": "Missing required inverter reading"},
    )

    # Consensus should now be REJECTED
    status_res = client.get(
        f"/api/v1/submissions/{sub.id}/consensus",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    data = status_res.json()
    assert data["status"] == "REJECTED"
    assert data["settlement_status"] == "settled"
    assert data["reject_votes"] == 2

    # Under standard rejection policy, locked stake is returned in good faith, but no reward is paid
    c_acct = db_session.query(TokenAccount).filter(TokenAccount.user_id == contributor.id).first()
    assert c_acct.locked_balance == 0
    assert c_acct.available_balance == 100  # 80 + 20 refund = 100, no reward minted


def test_peer_consensus_conflicting_votes_dispute(client: TestClient, db_session: Session):
    """Verify that a tie / split vote transitions consensus to DISPUTED."""
    contributor = _create_user(db_session, "contrib3@test.com", "contrib3", role="contributor")
    rev1 = _create_user(db_session, "rev3_1@test.com", "reviewer3_1", role="reviewer")
    rev2 = _create_user(db_session, "rev3_2@test.com", "reviewer3_2", role="reviewer")
    admin = _create_user(db_session, "admin3@test.com", "admin3", role="admin")

    task = _create_task(db_session, "Drainage Blockage Survey")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    admin_token = create_access_token(str(admin.id), role="admin")
    rev1_token = create_access_token(str(rev1.id), role="reviewer")
    rev2_token = create_access_token(str(rev2.id), role="reviewer")

    client.post(
        f"/api/v1/submissions/{sub.id}/assign-reviewers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"pool_size": 2, "quorum": 2, "reviewer_ids": [str(rev1.id), str(rev2.id)]},
    )

    # 1 approve vs 1 reject
    client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev1_token}"},
        json={"decision": "APPROVE", "notes": "Looks acceptable"},
    )
    client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev2_token}"},
        json={"decision": "REJECT", "notes": "Not clear if blockage was cleared"},
    )

    status_res = client.get(
        f"/api/v1/submissions/{sub.id}/consensus",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert status_res.json()["status"] == "DISPUTED"


def test_peer_review_flag_decision(client: TestClient, db_session: Session):
    """Verify that a FLAG decision escalates the contribution to DISPUTED status."""
    contributor = _create_user(db_session, "contrib4@test.com", "contrib4", role="contributor")
    rev1 = _create_user(db_session, "rev4_1@test.com", "reviewer4_1", role="reviewer")
    rev2 = _create_user(db_session, "rev4_2@test.com", "reviewer4_2", role="reviewer")
    admin = _create_user(db_session, "admin4@test.com", "admin4", role="admin")

    task = _create_task(db_session, "Culvert Check")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    admin_token = create_access_token(str(admin.id), role="admin")
    rev1_token = create_access_token(str(rev1.id), role="reviewer")
    rev2_token = create_access_token(str(rev2.id), role="reviewer")

    client.post(
        f"/api/v1/submissions/{sub.id}/assign-reviewers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"pool_size": 2, "quorum": 2, "reviewer_ids": [str(rev1.id), str(rev2.id)]},
    )

    # Rev 1 flags suspected fraud
    client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev1_token}"},
        json={"decision": "FLAG", "notes": "Possible stock photo; EXIF date doesn't match capture timestamp"},
    )
    # Rev 2 approves
    client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev2_token}"},
        json={"decision": "APPROVE", "notes": "Observations look valid"},
    )

    status_res = client.get(
        f"/api/v1/submissions/{sub.id}/consensus",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert status_res.json()["status"] == "DISPUTED"
    assert status_res.json()["flag_votes"] == 1


def test_self_review_prevention(client: TestClient, db_session: Session):
    """Verify that a contributor cannot review their own submission."""
    # Create user with reviewer privileges who also made a submission
    dual_user = _create_user(db_session, "dual@test.com", "dual_user", role="reviewer")
    task = _create_task(db_session, "Self Review Prevention Task")
    sub, claim = _create_claimed_submission(db_session, dual_user, task)

    token = create_access_token(str(dual_user.id), role="reviewer")

    res = client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "APPROVE", "notes": "Self approval attempt"},
    )
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "CANNOT_REVIEW_OWN_SUBMISSION"


def test_duplicate_voting_prevention(client: TestClient, db_session: Session):
    """Verify that a reviewer cannot cast multiple votes on the same submission."""
    contributor = _create_user(db_session, "contrib5@test.com", "contrib5", role="contributor")
    reviewer = _create_user(db_session, "rev5@test.com", "reviewer5", role="reviewer")
    task = _create_task(db_session, "Duplicate Vote Task")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    rev_token = create_access_token(str(reviewer.id), role="reviewer")

    # First vote succeeds
    r1 = client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev_token}"},
        json={"decision": "APPROVE", "notes": "First ballot"},
    )
    assert r1.status_code == 201

    # Second vote rejected with 409 Conflict
    r2 = client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev_token}"},
        json={"decision": "APPROVE", "notes": "Second ballot duplicate"},
    )
    assert r2.status_code == 409
    assert r2.json()["detail"]["code"] == "DUPLICATE_VOTE"


def test_unauthorized_contributor_cannot_review(client: TestClient, db_session: Session):
    """Verify that non-reviewers cannot cast peer review ballots."""
    author = _create_user(db_session, "author6@test.com", "author6", role="contributor")
    random_contrib = _create_user(db_session, "other6@test.com", "other6", role="contributor")
    task = _create_task(db_session, "Role Check Task")
    sub, claim = _create_claimed_submission(db_session, author, task)

    token = create_access_token(str(random_contrib.id), role="contributor")

    res = client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "APPROVE", "notes": "Unauthorized review"},
    )
    assert res.status_code == 403


def test_review_notes_required_on_reject_and_flag(client: TestClient, db_session: Session):
    """Verify that REJECT and FLAG decisions require descriptive review notes."""
    contributor = _create_user(db_session, "contrib7@test.com", "contrib7", role="contributor")
    reviewer = _create_user(db_session, "rev7@test.com", "reviewer7", role="reviewer")
    task = _create_task(db_session, "Notes Required Task")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    rev_token = create_access_token(str(reviewer.id), role="reviewer")

    # Empty notes on REJECT
    res_reject = client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev_token}"},
        json={"decision": "REJECT", "notes": ""},
    )
    assert res_reject.status_code == 422
    assert res_reject.json()["detail"]["code"] == "NOTES_REQUIRED"

    # Whitespace notes on FLAG
    res_flag = client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev_token}"},
        json={"decision": "FLAG", "notes": "   "},
    )
    assert res_flag.status_code == 422
    assert res_flag.json()["detail"]["code"] == "NOTES_REQUIRED"


def test_dispute_raising_and_admin_slashing(client: TestClient, db_session: Session):
    """Verify dispute escalation and administrative stake slashing with immutable audit entry."""
    contributor = _create_user(db_session, "fraud_contrib@test.com", "fraud_contrib", role="contributor")
    admin = _create_user(db_session, "superadmin@test.com", "superadmin", role="admin")
    task = _create_task(db_session, "Fraud Slashing Task")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    contrib_token = create_access_token(str(contributor.id), role="contributor")
    admin_token = create_access_token(str(admin.id), role="admin")

    # 1. Contributor raises dispute
    disp_res = client.post(
        f"/api/v1/submissions/{sub.id}/dispute",
        headers={"Authorization": f"Bearer {contrib_token}"},
        json={"reason": "Contesting verification outcome due to intermittent connectivity loss"},
    )
    assert disp_res.status_code == 200
    assert disp_res.json()["status"] == "DISPUTED"
    assert disp_res.json()["dispute_reason"] is not None

    # 2. Administrator resolves dispute with FRAUD SLASH
    resolve_res = client.post(
        f"/api/v1/submissions/{sub.id}/dispute/resolve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "resolve_action": "reject_slash",
            "notes": "Investigation confirms submitted photos were scraped from web and coordinates spoofed.",
        },
    )
    assert resolve_res.status_code == 200
    data = resolve_res.json()
    assert data["status"] == "REJECTED"
    assert data["settlement_status"] == "settled"

    # 3. Verify stake was SLASHED from contributor (burned from locked balance, not returned to available)
    c_acct = db_session.query(TokenAccount).filter(TokenAccount.user_id == contributor.id).first()
    assert c_acct.locked_balance == 0
    assert c_acct.available_balance == 80  # Initial 100 - 20 locked = 80; stake was burned, balance stays 80!

    # 4. Verify immutable ledger recorded "stake_slashing"
    slash_tx = (
        db_session.query(TokenTransaction)
        .filter(
            TokenTransaction.token_account_id == c_acct.id,
            TokenTransaction.transaction_type == "stake_slashing",
        )
        .first()
    )
    assert slash_tx is not None
    assert slash_tx.amount == -20
    assert slash_tx.reference_type == "submission"


def test_dispute_resolve_approve_and_payout(client: TestClient, db_session: Session):
    """Verify that admin dispute resolution with 'approve' releases escrow and mints rewards."""
    contributor = _create_user(db_session, "appealer@test.com", "appealer", role="contributor")
    admin = _create_user(db_session, "admin_appeal@test.com", "admin_appeal", role="admin")
    task = _create_task(db_session, "Appealed Task")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    admin_token = create_access_token(str(admin.id), role="admin")

    # Raise dispute
    client.post(
        f"/api/v1/submissions/{sub.id}/dispute",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"reason": "Reviewers had split vote; requires administrative override"},
    )

    # Admin resolves with approve
    res = client.post(
        f"/api/v1/submissions/{sub.id}/dispute/resolve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"resolve_action": "approve", "notes": "Evidence verified independently. High fidelity capture."},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "APPROVED"

    # Token balances updated
    c_acct = db_session.query(TokenAccount).filter(TokenAccount.user_id == contributor.id).first()
    assert c_acct.locked_balance == 0
    assert c_acct.available_balance == 200  # 80 + 20 stake returned + 100 reward


def test_double_settlement_idempotency(client: TestClient, db_session: Session):
    """Verify that multiple settlement calls do not duplicate token rewards or stake returns."""
    from app.modules.consensus.service import settle_consensus
    contributor = _create_user(db_session, "idem_contrib@test.com", "idem_contrib", role="contributor")
    rev1 = _create_user(db_session, "idem_rev1@test.com", "idem_rev1", role="reviewer")
    rev2 = _create_user(db_session, "idem_rev2@test.com", "idem_rev2", role="reviewer")
    admin = _create_user(db_session, "idem_admin@test.com", "idem_admin", role="admin")

    task = _create_task(db_session, "Idempotency Task")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    admin_token = create_access_token(str(admin.id), role="admin")
    rev1_token = create_access_token(str(rev1.id), role="reviewer")
    rev2_token = create_access_token(str(rev2.id), role="reviewer")

    # Assign and reach consensus
    client.post(
        f"/api/v1/submissions/{sub.id}/assign-reviewers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"pool_size": 2, "quorum": 2, "reviewer_ids": [str(rev1.id), str(rev2.id)]},
    )
    client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev1_token}"},
        json={"decision": "APPROVE", "notes": "Approved 1"},
    )
    client.post(
        f"/api/v1/submissions/{sub.id}/peer-reviews",
        headers={"Authorization": f"Bearer {rev2_token}"},
        json={"decision": "APPROVE", "notes": "Approved 2"},
    )

    # First settlement occurred automatically on 2nd vote
    c_acct = db_session.query(TokenAccount).filter(TokenAccount.user_id == contributor.id).first()
    assert c_acct.available_balance == 200

    # Explicitly call settle_consensus a second and third time
    consensus = db_session.query(ConsensusRecord).filter(ConsensusRecord.submission_id == sub.id).first()
    res2 = settle_consensus(db_session, consensus)
    assert res2["status"] == "already_settled"

    res3 = settle_consensus(db_session, consensus)
    assert res3["status"] == "already_settled"

    # Contributor balance MUST NOT have changed
    db_session.refresh(c_acct)
    assert c_acct.available_balance == 200
    assert c_acct.locked_balance == 0


def test_reviewer_workflow_my_assigned_reviews(client: TestClient, db_session: Session):
    """Verify that a reviewer can query their pending assigned reviews."""
    contributor = _create_user(db_session, "wf_contrib@test.com", "wf_contrib", role="contributor")
    reviewer = _create_user(db_session, "wf_rev@test.com", "wf_rev", role="reviewer")
    admin = _create_user(db_session, "wf_admin@test.com", "wf_admin", role="admin")

    task = _create_task(db_session, "Workflow Inspection Task")
    sub, claim = _create_claimed_submission(db_session, contributor, task)

    admin_token = create_access_token(str(admin.id), role="admin")
    rev_token = create_access_token(str(reviewer.id), role="reviewer")

    # Admin assigns reviewer
    client.post(
        f"/api/v1/submissions/{sub.id}/assign-reviewers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"pool_size": 1, "quorum": 1, "reviewer_ids": [str(reviewer.id)]},
    )

    # Reviewer checks their assigned reviews
    my_reviews_res = client.get(
        "/api/v1/me/assigned-reviews",
        headers={"Authorization": f"Bearer {rev_token}"},
    )
    assert my_reviews_res.status_code == 200
    my_subs = my_reviews_res.json()["submissions"]
    assert len(my_subs) >= 1
    assert any(s["id"] == str(sub.id) for s in my_subs)

