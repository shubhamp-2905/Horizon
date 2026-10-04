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
        return 'Task & Geofence Management';
      case 'submissions':
        return 'Submissions & Ground Evidence';
      case 'review':
        return 'AI & Quorum Verification Queue';
      case 'contributors':
        return 'Field Contributor Network';
      case 'tokens':
        return 'Token Ledger & Escrow Pool';
      case 'pipeline':
        return 'Loupe ML Downstream Pipeline';
      case 'settings':
        return 'System & Geospatial SRID Configuration';
    }
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <h1 className="header-title">{getTabTitle()}</h1>
        <span className="header-tag">PostGIS SRID 4326</span>
      </div>

      <div className="header-actions">
        <button
          type="button"
          onClick={onRefreshClick}
          className="btn btn-secondary btn-sm"
          disabled={loading}
          title="Query latest state from PostGIS and Consensus Engine"
        >
          <RefreshCwIcon size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Syncing...' : 'Refresh'}</span>
        </button>

        <button
          type="button"
          onClick={onLoadPresetClick}
          className="btn btn-secondary btn-sm"
          title="Pre-populate task builder with validated spatial preset"
        >
          <CompassIcon size={14} color="var(--accent-orange)" />
          <span>Load Preset</span>
        </button>

        <button
          type="button"
          onClick={onCreateTaskClick}
          className="btn btn-primary btn-sm"
        >
          <PlusIcon size={15} />
          <span>Create Task</span>
        </button>
      </div>
    </header>
  );
};
