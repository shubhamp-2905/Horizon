'use client';

import React, { useState } from 'react';
import type { AdminTaskItem } from './OverviewTab';
import { SearchIcon, PlusIcon, EyeIcon } from './Icons';

interface TasksTabProps {
  tasks: AdminTaskItem[];
  onOpenCreateTask: () => void;
  onToggleStatusWithConfirm: (task: AdminTaskItem) => void;
  onViewTask: (task: AdminTaskItem) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  onOpenCreateTask,
  onToggleStatusWithConfirm,
  onViewTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredTasks = tasks.filter((task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description.toLowerCase().includes(q);
      const matchType = task.artifact_type.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchType) return false;
    }

    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }

    if (categoryFilter !== 'all' && task.artifact_type !== categoryFilter) {
      return false;
    }

    return true;
  });

  const uniqueCategories = Array.from(new Set(tasks.map((t) => t.artifact_type)));

  return (
    <div>
      {/* Search and Filters Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '22px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: '34px', width: '100%' }}
              placeholder="Search tasks by title, category, or artifact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>

          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onOpenCreateTask}
          className="btn btn-primary"
        >
          <PlusIcon size={16} />
          <span>New Field Task</span>
        </button>
      </div>

      {/* Main Task Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Category</th>
              <th>Coordinates</th>
              <th>Reward</th>
              <th>Stake</th>
              <th>Status</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                  No tasks match the active filters.
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
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
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {task.commitment_stake} HZN
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${task.status === 'published' ? 'status-pill-published' : 'status-pill-draft'}`}>
                      <span className="badge-dot" />
                      {task.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(task.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => onToggleStatusWithConfirm(task)}
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
