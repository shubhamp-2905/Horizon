'use client';

import React from 'react';
import {
  CompassIcon,
  LayersIcon,
  CheckCircle2Icon,
  SatelliteIcon,
  SlidersIcon,
  EyeIcon,
  LogOutIcon,
} from './Icons';

export type AdminTab =
  | 'overview'
  | 'tasks'
  | 'submissions'
  | 'review'
  | 'pipeline'
  | 'settings';

interface SidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  taskCount: number;
  apiConnected: boolean;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  taskCount,
  apiConnected,
  onSignOut,
}) => {
  return (
    <aside className="app-sidebar">
      {/* Brand Header: Logo removed, only Horizon bold + Admin Dashboard below */}
      <div className="sidebar-header">
        <div className="brand-header-group">
          <div className="brand-title-bold">Horizon</div>
          <div className="brand-subtitle-text">Admin Dashboard</div>
        </div>
      </div>

      {/* Streamlined Operational Navigation */}
      <nav className="sidebar-nav">
        {/* OVERVIEW */}
        <div className="nav-section-title">Overview</div>
        <button
          type="button"
          className={`nav-link ${currentTab === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectTab('overview')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <CompassIcon size={18} />
            </span>
            <span>Dashboard</span>
          </span>
        </button>

        {/* OPERATIONS */}
        <div className="nav-section-title" style={{ marginTop: '16px' }}>
          Operations
        </div>
        <button
          type="button"
          className={`nav-link ${currentTab === 'tasks' ? 'active' : ''}`}
          onClick={() => onSelectTab('tasks')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <LayersIcon size={18} />
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
              <EyeIcon size={18} />
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
              <CheckCircle2Icon size={18} />
            </span>
            <span>Reviews</span>
          </span>
        </button>

        {/* VERIFIED */}
        <div className="nav-section-title" style={{ marginTop: '16px' }}>
          Verified
        </div>
        <button
          type="button"
          className={`nav-link ${currentTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => onSelectTab('pipeline')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <SatelliteIcon size={18} />
            </span>
            <span>Verified Data</span>
          </span>
        </button>

        {/* SYSTEM */}
        <div className="nav-section-title" style={{ marginTop: '16px' }}>
          System
        </div>
        <button
          type="button"
          className={`nav-link ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <span className="nav-link-left">
            <span className="nav-icon">
              <SlidersIcon size={18} />
            </span>
            <span>Settings</span>
          </span>
        </button>
      </nav>

      {/* Need Help Card (from target design) */}
      <div className="sidebar-help-card-wrap">
        <div className="sidebar-help-card">
          <div className="help-icon-circle">
            <span style={{ fontSize: '18px', color: '#15803D' }}>⚡</span>
          </div>
          <div className="help-card-title">Need Help?</div>
          <div className="help-card-desc">
            Check our verification docs or contact protocol operations.
          </div>
          <button
            type="button"
            className="help-card-btn"
            onClick={() => onSelectTab('settings')}
          >
            Operational Specs
          </button>
        </div>
      </div>

      {/* Footer with Operational Status and Sign Out */}
      <div className="sidebar-footer">
        <div className="conn-status">
          <div className={`conn-dot ${apiConnected ? '' : 'conn-dot-offline'}`} />
          <span>{apiConnected ? 'PostGIS Active (:4000)' : 'Connecting to API...'}</span>
        </div>
        <div className="admin-profile-pill" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="admin-avatar">OP</div>
            <div className="admin-info">
              <span className="admin-name">Admin</span>
              <span className="admin-role">Operations Manager</span>
            </div>
          </div>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s ease',
              }}
              title="Sign Out of Operations Console"
            >
              <LogOutIcon size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
