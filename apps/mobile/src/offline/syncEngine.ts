/**
 * @file Offline Synchronization Engine
 * Dependency-aware, idempotent sync processor with partial recovery, bounded retries,
 * network-state awareness, and observable UI events.
 */

import { apiClient, HorizonApiClient } from '../services/api';
import {
  submissionRepo,
  syncRepo,
  taskRepo,
  claimRepo,
  SubmissionRepository,
  SyncRepository,
} from './repositories';
import { sqliteDb } from '../database/sqlite';
import type { SyncOperationRecord, LocalSubmissionRecord, LocalMediaRecord } from '../database/schema';

export type NetworkState = 'ONLINE' | 'OFFLINE' | 'NETWORK_UNSTABLE';

export interface SyncEngineState {
  networkState: NetworkState;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt?: string;
  lastError?: string;
}

export type SyncStateListener = (state: SyncEngineState) => void;

export class SyncEngine {
  private networkState: NetworkState = 'ONLINE';
  private isSyncing = false;
  private lastSyncedAt?: string;
  private lastError?: string;
  private listeners: Set<SyncStateListener> = new Set();
  private maxRetries = 3;

  constructor(
    private client: HorizonApiClient = apiClient,
    private subRepo: SubmissionRepository = submissionRepo,
    private sRepo: SyncRepository = syncRepo
  ) {}

  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    for (const l of this.listeners) {
      try {
        l(state);
      } catch (err) {
        console.error('Error in sync state listener:', err);
      }
    }
  }

  getState(): SyncEngineState {
    return {
      networkState: this.networkState,
      isSyncing: this.isSyncing,
      pendingCount: 0, // calculated dynamically when needed or via getPendingCount()
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  async getPendingCount(): Promise<number> {
    const ops = await this.sRepo.getPendingOperations();
    return ops.length;
  }

  setNetworkState(state: NetworkState): void {
    const prev = this.networkState;
    this.networkState = state;
    this.notify();

    // If transitioned to ONLINE from OFFLINE, automatically trigger background sync
    if (prev === 'OFFLINE' && state === 'ONLINE') {
      this.syncNow().catch((err) => console.warn('Auto-sync on reconnect failed:', err));
    }
  }

  isOnline(): boolean {
    return this.networkState === 'ONLINE';
  }

  /**
   * Queue an entire local submission draft and all attached evidence media for synchronization.
   */
  async queueSubmissionForSync(localSubId: string): Promise<void> {
    const sub = await this.subRepo.getDraft(localSubId);
    if (!sub) {
      throw new Error(`Submission ${localSubId} not found`);
    }

    // 1. Mark submission ready to sync
    await this.subRepo.markReadyToSync(localSubId);

    // 2. Enqueue CREATE_SUBMISSION operation if server ID is not yet assigned
    if (!sub.server_submission_id) {
      await this.sRepo.enqueueOperation(
        'CREATE_SUBMISSION',
        localSubId,
        {
          taskId: sub.task_id,
          latitude: sub.latitude,
          longitude: sub.longitude,
          gps_accuracy: sub.gps_accuracy,
          captured_at: sub.captured_at,
          form_data: sub.form_data,
        }
      );
    } else {
      // If server ID already exists, enqueue UPDATE_SUBMISSION
      await this.sRepo.enqueueOperation(
        'UPDATE_SUBMISSION',
        localSubId,
        {
          latitude: sub.latitude,
          longitude: sub.longitude,
          gps_accuracy: sub.gps_accuracy,
          captured_at: sub.captured_at,
          form_data: sub.form_data,
        },
        sub.server_submission_id
      );
    }

    // 3. Enqueue ATTACH_MEDIA for each local media record
    const mediaItems = await this.subRepo.getMediaForSubmission(localSubId);
    for (const m of mediaItems) {
      if (m.sync_status !== 'SYNCED') {
        await this.sRepo.enqueueOperation(
          'ATTACH_MEDIA',
          localSubId,
          {
            localMediaId: m.local_media_id,
            storage_key: m.storage_key,
            media_type: m.media_type,
            metadata: m.metadata,
          },
          sub.server_submission_id
        );
      }
    }

    // 4. Enqueue FINALIZE_SUBMISSION
    await this.sRepo.enqueueOperation(
      'FINALIZE_SUBMISSION',
      localSubId,
      {},
      sub.server_submission_id
    );

    this.notify();

    // Trigger sync if online
    if (this.isOnline()) {
      this.syncNow().catch((err) => console.warn('Sync post-queue encountered error:', err));
    }
  }

  /**
   * Main sync orchestration loop. Respects operation dependencies,
   * handles bounded retries, records errors, and resumes partial uploads.
   */
  async syncNow(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isSyncing) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }
    if (!this.isOnline()) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.lastError = undefined;
    this.notify();

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      const pendingOps = await this.sRepo.getPendingOperations();

      for (const op of pendingOps) {
        // Enforce max retries
        if (op.retry_count >= this.maxRetries) {
          continue;
        }

        processed++;
        await this.sRepo.updateOp(op.operation_id, {
          status: 'SYNCING',
          last_attempt_at: new Date().toISOString(),
        });

        try {
          const serverSubId = await this.processOperation(op);

          await this.sRepo.updateOp(op.operation_id, {
            status: 'COMPLETED',
            server_submission_id: serverSubId,
          });
          succeeded++;
        } catch (err: any) {
          failed++;
          const isRetryable = this.classifyError(err);
          const newRetryCount = op.retry_count + 1;

          await this.sRepo.updateOp(op.operation_id, {
            status: isRetryable && newRetryCount < this.maxRetries ? 'FAILED' : 'FAILED',
            retry_count: newRetryCount,
            last_error: err.message || String(err),
          });

          this.lastError = err.message || 'Synchronization failure';
        }
      }

      this.lastSyncedAt = new Date().toISOString();
    } finally {
      this.isSyncing = false;
      this.notify();
    }

    return { processed, succeeded, failed };
  }

  private async processOperation(op: SyncOperationRecord): Promise<string | undefined> {
    const sub = await this.subRepo.getDraft(op.local_submission_id);
    if (!sub) {
      throw new Error(`Submission ${op.local_submission_id} does not exist locally`);
    }

    let serverSubId = op.server_submission_id || sub.server_submission_id;

    switch (op.operation_type) {
      case 'CREATE_SUBMISSION': {
        const payload = op.payload as any;
        const res = await this.client.createSubmissionDraft(payload.taskId, {
          latitude: payload.latitude,
          longitude: payload.longitude,
          gps_accuracy: payload.gps_accuracy,
          captured_at: payload.captured_at,
          form_data: payload.form_data,
        });

        serverSubId = res.id;
        sub.server_submission_id = serverSubId;
        sub.local_status = 'SYNCING';
        sub.server_status = res.status;
        await sqliteDb.upsertLocalSubmission(sub);
        return serverSubId;
      }

      case 'UPDATE_SUBMISSION': {
        if (!serverSubId) {
          throw new Error('Cannot update draft before server submission ID is created');
        }
        const payload = op.payload as any;
        const res = await this.client.updateSubmissionDraft(serverSubId, {
          latitude: payload.latitude,
          longitude: payload.longitude,
          gps_accuracy: payload.gps_accuracy,
          captured_at: payload.captured_at,
          form_data: payload.form_data,
        });
        sub.server_status = res.status;
        await sqliteDb.upsertLocalSubmission(sub);
        return serverSubId;
      }

      case 'ATTACH_MEDIA': {
        if (!serverSubId) {
          throw new Error('Cannot attach media before server submission ID is created');
        }
        const payload = op.payload as any;
        await this.client.attachSubmissionMedia(serverSubId, {
          storage_key: payload.storage_key,
          media_type: payload.media_type,
          metadata: payload.metadata,
        });

        if (payload.localMediaId) {
          await sqliteDb.updateLocalMediaStatus(payload.localMediaId, 'SYNCED');
        }
        return serverSubId;
      }

      case 'FINALIZE_SUBMISSION': {
        if (!serverSubId) {
          throw new Error('Cannot finalize submission before server submission ID is created');
        }
        const res = await this.client.finalizeSubmission(serverSubId);
        sub.local_status = 'SYNCED';
        sub.server_status = res.status || 'submitted';
        await sqliteDb.upsertLocalSubmission(sub);
        return serverSubId;
      }

      default:
        throw new Error(`Unknown sync operation type: ${op.operation_type}`);
    }
  }

  private classifyError(err: any): boolean {
    const msg = String(err.message || err).toLowerCase();
    // 4xx errors are generally non-retryable except timeouts
    if (msg.includes('validation') || msg.includes('400') || msg.includes('403') || msg.includes('404')) {
      return false;
    }
    // Network / 5xx / timeout are retryable
    return true;
  }
}

export const syncEngine = new SyncEngine();
