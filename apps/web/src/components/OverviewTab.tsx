'use client';

import React from 'react';
import {
  LayersIcon,
  CheckCircle2Icon,
  ClockIcon,
  AlertTriangleIcon,
  XCircleIcon,
  ArrowRightIcon,
  EyeIcon,
  PlusIcon,
} from './Icons';

export interface AdminTaskItem {
  id: string;
  title: string;
  description: string;
  artifact_type: string;
  status: string;
  difficulty: number;
  scarcity: number;
  base_reward: number;
  commitment_stake: number;
  estimated_effort_minutes: number;
  latitude: number;
  longitude: number;
  requirements: string[];
  created_at: string;
}

export interface ReviewQueueItem {
  id: string;
  task_title: string;
  contributor: string;
  location: string;
  gps_accuracy: string;
  submitted: string;
  community_result: string;
  community_votes: { approve: number; reject: number; flag: number; quorum: number };
  status: 'awaiting_review' | 'flagged' | 'pending';
}

export interface SystemStats {
  total_tasks: number;
  active_tasks: number;
  total_submissions: number;
  pending_submissions: number;
  awaiting_review: number;
  approved_count: number;
  rejected_count: number;
  flagged_count: number;
  total_contributors: number;
  total_tokens_circulating: number;
}

interface OverviewTabProps {
  tasks: AdminTaskItem[];
  stats?: SystemStats | null;
  reviewQueue?: ReviewQueueItem[];
  onNavigateToTasks: () => void;
  onNavigateToSubmissions: () => void;
  onOpenCreateTask: () => void;
  onToggleStatus: (task: AdminTaskItem) => void;
  onViewTask: (task: AdminTaskItem) => void;
  onInspectSubmission?: (submissionId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  tasks,
  stats,
  reviewQueue,
  onNavigateToTasks,
  onNavigateToSubmissions,
  onOpenCreateTask,
  onToggleStatus,
  onViewTask,
  onInspectSubmission,
}) => {
  const activeTasks = tasks.filter((t) => t.status === 'published');
  const activeTasksCount = stats ? stats.active_tasks : activeTasks.length;

  // Real operational metrics directly from Supabase / API
  const pendingSubmissions = stats ? stats.pending_submissions : (reviewQueue ? reviewQueue.length : 0);
  const awaitingFinalReview = stats ? stats.awaiting_review : (reviewQueue ? reviewQueue.filter((r) => r.status === 'awaiting_review').length : 0);
  const approvedCount = stats ? stats.approved_count : 0;
  const rejectedCount = stats ? stats.rejected_count : 0;
  const flaggedCount = stats ? stats.flagged_count : 0;

  const currentQueue = reviewQueue || [];

  return (
    <div>
      {/* 6 Essential Operational Metric Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <ClockIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Pending Submissions</div>
            <div className="stat-value">{pendingSubmissions}</div>
            <div className="stat-sub">
              <span className="stat-trend-tag">↑ In intake &amp; review</span>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-blue">
            <EyeIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Awaiting Review</div>
            <div className="stat-value">{awaitingFinalReview}</div>
            <div className="stat-sub">Community quorum met</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <CheckCircle2Icon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Approved</div>
            <div className="stat-value">{approvedCount}</div>
            <div className="stat-sub">Verified ground truth</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-red">
            <XCircleIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Rejected</div>
            <div className="stat-value">{rejectedCount}</div>
            <div className="stat-sub">Failed verification</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <AlertTriangleIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Flagged</div>
            <div className="stat-value">{flaggedCount}</div>
            <div className="stat-sub">Telemetry anomaly</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-gray">
            <LayersIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Active Tasks</div>
            <div className="stat-value">{activeTasksCount}</div>
            <div className="stat-sub">Live in field discovery</div>
          </div>
        </div>
      </div>

      {/* Primary Work Queue: Requires Review */}
      <div className="work-queue-card">
        <div className="work-queue-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Requires Review</h2>
              <span className="work-queue-badge">{awaitingFinalReview} Actionable</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Field submissions with community consensus awaiting final administrator acceptance or rejection
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onNavigateToSubmissions}
          >
            <span>All Submissions</span>
            <ArrowRightIcon size={14} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Submission</th>
                <th>Contributor</th>
                <th>Location</th>
                <th>Submitted</th>
                <th>Community Result</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                    No field submissions currently awaiting administrator review. All field submissions are up to date.
                  </td>
                </tr>
              ) : (
                currentQueue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-cell-title">{item.task_title}</div>
                      <div className="table-cell-desc font-mono">{item.id}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-primary)' }}>
                        @{item.contributor}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{item.location}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GPS: {item.gps_accuracy}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.submitted}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: item.status === 'flagged' ? 'var(--status-warning-text)' : 'var(--accent-emerald-text)',
                        }}
                      >
                        {item.community_result}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${item.status === 'flagged' ? 'status-pill-warning' : 'status-pill-pending'}`}>
                        <span className="badge-dot" />
                        {item.status === 'flagged' ? 'Flagged' : 'Awaiting Review'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-table-action"
                        onClick={() => {
                          if (onInspectSubmission) {
                            onInspectSubmission(item.id);
                          } else {
                            onNavigateToSubmissions();
                          }
                        }}
                      >
                        <span>Inspect &amp; Decide</span>
                        <ArrowRightIcon size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Tasks Management Strip */}
      <div className="table-container" style={{ marginTop: '24px' }}>
        <div className="table-header-bar">
          <div>
            <div className="table-title">Active Field Tasks</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PostGIS registered collection waypoints</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onOpenCreateTask}
              className="btn btn-primary btn-sm"
            >
              <PlusIcon size={14} />
              <span>Create Task</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToTasks}
              className="btn btn-secondary btn-sm"
            >
              <span>Manage All ({tasks.length})</span>
            </button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Artifact</th>
              <th>Coordinates</th>
              <th>Reward / Stake</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                  No field tasks found in database registry.
                </td>
              </tr>
            ) : (
              tasks.slice(0, 10).map((task) => (
                <tr key={task.id}>
                  <td>
                    <div className="table-cell-title">{task.title}</div>
                    <div className="table-cell-desc font-mono">{task.id.slice(0, 8)}...</div>
                  </td>
                  <td>
                    <span className="badge-artifact">
                      {task.artifact_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '12px' }}>
                    {task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>
                      +{task.base_reward} TKN
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                      ({task.commitment_stake} stake)
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${task.status === 'published' ? 'status-pill-published' : 'status-pill-draft'}`}>
                      <span className="badge-dot" />
                      {task.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => onToggleStatus(task)}
                        className="btn btn-secondary btn-sm"
                      >
                        {task.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewTask(task)}
                        className="btn btn-secondary btn-sm"
                      >
                        <EyeIcon size={13} />
                        <span>Details</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
