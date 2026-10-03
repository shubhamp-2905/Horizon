'use client';

import React, { useState } from 'react';

export interface ValidationCheckItem {
  name: string;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  message: string;
  details?: Record<string, unknown>;
}

export interface ImageQualityItem {
  id: string;
  label: string;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  confidence: number;
  blur_score: number;
  exposure: 'optimal' | 'underexposed' | 'overexposed' | 'low_contrast';
  resolution: string;
  reasons: string[];
}

export interface AdminSubmissionItem {
  id: string;
  task_id: string;
  task_title: string;
  artifact_type: string;
  contributor_email: string;
  status: string;
  gps_accuracy: number;
  latitude: number;
  longitude: number;
  captured_at: string;
  photo_count: number;
  validation_status: 'PASSED' | 'WARNING' | 'FAILED' | 'PENDING';
  validation_results: {
    status: 'PASSED' | 'WARNING' | 'FAILED';
    checks: ValidationCheckItem[];
    passed_checks: string[];
    failed_checks: string[];
    warnings: string[];
    validated_at: string;
  };
  ai_quality: {
    overall_status: 'PASSED' | 'WARNING' | 'FAILED';
    confidence: number;
    primary_reason: string;
    evaluated_at: string;
    media_results: ImageQualityItem[];
  };
  verification_status: 'pending' | 'approved' | 'rejected' | 'flagged';
  verification_notes?: string;
}

