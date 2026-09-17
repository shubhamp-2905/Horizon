/**
 * @file @horizon/config
 * Shared configuration constants and thresholds across the Horizon platform.
 */

export const APP_NAME = 'Horizon';
export const API_VERSION = 'v1';
export const DEFAULT_API_PORT = 4000;
export const DEFAULT_AI_PORT = 8000;

// Token economy baseline constants
export const STARTER_TOKEN_GRANT = 100;
export const DEFAULT_TASK_EXPIRATION_HOURS = 24;
export const MINIMUM_COMMITMENT_STAKE = 10;

// Geospatial verification constants
export const DEFAULT_GPS_ACCURACY_THRESHOLD_METERS = 15.0;
export const MAX_ALLOWED_DISTANCE_DEVIATION_METERS = 50.0;
