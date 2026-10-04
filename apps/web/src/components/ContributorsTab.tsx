'use client';

import React from 'react';
import { UsersIcon, CoinsIcon, ShieldCheckIcon, CheckCircle2Icon } from './Icons';

export const ContributorsTab: React.FC = () => {
  const demoContributors = [
    {
      id: 'usr-scout-01',
      username: 'scout_alex',
      email: 'alex@horizon.dev',
      role: 'contributor',
      status: 'active',
      available_tokens: 100,
      locked_tokens: 0,
      active_claims: 0,
      joined: '2026-09-20',
    },
    {
      id: 'usr-scout-02',
      username: 'marcus_k',
      email: 'marcus.k@horizon.dev',
      role: 'contributor',
      status: 'active',
      available_tokens: 80,
      locked_tokens: 20,
      active_claims: 1,
      joined: '2026-09-24',
    },
    {
      id: 'usr-admin-01',
      username: 'admin',
      email: 'admin@horizon.dev',
      role: 'admin',
      status: 'active',
      available_tokens: 1000,
      locked_tokens: 0,
      active_claims: 0,
      joined: '2026-09-18',
    },
  ];

  return (
    <div>
      <div className="stats-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-blue">
            <UsersIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Active Contributors</div>
            <div className="stat-value">{demoContributors.length}</div>
            <div className="stat-sub">Verified network identities</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <CoinsIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Starter Grant Standard</div>
            <div className="stat-value">100 HZN</div>
            <div className="stat-sub">Initial balance per account</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <ShieldCheckIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Locked Escrow Stakes</div>
            <div className="stat-value">20 HZN</div>
            <div className="stat-sub">Committed to active tasks</div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header-bar">
          <div>
            <div className="table-title">Contributor Directory & Balances</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ledger-backed token accounts</div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Contributor</th>
              <th>Role</th>
              <th>Status</th>
              <th>Available</th>
              <th>Locked Stake</th>
              <th>Active Claims</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {demoContributors.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="table-cell-title">{c.username}</div>
                  <div className="table-cell-desc font-mono">{c.email}</div>
                </td>
                <td>
                  <span className="badge-artifact">
                    {c.role}
                  </span>
                </td>
                <td>
                  <span className="status-pill status-pill-published">
                    <CheckCircle2Icon size={12} />
                    <span>Active</span>
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: 'var(--accent-orange-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {c.available_tokens} HZN
                  </span>
                </td>
                <td>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {c.locked_tokens} HZN
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: c.active_claims > 0 ? 'var(--accent-orange-text)' : 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {c.active_claims}
                  </span>
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {c.joined}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
