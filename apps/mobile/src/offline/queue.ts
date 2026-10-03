/**
 * @file Offline Submission Queue & Sync Architecture (Phase 3 Foundation)
 * Enqueues captured ground-truth submissions locally until connectivity resumes.
 */

import type { Submission } from '@horizon/types';
import { localStorage } from './storage';

export type SyncStatus = 'queued' | 'syncing' | 'synced' | 'failed';

export interface MediaAttachmentRecord {
  id: string;
  localUri: string;
  storageKey?: string;
  mediaType: string;
  metadata?: Record<string, unknown>;
}

export interface QueuedSubmission {
  id: string;
  taskId: string;
  userId: string;
  formData: Record<string, unknown>;
  location?: {
    latitude: number;
    longitude: number;
  };
  gpsAccuracy: number;
  capturedAt: string;
  media: MediaAttachmentRecord[];
  status: SyncStatus;
  queuedAt: string;
  retryCount: number;
  serverSubmissionId?: string;
  lastError?: string;
}

export class OfflineSubmissionQueue {
  private readonly QUEUE_STORAGE_KEY = 'horizon_offline_submissions_queue';

  async enqueue(
    payload: {
      taskId: string;
      userId: string;
      formData: Record<string, unknown>;
      location?: { latitude: number; longitude: number };
      gpsAccuracy?: number;
      capturedAt?: string;
      media?: MediaAttachmentRecord[];
    }
  ): Promise<QueuedSubmission> {
    const queue = await this.getQueue();
    const item: QueuedSubmission = {
      id: `local_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId: payload.taskId,
      userId: payload.userId,
      formData: payload.formData,
      location: payload.location,
      gpsAccuracy: payload.gpsAccuracy || 5.0,
      capturedAt: payload.capturedAt || new Date().toISOString(),
      media: payload.media || [],
      status: 'queued',
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    };
    queue.push(item);
    await localStorage.setItem(this.QUEUE_STORAGE_KEY, queue);
    return item;
  }

  async getQueue(): Promise<QueuedSubmission[]> {
    const queue = await localStorage.getItem<QueuedSubmission[]>(this.QUEUE_STORAGE_KEY);
    return queue || [];
  }

  async getPendingSyncs(): Promise<QueuedSubmission[]> {
    const queue = await this.getQueue();
    return queue.filter((item) => item.status === 'queued' || item.status === 'failed');
  }

  async markSyncing(id: string): Promise<void> {
    const queue = await this.getQueue();
    const item = queue.find((q) => q.id === id);
    if (item) {
      item.status = 'syncing';
      await localStorage.setItem(this.QUEUE_STORAGE_KEY, queue);
    }
  }

  async markSynced(id: string, serverSubmissionId: string): Promise<void> {
    const queue = await this.getQueue();
    const item = queue.find((q) => q.id === id);
    if (item) {
      item.status = 'synced';
      item.serverSubmissionId = serverSubmissionId;
      await localStorage.setItem(this.QUEUE_STORAGE_KEY, queue);
    }
  }

  async markFailed(id: string, error: string): Promise<void> {
    const queue = await this.getQueue();
    const item = queue.find((q) => q.id === id);
    if (item) {
      item.status = 'failed';
      item.retryCount += 1;
      item.lastError = error;
      await localStorage.setItem(this.QUEUE_STORAGE_KEY, queue);
    }
  }

  async getQueueCount(): Promise<number> {
    const pending = await this.getPendingSyncs();
    return pending.length;
  }

  async clear(): Promise<void> {
    await localStorage.removeItem(this.QUEUE_STORAGE_KEY);
  }
}

export const offlineQueue = new OfflineSubmissionQueue();
