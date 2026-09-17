/**
 * @file Offline Submission Queue Contract
 * Enqueues captured ground-truth submissions locally until connectivity resumes.
 */

import type { Submission } from '@horizon/types';
import { localStorage } from './storage';

export interface QueuedSubmission {
  id: string;
  submission: Partial<Submission>;
  queuedAt: string;
  retryCount: number;
}

export class OfflineSubmissionQueue {
  private readonly QUEUE_STORAGE_KEY = 'horizon_offline_submissions_queue';

  async enqueue(submission: Partial<Submission>): Promise<QueuedSubmission> {
    const queue = await this.getQueue();
    const item: QueuedSubmission = {
      id: Math.random().toString(36).substring(2, 9),
      submission,
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

  async clear(): Promise<void> {
    await localStorage.removeItem(this.QUEUE_STORAGE_KEY);
  }
}

export const offlineQueue = new OfflineSubmissionQueue();
