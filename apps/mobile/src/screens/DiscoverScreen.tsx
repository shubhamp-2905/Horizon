import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { TaskCard } from '../components/TaskCard';
import { apiClient } from '../services/api';
import type { TaskResponseDTO } from '@horizon/types';

interface DiscoverScreenProps {
  onSelectTask: (task: TaskResponseDTO) => void;
  userCoords?: { latitude: number; longitude: number };
}

const ARTIFACT_CATEGORIES = [
  { label: 'All Types', value: undefined },
  { label: 'Water', value: 'water_source' },
  { label: 'Solar', value: 'solar_installation' },
  { label: 'Traffic', value: 'traffic_flow' },
  { label: 'Shelter', value: 'emergency_shelter' },
  { label: 'Telecom', value: 'telecom_tower' },
];

const RADII = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
];

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  onSelectTask,
  userCoords = { latitude: 18.5204, longitude: 73.8567 },
}) => {
  const [tasks, setTasks] = useState<TaskResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState(10000);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.discoverTasks({
        lat: userCoords.latitude,
        lng: userCoords.longitude,
        radius,
        artifact_type: selectedCategory,
      });
      setTasks(res.tasks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load geospatial tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userCoords, radius, selectedCategory]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  return (
    <View style={styles.container}>
      {/* Top GPS bar */}
      <View style={styles.gpsBar}>
        <View style={styles.gpsIndicator}>
          <View style={styles.gpsPulse} />
          <Text style={styles.gpsText}>
            GPS FIX: {userCoords.latitude.toFixed(4)}, {userCoords.longitude.toFixed(4)}
          </Text>
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'list' && styles.activeToggleBtn]}
            onPress={() => setActiveTab('list')}
          >
            <Text style={[styles.toggleText, activeTab === 'list' && styles.activeToggleText]}>
              List ({tasks.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'map' && styles.activeToggleBtn]}
            onPress={() => setActiveTab('map')}
          >
            <Text style={[styles.toggleText, activeTab === 'map' && styles.activeToggleText]}>
              Map
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Radius Filters */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>RADIUS:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {RADII.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.chip, radius === r.value && styles.activeChip]}
              onPress={() => setRadius(r.value)}
            >
              <Text style={[styles.chipText, radius === r.value && styles.activeChipText]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Category Pills */}
      <View style={styles.categorySection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {ARTIFACT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={[styles.catChip, selectedCategory === cat.value && styles.activeCatChip]}
              onPress={() => setSelectedCategory(cat.value)}
            >
              <Text style={[styles.catText, selectedCategory === cat.value && styles.activeCatText]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Querying PostGIS spatial engine...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTasks}>
            <Text style={styles.retryText}>Retry Search</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'map' ? (
        <View style={styles.mapRepresentation}>
          <View style={styles.mapCanvas}>
            <View style={styles.mapGridLines} />
            {/* Contributor Pin */}
            <View style={styles.contributorPin}>
              <View style={styles.contributorRing} />
              <Text style={styles.contributorDot}>📍 YOU</Text>
            </View>

            {/* Task Pins */}
            {tasks.map((t, idx) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.taskPin,
                  {
                    top: `${30 + ((idx * 17) % 50)}%`,
                    left: `${20 + ((idx * 23) % 65)}%`,
                  },
                ]}
                onPress={() => onSelectTask(t)}
              >
                <View style={styles.taskPinBadge}>
                  <Text style={styles.taskPinText}>+{t.base_reward}</Text>
                </View>
                <Text style={styles.taskPinTitle} numberOfLines={1}>
                  {t.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.mapLegend}>
            PostGIS Proximity: {tasks.length} task(s) within {radius / 1000}km of current coordinate.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
        >
          {tasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🛰️</Text>
              <Text style={styles.emptyTitle}>No Published Tasks In Range</Text>
              <Text style={styles.emptySubtitle}>
                Expand your search radius or select "All Types" to uncover open data gaps.
              </Text>
            </View>
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
    backgroundColor: '#090D16',
  },
  gpsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  gpsText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#10B981',
    fontWeight: '700',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeToggleBtn: {
    backgroundColor: '#38BDF8',
  },
  toggleText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginRight: 8,
  },
  filterRow: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  chipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeChipText: {
    color: '#38BDF8',
  },
  categorySection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  catChip: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  activeCatChip: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
  },
  catText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  activeCatText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 12,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  mapRepresentation: {
    flex: 1,
    padding: 16,
  },
  mapCanvas: {
    flex: 1,
    backgroundColor: '#060910',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGridLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  contributorPin: {
    position: 'absolute',
    top: '48%',
    left: '46%',
    alignItems: 'center',
  },
  contributorRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    top: -6,
    left: -4,
  },
  contributorDot: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  taskPin: {
    position: 'absolute',
    alignItems: 'center',
  },
  taskPinBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taskPinText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  taskPinTitle: {
    fontSize: 9,
    color: '#CBD5E1',
    marginTop: 2,
    maxWidth: 70,
  },
  mapLegend: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 10,
    textAlign: 'center',
  },
});
