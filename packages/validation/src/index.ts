/**
 * @file @horizon/validation
 * Shared domain validation functions and payload integrity checkers for Horizon.
 */

import type { GeoPoint } from '@horizon/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates contributor submission telemetry and coordinate boundaries.
 */
export function validateSubmissionCoordinates(point?: GeoPoint, accuracy?: number): ValidationResult {
  const errors: string[] = [];

  if (!point) {
    errors.push('Location coordinate point is required.');
  } else {
    if (typeof point.latitude !== 'number' || point.latitude < -90 || point.latitude > 90) {
      errors.push('Latitude must be a valid number between -90 and 90.');
    }
    if (typeof point.longitude !== 'number' || point.longitude < -180 || point.longitude > 180) {
      errors.push('Longitude must be a valid number between -180 and 180.');
    }
  }

  if (typeof accuracy !== 'number' || accuracy <= 0) {
    errors.push('GPS accuracy must be a positive number in meters.');
  } else if (accuracy > 100) {
    errors.push('GPS accuracy exceeds maximum threshold of 100 meters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates task commitment stake amount against contributor balance.
 */
export function validateTaskClaim(
  stakeRequired: number,
  contributorAvailableBalance: number
): ValidationResult {
  const errors: string[] = [];

  if (stakeRequired < 0) {
    errors.push('Required stake cannot be negative.');
  }
  if (contributorAvailableBalance < stakeRequired) {
    errors.push(`Insufficient available tokens. Required: ${stakeRequired}, Available: ${contributorAvailableBalance}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
