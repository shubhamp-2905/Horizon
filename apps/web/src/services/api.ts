/**
 * @file Reviewer & Admin Dashboard API Client Placeholder
 */

import type { HealthResponse } from '@horizon/types';

export class AdminApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'https://horizon-backend-api.onrender.com/api/v1') {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with status: ${res.status}`);
    }
    return res.json();
  }
}

export const adminApiClient = new AdminApiClient();
