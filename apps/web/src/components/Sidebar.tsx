'use client';

import React from 'react';
import {
  LogoMark,
  CompassIcon,
  LayersIcon,
  CheckCircle2Icon,
  UsersIcon,
  CoinsIcon,
  SatelliteIcon,
  SlidersIcon,
  ArrowRightIcon,
  EyeIcon,
} from './Icons';

export type AdminTab =
  | 'overview'
  | 'tasks'
  | 'submissions'
  | 'review'
  | 'contributors'
  | 'tokens'
  | 'pipeline'
  | 'settings';

interface SidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  taskCount: number;
  apiConnected: boolean;
  onSwitchToContributor?: () => void;
  onReturnToLanding?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  taskCount,
  apiConnected,
  onSwitchToContributor,
  onReturnToLanding,
}) => {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div
          className="brand-badge"
          style={{ cursor: onReturnToLanding ? 'pointer' : 'default' }}
          onClick={onReturnToLanding}
          title={onReturnToLanding ? 'Return to Horizon Landing' : undefined}
        >
          <div className="brand-logo-mark">
            <LogoMark size={20} />
          </div>
          <div>
            <div className="brand-name">HORIZON</div>
            <div className="brand-version">Enterprise Console</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Operations</div>

        <button
          type="button"
          className={`nav-link ${currentTab === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectTab('overview')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <CompassIcon size={16} />
            </span>
            <span>Dashboard</span>
          </span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentTab === 'tasks' ? 'active' : ''}`}
          onClick={() => onSelectTab('tasks')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <LayersIcon size={16} />
            </span>
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
            <span className="nav-icon">
              <EyeIcon size={16} />
            </span>
            <span>Submissions</span>
          </span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentTab === 'review' ? 'active' : ''}`}
          onClick={() => onSelectTab('review')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <CheckCircle2Icon size={16} />
            </span>
            <span>Review Queue</span>
          </span>
        </button>

        <div className="nav-section-title" style={{ marginTop: '12px' }}>
          Network & Ledger
        </div>

        <button
          type="button"
          className={`nav-link ${currentTab === 'contributors' ? 'active' : ''}`}
          onClick={() => onSelectTab('contributors')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <UsersIcon size={16} />
            </span>
            <span>Contributors</span>
          </span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentTab === 'tokens' ? 'active' : ''}`}
          onClick={() => onSelectTab('tokens')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <CoinsIcon size={16} />
            </span>
            <span>Token Ledger</span>
          </span>
        </button>

        <div className="nav-section-title" style={{ marginTop: '12px' }}>
          Downstream
        </div>

        <button
          type="button"
          className={`nav-link ${currentTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => onSelectTab('pipeline')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <SatelliteIcon size={16} />
            </span>
            <span>Loupe Pipeline</span>
          </span>
        </button>

        <div className="nav-section-title" style={{ marginTop: '12px' }}>
          System
        </div>

        <button
          type="button"
          className={`nav-link ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <SlidersIcon size={16} />
            </span>
            <span>Settings</span>
          </span>
        </button>

        {onSwitchToContributor && (
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'space-between', fontSize: '11px', padding: '8px 12px' }}
              onClick={onSwitchToContributor}
            >
              <span>Field Contributor View</span>
              <ArrowRightIcon size={14} color="var(--accent-orange)" />
            </button>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="conn-status">
          <div className={`conn-dot ${apiConnected ? '' : 'conn-dot-offline'}`} />
          <span>{apiConnected ? 'PostGIS Active (:4000)' : 'Connecting to API...'}</span>
        </div>
        <div className="admin-profile-pill">
          <div className="admin-avatar">AD</div>
          <div className="admin-info">
            <span className="admin-name">Admin Control</span>
            <span className="admin-role">Enterprise Operator</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
