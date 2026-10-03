/**
 * @file SQLite Local Database Schema & Migration Definitions
 * Local source of truth for offline task caching, claim tracking, observation drafts,
 * media records, and queued synchronization operations.
 */

export interface CachedTaskRecord {
  id: string;
  title: string;
  description: string;
  artifact_type: string;
  status: string;
  difficulty: number;
  scarcity: number;
  base_reward: number;
  commitment_stake: number;
  estimated_effort_minutes?: number;
  requirements: string[]; // JSON serialized
  latitude?: number;
  longitude?: number;
  last_synced_at: string;
}

export interface CachedClaimRecord {
  claim_id: string;
  task_id: string;
  user_id: string;
  stake_amount: number;
  status: string;
  claimed_at: string;
  last_synced_at: string;
}

export interface CachedFormSchemaRecord {
  task_id: string;
  version: number;
  fields: any[]; // JSON serialized field definitions
  minimum_photos: number;
  instructions?: string;
  last_synced_at: string;
}

export type LocalSubmissionState =
  | 'LOCAL_DRAFT'
  | 'READY_TO_SYNC'
  | 'SYNCING'
  | 'SYNCED'
  | 'SYNC_FAILED';

export interface LocalSubmissionRecord {
  local_submission_id: string;
  server_submission_id?: string;
  task_id: string;
  claim_id?: string;
  user_id: string;
  latitude?: number;
  longitude?: number;
  gps_accuracy: number;
  captured_at: string;
  form_data: Record<string, unknown>; // JSON serialized
  local_status: LocalSubmissionState;
  server_status?: string;
  created_at: string;
  updated_at: string;
}

export type LocalMediaSyncStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADING'
  | 'SYNCED'
  | 'FAILED';

export interface LocalMediaRecord {
  local_media_id: string;
  local_submission_id: string;
  storage_key: string;
  local_uri: string;
  media_type: string;
  metadata: Record<string, unknown>; // JSON serialized (width, height, hash, size)
  sync_status: LocalMediaSyncStatus;
  created_at: string;
}

export type SyncOpType =
  | 'CREATE_SUBMISSION'
  | 'UPDATE_SUBMISSION'
  | 'ATTACH_MEDIA'
  | 'FINALIZE_SUBMISSION';

export type SyncOpStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'FAILED'
  | 'COMPLETED';

export interface SyncOperationRecord {
  operation_id: string;
  operation_type: SyncOpType;
  local_submission_id: string;
  server_submission_id?: string;
  payload: Record<string, unknown>; // JSON serialized
  status: SyncOpStatus;
  retry_count: number;
  last_attempt_at?: string;
  last_error?: string;
  created_at: string;
}

export const SQLITE_TABLES = {
  CACHED_TASKS: 'cached_tasks',
  CACHED_CLAIMS: 'cached_claims',
  CACHED_FORM_SCHEMAS: 'cached_form_schemas',
  LOCAL_SUBMISSIONS: 'local_submissions',
  LOCAL_MEDIA: 'local_media',
  SYNC_OPERATIONS: 'sync_operations',
} as const;
