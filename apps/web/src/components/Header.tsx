'use client';

import React from 'react';
import type { AdminTab } from './Sidebar';

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
        return 'Dashboard Overview';
      case 'tasks':
        return 'Task Management';
      case 'submissions':
        return 'Submissions & Evidence';
      case 'review':
        return 'Verification & Review Queue';
      case 'contributors':
        return 'Contributor Directory';
      case 'tokens':
        return 'Token Ledger & Balances';
      case 'settings':
        return 'System Configuration';
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
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>

        <button
          type="button"
          onClick={onLoadPresetClick}
          className="btn btn-secondary btn-sm"
          title="Fill form with sample task preset"
        >
          Sample Preset
        </button>

        <button
          type="button"
          onClick={onCreateTaskClick}
          className="btn btn-primary btn-sm"
        >
          + Create Task
        </button>
      </div>
    </header>
  );
};
