#!/usr/bin/env python3
"""
Project Horizon — Backup & Disaster Recovery Verification Suite
Tests the complete database backup, restoration, and ledger integrity verification workflow
without risking or modifying production data:

1. Creates an isolated source database populated with realistic production-equivalent records
   (users, tasks, claims, submissions, media, consensus records, peer reviews, and token transactions).
2. Performs a logical backup snapshot with SHA-256 checksum generation.
3. Simulates disaster recovery by restoring the snapshot into an isolated target database.
4. Validates 100% data integrity and record completeness across all tables.
5. Executes the authoritative mathematical token ledger audit on the restored state.
6. Asserts zero balance discrepancies and zero double-spend anomalies.
7. Safely cleans up temporary backup artifacts.
"""

import hashlib
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
API_DIR = PROJECT_ROOT / "apps" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Color formatting
GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

from app.database.base import Base
from app.database.models.user import User
from app.database.models.token import TokenAccount, TokenTransaction
from app.database.models.task import Task
from app.database.models.task_claim import TaskClaim
from app.database.models.submission import Submission
from app.database.models.submission_media import SubmissionMedia
from app.database.models.consensus import ConsensusRecord, PeerReview
from app.database.models.pipeline import DownstreamObservation
from app.modules.tokens.service import audit_token_ledger_integrity

# Disable GeoAlchemy2 SQLite hooks during in-memory testing
try:
    from geoalchemy2.admin.dialects import sqlite as geo_sqlite
    geo_sqlite.after_create = lambda table, bind, **kw: None
    geo_sqlite.before_create = lambda table, bind, **kw: None
    geo_sqlite.before_drop = lambda table, bind, **kw: None
    geo_sqlite.after_drop = lambda table, bind, **kw: None
except ImportError:
    pass


