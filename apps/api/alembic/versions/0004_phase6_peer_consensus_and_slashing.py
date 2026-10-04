"""Phase 6 Distributed Peer Consensus and Slashing

Revision ID: 0004_phase6_peer_consensus_and_slashing
Revises: 0003_phase4_5_verification_fields
Create Date: 2026-10-04 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.database.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0004_phase6_peer_consensus_and_slashing'
down_revision: Union[str, None] = '0003_phase4_5_verification_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. peer_review_assignments table
    op.create_table(
        'peer_review_assignments',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('submission_id', GUID(), nullable=False),
        sa.Column('reviewer_id', GUID(), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='assigned', nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('submission_id', 'reviewer_id', name='uq_peer_assignment_submission_reviewer'),
    )
    op.create_index('ix_peer_review_assignments_submission_id', 'peer_review_assignments', ['submission_id'])
    op.create_index('ix_peer_review_assignments_reviewer_id', 'peer_review_assignments', ['reviewer_id'])
    op.create_index('ix_peer_review_assignments_status', 'peer_review_assignments', ['status'])

    # 2. peer_reviews table
    op.create_table(
        'peer_reviews',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('submission_id', GUID(), nullable=False),
        sa.Column('reviewer_id', GUID(), nullable=False),
        sa.Column('decision', sa.String(length=32), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('evidence_references', sa.JSON(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('submission_id', 'reviewer_id', name='uq_peer_review_submission_reviewer'),
    )
    op.create_index('ix_peer_reviews_submission_id', 'peer_reviews', ['submission_id'])
    op.create_index('ix_peer_reviews_reviewer_id', 'peer_reviews', ['reviewer_id'])
    op.create_index('ix_peer_reviews_decision', 'peer_reviews', ['decision'])

    # 3. consensus_records table
    op.create_table(
        'consensus_records',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('submission_id', GUID(), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='PENDING', nullable=False),
        sa.Column('pool_size', sa.Integer(), server_default='3', nullable=False),
        sa.Column('quorum', sa.Integer(), server_default='2', nullable=False),
        sa.Column('approval_threshold', sa.Float(), server_default='0.5', nullable=False),
        sa.Column('rejection_threshold', sa.Float(), server_default='0.5', nullable=False),
        sa.Column('total_votes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('approve_votes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('reject_votes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('flag_votes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('settlement_status', sa.String(length=32), server_default='unsettled', nullable=False),
        sa.Column('settled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dispute_reason', sa.Text(), nullable=True),
        sa.Column('disputed_by', GUID(), nullable=True),
        sa.Column('disputed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('resolved_by', GUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('consensus_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['disputed_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('submission_id'),
    )
    op.create_index('ix_consensus_records_status', 'consensus_records', ['status'])
    op.create_index('ix_consensus_records_settlement_status', 'consensus_records', ['settlement_status'])


def downgrade() -> None:
    op.drop_table('consensus_records')
    op.drop_table('peer_reviews')
    op.drop_table('peer_review_assignments')
