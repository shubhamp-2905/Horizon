/**
 * @file Offline Repository Layer
 * Clean abstractions shielding UI and Sync Engine from direct database operations.
 */

import { sqliteDb, type ISQLiteDatabase } from '../database/sqlite';
import type {
  CachedTaskRecord,
  CachedClaimRecord,
  CachedFormSchemaRecord,
  LocalSubmissionRecord,
  LocalMediaRecord,
  SyncOperationRecord,
  SyncOpType,
} from '../database/schema';
import type { TaskResponseDTO, UserClaimedTaskDTO } from '@horizon/types';

export class TaskRepository {
  constructor(private db: ISQLiteDatabase = sqliteDb) {}

  async cacheTasks(tasks: TaskResponseDTO[]): Promise<void> {
    const now = new Date().toISOString();
    for (const t of tasks) {
      await this.db.upsertCachedTask({
        id: t.id,
        title: t.title,
        description: t.description || '',
        artifact_type: t.artifact_type,
        status: t.status,
        difficulty: t.difficulty,
        scarcity: t.scarcity,
        base_reward: t.base_reward,
        commitment_stake: t.commitment_stake,
        estimated_effort_minutes: t.estimated_effort_minutes,
        requirements: t.requirements || [],
        latitude: t.latitude,
        longitude: t.longitude,
        last_synced_at: now,
      });
    }
  }

  async getCachedTask(taskId: string): Promise<CachedTaskRecord | null> {
    return this.db.getCachedTask(taskId);
  }

  async getAllCachedTasks(): Promise<CachedTaskRecord[]> {
    return this.db.getAllCachedTasks();
  }

  async cacheFormSchema(taskId: string, schema: any): Promise<void> {
    await this.db.upsertCachedFormSchema({
      task_id: taskId,
      version: schema.version || 1,
      fields: schema.fields || [],
      minimum_photos: schema.minimum_photos || 2,
      instructions: schema.instructions || '',
      last_synced_at: new Date().toISOString(),
    });
  }

  async getCachedFormSchema(taskId: string): Promise<CachedFormSchemaRecord | null> {
    return this.db.getCachedFormSchema(taskId);
  }
}

export class ClaimRepository {
  constructor(private db: ISQLiteDatabase = sqliteDb) {}

  async cacheClaims(claims: UserClaimedTaskDTO[]): Promise<void> {
    const now = new Date().toISOString();
    for (const c of claims) {
      await this.db.upsertCachedClaim({
        claim_id: c.claim_id,
        task_id: c.task.id,
        user_id: (c as any).user_id || 'current_user',
        stake_amount: c.stake_amount,
        status: c.status,
        claimed_at: c.claimed_at || now,
        last_synced_at: now,
      });
    }
  }

  async getCachedClaims(userId?: string): Promise<CachedClaimRecord[]> {
    return this.db.getCachedClaims(userId);
  }
}

export class SubmissionRepository {
  constructor(private db: ISQLiteDatabase = sqliteDb) {}

  async getOrCreateDraft(
    taskId: string,
    userId: string,
    claimId?: string,
    initialLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<LocalSubmissionRecord> {
    const existing = await this.db.getLocalSubmissionByTask(taskId, userId);
    if (existing && existing.local_status === 'LOCAL_DRAFT') {
      return existing;
    }

    const now = new Date().toISOString();
    const newDraft: LocalSubmissionRecord = {
      local_submission_id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      task_id: taskId,
      claim_id: claimId,
      user_id: userId,
      latitude: initialLocation?.latitude,
      longitude: initialLocation?.longitude,
      gps_accuracy: initialLocation?.accuracy || 5.0,
      captured_at: now,
      form_data: {},
      local_status: 'LOCAL_DRAFT',
      created_at: now,
      updated_at: now,
    };

    await this.db.upsertLocalSubmission(newDraft);
    return newDraft;
  }

  async saveDraftObservations(
    localSubId: string,
    formData: Record<string, unknown>,
    location?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<LocalSubmissionRecord> {
    const sub = await this.db.getLocalSubmission(localSubId);
    if (!sub) {
      throw new Error(`Submission ${localSubId} not found`);
    }

    sub.form_data = { ...sub.form_data, ...formData };
    if (location) {
      sub.latitude = location.latitude;
      sub.longitude = location.longitude;
      sub.gps_accuracy = location.accuracy || sub.gps_accuracy;
    }
    sub.updated_at = new Date().toISOString();

    await this.db.upsertLocalSubmission(sub);
    return sub;
  }

  async attachLocalMedia(
    localSubId: string,
    localUri: string,
    mediaType: string = 'image/jpeg',
    metadata: Record<string, unknown> = {}
  ): Promise<LocalMediaRecord> {
    const localMediaId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const storageKey = `evidence/field/${localSubId}/${localMediaId}.jpg`;

    const mediaRecord: LocalMediaRecord = {
      local_media_id: localMediaId,
      local_submission_id: localSubId,
      storage_key: storageKey,
      local_uri: localUri,
      media_type: mediaType,
      metadata: {
        ...metadata,
        file_size: metadata.file_size || 2500000,
        hash: metadata.hash || `sha256_${localMediaId}`,
      },
      sync_status: 'PENDING_UPLOAD',
      created_at: new Date().toISOString(),
    };

    await this.db.insertLocalMedia(mediaRecord);
    return mediaRecord;
  }

  async getMediaForSubmission(localSubId: string): Promise<LocalMediaRecord[]> {
    return this.db.getLocalMediaForSubmission(localSubId);
  }

  async deleteLocalMedia(localMediaId: string): Promise<void> {
    await this.db.deleteLocalMedia(localMediaId);
  }

  async markReadyToSync(localSubId: string): Promise<LocalSubmissionRecord> {
    const sub = await this.db.getLocalSubmission(localSubId);
    if (!sub) {
      throw new Error(`Submission ${localSubId} not found`);
    }

    sub.local_status = 'READY_TO_SYNC';
    sub.updated_at = new Date().toISOString();
    await this.db.upsertLocalSubmission(sub);
    return sub;
  }

  async getDraft(localSubId: string): Promise<LocalSubmissionRecord | null> {
    return this.db.getLocalSubmission(localSubId);
  }

  async getAllSubmissions(userId?: string): Promise<LocalSubmissionRecord[]> {
    return this.db.getAllLocalSubmissions(userId);
  }
}

export class SyncRepository {
  constructor(private db: ISQLiteDatabase = sqliteDb) {}

  async enqueueOperation(
    opType: SyncOpType,
    localSubId: string,
    payload: Record<string, unknown>,
    serverSubId?: string
  ): Promise<SyncOperationRecord> {
    const op: SyncOperationRecord = {
      operation_id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      operation_type: opType,
      local_submission_id: localSubId,
      server_submission_id: serverSubId,
      payload,
      status: 'PENDING',
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    await this.db.insertSyncOperation(op);
    return op;
  }

  async getPendingOperations(): Promise<SyncOperationRecord[]> {
    return this.db.getPendingSyncOperations();
  }

  async updateOp(
    opId: string,
    updates: Partial<Pick<SyncOperationRecord, 'status' | 'retry_count' | 'last_attempt_at' | 'last_error' | 'server_submission_id'>>
  ): Promise<void> {
    await this.db.updateSyncOperation(opId, updates);
  }
}

export const taskRepo = new TaskRepository();
export const claimRepo = new ClaimRepository();
export const submissionRepo = new SubmissionRepository();
export const syncRepo = new SyncRepository();
