import uuid
from datetime import datetime, timezone
from app.database.models import (
    User,
    Task,
    TaskFormSchema,
    TaskClaim,
    Submission,
    SubmissionMedia,
    Verification,
    Reward,
    TokenAccount,
    TokenTransaction,
    Reputation,
)


def test_user_and_token_account_lifecycle(db_session):
    user = User(
        email="contributor@example.com",
        username="earth_scout_01",
        hashed_password="hash123",
        display_name="Earth Scout 01",
        role="contributor",
        status="active",
        profile_data={"device": "android", "level": 1},
    )
    db_session.add(user)
    db_session.flush()

    assert user.id is not None
    assert user.email == "contributor@example.com"

    # Token Account
    account = TokenAccount(
        user_id=user.id,
        available_balance=100,
        locked_balance=0,
    )
    db_session.add(account)
    db_session.flush()

    # Initial Grant Transaction
    tx = TokenTransaction(
        token_account_id=account.id,
        transaction_type="starter_grant",
        amount=100,
        reference_type="system_bootstrap",
        reference_id="welcome_bonus",
    )
    db_session.add(tx)
    db_session.flush()

    # Reputation
    rep = Reputation(
        user_id=user.id,
        score=100.0,
    )
    db_session.add(rep)
    db_session.flush()

    queried_user = db_session.query(User).filter_by(username="earth_scout_01").first()
    assert queried_user is not None
    assert queried_user.token_account.available_balance == 100
    assert queried_user.reputation.score == 100.0


def test_task_submission_and_verification_lifecycle(db_session):
    # 1. Create Contributor & Reviewer
    contributor = User(email="c1@test.com", username="c1", hashed_password="hash123")
    reviewer = User(email="r1@test.com", username="r1", role="reviewer", hashed_password="hash123")
    db_session.add_all([contributor, reviewer])
    db_session.flush()

    # 2. Create Task
    task = Task(
        title="Map Flood Defense Bund",
        description="Capture boundary and photos of newly reinforced earth bund.",
        artifact_type="flood_defense",
        status="active",
        difficulty=2,
        scarcity=1.5,
        base_reward=75,
        commitment_stake=15,
    )
    db_session.add(task)
    db_session.flush()

    # 3. Form Schema
    schema = TaskFormSchema(
        task_id=task.id,
        schema_definition={
            "type": "object",
            "properties": {
                "crest_height_m": {"type": "number"},
                "condition": {"type": "string", "enum": ["intact", "eroded", "breached"]},
            },
            "required": ["crest_height_m", "condition"],
        },
        version=1,
    )
    db_session.add(schema)

    # 4. Task Claim
    claim = TaskClaim(
        task_id=task.id,
        user_id=contributor.id,
        stake_amount=15,
        status="claimed",
    )
    db_session.add(claim)
    db_session.flush()

    # 5. Submission
    submission = Submission(
        task_id=task.id,
        user_id=contributor.id,
        gps_accuracy=3.2,
        captured_at=datetime.now(timezone.utc),
        status="submitted",
        form_data={"crest_height_m": 2.4, "condition": "intact"},
    )
    db_session.add(submission)
    db_session.flush()

    # 6. Submission Media
    media = SubmissionMedia(
        submission_id=submission.id,
        storage_key="submissions/2026/09/flood_defense_01.jpg",
        media_type="image/jpeg",
        media_metadata={"width": 4032, "height": 3024, "iso": 100},
    )
    db_session.add(media)

    # 7. Verification
    verification = Verification(
        submission_id=submission.id,
        reviewer_id=reviewer.id,
        status="verified",
        notes="High quality photos showing clear crest height and no visible erosion.",
        ai_confidence_score=0.94,
    )
    db_session.add(verification)

    # 8. Reward
    reward = Reward(
        submission_id=submission.id,
        base_value=75.0,
        difficulty_factor=1.2,
        scarcity_factor=1.5,
        quality_factor=1.0,
        calculated_reward=135,
        status="granted",
    )
    db_session.add(reward)
    db_session.flush()

    # Verify query graph
    saved_sub = db_session.query(Submission).filter_by(id=submission.id).first()
    assert saved_sub is not None
    assert saved_sub.user.username == "c1"
    assert saved_sub.task.artifact_type == "flood_defense"
    assert len(saved_sub.media) == 1
    assert saved_sub.verification.status == "verified"
    assert saved_sub.reward.calculated_reward == 135