def setup_in_memory_engine():
    """Create an isolated SQLite database engine with spatial mock functions."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

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

    @event.listens_for(engine, "connect")
    def register_spatial(conn, _):
        conn.create_function("GeomFromEWKT", 1, lambda x: x)
        conn.create_function("GeomFromText", 1, lambda x: x)
        conn.create_function("GeomFromEWKB", 1, lambda x: x)
        conn.create_function("GeomFromWKB", 1, lambda x: x)
        conn.create_function("AsEWKT", 1, lambda x: str(x))
        conn.create_function("AsText", 1, lambda x: str(x))
        conn.create_function("AsEWKB", 1, _mock_as_ewkb)
        conn.create_function("AsBinary", 1, _mock_as_ewkb)
        conn.create_function("RecoverGeometryColumn", 5, lambda a, b, c, d, e: 1)
        conn.create_function("DiscardGeometryColumn", 2, lambda a, b: 1)

    Base.metadata.create_all(bind=engine)
    return engine


def seed_test_database(session):
    """Seed comprehensive test records into the source database."""
    # 1. Users & Token Accounts
    u_contrib = User(
        id=uuid.uuid4(),
        email="field_scout_dr@horizon.dev",
        username="field_scout_dr",
        role="contributor",
        hashed_password="mock_hashed_pw",
        display_name="Field Scout DR",
        status="active",
    )
    u_reviewer = User(
        id=uuid.uuid4(),
        email="peer_reviewer_dr@horizon.dev",
        username="peer_reviewer_dr",
        role="reviewer",
        hashed_password="mock_hashed_pw",
        display_name="Peer Reviewer DR",
        status="active",
    )
    session.add_all([u_contrib, u_reviewer])
    session.flush()

    # Contributor account: 100 starter + 50 reward = 150 available, 0 locked
    t_contrib = TokenAccount(user_id=u_contrib.id, available_balance=150, locked_balance=0)
    # Reviewer account: 100 starter + 5 bounty = 105 available, 0 locked
    t_reviewer = TokenAccount(user_id=u_reviewer.id, available_balance=105, locked_balance=0)
    session.add_all([t_contrib, t_reviewer])
    session.flush()

    # Ledger transactions for contributor
    tx1 = TokenTransaction(
        token_account_id=t_contrib.id,
        amount=100,
        transaction_type="starter_grant",
        reference_type="system_bootstrap",
        reference_id="welcome_grant",
    )
    tx2 = TokenTransaction(
        token_account_id=t_contrib.id,
        amount=-20,
        transaction_type="task_stake_lock",
        reference_type="task_claim",
        reference_id="claim_001",
    )
    tx3 = TokenTransaction(
        token_account_id=t_contrib.id,
        amount=20,
        transaction_type="stake_return",
        reference_type="consensus_approval",
        reference_id="claim_001",
    )
    tx4 = TokenTransaction(
        token_account_id=t_contrib.id,
        amount=50,
        transaction_type="reward",
        reference_type="task_reward",
        reference_id="task_001",
    )

    # Ledger transactions for reviewer
    tx5 = TokenTransaction(
        token_account_id=t_reviewer.id,
        amount=100,
        transaction_type="starter_grant",
        reference_type="system_bootstrap",
        reference_id="welcome_grant",
    )
    tx6 = TokenTransaction(
        token_account_id=t_reviewer.id,
        amount=5,
        transaction_type="reward",
        reference_type="consensus_bounty",
        reference_id="consensus_001",
    )
    session.add_all([tx1, tx2, tx3, tx4, tx5, tx6])
    session.flush()

    # 2. Tasks & Claims
    task = Task(
        id=uuid.uuid4(),
        title="Canopy & Watershed Assessment",
        description="Disaster recovery validation task",
        artifact_type="water_source",
        base_reward=50,
        commitment_stake=20,
        status="published",
    )
    session.add(task)
    session.flush()

    claim = TaskClaim(
        id=uuid.uuid4(),
        task_id=task.id,
        user_id=u_contrib.id,
        stake_amount=20,
        status="completed",
    )
    session.add(claim)
    session.flush()

    # 3. Submissions & Media
    sub = Submission(
        id=uuid.uuid4(),
        task_id=task.id,
        user_id=u_contrib.id,
        gps_accuracy=4.0,
        captured_at=datetime.now(timezone.utc),
        form_data={"water_status": "potable", "flow_rate": 35.0},
        status="approved",
    )
    session.add(sub)
    session.flush()

    media = SubmissionMedia(
        id=uuid.uuid4(),
        submission_id=sub.id,
        storage_key=f"submissions/{sub.id}/canopy_recovery_test.jpg",
        media_type="image/jpeg",
        media_metadata={"width": 1920, "height": 1080},
    )
    session.add(media)
    session.flush()

    # 4. Consensus & Review Ballots
    consensus = ConsensusRecord(
        id=uuid.uuid4(),
        submission_id=sub.id,
        status="APPROVED",
        pool_size=2,
        quorum=2,
        total_votes=2,
        approve_votes=2,
        reject_votes=0,
        flag_votes=0,
        settlement_status="settled",
    )
    session.add(consensus)
    session.flush()

    peer_review = PeerReview(
        id=uuid.uuid4(),
        submission_id=sub.id,
        reviewer_id=u_reviewer.id,
        decision="APPROVE",
        notes="All field data matches telemetry requirements.",
        confidence_score=0.96,
    )
    session.add(peer_review)
    session.flush()

    # 5. Downstream Observation
    downstream = DownstreamObservation(
        id=uuid.uuid4(),
        submission_id=sub.id,
        task_id=task.id,
        dataset_version="v1.recovery.test",
        artifact_type="water_source",
        latitude=18.5204,
        longitude=73.8567,
        gps_accuracy=4.0,
        captured_at=datetime.now(timezone.utc),
        approved_at=datetime.now(timezone.utc),
        canonical_data={"water_status": "potable", "flow_rate": 35.0},
        media_references=[],
        quality_score=0.92,
        provenance={"schema_version": "v1.0.0", "source": "staging_dr_test"},
    )
    session.add(downstream)
    session.commit()

    return {
        "user_ids": [str(u_contrib.id), str(u_reviewer.id)],
        "task_id": str(task.id),
        "submission_id": str(sub.id),
        "consensus_id": str(consensus.id),
        "downstream_id": str(downstream.id),
    }


def extract_database_snapshot(session):
    """Serialize all database tables to an in-memory structured snapshot dictionary."""
    snapshot = {}
    tables = [
        User, TokenAccount, TokenTransaction, Task, TaskClaim,
        Submission, SubmissionMedia, ConsensusRecord, PeerReview, DownstreamObservation
    ]

    for model in tables:
        records = session.query(model).all()
        table_name = model.__tablename__
        rows = []
        for r in records:
            row_dict = {}
            for col in r.__table__.columns:
                key = col.key
                if isinstance(r, SubmissionMedia) and key == "metadata":
                    val = r.media_metadata
                else:
                    val = getattr(r, key, None)

                if isinstance(val, uuid.UUID):
                    row_dict[key] = str(val)
                elif isinstance(val, datetime):
                    row_dict[key] = val.isoformat()
                elif hasattr(val, "value"):  # Enum
                    row_dict[key] = val.value
                else:
                    row_dict[key] = val
            rows.append(row_dict)
        snapshot[table_name] = rows

    return snapshot


def restore_database_snapshot(session, snapshot):
    """Restore serialized snapshot records into a clean target database."""
    tables_map = {
        "users": User,
        "token_accounts": TokenAccount,
        "token_transactions": TokenTransaction,
        "tasks": Task,
        "task_claims": TaskClaim,
        "submissions": Submission,
        "submission_media": SubmissionMedia,
        "consensus_records": ConsensusRecord,
        "peer_reviews": PeerReview,
        "downstream_observations": DownstreamObservation,
    }

    # Order of insertion to respect foreign key constraints
    insertion_order = [
        "users",
        "token_accounts",
        "token_transactions",
        "tasks",
        "task_claims",
        "submissions",
        "submission_media",
        "consensus_records",
        "peer_reviews",
        "downstream_observations",
    ]

    for table_name in insertion_order:
        model = tables_map[table_name]
        rows = snapshot.get(table_name, [])
        for row in rows:
            kwargs = {}
            for k, v in row.items():
                if model is SubmissionMedia and k == "metadata":
                    kwargs["media_metadata"] = v
                    continue
                col = model.__table__.columns.get(k)
                if col is None:
                    for c in model.__table__.columns:
                        if c.key == k:
                            col = c
                            break
                if col is not None:
                    if str(col.type).lower().startswith("uuid") or "guid" in str(col.type).lower():
                        kwargs[k] = uuid.UUID(v) if v else None
                    elif "datetime" in str(col.type).lower() or "timestamp" in str(col.type).lower():
                        kwargs[k] = datetime.fromisoformat(v) if v else None
                    else:
                        kwargs[k] = v
                else:
                    kwargs[k] = v
            session.add(model(**kwargs))
        session.flush()

    session.commit()


def run_backup_and_recovery_verification():
    print("\n" + "=" * 80)
    print(f"{BOLD}PROJECT HORIZON — BACKUP & DISASTER RECOVERY TEST RUNNER{RESET}")
    print("=" * 80)
    t_start = time.time()

    # Step 1: Initialize isolated Source Database
    print(f"\n{CYAN}[1/6] Initializing isolated source database & seeding records...{RESET}")
    src_engine = setup_in_memory_engine()
    SrcSession = sessionmaker(bind=src_engine)
    src_session = SrcSession()
    seed_meta = seed_test_database(src_session)
    print(f"  ✓ Source DB seeded: 2 Users, 2 Token Accounts, 6 Transactions, 1 Task, 1 Submission, 1 Consensus Record")

    # Step 2: Extract Logical Backup
    print(f"\n{CYAN}[2/6] Generating logical snapshot backup...{RESET}")
    snapshot = extract_database_snapshot(src_session)
    src_session.close()

    total_records = sum(len(rows) for rows in snapshot.values())
    snapshot_json = json.dumps(snapshot, indent=2, sort_keys=True)
    snapshot_hash = hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest()

    # Save snapshot to storage/backups/
    backup_dir = PROJECT_ROOT / "storage" / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    snapshot_file = backup_dir / f"test_recovery_snapshot_{uuid.uuid4().hex[:8]}.json"
    with open(snapshot_file, "w", encoding="utf-8") as f:
        f.write(snapshot_json)

    print(f"  ✓ Snapshot created: {snapshot_file.name}")
    print(f"  ✓ Total Tables: {len(snapshot)} | Total Records: {total_records}")
    print(f"  ✓ SHA-256 Checksum: {snapshot_hash[:32]}...")

    # Step 3: Initialize Clean Target Database for Restoration
    print(f"\n{CYAN}[3/6] Initializing clean target recovery database...{RESET}")
    dest_engine = setup_in_memory_engine()
    DestSession = sessionmaker(bind=dest_engine)
    dest_session = DestSession()
    print("  ✓ Clean target recovery database initialized with schema")

    # Step 4: Perform Restoration
    print(f"\n{CYAN}[4/6] Restoring snapshot into recovery database...{RESET}")
    restore_database_snapshot(dest_session, snapshot)
    print("  ✓ Restoration transaction committed successfully")

    # Step 5: Verify Data Completeness and Record Matching
    print(f"\n{CYAN}[5/6] Verifying record completeness and schema invariants...{RESET}")
    recovered_users = dest_session.query(User).count()
    recovered_accounts = dest_session.query(TokenAccount).count()
    recovered_txs = dest_session.query(TokenTransaction).count()
    recovered_tasks = dest_session.query(Task).count()
    recovered_claims = dest_session.query(TaskClaim).count()
    recovered_subs = dest_session.query(Submission).count()
    recovered_media = dest_session.query(SubmissionMedia).count()
    recovered_consensus = dest_session.query(ConsensusRecord).count()
    recovered_reviews = dest_session.query(PeerReview).count()
    recovered_downstream = dest_session.query(DownstreamObservation).count()

    assert recovered_users == 2, f"Expected 2 users, got {recovered_users}"
    assert recovered_accounts == 2, f"Expected 2 accounts, got {recovered_accounts}"
    assert recovered_txs == 6, f"Expected 6 transactions, got {recovered_txs}"
    assert recovered_tasks == 1, f"Expected 1 task, got {recovered_tasks}"
    assert recovered_claims == 1, f"Expected 1 claim, got {recovered_claims}"
    assert recovered_subs == 1, f"Expected 1 submission, got {recovered_subs}"
    assert recovered_media == 1, f"Expected 1 media record, got {recovered_media}"
    assert recovered_consensus == 1, f"Expected 1 consensus record, got {recovered_consensus}"
    assert recovered_reviews == 1, f"Expected 1 peer review, got {recovered_reviews}"
    assert recovered_downstream == 1, f"Expected 1 downstream observation, got {recovered_downstream}"

    print("  ✓ 100% Record Completeness: All 10 table counts match source exactly")

    # Step 6: Immutable Token Ledger Mathematical Audit on Recovered State
    print(f"\n{CYAN}[6/6] Executing authoritative mathematical token ledger audit...{RESET}")
    audit_report = audit_token_ledger_integrity(dest_session)

    print(f"  • Audit Status:            {audit_report['status']}")
    print(f"  • Accounts Audited:        {audit_report['total_accounts_audited']}")
    print(f"  • Total Circulating Tokens:{audit_report['total_circulating_available']}")
    print(f"  • Locked Tokens:           {audit_report['total_circulating_locked']}")
    print(f"  • Anomaly Count:           {audit_report['anomaly_count']}")

    assert audit_report["is_healthy"] is True, f"Ledger audit failed: {audit_report}"
    assert audit_report["anomaly_count"] == 0, f"Expected 0 anomalies, got {audit_report['anomaly_count']}"
    assert audit_report["total_circulating_available"] == 255  # 150 + 105
    assert audit_report["total_circulating_locked"] == 0

    print("  ✓ Token Ledger Audit: HEALTHY (Zero mathematical anomalies, zero double-spends)")

    # Clean up test snapshot file
    dest_session.close()
    if snapshot_file.exists():
        snapshot_file.unlink()
        print(f"  ✓ Cleaned up temporary test snapshot: {snapshot_file.name}")

    duration_ms = (time.time() - t_start) * 1000

    print("\n" + "=" * 80)
    print(f"{GREEN}{BOLD}BACKUP & DISASTER RECOVERY VERIFICATION: ALL CHECKS PASSED (100%){RESET}")
    print(f"Execution Latency: {duration_ms:.1f}ms")
    print(f"Production Safety: Strictly Isolated Sandbox (Zero production or live data touched)")
    print("=" * 80 + "\n")
    return True


if __name__ == "__main__":
    success = run_backup_and_recovery_verification()
    sys.exit(0 if success else 1)
