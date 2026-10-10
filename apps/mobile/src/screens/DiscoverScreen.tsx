import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { TaskCard } from '../components/TaskCard';
import { apiClient } from '../services/api';
import type { TaskResponseDTO } from '@horizon/types';
import { radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { HorizonButton } from '../components/ui/HorizonButton';
import { TokenBadge } from '../components/ui/TokenBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';

interface DiscoverScreenProps {
  onSelectTask: (task: TaskResponseDTO) => void;
  userCoords?: { latitude: number; longitude: number };
}

const ARTIFACT_CATEGORIES = [
  { label: 'All Categories', value: undefined },
  { label: 'Water Source', value: 'water_source' },
  { label: 'Solar Array', value: 'solar_installation' },
  { label: 'Traffic Flow', value: 'traffic_flow' },
  { label: 'Shelter', value: 'emergency_shelter' },
  { label: 'Telecom', value: 'telecom_tower' },
];

export const MAX_DISCOVERY_RADIUS_METERS = 50000; // 50 km strict upper bound for geospatial task discovery

const RADII = [
  { label: '5 km', value: 5000 },
  { label: '15 km', value: 15000 },
  { label: '30 km', value: 30000 },
  { label: '50 km (Max)', value: 50000 },
];

const DIFFICULTIES = [
  { label: 'All', value: undefined },
  { label: 'Easy', max: 1.5 },
  { label: 'Medium', min: 1.6, max: 2.5 },
  { label: 'Hard', min: 2.6 },
];

function getHumanReadableLocation(lat: number, lng: number): string {
  if (Math.abs(lat - 18.52) < 0.6 && Math.abs(lng - 73.85) < 0.6) {
    return 'Pune, Maharashtra';
  }
  if (Math.abs(lat - 19.07) < 0.5 && Math.abs(lng - 72.87) < 0.5) {
    return 'Mumbai, Maharashtra';
  }
  if (Math.abs(lat - 12.97) < 0.5 && Math.abs(lng - 77.59) < 0.5) {
    return 'Bengaluru, Karnataka';
  }
  if (Math.abs(lat - 28.61) < 0.5 && Math.abs(lng - 77.20) < 0.5) {
    return 'New Delhi, Delhi';
  }
  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatDistance(meters?: number | null): string {
  if (meters === null || meters === undefined) return 'Nearby';
  if (meters < 1000) return `${meters} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  onSelectTask,
  userCoords = { latitude: 18.5204, longitude: 73.8567 },
}) => {
  const { theme, isDark } = useTheme();
  const [tasks, setTasks] = useState<TaskResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(15000);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedDifficultyIdx, setSelectedDifficultyIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedTaskOnMap, setSelectedTaskOnMap] = useState<TaskResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Primitive stable coordinates
  const lat = userCoords.latitude;
  const lng = userCoords.longitude;
  const locationName = useMemo(() => getHumanReadableLocation(lat, lng), [lat, lng]);

  const fetchTasks = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) {
          setLoading(true);
        }
        setError(null);
        // Cap query radius strictly to 50km
        const effectiveRadius = Math.min(radiusMeters, MAX_DISCOVERY_RADIUS_METERS);
        const res = await apiClient.discoverTasks({
          lat,
          lng,
          radius: effectiveRadius,
          artifact_type: selectedCategory,
        });

        let results = res.tasks || [];

        // Dynamically compute real distance for every task from user's coordinates
        results = results.map((t) => {
          let dist = t.distance_meters;
          if ((dist === null || dist === undefined) && t.latitude && t.longitude) {
            dist = calculateDistanceMeters(lat, lng, t.latitude, t.longitude);
          }
          return { ...t, distance_meters: dist };
        });

        // Strictly enforce 50km boundary: user should only see tasks under our range (max 50km)
        results = results.filter((t) => {
          if (t.distance_meters !== null && t.distance_meters !== undefined) {
            return t.distance_meters <= effectiveRadius;
          }
          return true;
        });

        // Proximity sort: nearest tasks appear first
        results.sort((a, b) => (a.distance_meters ?? 0) - (b.distance_meters ?? 0));

        // Filter by difficulty if set
        const diffFilter = DIFFICULTIES[selectedDifficultyIdx];
        if (diffFilter.value === undefined && (diffFilter.min || diffFilter.max)) {
          results = results.filter((t) => {
            if (diffFilter.min && t.difficulty < diffFilter.min) return false;
            if (diffFilter.max && t.difficulty > diffFilter.max) return false;
            return true;
          });
        }

        setTasks(results);
        setSelectedTaskOnMap((prev) => {
          if (!prev) return results[0] || null;
          const match = results.find((r) => r.id === prev.id);
          return match || results[0] || null;
        });
      } catch (err: any) {
        setError(err.message || 'Unable to load nearby tasks. Please verify connection.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [lat, lng, radiusMeters, selectedCategory, selectedDifficultyIdx]
  );

  // Fetch only on filter / coordinate changes
  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks(false);
  };

  const getDifficultyLabel = (diff: number) => {
    if (diff <= 1.5) return 'Easy';
    if (diff <= 2.5) return 'Medium';
    return 'Hard';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Location Bar with Human-Readable Location Name & Accuracy */}
      <View
        style={[
          styles.locationBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.locationInfo}>
          <View style={[styles.pulseDot, { backgroundColor: theme.electricPurple }]} />
          <View>
            <Text style={[styles.locationLabel, { color: theme.textMuted }]}>
              YOUR LOCATION
            </Text>
            <Text style={[styles.locationName, { color: theme.textPrimary }]}>
              {locationName}
            </Text>
            <Text style={[styles.locationAccuracy, { color: theme.textSecondary }]}>
              ±4.2 m accuracy
            </Text>
          </View>
        </View>

        {/* View Toggle: Map vs List */}
        <View
          style={[
            styles.toggleGroup,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.borderLight,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              viewMode === 'map' && { backgroundColor: theme.electricPurple },
            ]}
            onPress={() => setViewMode('map')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toggleText,
                { color: viewMode === 'map' ? '#FFFFFF' : theme.textSecondary },
                viewMode === 'map' && { fontWeight: '800' },
              ]}
            >
              Map
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              viewMode === 'list' && { backgroundColor: theme.electricPurple },
            ]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toggleText,
                { color: viewMode === 'list' ? '#FFFFFF' : theme.textSecondary },
                viewMode === 'list' && { fontWeight: '800' },
              ]}
            >
              List ({tasks.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Bars */}
      <View
        style={[
          styles.filterArea,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        {/* Radius Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          <Text style={[styles.filterGroupLabel, { color: theme.textMuted }]}>RADIUS:</Text>
          {RADII.map((r) => {
            const isSelected = radiusMeters === r.value;
            return (
              <TouchableOpacity
                key={r.value}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? theme.purpleMuted : theme.surfaceCard,
                    borderColor: isSelected ? theme.borderHighlight : theme.border,
                  },
                ]}
                onPress={() => setRadiusMeters(r.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? theme.electricPurple : theme.textSecondary,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ARTIFACT_CATEGORIES.map((cat) => {
            const isCatSelected = selectedCategory === cat.value;
            return (
              <TouchableOpacity
                key={cat.label}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: isCatSelected ? theme.electricPurple : theme.surfaceCard,
                    borderColor: isCatSelected ? theme.electricPurple : theme.border,
                  },
                ]}
                onPress={() => setSelectedCategory(cat.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.catChipText,
                    {
                      color: isCatSelected ? '#FFFFFF' : theme.textSecondary,
                      fontWeight: isCatSelected ? '700' : '500',
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content: Map or List */}
      {loading ? (
        <LoadingState message="Discovering nearby tasks..." />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
            Unable to load tasks
          </Text>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <HorizonButton title="Retry" onPress={() => fetchTasks(true)} variant="primary" size="sm" />
        </View>
      ) : viewMode === 'map' ? (
        <View style={[styles.mapContainer, { backgroundColor: theme.background }]}>
          {/* Spatial Radar Canvas */}
          <View style={styles.spatialCanvas}>
            {/* Range Rings */}
            <View style={[styles.rangeRingOuter, { borderColor: theme.border }]} />
            <View style={[styles.rangeRingMid, { borderColor: theme.borderLight }]} />
            <View
              style={[
                styles.rangeRingInner,
                { borderColor: isDark ? 'rgba(124, 58, 237, 0.4)' : 'rgba(124, 58, 237, 0.25)' },
              ]}
            />

            {/* Grid Crosshairs */}
            <View style={[styles.crosshairVertical, { backgroundColor: theme.borderLight }]} />
            <View style={[styles.crosshairHorizontal, { backgroundColor: theme.borderLight }]} />

            {/* User Center Dot */}
            <View style={styles.userCenterPin}>
              <View style={[styles.userPulseRing, { backgroundColor: theme.purpleMuted }]} />
              <View style={[styles.userCoreDot, { backgroundColor: theme.electricPurple }]} />
              <Text style={[styles.userPinLabel, { color: theme.electricPurple }]}>YOU</Text>
            </View>

            {/* Task Markers on Radar Canvas using actual coordinate offsets */}
            {tasks.map((task) => {
              const isSelected = selectedTaskOnMap?.id === task.id;
              const taskLat = task.latitude ?? lat;
              const taskLng = task.longitude ?? lng;
              const deltaLat = taskLat - lat;
              const deltaLng = taskLng - lng;
              const maxDeg = radiusMeters / 111320;
              const normX = Math.max(-0.4, Math.min(0.4, (deltaLng / (maxDeg * 1.8 || 1)) * 0.4));
              const normY = Math.max(-0.4, Math.min(0.4, (deltaLat / (maxDeg * 1.8 || 1)) * 0.4));
              const topOffset = 50 - normY * 100;
              const leftOffset = 50 + normX * 100;

              return (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.taskMarker,
                    { top: `${topOffset}%`, left: `${leftOffset}%` },
                    isSelected && styles.selectedTaskMarker,
                  ]}
                  onPress={() => setSelectedTaskOnMap(task)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.markerBadge,
                      {
                        backgroundColor: isSelected ? theme.electricPurple : theme.surfaceCard,
                        borderColor: isSelected ? theme.electricPurple : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.markerText,
                        { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                      ]}
                    >
                      +{task.base_reward}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.markerTitle,
                      {
                        color: theme.textSecondary,
                        backgroundColor: theme.surfaceCard,
                        borderColor: theme.border,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {tasks.length === 0 && (
              <View
                style={[
                  styles.mapEmptyNotice,
                  {
                    backgroundColor: theme.surfaceCard,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.mapEmptyText, { color: theme.textSecondary }]}>
                  No nearby tasks within {radiusMeters / 1000} km
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Task Preview Card */}
          {selectedTaskOnMap && (
            <View
              style={[
                styles.bottomPreviewCard,
                {
                  backgroundColor: theme.surfaceCard,
                  borderColor: theme.border,
                  shadowColor: '#000000',
                },
              ]}
            >
              <View style={styles.previewTop}>
                <View
                  style={[
                    styles.previewTypeTag,
                    { backgroundColor: theme.purpleMuted },
                  ]}
                >
                  <Text style={[styles.previewTypeText, { color: theme.electricPurple }]}>
                    {selectedTaskOnMap.artifact_type.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.previewDistance, { color: theme.textSecondary }]}>
                  {formatDistance(selectedTaskOnMap.distance_meters)}
                  {' · ~'}{selectedTaskOnMap.estimated_effort_minutes || 25} min
                </Text>
              </View>

              <Text style={[styles.previewTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {selectedTaskOnMap.title}
              </Text>

              <View style={styles.previewEconomicsRow}>
                <View style={styles.previewTokensGroup}>
                  <TokenBadge
                    amount={selectedTaskOnMap.base_reward}
                    type="reward"
                    size="sm"
                  />
                  <TokenBadge
                    amount={`${selectedTaskOnMap.commitment_stake}`}
                    label="TOKEN STAKE"
                    type="stake"
                    size="sm"
                  />
                </View>

                <View
                  style={[
                    styles.previewDiffTag,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <Text style={[styles.previewDiffText, { color: theme.textMuted }]}>
                    Difficulty · {getDifficultyLabel(selectedTaskOnMap.difficulty)}
                  </Text>
                </View>
              </View>

              <HorizonButton
                title="View Task Details"
                onPress={() => onSelectTask(selectedTaskOnMap)}
                size="md"
                style={styles.previewCTA}
              />
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.electricPurple}
            />
          }
        >
          {tasks.length === 0 ? (
            <EmptyState
              title="No nearby tasks available"
              description="Expand your search radius or choose 'All Categories' to discover more geospatial tasks."
              actionText="Expand to 25 km"
              onAction={() => setRadiusMeters(25000)}
            />
          ) : (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onPress={onSelectTask} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  locationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  locationLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  locationName: {
    fontSize: 13,
    fontWeight: '800',
  },
  locationAccuracy: {
    fontSize: 10,
    fontWeight: '500',
  },
  toggleGroup: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 2,
    borderWidth: 1,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterArea: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 6,
  },
  chipRow: {
    paddingHorizontal: 16,
  },
  filterGroupLabel: {
    fontSize: 9,
    fontWeight: '800',
    alignSelf: 'center',
    marginRight: 8,
    letterSpacing: 0.5,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: 6,
  },
  catChipText: {
    fontSize: 11,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  spatialCanvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rangeRingOuter: {
    position: 'absolute',
    width: '85%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  rangeRingMid: {
    position: 'absolute',
    width: '58%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  rangeRingInner: {
    position: 'absolute',
    width: '32%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  crosshairVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
  },
  crosshairHorizontal: {
    position: 'absolute',
    height: 1,
    width: '100%',
  },
  userCenterPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  userCoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  userPinLabel: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 4,
  },
  taskMarker: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  selectedTaskMarker: {
    zIndex: 10,
    transform: [{ translateX: -20 }, { translateY: -20 }, { scale: 1.1 }],
  },
  markerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  markerText: {
    fontSize: 10,
    fontWeight: '800',
  },
  markerTitle: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.5,
    maxWidth: 90,
  },
  mapEmptyNotice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  mapEmptyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomPreviewCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  previewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  previewTypeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  previewDistance: {
    fontSize: 11,
    fontWeight: '600',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  previewEconomicsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewTokensGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  previewDiffTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  previewDiffText: {
    fontSize: 10,
    fontWeight: '600',
  },
  previewCTA: {
    width: '100%',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
});
