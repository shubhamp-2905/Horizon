/**
 * @file Contributor Mobile API Client
 * Authoritative interface between the mobile client and the FastAPI backend.
 */

import type {
  AuthTokenResponse,
  TaskListResponseDTO,
  TaskResponseDTO,
  WalletSummaryDTO,
  ClaimResponseDTO,
  UserClaimedTaskDTO,
  HealthResponse,
} from '@horizon/types';

export class HorizonApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = 'http://localhost:4000/api/v1') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`API health check failed with status: ${res.status}`);
    }
    return res.json();
  }

  async register(params: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
  }): Promise<AuthTokenResponse> {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...params, role: 'contributor' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.message || err.detail || 'Registration failed');
    }
    const data: AuthTokenResponse = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  async login(emailOrUsername: string, password: string): Promise<AuthTokenResponse> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email_or_username: emailOrUsername, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.message || err.detail || 'Invalid login credentials');
    }
    const data: AuthTokenResponse = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  async getMe(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/me`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to load contributor profile');
    }
    return res.json();
  }

  async getWallet(): Promise<WalletSummaryDTO> {
    const res = await fetch(`${this.baseUrl}/wallet`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch wallet balances');
    }
    return res.json();
  }

  async discoverTasks(params: {
    lat?: number;
    lng?: number;
    radius?: number;
    artifact_type?: string;
    difficulty?: number;
    page?: number;
    page_size?: number;
  } = {}): Promise<TaskListResponseDTO> {
    const query = new URLSearchParams();
    if (params.lat !== undefined) query.set('lat', params.lat.toString());
    if (params.lng !== undefined) query.set('lng', params.lng.toString());
    if (params.radius !== undefined) query.set('radius', params.radius.toString());
    if (params.artifact_type) query.set('artifact_type', params.artifact_type);
    if (params.difficulty !== undefined) query.set('difficulty', params.difficulty.toString());
    if (params.page !== undefined) query.set('page', params.page.toString());
    if (params.page_size !== undefined) query.set('page_size', params.page_size.toString());

    const qs = query.toString();
    const res = await fetch(`${this.baseUrl}/tasks${qs ? `?${qs}` : ''}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to discover geospatial tasks');
    }
    return res.json();
  }

  async getTaskDetails(taskId: string, lat?: number, lng?: number): Promise<TaskResponseDTO> {
    const query = new URLSearchParams();
    if (lat !== undefined) query.set('lat', lat.toString());
    if (lng !== undefined) query.set('lng', lng.toString());
    const qs = query.toString();

    const res = await fetch(`${this.baseUrl}/tasks/${taskId}${qs ? `?${qs}` : ''}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to load task details');
    }
    return res.json();
  }

  async claimTask(taskId: string): Promise<ClaimResponseDTO> {
    const res = await fetch(`${this.baseUrl}/tasks/${taskId}/claim`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.message || err.detail || 'Failed to claim task');
    }
    return res.json();
  }

  async getMyTasks(): Promise<UserClaimedTaskDTO[]> {
    const res = await fetch(`${this.baseUrl}/me/tasks`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve active claimed tasks');
    }
    return res.json();
  }
}

export const apiClient = new HorizonApiClient();
