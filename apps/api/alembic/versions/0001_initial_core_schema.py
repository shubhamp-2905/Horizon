"""Initial core schema migration for Horizon foundation

Revision ID: 0001_initial_core_schema
Revises: 
Create Date: 2026-09-17 04:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = '0001_initial_core_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable PostGIS extension if running against PostgreSQL
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # 1. Users table
    op.create_table(
        'users',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=64), nullable=False),
        sa.Column('display_name', sa.String(length=128), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('role', sa.String(length=32), nullable=False, server_default='contributor'),
        sa.Column('avatar_url', sa.String(length=512), nullable=True),
        sa.Column('profile_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_status', 'users', ['status'])
    op.create_index('ix_users_role', 'users', ['role'])

    # 2. Tasks table
    op.create_table(
        'tasks',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('artifact_type', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('difficulty', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('scarcity', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('base_reward', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('commitment_stake', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('location_point', Geometry(geometry_type='POINT', srid=4326), nullable=True),
        sa.Column('geographic_area', Geometry(geometry_type='POLYGON', srid=4326), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_tasks_artifact_type', 'tasks', ['artifact_type'])
    op.create_index('ix_tasks_status', 'tasks', ['status'])
    op.create_index('idx_tasks_status_artifact', 'tasks', ['status', 'artifact_type'])

    # 3. Task Form Schemas table
    op.create_table(
        'task_form_schemas',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('task_id', sa.CHAR(36), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('schema_definition', sa.JSON(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_task_form_schemas_task_id', 'task_form_schemas', ['task_id'])

    # 4. Task Claims table
    op.create_table(
        'task_claims',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('task_id', sa.CHAR(36), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.CHAR(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('stake_amount', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='claimed'),
        sa.Column('claimed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_task_claims_task_id', 'task_claims', ['task_id'])
    op.create_index('ix_task_claims_user_id', 'task_claims', ['user_id'])
    op.create_index('ix_task_claims_status', 'task_claims', ['status'])
    op.create_index('idx_claims_task_user_status', 'task_claims', ['task_id', 'user_id', 'status'])

    # 5. Submissions table
    op.create_table(
        'submissions',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('task_id', sa.CHAR(36), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.CHAR(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('location', Geometry(geometry_type='POINT', srid=4326), nullable=True),
        sa.Column('gps_accuracy', sa.Float(), nullable=False, server_default='5.0'),
        sa.Column('captured_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='submitted'),
        sa.Column('form_data', sa.JSON(), nullable=False),
    )
    op.create_index('ix_submissions_task_id', 'submissions', ['task_id'])
    op.create_index('ix_submissions_user_id', 'submissions', ['user_id'])
    op.create_index('ix_submissions_status', 'submissions', ['status'])
    op.create_index('idx_submissions_task_status', 'submissions', ['task_id', 'status'])
    op.create_index('idx_submissions_user_status', 'submissions', ['user_id', 'status'])

    # 6. Submission Media table
    op.create_table(
        'submission_media',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('submission_id', sa.CHAR(36), sa.ForeignKey('submissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('storage_key', sa.String(length=512), nullable=False),
        sa.Column('media_type', sa.String(length=64), nullable=False, server_default='image/jpeg'),
        sa.Column('metadata', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_submission_media_submission_id', 'submission_media', ['submission_id'])

    # 7. Verifications table
    op.create_table(
        'verifications',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('submission_id', sa.CHAR(36), sa.ForeignKey('submissions.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('reviewer_id', sa.CHAR(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('ai_confidence_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_verifications_submission_id', 'verifications', ['submission_id'])
    op.create_index('ix_verifications_status', 'verifications', ['status'])
    op.create_index('idx_verifications_status_reviewer', 'verifications', ['status', 'reviewer_id'])

    # 8. Rewards table
    op.create_table(
        'rewards',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('submission_id', sa.CHAR(36), sa.ForeignKey('submissions.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('base_value', sa.Float(), nullable=False, server_default='50.0'),
        sa.Column('difficulty_factor', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('scarcity_factor', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('quality_factor', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('calculated_reward', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_rewards_submission_id', 'rewards', ['submission_id'])
    op.create_index('ix_rewards_status', 'rewards', ['status'])

    # 9. Token Accounts table
    op.create_table(
        'token_accounts',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('user_id', sa.CHAR(36), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('available_balance', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('locked_balance', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_token_accounts_user_id', 'token_accounts', ['user_id'])

    # 10. Token Transactions table
    op.create_table(
        'token_transactions',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('token_account_id', sa.CHAR(36), sa.ForeignKey('token_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('transaction_type', sa.String(length=32), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('reference_type', sa.String(length=32), nullable=True),
        sa.Column('reference_id', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_token_transactions_token_account_id', 'token_transactions', ['token_account_id'])
    op.create_index('ix_token_transactions_transaction_type', 'token_transactions', ['transaction_type'])
    op.create_index('idx_transactions_account_type', 'token_transactions', ['token_account_id', 'transaction_type'])

    # 11. Reputations table
    op.create_table(
        'reputations',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('user_id', sa.CHAR(36), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('score', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_reputations_user_id', 'reputations', ['user_id'])


def downgrade() -> None:
    op.drop_table('reputations')
    op.drop_table('token_transactions')
    op.drop_table('token_accounts')
    op.drop_table('rewards')
    op.drop_table('verifications')
    op.drop_table('submission_media')
    op.drop_table('submissions')
    op.drop_table('task_claims')
    op.drop_table('task_form_schemas')
    op.drop_table('tasks')
    op.drop_table('users')
