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
  const { theme, isDark } = useTheme();
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Location & GPS Fix Header */}
      <View
        style={[
          styles.gpsBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.gpsInfo}>
          <View style={[styles.gpsPulse, { backgroundColor: theme.primary }]} />
          <View>
            <Text style={[styles.gpsFixLabel, { color: theme.textMuted }]}>
              POSTGIS GEOSPATIAL FIX
            </Text>
            <Text style={[styles.gpsCoords, { color: theme.primaryLight }]}>
              {userCoords.latitude.toFixed(4)}°N, {userCoords.longitude.toFixed(4)}°E (±4.2m)
            </Text>
          </View>
        </View>

        {/* View Toggle */}
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
              viewMode === 'map' && { backgroundColor: theme.primary },
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
              viewMode === 'list' && { backgroundColor: theme.primary },
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
                    backgroundColor: isSelected ? theme.primaryMuted : theme.card,
                    borderColor: isSelected ? theme.primary : theme.borderLight,
                  },
                ]}
                onPress={() => setRadiusMeters(r.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? theme.primaryLight : theme.textSecondary,
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
                    backgroundColor: isCatSelected ? theme.primary : theme.card,
                    borderColor: isCatSelected ? theme.primary : theme.border,
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
        <LoadingState message="Discovering nearby tasks via PostGIS..." />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <HorizonButton title="Retry Search" onPress={fetchTasks} variant="secondary" size="sm" />
        </View>
      ) : viewMode === 'map' ? (
        <View style={[styles.mapContainer, { backgroundColor: theme.background }]}>
          {/* Spatial Canvas Preview */}
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
              <View style={[styles.userPulseRing, { backgroundColor: theme.primaryMuted }]} />
              <View style={[styles.userCoreDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.userPinLabel, { color: theme.primaryLight }]}>YOU</Text>
            </View>

            {/* Task Markers on Radar Canvas */}
            {tasks.map((task, idx) => {
              const isSelected = selectedTaskOnMap?.id === task.id;
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
                  <View
                    style={[
                      styles.markerBadge,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.card,
                        borderColor: isSelected ? theme.primary : theme.border,
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
                        backgroundColor: theme.card,
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
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.mapEmptyText, { color: theme.textSecondary }]}>
                  No data gaps within {radiusMeters / 1000} km
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
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: isDark ? '#000000' : '#4C1D95',
                },
              ]}
            >
              <View style={styles.previewTop}>
                <View
                  style={[
                    styles.previewTypeTag,
                    { backgroundColor: theme.primaryMuted },
                  ]}
                >
                  <Text style={[styles.previewTypeText, { color: theme.primaryLight }]}>
                    {selectedTaskOnMap.artifact_type.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.previewDistance, { color: theme.textSecondary }]}>
                  {selectedTaskOnMap.distance_meters !== null && selectedTaskOnMap.distance_meters !== undefined
                    ? `${(selectedTaskOnMap.distance_meters / 1000).toFixed(1)} km away`
                    : 'Nearby'}
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
              tintColor={theme.primary}
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
  },
  gpsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
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
  },
  gpsFixLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  gpsCoords: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
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
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  filterGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    alignSelf: 'center',
    marginRight: 6,
    letterSpacing: 0.6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: 6,
  },
  catChipText: {
    fontSize: 11,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
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
    borderStyle: 'dashed',
  },
  rangeRingMid: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
  },
  rangeRingInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
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
    zIndex: 10,
  },
  userPulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  userCoreDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userPinLabel: {
    fontSize: 10,
    fontWeight: '700',
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
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  markerText: {
    fontSize: 10,
    fontWeight: '700',
  },
  markerTitle: {
    fontSize: 9,
    fontWeight: '600',
    maxWidth: 90,
    marginTop: 2,
    paddingHorizontal: 4,
    borderRadius: 2,
    borderWidth: 1,
    textAlign: 'center',
  },
  mapEmptyNotice: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  mapEmptyText: {
    fontSize: 12,
  },
  bottomPreviewCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  previewTypeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewDistance: {
    fontSize: 11,
    fontWeight: '600',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
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
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  previewDiffText: {
    fontSize: 10,
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
    textAlign: 'center',
  },
});
