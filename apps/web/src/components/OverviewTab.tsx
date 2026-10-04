'use client';

import React from 'react';
import {
  LayersIcon,
  CheckCircle2Icon,
  ClockIcon,
  CoinsIcon,
  PlusIcon,
  ArrowRightIcon,
  EyeIcon,
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

interface OverviewTabProps {
  tasks: AdminTaskItem[];
  onNavigateToTasks: () => void;
  onOpenCreateTask: () => void;
  onToggleStatus: (task: AdminTaskItem) => void;
  onViewTask: (task: AdminTaskItem) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  tasks,
  onNavigateToTasks,
  onOpenCreateTask,
  onToggleStatus,
  onViewTask,
}) => {
  const publishedTasks = tasks.filter((t) => t.status === 'published');
  const draftTasks = tasks.filter((t) => t.status === 'draft');
  const rewardPoolTotal = tasks.reduce((sum, t) => sum + (t.base_reward || 0), 0);

  // Group by artifact type
  const typeCounts: Record<string, number> = {};
  tasks.forEach((t) => {
    const key = t.artifact_type || 'other';
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  });

  return (
    <div>
      {/* 4 Precision KPI Metric Cards */}
      <div className="stats-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <LayersIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Total Field Tasks</div>
            <div className="stat-value">{tasks.length}</div>
            <div className="stat-sub">PostGIS registered points</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <CheckCircle2Icon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Published in Field</div>
            <div className="stat-value">{publishedTasks.length}</div>
            <div className="stat-sub">Active on contributor mobile</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-gray">
            <ClockIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Draft Backlog</div>
            <div className="stat-value">{draftTasks.length}</div>
            <div className="stat-sub">Pending requirements audit</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <CoinsIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Allocated Reward Pool</div>
            <div className="stat-value">{rewardPoolTotal} HZN</div>
            <div className="stat-sub">Secured in escrow ledger</div>
          </div>
        </div>
      </div>

      {/* Category Breakdown & Operations Control */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Category Breakdown */}
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Task Categories</h3>
            <span style={{ fontSize: '11px', color: 'var(--accent-orange-text)', fontWeight: 600 }}>{Object.keys(typeCounts).length} types</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.entries(typeCounts).map(([type, count]) => {
              const percent = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
              return (
                <div key={type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: 'var(--gradient-orange)',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Quick Actions */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
              Field Operations Control
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              Deploy ground-truth observation tasks, monitor geospatial telemetry, and manage token commitments across the decentralized contributor network.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onOpenCreateTask}
              className="btn btn-primary"
            >
              <PlusIcon size={16} />
              <span>Create New Task</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToTasks}
              className="btn btn-secondary"
            >
              <span>Manage Tasks ({tasks.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Tasks Table */}
      <div className="table-container">
        <div className="table-header-bar">
          <div>
            <div className="table-title">Recent Geospatial Tasks</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Latest active collection points</div>
          </div>
          <button
            type="button"
            onClick={onNavigateToTasks}
            className="btn btn-secondary btn-sm"
          >
            <span>View All ({tasks.length})</span>
            <ArrowRightIcon size={14} />
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Category</th>
              <th>Coordinates</th>
              <th>Reward / Stake</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.slice(0, 5).map((task) => (
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
                  <span style={{ fontWeight: 700, color: 'var(--accent-orange-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                    +{task.base_reward} HZN
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
