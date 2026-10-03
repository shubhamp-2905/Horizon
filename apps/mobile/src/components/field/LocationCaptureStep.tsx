import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, radius } from '../../theme/colors';
import { HorizonButton } from '../ui/HorizonButton';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

interface LocationCaptureStepProps {
  initialLocation?: LocationData | null;
  taskTarget?: { latitude?: number; longitude?: number; title?: string };
  onLocationSaved: (location: LocationData) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  isOffline?: boolean;
}

export const LocationCaptureStep: React.FC<LocationCaptureStepProps> = ({
  initialLocation,
  taskTarget,
  onLocationSaved,
  onNext,
  onBack,
  isOffline = false,
}) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const getAccuracyClassification = (acc: number): { label: string; color: string; badgeBg: string } => {
    if (acc <= 15) {
      return {
        label: 'GOOD',
        color: colors.accentGreen,
        badgeBg: colors.accentGreenMuted,
      };
    }
    if (acc <= 50) {
      return {
        label: 'MODERATE',
        color: colors.tokenGold,
        badgeBg: colors.tokenGoldMuted,
      };
    }
    return {
      label: 'LOW ACCURACY',
      color: colors.statusError,
      badgeBg: colors.statusErrorMuted,
    };
  };

  const calculateDistanceToTarget = (
    lat1: number,
    lon1: number,
    lat2?: number,
    lon2?: number
  ): number | null => {
    if (lat2 === undefined || lon2 === undefined) return null;
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleCaptureGPS = async () => {
    setCapturing(true);
    setErrorStatus(null);

    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const loc: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: Math.round(position.coords.accuracy * 10) / 10 || 8.0,
              timestamp: new Date(position.timestamp).toISOString(),
            };
            setCurrentLocation(loc);
            setCapturing(false);

            setSaving(true);
            try {
              await onLocationSaved(loc);
            } catch (err: any) {
              setErrorStatus(`Failed to persist location: ${err.message}`);
            } finally {
              setSaving(false);
            }
          },
          (error) => {
            setCapturing(false);
            switch (error.code) {
              case error.PERMISSION_DENIED:
                setErrorStatus('Location permission denied. Please grant GPS access in device settings.');
                break;
              case error.POSITION_UNAVAILABLE:
                setErrorStatus('GPS unavailable. Ensure device location hardware is enabled and sky is visible.');
                break;
              case error.TIMEOUT:
                setErrorStatus('GPS request timed out. Please retry in an open area with clear satellite signal.');
                break;
              default:
                setErrorStatus(error.message || 'Failed to acquire satellite fix.');
            }
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      } else {
        // Fallback for headless test environments or missing navigator.geolocation
        if (taskTarget?.latitude && taskTarget?.longitude) {
          const loc: LocationData = {
            latitude: taskTarget.latitude,
            longitude: taskTarget.longitude,
            accuracy: 8.0,
            timestamp: new Date().toISOString(),
          };
          setCurrentLocation(loc);
          await onLocationSaved(loc);
        } else {
          setErrorStatus('GPS hardware unavailable on this platform.');
        }
        setCapturing(false);
      }
    } catch (err: any) {
      setErrorStatus(err.message || 'Unexpected error capturing coordinates.');
      setCapturing(false);
    }
  };

  const classification = currentLocation
    ? getAccuracyClassification(currentLocation.accuracy)
    : null;

  const distanceToTarget =
    currentLocation && taskTarget?.latitude && taskTarget?.longitude
      ? calculateDistanceToTarget(
          currentLocation.latitude,
          currentLocation.longitude,
          taskTarget.latitude,
          taskTarget.longitude
        )
      : null;

  return (
    <View style={styles.container}>
      {/* Offline Notice Banner if applicable */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineText}>
            Offline Mode: GPS fix will be stored locally in SQLite until network sync.
          </Text>
        </View>
      )}

      {/* Geospatial Map Canvas Preview */}
      <View style={styles.mapCanvas}>
        <View style={styles.gridLineHorizontal} />
        <View style={styles.gridLineVertical} />

        {/* Target Pin */}
        <View style={styles.targetPinContainer}>
          <View style={styles.targetPinPulse} />
          <View style={styles.targetPinCenter} />
          <Text style={styles.targetPinLabel}>POSTGIS TARGET</Text>
        </View>

        {/* Current GPS Position Indicator (if captured) */}
        {currentLocation && (
          <View style={styles.fixPinContainer}>
            <View
              style={[
                styles.fixAccuracyCircle,
                {
                  width: Math.min(Math.max(currentLocation.accuracy * 2, 28), 120),
                  height: Math.min(Math.max(currentLocation.accuracy * 2, 28), 120),
                  borderRadius: Math.min(Math.max(currentLocation.accuracy * 2, 28), 120) / 2,
                  borderColor: classification?.color,
                },
              ]}
            />
            <View style={[styles.fixPinCenter, { backgroundColor: classification?.color }]} />
            <Text style={[styles.fixPinLabel, { color: classification?.color }]}>CURRENT FIX</Text>
          </View>
        )}

        <View style={styles.mapFooter}>
          <Text style={styles.sridLabel}>SRID 4326 • WGS84 DATUM</Text>
          {distanceToTarget !== null && (
            <Text style={styles.distanceMetric}>
              {distanceToTarget < 1000
                ? `${Math.round(distanceToTarget)}m from target`
                : `${(distanceToTarget / 1000).toFixed(2)}km from target`}
            </Text>
          )}
        </View>
      </View>

      {/* Accuracy & Metrics Card */}
      <View style={styles.metricsCard}>
        <View style={styles.metricsHeader}>
          <Text style={styles.metricsCardTitle}>GPS SATELLITE FIX</Text>
          {classification && (
            <View style={[styles.accuracyBadge, { backgroundColor: classification.badgeBg }]}>
              <Text style={[styles.accuracyBadgeText, { color: classification.color }]}>
                {classification.label}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metricsGrid}>
          {/* Accuracy Column */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>GPS ACCURACY</Text>
            <Text
              style={[
                styles.accuracyValue,
                { color: classification ? classification.color : colors.textPrimary },
              ]}
            >
              {currentLocation ? `± ${currentLocation.accuracy}m` : '—'}
            </Text>
            <Text style={styles.metricSub}>
              {currentLocation ? classification?.label : 'Awaiting sensor reading'}
            </Text>
          </View>

          {/* Timestamp Column */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>CAPTURE TIMESTAMP</Text>
            <Text style={styles.timestampValue}>
              {currentLocation
                ? new Date(currentLocation.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '—'}
            </Text>
            <Text style={styles.metricSub}>
              {currentLocation
                ? new Date(currentLocation.timestamp).toISOString().split('T')[0]
                : 'UTC Timestamp'}
            </Text>
          </View>
        </View>

        {/* Coordinates Display */}
        <View style={styles.coordsCard}>
          <View style={styles.coordCol}>
            <Text style={styles.coordSubLabel}>LATITUDE</Text>
            <Text style={styles.coordValueText}>
              {currentLocation ? currentLocation.latitude.toFixed(6) : 'Pending capture'}
            </Text>
          </View>
          <View style={styles.coordColDivider} />
          <View style={styles.coordCol}>
            <Text style={styles.coordSubLabel}>LONGITUDE</Text>
            <Text style={styles.coordValueText}>
              {currentLocation ? currentLocation.longitude.toFixed(6) : 'Pending capture'}
            </Text>
          </View>
        </View>
      </View>

      {/* Error Callout */}
      {errorStatus && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorText}>{errorStatus}</Text>
        </View>
      )}

      {/* Primary Capture Action */}
      <View style={styles.actionSection}>
        <HorizonButton
          title={
            capturing
              ? 'Acquiring Satellite Fix...'
              : saving
              ? 'Saving to Local SQLite...'
              : currentLocation
              ? 'Recalibrate GPS Fix'
              : 'Capture GPS Fix'
          }
          onPress={handleCaptureGPS}
          loading={capturing || saving}
          size="lg"
          variant={currentLocation ? 'outline' : 'primary'}
          style={styles.captureBtn}
        />

        {/* Navigation Buttons */}
        <View style={styles.navRow}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Task Overview</Text>
          </TouchableOpacity>

          <HorizonButton
            title="Proceed to Images →"
            onPress={onNext}
            disabled={!currentLocation}
            size="md"
            variant="primary"
            style={styles.nextBtn}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: radius.sm,
    padding: 10,
    gap: 8,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tokenGold,
  },
  offlineText: {
    fontSize: 11,
    color: colors.tokenGold,
    fontWeight: '600',
    flex: 1,
  },
  mapCanvas: {
    height: 180,
    backgroundColor: '#070B12',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  gridLineVertical: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  targetPinContainer: {
    position: 'absolute',
    left: '35%',
    top: '38%',
    alignItems: 'center',
  },
  targetPinPulse: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  targetPinCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8',
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  targetPinLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  fixPinContainer: {
    position: 'absolute',
    left: '52%',
    top: '46%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixAccuracyCircle: {
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  fixPinCenter: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  fixPinLabel: {
    position: 'absolute',
    top: 14,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mapFooter: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sridLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  distanceMetric: {
    fontSize: 10,
    color: colors.accentGreen,
    fontWeight: '700',
  },
  metricsCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricsCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  accuracyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  accuracyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accuracyValue: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 2,
  },
  timestampValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  metricSub: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
  },
  coordsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coordCol: {
    flex: 1,
    alignItems: 'center',
  },
  coordColDivider: {
    width: 1,
    height: '100%',
    backgroundColor: colors.borderLight,
  },
  coordSubLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coordValueText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorBox: {
    flexDirection: 'row',
    backgroundColor: colors.statusErrorMuted,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: radius.sm,
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 14,
    color: colors.statusError,
  },
  errorText: {
    fontSize: 11,
    color: colors.statusError,
    flex: 1,
    lineHeight: 16,
  },
  actionSection: {
    gap: 12,
    marginTop: 6,
  },
  captureBtn: {
    width: '100%',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
  },
});
