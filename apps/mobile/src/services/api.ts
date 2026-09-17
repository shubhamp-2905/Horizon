/**
 * @file Contributor API Client Placeholder
 * Connects the mobile client with the authoritative Horizon Backend API.
 */

import type { Task, Submission, HealthResponse } from '@horizon/types';

export class HorizonApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:4000/api/v1') {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`API health check failed with status: ${res.status}`);
    }
    return res.json();
  }

  async getTasks(): Promise<Task[]> {
    // Placeholder for Phase 2 task discovery
    return [];
  }

  async submitObservation(submission: Partial<Submission>): Promise<{ submissionId: string }> {
    // Placeholder for Phase 2 submission upload
    return { submissionId: 'placeholder' };
  }
}

export const apiClient = new HorizonApiClient();
