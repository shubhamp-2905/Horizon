"""Phase 7 Loupe Downstream ETL Pipeline

Revision ID: 0005_phase7_loupe_downstream_pipeline
Revises: 0004_phase6_peer_consensus_and_slashing
Create Date: 2026-10-04 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.database.base import GUID
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = '0005_phase7_loupe_downstream_pipeline'
down_revision: Union[str, None] = '0004_phase6_peer_consensus_and_slashing'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. etl_pipeline_runs table
    op.create_table(
        'etl_pipeline_runs',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('pipeline_name', sa.String(length=64), server_default='loupe_downstream_etl', nullable=False),
        sa.Column('dataset_version', sa.String(length=32), nullable=False),
        sa.Column('run_type', sa.String(length=32), server_default='incremental', nullable=False),
        sa.Column('status', sa.String(length=32), server_default='PENDING', nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('records_extracted', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_transformed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_loaded', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_skipped', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_failed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('max_retries', sa.Integer(), server_default='3', nullable=False),
        sa.Column('execution_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_etl_runs_version_status', 'etl_pipeline_runs', ['dataset_version', 'status'], unique=False)
    op.create_index(op.f('ix_etl_pipeline_runs_dataset_version'), 'etl_pipeline_runs', ['dataset_version'], unique=False)
    op.create_index(op.f('ix_etl_pipeline_runs_status'), 'etl_pipeline_runs', ['status'], unique=False)

    # 2. etl_bronze_records table
    op.create_table(
        'etl_bronze_records',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('pipeline_run_id', GUID(), nullable=False),
        sa.Column('submission_id', GUID(), nullable=False),
        sa.Column('raw_payload', sa.JSON(), nullable=False),
        sa.Column('extracted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['pipeline_run_id'], ['etl_pipeline_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_etl_bronze_records_pipeline_run_id'), 'etl_bronze_records', ['pipeline_run_id'], unique=False)
    op.create_index(op.f('ix_etl_bronze_records_submission_id'), 'etl_bronze_records', ['submission_id'], unique=False)

    # 3. etl_silver_records table
    op.create_table(
        'etl_silver_records',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('pipeline_run_id', GUID(), nullable=False),
        sa.Column('submission_id', GUID(), nullable=False),
        sa.Column('validation_status', sa.String(length=32), server_default='VALID', nullable=False),
        sa.Column('cleaned_payload', sa.JSON(), nullable=False),
        sa.Column('quality_score', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('transformed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['pipeline_run_id'], ['etl_pipeline_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_etl_silver_records_pipeline_run_id'), 'etl_silver_records', ['pipeline_run_id'], unique=False)
    op.create_index(op.f('ix_etl_silver_records_submission_id'), 'etl_silver_records', ['submission_id'], unique=False)
    op.create_index(op.f('ix_etl_silver_records_validation_status'), 'etl_silver_records', ['validation_status'], unique=False)

    # 4. downstream_observations (Gold Layer) table
    op.create_table(
        'downstream_observations',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('pipeline_run_id', GUID(), nullable=True),
        sa.Column('submission_id', GUID(), nullable=False),
        sa.Column('task_id', GUID(), nullable=False),
        sa.Column('dataset_version', sa.String(length=32), nullable=False),
        sa.Column('artifact_type', sa.String(length=64), nullable=False),
        sa.Column('location', Geometry(geometry_type='POINT', srid=4326), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('gps_accuracy', sa.Float(), server_default='5.0', nullable=False),
        sa.Column('captured_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('canonical_data', sa.JSON(), nullable=False),
        sa.Column('media_references', sa.JSON(), nullable=False),
        sa.Column('quality_score', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('provenance', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['pipeline_run_id'], ['etl_pipeline_runs.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('submission_id', 'dataset_version', name='uq_downstream_submission_version'),
    )
    op.create_index('idx_downstream_task_artifact', 'downstream_observations', ['task_id', 'artifact_type'], unique=False)
    op.create_index('idx_downstream_version_score', 'downstream_observations', ['dataset_version', 'quality_score'], unique=False)
    op.create_index(op.f('ix_downstream_observations_artifact_type'), 'downstream_observations', ['artifact_type'], unique=False)
    op.create_index(op.f('ix_downstream_observations_dataset_version'), 'downstream_observations', ['dataset_version'], unique=False)
    op.create_index(op.f('ix_downstream_observations_pipeline_run_id'), 'downstream_observations', ['pipeline_run_id'], unique=False)
    op.create_index(op.f('ix_downstream_observations_submission_id'), 'downstream_observations', ['submission_id'], unique=False)
    op.create_index(op.f('ix_downstream_observations_task_id'), 'downstream_observations', ['task_id'], unique=False)

    # 5. etl_dataset_artifacts table
    op.create_table(
        'etl_dataset_artifacts',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('pipeline_run_id', GUID(), nullable=False),
        sa.Column('dataset_version', sa.String(length=32), nullable=False),
        sa.Column('export_format', sa.String(length=32), nullable=False),
        sa.Column('storage_path', sa.String(length=512), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('record_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('checksum_sha256', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['pipeline_run_id'], ['etl_pipeline_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_artifacts_version_format', 'etl_dataset_artifacts', ['dataset_version', 'export_format'], unique=False)
    op.create_index(op.f('ix_etl_dataset_artifacts_dataset_version'), 'etl_dataset_artifacts', ['dataset_version'], unique=False)
    op.create_index(op.f('ix_etl_dataset_artifacts_export_format'), 'etl_dataset_artifacts', ['export_format'], unique=False)
    op.create_index(op.f('ix_etl_dataset_artifacts_pipeline_run_id'), 'etl_dataset_artifacts', ['pipeline_run_id'], unique=False)


def downgrade() -> None:
    op.drop_table('etl_dataset_artifacts')
    op.drop_table('downstream_observations')
    op.drop_table('etl_silver_records')
    op.drop_table('etl_bronze_records')
    op.drop_table('etl_pipeline_runs')
