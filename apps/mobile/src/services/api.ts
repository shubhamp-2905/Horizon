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

function extractErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;
  if (typeof err.detail === 'string') return err.detail;
  if (err.detail && typeof err.detail === 'object' && err.detail.message) {
    return err.detail.message;
  }
  if (typeof err.message === 'string') return err.message;
  return fallback;
}

function resolveDefaultBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  try {
    // Attempt dynamic extraction of Metro development machine IP from Expo
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.debuggerHost ||
      Constants?.linkingUri ||
      Constants?.experienceUrl;
    if (hostUri && typeof hostUri === 'string') {
      const match = hostUri.match(/(?:https?:\/\/)?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
      if (match && match[1] && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:4000/api/v1`;
      }
    }
  } catch {
    // Fall back to localhost
  }
  return 'http://localhost:4000/api/v1';
}

export class HorizonApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || resolveDefaultBaseUrl();
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
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
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) {
        throw new Error(`API health check failed with status: ${res.status}`);
      }
      return res.json();
    } catch (err: any) {
      throw new Error(`Cannot reach API at ${this.baseUrl}: ${err.message || 'Network request failed'}`);
    }
  }

  async register(params: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
  }): Promise<AuthTokenResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ ...params, role: 'contributor' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(extractErrorMessage(err, 'Registration failed'));
      }
      const data: AuthTokenResponse = await res.json();
      this.setToken(data.access_token);
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('Network request failed')) {
        throw new Error(`Unable to reach backend at ${this.baseUrl}. Please verify Wi-Fi connectivity.`);
      }
      throw err;
    }
  }

  async login(emailOrUsername: string, password: string): Promise<AuthTokenResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email_or_username: emailOrUsername, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(extractErrorMessage(err, 'Invalid login credentials'));
      }
      const data: AuthTokenResponse = await res.json();
      this.setToken(data.access_token);
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('Network request failed')) {
        throw new Error(`Unable to reach backend at ${this.baseUrl}. Please verify Wi-Fi connectivity.`);
      }
      throw err;
    }
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

  async getTaskFormSchema(taskId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/tasks/${taskId}/form-schema`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve task form schema');
    }
    return res.json();
  }

  async createSubmissionDraft(
    taskId: string,
    payload: {
      latitude?: number;
      longitude?: number;
      gps_accuracy?: number;
      captured_at?: string;
      form_data?: Record<string, unknown>;
    }
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/tasks/${taskId}/submission`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.message || err.detail || 'Failed to create submission draft');
    }
    return res.json();
  }

  async updateSubmissionDraft(
    submissionId: string,
    payload: {
      latitude?: number;
      longitude?: number;
      gps_accuracy?: number;
      captured_at?: string;
      form_data?: Record<string, unknown>;
    }
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/submissions/${submissionId}/draft`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.message || err.detail || 'Failed to update submission draft');
    }
    return res.json();
  }

  async attachSubmissionMedia(
    submissionId: string,
    payload: {
      storage_key: string;
      media_type?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/submissions/${submissionId}/media`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.message || err.detail || 'Failed to attach media to submission');
    }
    return res.json();
  }

  async finalizeSubmission(submissionId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/submissions/${submissionId}/submit`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.message || err.detail || 'Failed to finalize submission');
    }
    return res.json();
  }

  async getSubmission(submissionId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/submissions/${submissionId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve submission details');
    }
    return res.json();
  }

  async getMySubmissions(page: number = 1, pageSize: number = 20): Promise<any> {
    const res = await fetch(`${this.baseUrl}/me/submissions?page=${page}&page_size=${pageSize}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve contributor submissions');
    }
    return res.json();
  }
}

export const apiClient = new HorizonApiClient();
