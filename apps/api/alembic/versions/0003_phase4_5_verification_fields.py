"""Phase 4 and 5 verification validation and AI quality fields

Revision ID: 0003_phase4_5_verification_fields
Revises: 0002_phase2_auth_and_task_fields
Create Date: 2026-10-01 06:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0003_phase4_5_verification_fields'
down_revision: Union[str, None] = '0002_phase2_auth_and_task_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add validation columns to verifications
    op.add_column('verifications', sa.Column('validation_status', sa.String(length=32), nullable=True, server_default='pending'))
    op.add_column('verifications', sa.Column('validation_results', sa.JSON(), nullable=True))
    op.create_index('ix_verifications_validation_status', 'verifications', ['validation_status'])

    # Add AI evaluation columns to verifications
    op.add_column('verifications', sa.Column('ai_status', sa.String(length=32), nullable=True, server_default='PENDING'))
    op.add_column('verifications', sa.Column('ai_results', sa.JSON(), nullable=True))
    op.create_index('ix_verifications_ai_status', 'verifications', ['ai_status'])


def downgrade() -> None:
    op.drop_index('ix_verifications_ai_status', table_name='verifications')
    op.drop_column('verifications', 'ai_results')
    op.drop_column('verifications', 'ai_status')
    op.drop_index('ix_verifications_validation_status', table_name='verifications')
    op.drop_column('verifications', 'validation_results')
    op.drop_column('verifications', 'validation_status')
