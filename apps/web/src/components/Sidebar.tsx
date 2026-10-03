'use client';

import React from 'react';

export type AdminTab =
  | 'overview'
  | 'tasks'
  | 'submissions'
  | 'review'
  | 'contributors'
  | 'tokens'
  | 'settings';

interface SidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  taskCount: number;
  apiConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  taskCount,
  apiConnected,
}) => {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="brand-badge">
          <div className="brand-logo-mark">◈</div>
          <div>
            <div className="brand-name">Horizon</div>
            <div className="brand-version">Admin Console</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Main</div>
        
        <button
          type="button"
          className={`nav-link ${currentTab === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectTab('overview')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">⌂</span>
            <span>Dashboard</span>
          </span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentTab === 'tasks' ? 'active' : ''}`}
          onClick={() => onSelectTab('tasks')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">▤</span>
            <span>Tasks</span>
          </span>
          <span className="nav-pill">{taskCount}</span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentTab === 'submissions' ? 'active' : ''}`}
          onClick={() => onSelectTab('submissions')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">📥</span>
            <span>Submissions</span>
          </span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentTab === 'review' ? 'active' : ''}`}
          onClick={() => onSelectTab('review')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">✓</span>
            <span>Review Queue</span>
          </span>
        </button>

        <div className="nav-section-title" style={{ marginTop: '12px' }}>Network</div>

        <button
          type="button"
          className={`nav-link ${currentTab === 'contributors' ? 'active' : ''}`}
          onClick={() => onSelectTab('contributors')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">👥</span>
            <span>Contributors</span>
          </span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentTab === 'tokens' ? 'active' : ''}`}
          onClick={() => onSelectTab('tokens')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">◈</span>
            <span>Token Ledger</span>
          </span>
        </button>

        <div className="nav-section-title" style={{ marginTop: '12px' }}>System</div>

        <button
          type="button"
          className={`nav-link ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="conn-status">
          <div className={`conn-dot ${apiConnected ? '' : 'conn-dot-offline'}`} />
          <span>{apiConnected ? 'API Connected (:4000)' : 'Connecting to API...'}</span>
        </div>
        <div className="admin-profile-pill">
          <div className="admin-avatar">AD</div>
          <div className="admin-info">
            <span className="admin-name">Admin Ops</span>
            <span className="admin-role">System Administrator</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
