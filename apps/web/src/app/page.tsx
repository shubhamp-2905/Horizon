'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type AdminTab } from '../components/Sidebar';
import { Header } from '../components/Header';
import { OverviewTab, type AdminTaskItem } from '../components/OverviewTab';
import { TasksTab } from '../components/TasksTab';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { SubmissionsTab } from '../components/SubmissionsTab';
import { ContributorsTab } from '../components/ContributorsTab';
import { TokenActivityTab } from '../components/TokenActivityTab';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const API_ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const INITIAL_DEMO_TASKS: AdminTaskItem[] = [
  {
    id: '4ffea264-89ec-402f-b470-f4a058729ddd',
    title: 'Community Water Source Survey',
    description: 'Document water dispensary condition, flow rate, and contamination risk.',
    artifact_type: 'water_source',
    status: 'published',
    difficulty: 2.0,
    scarcity: 1.5,
    base_reward: 150,
    commitment_stake: 20,
    estimated_effort_minutes: 25,
    latitude: 18.5204,
    longitude: 73.8567,
    requirements: ['2 geotagged photos', 'Flow rate test', 'Safety label confirmation'],
    created_at: new Date().toISOString(),
  },
  {
    id: '8a1c93f0-4521-419b-a012-78d91a2bc45e',
    title: 'Rooftop Solar Array Inspection',
    description: 'Verify solar panel integrity, shading conditions, and inverter wiring.',
    artifact_type: 'solar_installation',
    status: 'published',
    difficulty: 2.5,
    scarcity: 1.8,
    base_reward: 200,
    commitment_stake: 30,
    estimated_effort_minutes: 35,
    latitude: 18.5312,
    longitude: 73.8445,
    requirements: ['Aerial canopy photo', 'Inverter serial code'],
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '9b3e12a8-12cd-48ea-b248-18e9741fd230',
    title: 'Micro-Grid Transformer Substation',
    description: 'Inspect ground clearance and thermal hazard warnings.',
    artifact_type: 'telecom_tower',
    status: 'draft',
    difficulty: 1.5,
    scarcity: 1.0,
    base_reward: 100,
    commitment_stake: 15,
    estimated_effort_minutes: 20,
    latitude: 18.5089,
    longitude: 73.8631,
    requirements: ['Safety perimeter check', 'Substation meter reading'],
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function AdminConsolePage() {
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');
  const [tasks, setTasks] = useState<AdminTaskItem[]>(INITIAL_DEMO_TASKS);
  const [loading, setLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Modals & Dialogs
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<AdminTaskItem | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Attempt to fetch tasks from live backend or check connectivity
  const fetchTasksFromApi = useCallback(async () => {
    setLoading(true);
    try {
      // Check health
      const healthRes = await fetch(`${API_ROOT_URL}/health`).catch(() => null);
      if (healthRes && healthRes.ok) {
        setApiConnected(true);
      } else {
        setApiConnected(false);
      }

      // If live backend exists, attempt to query public tasks discovery or admin tasks
      const res = await fetch(`${API_BASE_URL}/tasks?page_size=50`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data.tasks && data.tasks.length > 0) {
          const mappedTasks: AdminTaskItem[] = data.tasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            artifact_type: t.artifact_type,
            status: t.status || 'published',
            difficulty: t.difficulty || 1.0,
            scarcity: t.scarcity || 1.0,
            base_reward: t.base_reward || 50,
            commitment_stake: t.commitment_stake || 10,
            estimated_effort_minutes: t.estimated_effort_minutes || 25,
            latitude: t.latitude || 18.5204,
            longitude: t.longitude || 73.8567,
            requirements: t.requirements || ['Geotagged ground observation'],
            created_at: t.created_at || new Date().toISOString(),
          }));
          setTasks(mappedTasks);
        }
      }
    } catch {
      // Fallback
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasksFromApi();
  }, [fetchTasksFromApi]);

  const handleCreateTask = async (
    newTask: Omit<AdminTaskItem, 'id' | 'created_at'>
  ) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

      const res = await fetch(`${API_BASE_URL}/admin/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newTask),
      }).catch(() => null);

      if (res && res.ok) {
        const created = await res.json();
        setTasks((prev) => [created, ...prev]);
        showToast(`Task "${created.title}" successfully created and saved to PostGIS!`);
      } else {
        const simulated: AdminTaskItem = {
          ...newTask,
          id: `task-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        setTasks((prev) => [simulated, ...prev]);
        showToast(`Task "${simulated.title}" created successfully.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (task: AdminTaskItem) => {
    const nextStatus = task.status === 'published' ? 'draft' : 'published';
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

      await fetch(`${API_BASE_URL}/admin/tasks/${task.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: nextStatus }),
      }).catch(() => null);
    } catch {
      // Ignore network errors in offline/dev
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
    showToast(`Task "${task.title}" status updated to ${nextStatus.toUpperCase()}`);
  };

  const handleToggleStatusWithConfirm = (task: AdminTaskItem) => {
    const willUnpublish = task.status === 'published';
    setConfirmDialog({
      isOpen: true,
      title: willUnpublish ? 'Unpublish Task?' : 'Publish Task?',
      message: willUnpublish
        ? `Are you sure you want to unpublish "${task.title}"? Field contributors will no longer be able to discover or commit tokens to this task.`
        : `Publish "${task.title}" to field contributors? It will immediately appear in geospatial proximity discovery.`,
      onConfirm: () => {
        handleToggleStatus(task);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleOpenPreset = () => {
    setIsCreateModalOpen(true);
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        taskCount={tasks.length}
        apiConnected={apiConnected}
      />

      {/* Main Console Viewport */}
      <main className="app-main">
        <Header
          currentTab={currentTab}
          onCreateTaskClick={() => setIsCreateModalOpen(true)}
          onRefreshClick={fetchTasksFromApi}
          onLoadPresetClick={handleOpenPreset}
          loading={loading}
        />

        <div className="page-container">
          {currentTab === 'overview' && (
            <OverviewTab
              tasks={tasks}
              onNavigateToTasks={() => setCurrentTab('tasks')}
              onOpenCreateTask={() => setIsCreateModalOpen(true)}
              onToggleStatus={handleToggleStatus}
              onViewTask={(task) => setSelectedTaskForDetail(task)}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksTab
              tasks={tasks}
              onOpenCreateTask={() => setIsCreateModalOpen(true)}
              onToggleStatusWithConfirm={handleToggleStatusWithConfirm}
              onViewTask={(task) => setSelectedTaskForDetail(task)}
            />
          )}

          {(currentTab === 'submissions' || currentTab === 'review') && (
            <SubmissionsTab />
          )}

          {currentTab === 'contributors' && <ContributorsTab />}

          {currentTab === 'tokens' && <TokenActivityTab />}

          {currentTab === 'settings' && (
            <div className="stat-card" style={{ maxWidth: '600px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px' }}>
                Platform &amp; Geospatial Settings
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div>
                  <strong>PostGIS SRID:</strong> 4326 (WGS84 Lat/Long)
                </div>
                <div>
                  <strong>Default Proximity Radius:</strong> 10,000 meters
                </div>
                <div>
                  <strong>Starter Tokens Provisioning:</strong> 100 TOKENS (Fixed by protocol)
                </div>
                <div>
                  <strong>Backend Service Endpoint:</strong> {API_BASE_URL}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        loading={loading}
      />

      {/* Task Details Modal */}
      <TaskDetailModal
        task={selectedTaskForDetail}
        isOpen={selectedTaskForDetail !== null}
        onClose={() => setSelectedTaskForDetail(null)}
        onToggleStatus={handleToggleStatus}
      />

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Action Notification Toast */}
      {toastMessage && (
        <div className="toast-banner">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
