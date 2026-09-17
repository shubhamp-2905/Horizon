/**
 * @file @horizon/utils
 * Cross-platform helper functions and math routines for Horizon.
 */

import type { GeoPoint } from '@horizon/types';

/**
 * Calculates the great-circle distance between two points on the Earth (WGS84) in meters.
 */
export function haversineDistanceMeters(
  pointA: GeoPoint,
  pointB: GeoPoint
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((pointB.latitude - pointA.latitude) * Math.PI) / 180;
  const dLon = ((pointB.longitude - pointA.longitude) * Math.PI) / 180;
  const lat1 = (pointA.latitude * Math.PI) / 180;
  const lat2 = (pointB.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validates whether latitude and longitude numbers lie within valid Earth bounds.
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Formats token balances for contributor display.
 */
export function formatTokenAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount);
}
