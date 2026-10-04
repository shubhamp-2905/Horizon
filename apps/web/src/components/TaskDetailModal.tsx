'use client';

import React, { useState } from 'react';
import type { AdminTaskItem } from './OverviewTab';

interface TaskDetailModalProps {
  task: AdminTaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleStatus: (task: AdminTaskItem) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onToggleStatus,
}) => {
  const [showJson, setShowJson] = useState(false);

  if (!isOpen || !task) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge-artifact">
                {task.artifact_type.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className={`badge ${task.status === 'published' ? 'badge-published' : 'badge-draft'}`}>
                <span className="badge-dot" />
                {task.status.toUpperCase()}
              </span>
            </div>
            <h2 className="modal-title" style={{ marginTop: '6px' }}>{task.title}</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Spatial Info */}
          <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
              POSTGIS GEOSPATIAL PARAMETERS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Latitude: </span>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {task.latitude.toFixed(6)}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Longitude: </span>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {task.longitude.toFixed(6)}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--accent-orange-text)', marginTop: '6px' }}>
              EPSG: 4326 (WGS84 Geodetic Reference System)
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
              OBJECTIVE & SCOPE
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {task.description || 'No additional instructions provided for this collection gap.'}
            </p>
          </div>

          {/* Requirements */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
              COLLECTION REQUIREMENTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(task.requirements || ['Geotagged ground photo', 'Survey checklist']).map((req, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent-orange)', fontWeight: 800 }}>✓</span>
                  <span>{req}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Economics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>REWARD</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent-orange-text)' }}>+{task.base_reward}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>STAKE</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{task.commitment_stake}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>DIFFICULTY</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{task.difficulty.toFixed(1)}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>EFFORT</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>~{task.estimated_effort_minutes || 25}m</div>
            </div>
          </div>

          {/* Raw JSON Inspector Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {showJson ? 'Hide JSON Payload' : 'Inspect Raw PostGIS JSON'}
            </button>
            {showJson && (
              <pre style={{
                marginTop: '8px',
                padding: '12px',
                background: '#060a12',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                color: 'var(--accent-emerald)',
                overflowX: 'auto',
                fontFamily: 'monospace',
                border: '1px solid var(--border-subtle)',
              }}>
                {JSON.stringify(task, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onToggleStatus(task)}
          >
            {task.status === 'published' ? 'Unpublish Task' : 'Publish Task'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