const DEMO_SUBMISSIONS: AdminSubmissionItem[] = [
  {
    id: 'sub_8f4a23c5_bc5e',
    task_id: '4ffea264-89ec-402f-b470-f4a058729ddd',
    task_title: 'Community Water Source Survey',
    artifact_type: 'water_source',
    contributor_email: 'scout_alex@horizon.dev',
    status: 'submitted',
    gps_accuracy: 6.8,
    latitude: 18.520432,
    longitude: 73.856738,
    captured_at: new Date(Date.now() - 3600000).toISOString(),
    photo_count: 2,
    validation_status: 'PASSED',
    validation_results: {
      status: 'PASSED',
      checks: [
        { name: 'required_fields', status: 'PASSED', message: 'All dynamic schema requirements satisfied' },
        { name: 'media_evidence', status: 'PASSED', message: '2/2 required geotagged photos attached' },
        { name: 'gps_accuracy', status: 'PASSED', message: 'High accuracy fix (±6.8m within 15m limit)' },
        { name: 'task_radius', status: 'PASSED', message: 'Proximity 14.2m from target waypoint' },
        { name: 'capture_timestamp', status: 'PASSED', message: 'Valid non-future capture timestamp' },
      ],
      passed_checks: ['required_fields', 'media_evidence', 'gps_accuracy', 'task_radius', 'capture_timestamp'],
      failed_checks: [],
      warnings: [],
      validated_at: new Date(Date.now() - 3500000).toISOString(),
    },
    ai_quality: {
      overall_status: 'PASSED',
      confidence: 0.96,
      primary_reason: 'Sharp focus, optimal natural daylight exposure, and clear landmark framing',
      evaluated_at: new Date(Date.now() - 3400000).toISOString(),
      media_results: [
        {
          id: 'med_01',
          label: 'Photo 1: Water pump wide view',
          status: 'PASSED',
          confidence: 0.97,
          blur_score: 148.2,
          exposure: 'optimal',
          resolution: '1920x1080',
          reasons: ['Optimal edge sharpness', 'Balanced lighting'],
        },
        {
          id: 'med_02',
          label: 'Photo 2: Valve mechanism close-up',
          status: 'PASSED',
          confidence: 0.95,
          blur_score: 122.6,
          exposure: 'optimal',
          resolution: '1920x1080',
          reasons: ['Clear mechanical detail', 'No lens flare'],
        },
      ],
    },
    verification_status: 'pending',
  },
  {
    id: 'sub_da052732_361d',
    task_id: '8a1c93f0-4521-419b-a012-78d91a2bc45e',
    task_title: 'Solar Mini-Grid Installation Check',
    artifact_type: 'renewable_energy',
    contributor_email: 'marcus.k@horizon.dev',
    status: 'submitted',
    gps_accuracy: 28.5,
    latitude: 18.5152,
    longitude: 73.8504,
    captured_at: new Date(Date.now() - 7200000).toISOString(),
    photo_count: 2,
    validation_status: 'WARNING',
    validation_results: {
      status: 'WARNING',
      checks: [
        { name: 'required_fields', status: 'PASSED', message: 'All inspection fields populated' },
        { name: 'media_evidence', status: 'PASSED', message: '2 photos provided' },
        { name: 'gps_accuracy', status: 'WARNING', message: 'Moderate GPS accuracy (±28.5m exceeds 15m threshold)' },
        { name: 'task_radius', status: 'PASSED', message: 'Proximity 42m from installation' },
        { name: 'capture_timestamp', status: 'PASSED', message: 'Valid capture timestamp' },
      ],
      passed_checks: ['required_fields', 'media_evidence', 'task_radius', 'capture_timestamp'],
      failed_checks: [],
      warnings: ['Moderate GPS accuracy (±28.5m)'],
      validated_at: new Date(Date.now() - 7100000).toISOString(),
    },
    ai_quality: {
      overall_status: 'WARNING',
      confidence: 0.78,
      primary_reason: 'Mild glare on digital inverter readout; human confirmation recommended',
      evaluated_at: new Date(Date.now() - 7000000).toISOString(),
      media_results: [
        {
          id: 'med_03',
          label: 'Photo 1: PV panel array overview',
          status: 'PASSED',
          confidence: 0.92,
          blur_score: 110.4,
          exposure: 'optimal',
          resolution: '1920x1080',
          reasons: ['Panels visible without obstruction'],
        },
        {
          id: 'med_04',
          label: 'Photo 2: Inverter digital display',
          status: 'WARNING',
          confidence: 0.65,
          blur_score: 62.1,
          exposure: 'overexposed',
          resolution: '1280x720',
          reasons: ['Direct sun reflection on screen digits'],
        },
      ],
    },
    verification_status: 'pending',
  },
  {
    id: 'sub_e41b892a_90f1',
    task_id: '9b3e12a8-12cd-48ea-b248-18e9741fd230',
    task_title: 'Urban Flood Drainage Channel',
    artifact_type: 'drainage_infrastructure',
    contributor_email: 'scout_field_test@horizon.dev',
    status: 'submitted',
    gps_accuracy: 142.0,
    latitude: 18.528,
    longitude: 73.861,
    captured_at: new Date(Date.now() - 10800000).toISOString(),
    photo_count: 1,
    validation_status: 'FAILED',
    validation_results: {
      status: 'FAILED',
      checks: [
        { name: 'required_fields', status: 'FAILED', message: 'Missing culvert blockage measurement' },
        { name: 'media_evidence', status: 'FAILED', message: 'Only 1 of 2 required photos attached' },
        { name: 'gps_accuracy', status: 'FAILED', message: 'GPS accuracy ±142m exceeds maximum allowable tolerance' },
        { name: 'task_radius', status: 'PASSED', message: 'Within bounds' },
        { name: 'capture_timestamp', status: 'PASSED', message: 'Timestamp verified' },
      ],
      passed_checks: ['task_radius', 'capture_timestamp'],
      failed_checks: ['required_fields', 'media_evidence', 'gps_accuracy'],
      warnings: [],
      validated_at: new Date(Date.now() - 10700000).toISOString(),
    },
    ai_quality: {
      overall_status: 'FAILED',
      confidence: 0.38,
      primary_reason: 'Severe motion blur and low illumination in primary capture',
      evaluated_at: new Date(Date.now() - 10600000).toISOString(),
      media_results: [
        {
          id: 'med_05',
          label: 'Photo 1: Drainage intake culvert',
          status: 'FAILED',
          confidence: 0.38,
          blur_score: 22.4,
          exposure: 'underexposed',
          resolution: '1280x720',
          reasons: ['Laplacian variance below 50 threshold (blurry)', 'Mean pixel luminance under 40'],
        },
      ],
    },
    verification_status: 'flagged',
  },
];

