/**
 * @file @horizon/types
 * Core domain interfaces, DTOs, and geospatial types for the Horizon platform.
 */

export type UserRole = 'contributor' | 'reviewer' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  status: UserStatus;
  role: UserRole;
  avatarUrl?: string;
  profileData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'draft' | 'active' | 'in_progress' | 'completed' | 'expired';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoPolygon {
  coordinates: [number, number][][];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  artifactType: string;
  status: TaskStatus;
  difficulty: number;
  scarcity: number;
  baseReward: number;
  commitmentStake: number;
  locationPoint?: GeoPoint;
  geographicArea?: GeoPolygon;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFormSchema {
  id: string;
  taskId: string;
  schemaDefinition: Record<string, unknown>;
  version: number;
  createdAt: string;
}

export type ClaimStatus =
  | 'claimed'
  | 'in_progress'
  | 'submitted'
  | 'released'
  | 'forfeited'
  | 'expired'
  | 'abandoned';

export interface TaskClaim {
  id: string;
  taskId: string;
  userId: string;
  stakeAmount: number;
  status: ClaimStatus;
  claimedAt: string;
  completedAt?: string;
}

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'validating'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'verified';

export interface Submission {
  id: string;
  taskId: string;
  userId: string;
  location?: GeoPoint;
  gpsAccuracy: number;
  capturedAt: string;
  submittedAt?: string;
  status: SubmissionStatus;
  formData: Record<string, unknown>;
}

export interface SubmissionMedia {
  id: string;
  submissionId: string;
  storageKey: string;
  mediaType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'disputed';

export interface Verification {
  id: string;
  submissionId: string;
  status: VerificationStatus;
  reviewerId?: string;
  notes?: string;
  aiConfidenceScore?: number;
  createdAt: string;
  updatedAt: string;
}

export type RewardStatus = 'pending' | 'granted' | 'revoked';

export interface Reward {
  id: string;
  submissionId: string;
  baseValue: number;
  difficultyFactor: number;
  scarcityFactor: number;
  qualityFactor: number;
  calculatedReward: number;
  status: RewardStatus;
  createdAt: string;
}

export interface TokenAccount {
  id: string;
  userId: string;
  availableBalance: number;
  lockedBalance: number;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType =
  | 'starter_grant'
  | 'stake_lock'
  | 'stake_unlock'
  | 'reward_payout'
  | 'penalty';

export interface TokenTransaction {
  id: string;
  tokenAccountId: string;
  transactionType: TransactionType;
  amount: number;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

export interface Reputation {
  id: string;
  userId: string;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  environment: string;
  version: string;
  database: 'connected' | 'disconnected';
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    username: string;
    full_name?: string;
    role: string;
    status: string;
  };
  starter_tokens_granted: boolean;
}

export interface TaskResponseDTO {
  id: string;
  title: string;
  description?: string;
  artifact_type: string;
  status: string;
  difficulty: number;
  scarcity: number;
  base_reward: number;
  commitment_stake: number;
  estimated_effort_minutes?: number;
  requirements?: string[];
  latitude?: number;
  longitude?: number;
  distance_meters?: number;
  created_at: string;
}

export interface TaskListResponseDTO {
  tasks: TaskResponseDTO[];
  total: number;
  page: number;
  page_size: number;
}

export interface WalletSummaryDTO {
  available_balance: number;
  available_tokens: number;
  locked_balance: number;
  locked_tokens: number;
  total_tokens: number;
  transactions: Array<{
    id: string;
    type: string;
    transaction_type: string;
    amount: number;
    description?: string;
    reference_type?: string;
    reference_id?: string;
    created_at: string;
  }>;
  recent_transactions?: Array<{
    id: string;
    type: string;
    amount: number;
    description?: string;
    created_at: string;
  }>;
}

export interface ClaimResponseDTO {
  claim_id: string;
  task_id: string;
  user_id: string;
  stake_amount: number;
  status: string;
  claimed_at: string;
  available_tokens: number;
  locked_tokens: number;
}

export interface UserClaimedTaskDTO {
  claim_id: string;
  status: string;
  stake_amount: number;
  claimed_at?: string;
  completed_at?: string;
  task: TaskResponseDTO;
}

export interface SubmissionMediaResponseDTO {
  id: string;
  submission_id: string;
  storage_key: string;
  media_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SubmissionResponseDTO {
  id: string;
  task_id: string;
  task_title?: string;
  artifact_type?: string;
  user_id: string;
  contributor_email?: string;
  status: SubmissionStatus | string;
  gps_accuracy: number;
  latitude?: number;
  longitude?: number;
  captured_at: string;
  submitted_at?: string;
  form_data: Record<string, unknown>;
  media: SubmissionMediaResponseDTO[];
  verification_status?: string;
  verification_notes?: string;
  ai_confidence_score?: number;
  created_at?: string;
}

export interface SubmissionListResponseDTO {
  submissions: SubmissionResponseDTO[];
  total: number;
  page: number;
  page_size: number;
}

export interface TaskFormFieldDefinitionDTO {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface TaskFormSchemaResponseDTO {
  task_id: string;
  version: number;
  fields: TaskFormFieldDefinitionDTO[];
  minimum_photos: number;
  instructions?: string;
}
