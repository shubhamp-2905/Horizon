import React, { useState, useEffect, useCallback } from 'react';
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
import { colors, radius } from '../theme/colors';
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

const RADII = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
];

const DIFFICULTIES = [
  { label: 'All', value: undefined },
  { label: 'Easy', max: 1.5 },
  { label: 'Medium', min: 1.6, max: 2.5 },
  { label: 'Hard', min: 2.6 },
];

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  onSelectTask,
  userCoords = { latitude: 18.5204, longitude: 73.8567 },
}) => {
  const [tasks, setTasks] = useState<TaskResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(10000);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedDifficultyIdx, setSelectedDifficultyIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedTaskOnMap, setSelectedTaskOnMap] = useState<TaskResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.discoverTasks({
        lat: userCoords.latitude,
        lng: userCoords.longitude,
        radius: radiusMeters,
        artifact_type: selectedCategory,
      });

      let results = res.tasks || [];
      const diffFilter = DIFFICULTIES[selectedDifficultyIdx];
      if (diffFilter.value === undefined && (diffFilter.min || diffFilter.max)) {
        results = results.filter((t) => {
          if (diffFilter.min && t.difficulty < diffFilter.min) return false;
          if (diffFilter.max && t.difficulty > diffFilter.max) return false;
          return true;
        });
      }

      setTasks(results);
      if (results.length > 0 && !selectedTaskOnMap) {
        setSelectedTaskOnMap(results[0]);
      } else if (results.length === 0) {
        setSelectedTaskOnMap(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to query PostGIS spatial engine');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userCoords, radiusMeters, selectedCategory, selectedDifficultyIdx, selectedTaskOnMap]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const getDifficultyLabel = (diff: number) => {
    if (diff <= 1.5) return 'Easy';
    if (diff <= 2.5) return 'Medium';
    return 'Hard';
  };

  return (
    <View style={styles.container}>
      {/* Location & GPS Fix Header */}
      <View style={styles.gpsBar}>
        <View style={styles.gpsInfo}>
          <View style={styles.gpsPulse} />
          <View>
            <Text style={styles.gpsFixLabel}>POSTGIS GEOSPATIAL FIX</Text>
            <Text style={styles.gpsCoords}>
              {userCoords.latitude.toFixed(4)}°N, {userCoords.longitude.toFixed(4)}°E (±4.2m)
            </Text>
          </View>
        </View>

        {/* View Toggle */}
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'map' && styles.activeToggleBtn]}
            onPress={() => setViewMode('map')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, viewMode === 'map' && styles.activeToggleText]}>
              Map
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.activeToggleBtn]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, viewMode === 'list' && styles.activeToggleText]}>
              List ({tasks.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Bars */}
      <View style={styles.filterArea}>
        {/* Radius Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          <Text style={styles.filterGroupLabel}>RADIUS:</Text>
          {RADII.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.chip, radiusMeters === r.value && styles.activeChip]}
              onPress={() => setRadiusMeters(r.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, radiusMeters === r.value && styles.activeChipText]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ARTIFACT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={[styles.catChip, selectedCategory === cat.value && styles.activeCatChip]}
              onPress={() => setSelectedCategory(cat.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.catChipText,
                  selectedCategory === cat.value && styles.activeCatChipText,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content: Map or List */}
      {loading ? (
        <LoadingState message="Discovering nearby tasks via PostGIS..." />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <HorizonButton title="Retry Search" onPress={fetchTasks} variant="secondary" size="sm" />
        </View>
      ) : viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          {/* Spatial Canvas Preview */}
          <View style={styles.spatialCanvas}>
            {/* Range Rings */}
            <View style={styles.rangeRingOuter} />
            <View style={styles.rangeRingMid} />
            <View style={styles.rangeRingInner} />

            {/* Grid Crosshairs */}
            <View style={styles.crosshairVertical} />
            <View style={styles.crosshairHorizontal} />

            {/* User Center Dot */}
            <View style={styles.userCenterPin}>
              <View style={styles.userPulseRing} />
              <View style={styles.userCoreDot} />
              <Text style={styles.userPinLabel}>YOU</Text>
            </View>

            {/* Task Markers on Radar Canvas */}
            {tasks.map((task, idx) => {
              const isSelected = selectedTaskOnMap?.id === task.id;
              // Deterministic polar offset distribution around center
              const angle = (idx * 137.5) * (Math.PI / 180);
              const distanceFactor = Math.min(0.42, 0.18 + (idx * 0.1));
              const topOffset = 50 + Math.sin(angle) * (distanceFactor * 100);
              const leftOffset = 50 + Math.cos(angle) * (distanceFactor * 100);

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
                  <View style={[styles.markerBadge, isSelected && styles.selectedMarkerBadge]}>
                    <Text style={[styles.markerText, isSelected && styles.selectedMarkerText]}>
                      +{task.base_reward}
                    </Text>
                  </View>
                  <Text style={styles.markerTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {tasks.length === 0 && (
              <View style={styles.mapEmptyNotice}>
                <Text style={styles.mapEmptyText}>No data gaps within {radiusMeters / 1000} km</Text>
              </View>
            )}
          </View>

          {/* Bottom Task Preview Card */}
          {selectedTaskOnMap && (
            <View style={styles.bottomPreviewCard}>
              <View style={styles.previewTop}>
                <View style={styles.previewTypeTag}>
                  <Text style={styles.previewTypeText}>
                    {selectedTaskOnMap.artifact_type.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.previewDistance}>
                  {selectedTaskOnMap.distance_meters !== null && selectedTaskOnMap.distance_meters !== undefined
                    ? `${(selectedTaskOnMap.distance_meters / 1000).toFixed(1)} km away`
                    : 'Nearby'}
                  {' · ~'}{selectedTaskOnMap.estimated_effort_minutes || 25} min
                </Text>
              </View>

              <Text style={styles.previewTitle} numberOfLines={1}>
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

                <View style={styles.previewDiffTag}>
                  <Text style={styles.previewDiffText}>
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
              tintColor={colors.accentGreen}
            />
          }
        >
          {tasks.length === 0 ? (
            <EmptyState
              title="No Tasks Found In Range"
              description="Expand your search radius or choose 'All Categories' to discover more geospatial data gaps."
              actionText="Reset to 25 km"
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
    backgroundColor: colors.background,
  },
  gpsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gpsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentGreen,
  },
  gpsFixLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  gpsCoords: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.accentGreen,
    fontWeight: '600',
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  activeToggleBtn: {
    backgroundColor: colors.accentGreen,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeToggleText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterArea: {
    backgroundColor: colors.surface,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  filterGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    alignSelf: 'center',
    marginRight: 6,
    letterSpacing: 0.6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 6,
  },
  activeChip: {
    backgroundColor: colors.accentOrangeMuted,
    borderColor: colors.accentOrange,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeChipText: {
    color: colors.accentOrange,
    fontWeight: '800',
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  activeCatChip: {
    backgroundColor: colors.accentOrange,
    borderColor: colors.accentOrange,
  },
  catChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeCatChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.background,
  },
  spatialCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rangeRingOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  rangeRingMid: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rangeRingInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  crosshairVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: colors.borderLight,
  },
  crosshairHorizontal: {
    position: 'absolute',
    height: 1,
    width: '100%',
    backgroundColor: colors.borderLight,
  },
  userCenterPin: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  userPulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentOrangeMuted,
  },
  userCoreDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accentOrange,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userPinLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentOrange,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  taskMarker: {
    position: 'absolute',
    transform: [{ translateX: -30 }, { translateY: -15 }],
    alignItems: 'center',
    zIndex: 5,
  },
  selectedTaskMarker: {
    zIndex: 20,
    transform: [{ translateX: -32 }, { translateY: -18 }, { scale: 1.06 }],
  },
  markerBadge: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedMarkerBadge: {
    backgroundColor: colors.accentOrange,
    borderColor: colors.accentOrange,
  },
  markerText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectedMarkerText: {
    color: '#FFFFFF',
  },
  markerTitle: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
    maxWidth: 90,
    marginTop: 2,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
  },
  mapEmptyNotice: {
    padding: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapEmptyText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bottomPreviewCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  previewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewTypeTag: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  previewTypeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  previewDistance: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  previewEconomicsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTokensGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  previewDiffTag: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  previewDiffText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  previewCTA: {
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    color: colors.statusError,
    textAlign: 'center',
  },
});
