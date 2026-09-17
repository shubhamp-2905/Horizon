"""Phase 2 authentication and task specification fields

Revision ID: 0002_phase2_auth_and_task_fields
Revises: 0001_initial_core_schema
Create Date: 2026-09-17 04:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_phase2_auth_and_task_fields'
down_revision: Union[str, None] = '0001_initial_core_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add hashed_password column to users
    op.add_column('users', sa.Column('hashed_password', sa.String(length=255), nullable=False, server_default=''))
    
    # Add estimated_effort_minutes and requirements to tasks
    op.add_column('tasks', sa.Column('estimated_effort_minutes', sa.Integer(), nullable=True, server_default='30'))
    op.add_column('tasks', sa.Column('requirements', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'requirements')
    op.drop_column('tasks', 'estimated_effort_minutes')
    op.drop_column('users', 'hashed_password')
