'use client';

import React from 'react';
import { CoinsIcon, ShieldCheckIcon, CheckCircle2Icon } from './Icons';

export const TokenActivityTab: React.FC = () => {
  const ledgerTransactions = [
    {
      id: 'tx-001',
      type: 'STARTER_GRANT',
      amount: 100,
      user: 'scout_alex',
      reference: 'Initial account provisioning',
      timestamp: '2026-09-20 10:14:02',
    },
    {
      id: 'tx-002',
      type: 'STARTER_GRANT',
      amount: 100,
      user: 'marcus_k',
      reference: 'Initial account provisioning',
      timestamp: '2026-09-24 14:22:18',
    },
    {
      id: 'tx-003',
      type: 'TASK_STAKE_LOCK',
      amount: -20,
      user: 'marcus_k',
      reference: 'Task: Community Water Source Survey',
      timestamp: '2026-09-24 14:25:40',
    },
  ];

  return (
    <div>
      <div className="stats-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <CoinsIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Total Circulating Tokens</div>
            <div className="stat-value">1,200 HZN</div>
            <div className="stat-sub">Across 3 verified accounts</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <ShieldCheckIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Escrowed Stakes</div>
            <div className="stat-value">20 HZN</div>
            <div className="stat-sub">1 active commitment lock</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <CheckCircle2Icon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Ledger Integrity</div>
            <div className="stat-value">Immutable</div>
            <div className="stat-sub">Double-entry audit trail</div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header-bar">
          <div>
            <div className="table-title">Token Audit Ledger</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Financial audit trail of grants, escrows, and settlements</div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Tx ID</th>
              <th>Type</th>
              <th>Contributor</th>
              <th>Amount</th>
              <th>Reference / Context</th>
              <th>Timestamp (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {ledgerTransactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <tr key={tx.id}>
                  <td className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {tx.id}
                  </td>
                  <td>
                    <span className="badge-artifact">
                      {tx.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.user}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: isPositive ? 'var(--status-success)' : 'var(--accent-orange-text)',
                      }}
                    >
                      {isPositive ? `+${tx.amount}` : tx.amount} HZN
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {tx.reference}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {tx.timestamp}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