export const SubmissionsTab: React.FC = () => {
  const [submissions, setSubmissions] = useState<AdminSubmissionItem[]>(DEMO_SUBMISSIONS);
  const [selectedSub, setSelectedSub] = useState<AdminSubmissionItem>(DEMO_SUBMISSIONS[0]);
  const [filter, setFilter] = useState<'all' | 'PASSED' | 'WARNING' | 'FAILED'>('all');

  const filtered = filter === 'all' ? submissions : submissions.filter((s) => s.validation_status === filter);

  const handleDecision = (subId: string, decision: 'approved' | 'rejected') => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, verification_status: decision } : s))
    );
    if (selectedSub && selectedSub.id === subId) {
      setSelectedSub({ ...selectedSub, verification_status: decision });
    }
  };

  const renderBadge = (status: 'PASSED' | 'WARNING' | 'FAILED' | 'PENDING') => {
    switch (status) {
      case 'PASSED':
        return <span className="status-pill status-pill-passed">✓ Passed</span>;
      case 'WARNING':
        return <span className="status-pill status-pill-warning">⚠ Warning</span>;
      case 'FAILED':
        return <span className="status-pill status-pill-failed">✕ Failed</span>;
      default:
        return <span className="status-pill status-pill-draft">⏳ Pending</span>;
    }
  };

  return (
    <div>
      {/* 4-Stage Operational Overview Banner */}
      <div className="stat-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Verification & AI Quality Pipeline
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Deterministic spatial validation combined with AI-assisted media evaluation
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All ({submissions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('PASSED')}
              className={`btn btn-sm ${filter === 'PASSED' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Passed ({submissions.filter((s) => s.validation_status === 'PASSED').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('WARNING')}
              className={`btn btn-sm ${filter === 'WARNING' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Warning ({submissions.filter((s) => s.validation_status === 'WARNING').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('FAILED')}
              className={`btn btn-sm ${filter === 'FAILED' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Failed ({submissions.filter((s) => s.validation_status === 'FAILED').length})
            </button>
          </div>
        </div>

        {/* Pipeline Stepper Visualization */}
        <div className="pipeline-stepper">
          <div className="pipeline-step completed">
            <span className="pipeline-step-badge">1</span>
            <span>Field Submission</span>
          </div>
          <span className="pipeline-separator">→</span>
          <div className="pipeline-step completed">
            <span className="pipeline-step-badge">2</span>
            <span>Automated Validation</span>
          </div>
          <span className="pipeline-separator">→</span>
          <div className="pipeline-step completed">
            <span className="pipeline-step-badge">3</span>
            <span>AI Image Quality</span>
          </div>
          <span className="pipeline-separator">→</span>
          <div className="pipeline-step active">
            <span className="pipeline-step-badge">4</span>
            <span>Human Review & Release</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Submissions List + Review Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Left Column: Submissions Table */}
        <div className="table-container" style={{ margin: 0 }}>
          <div className="table-header-bar">
            <div className="table-title">Submissions Queue</div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filtered.length} entries</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Task / Contributor</th>
                <th>Validation</th>
                <th>AI Quality</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const isSelected = selectedSub?.id === sub.id;
                return (
                  <tr
                    key={sub.id}
                    onClick={() => setSelectedSub(sub)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-emerald-subtle)' : undefined,
                    }}
                  >
                    <td>
                      <div className="table-cell-title" style={{ fontSize: '13px' }}>{sub.task_title}</div>
                      <div className="table-cell-desc">{sub.contributor_email}</div>
                    </td>
                    <td>{renderBadge(sub.validation_status)}</td>
                    <td>{renderBadge(sub.ai_quality.overall_status)}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          sub.verification_status === 'approved'
                            ? 'status-pill-verified'
                            : sub.verification_status === 'rejected'
                            ? 'status-pill-rejected'
                            : 'status-pill-draft'
                        }`}
                      >
                        {sub.verification_status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right Column: Submission Inspector (Phase 4 + Phase 5 Visible) */}
        {selectedSub && (
          <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-default)', paddingBottom: '14px' }}>
              <div>
                <span className="badge-artifact" style={{ marginBottom: '6px' }}>
                  {selectedSub.artifact_type.replace(/_/g, ' ')}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedSub.task_title}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Contributor: {selectedSub.contributor_email} · ID: {selectedSub.id}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GPS Accuracy</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ±{selectedSub.gps_accuracy.toFixed(1)}m
                </div>
              </div>
            </div>

            {/* Stage 2: Automated Validation Results */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  2. Automated Validation Audit
                </span>
                {renderBadge(selectedSub.validation_status)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedSub.validation_results.checks.map((chk) => (
                  <div
                    key={chk.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{chk.message}</span>
                    {renderBadge(chk.status)}
                  </div>
                ))}
              </div>
            </div>

            {/* Stage 3: AI Image Quality Evaluator (Phase 5) */}
            <div className="ai-quality-card">
              <div className="ai-quality-header">
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    3. AI Image Quality Evaluation
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Confidence: {Math.round(selectedSub.ai_quality.confidence * 100)}% · Reason: {selectedSub.ai_quality.primary_reason}
                  </div>
                </div>
                {renderBadge(selectedSub.ai_quality.overall_status)}
              </div>

              {/* Per-Image Results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedSub.ai_quality.media_results.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {img.label}
                      </span>
                      {renderBadge(img.status)}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Resolution: {img.resolution}</span>
                      <span>Sharpness Score: {img.blur_score}</span>
                      <span style={{ textTransform: 'capitalize' }}>Exposure: {img.exposure}</span>
                    </div>
                    {img.reasons.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Note: {img.reasons.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Stage 4: Review Decision Controls */}
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                4. Human Verification Decision
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleDecision(selectedSub.id, 'approved')}
                  disabled={selectedSub.verification_status === 'approved'}
                  className="btn btn-emerald"
                  style={{ flex: 1 }}
                >
                  ✓ Approve & Release Reward
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision(selectedSub.id, 'rejected')}
                  disabled={selectedSub.verification_status === 'rejected'}
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                >
                  ✕ Reject Submission
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
