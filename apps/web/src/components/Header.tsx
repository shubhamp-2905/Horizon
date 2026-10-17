'use client';

import React from 'react';
import type { AdminTab } from './Sidebar';
import { RefreshCwIcon, PlusIcon, CompassIcon } from './Icons';

interface HeaderProps {
  currentTab: AdminTab;
  onCreateTaskClick: () => void;
  onRefreshClick: () => void;
  onLoadPresetClick: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onCreateTaskClick,
  onRefreshClick,
  onLoadPresetClick,
  loading,
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'overview':
        return 'Operations Dashboard';
      case 'tasks':
        return 'Task Management';
      case 'submissions':
        return 'Field Data Intake & Verification';
      case 'members':
        return 'Members & Contributors';
      case 'review':
        return 'Admin Review & Decisions';
      case 'pipeline':
        return 'Verified Geospatial Data';
      case 'settings':
        return 'Operations & Security Settings';
    }
  };

  const getTabSubtitle = () => {
    switch (currentTab) {
      case 'overview':
        return 'Welcome back, Operations Administrator 👋';
      case 'tasks':
        return 'Manage and monitor all active PostGIS ground-truth waypoints';
      case 'submissions':
        return 'Inspect incoming field observations, telemetry validation checks, and AI quality assessment';
      case 'members':
        return 'Directory of registered platform contributors, activity records, and token balances';
      case 'review':
        return 'Inspect verified field submissions, review AI validation diagnostics, and execute authoritative decisions';
      case 'pipeline':
        return 'Loupe analytics dataset packaging and ETL export feeds';
      case 'settings':
        return 'Cryptographic key parameters, API status, and access controls';
    }
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <div>
          <h1 className="header-title">{getTabTitle()}</h1>
          <p className="header-subtitle">{getTabSubtitle()}</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Refresh / Sync Action Button with high-contrast text */}
        <button
          type="button"
          onClick={onRefreshClick}
          className="header-btn header-btn-secondary"
          disabled={loading}
          title="Query latest state from PostGIS and Consensus Engine"
        >
          <RefreshCwIcon size={14} className={loading ? 'animate-spin' : ''} color="#344054" />
          <span className="header-btn-text">{loading ? 'Syncing...' : 'Sync State'}</span>
        </button>

        {/* Load Spatial Preset Button with high-contrast text */}
        <button
          type="button"
          onClick={onLoadPresetClick}
          className="header-btn header-btn-secondary"
          title="Pre-populate task builder with validated spatial preset"
        >
          <CompassIcon size={14} color="#15803D" />
          <span className="header-btn-text">Load Preset</span>
        </button>

        {/* Create Task Button — Solid Emerald Green CTA */}
        <button
          type="button"
          onClick={onCreateTaskClick}
          className="header-btn header-btn-primary"
        >
          <PlusIcon size={15} color="#FFFFFF" />
          <span>+ Create Task</span>
        </button>
      </div>
    </header>
  );
};
