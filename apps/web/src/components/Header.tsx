'use client';

import React, { useState, useEffect } from 'react';
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
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('horizon_admin_theme');
      const current = (stored === 'light' || stored === 'dark')
        ? stored
        : (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'light';
      setTheme(current);
      document.documentElement.setAttribute('data-theme', current);
    } catch {
      // Default to light
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('horizon_admin_theme', nextTheme);
    } catch {
      // Ignore write errors
    }
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case 'overview':
        return 'Operations Dashboard';
      case 'tasks':
        return 'Task Management';
      case 'submissions':
        return 'Field Submissions';
      case 'review':
        return 'Consensus & Verification Queue';
      case 'pipeline':
        return 'Verified Geospatial Data';
      case 'settings':
        return 'Operations & Security Settings';
    }
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <h1 className="header-title">{getTabTitle()}</h1>
        <span className="header-tag">Production Live</span>
      </div>

      <div className="header-actions">
        {/* Dark / Light Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn btn-secondary btn-sm"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{ minWidth: '78px', justifyContent: 'center' }}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>

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
          <CompassIcon size={14} color="var(--accent-brand)" />
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
