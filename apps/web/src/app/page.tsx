import React from 'react';

export default function DashboardPage() {
  return (
    <div className="dashboard-layout">
      {/* Navigation Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
          HORIZON
        </div>

        <nav>
          <a href="#" className="nav-item active">Overview</a>
          <a href="#" className="nav-item">Task Management</a>
          <a href="#" className="nav-item">Submissions</a>
          <a href="#" className="nav-item">Verification Queue</a>
          <a href="#" className="nav-item">Contributors</a>
          <a href="#" className="nav-item">Token & Ledger</a>
        </nav>
      </aside>

      {/* Main Console Content */}
      <main className="main-content">
        <header className="header">
          <h1>Reviewer &amp; Admin Console</h1>
          <p>Phase 1 Foundation: Monitoring authoritative geospatial ingest, verification, and ledger systems.</p>
        </header>

        {/* Metrics Grid */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Active Tasks</div>
            <div className="metric-value">--</div>
            <div className="metric-status">Ready for Phase 2 Engine</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pending Verifications</div>
            <div className="metric-value">--</div>
            <div className="metric-status">Queue Standing By</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Active Contributors</div>
            <div className="metric-value">--</div>
            <div className="metric-status">Auth Module Ready</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Token Circulation</div>
            <div className="metric-value">--</div>
            <div className="metric-status">Ledger Schema Validated</div>
          </div>
        </section>

        {/* System Architecture Topology */}
        <section className="panel">
          <h2 className="panel-title">System Infrastructure Status</h2>
          <ul className="system-status-list">
            <li className="system-status-item">
              <span>Authoritative Backend (FastAPI / SQLAlchemy)</span>
              <span className="status-badge">Operational (Port 4000)</span>
            </li>
            <li className="system-status-item">
              <span>Spatial Database (PostgreSQL / PostGIS)</span>
              <span className="status-badge">Schema Initialized</span>
            </li>
            <li className="system-status-item">
              <span>AI Verification Microservice (FastAPI / PyTorch)</span>
              <span className="status-badge">Operational (Port 8000)</span>
            </li>
            <li className="system-status-item">
              <span>Object Storage (S3 / MinIO / R2)</span>
              <span className="status-badge">Configured</span>
            </li>
            <li className="system-status-item">
              <span>Mobile Client (React Native / Expo / SQLite)</span>
              <span className="status-badge">Scaffold Ready</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
