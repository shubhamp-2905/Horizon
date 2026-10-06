'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type {
  EtlPipelineRunDTO,
  DatasetSummaryDTO,
  LoupeSyncResponseDTO,
} from '@horizon/types';

interface PipelineTabProps {
  apiBaseUrl: string;
  adminToken: string | null;
  onShowToast: (msg: string) => void;
}

export const PipelineTab: React.FC<PipelineTabProps> = ({
  apiBaseUrl,
  adminToken,
  onShowToast,
}) => {
  const [runs, setRuns] = useState<EtlPipelineRunDTO[]>([]);
  const [datasets, setDatasets] = useState<DatasetSummaryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingVersion, setSyncingVersion] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<LoupeSyncResponseDTO | null>(null);

  // Trigger Run Modal State
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [datasetVersionInput, setDatasetVersionInput] = useState('v1.0.0');
  const [runTypeInput, setRunTypeInput] = useState<'incremental' | 'full_refresh'>('incremental');
  const [artifactFilterInput, setArtifactFilterInput] = useState('');
  const [triggering, setTriggering] = useState(false);

  // Auth headers
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    // Also include default Loupe export API key as fallback
    headers['X-Loupe-API-Key'] = 'horizon_loupe_export_key_2026';
    return headers;
  }, [adminToken]);

  // Fetch Pipeline Runs & Datasets
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();

      // 1. Fetch Runs
      const runsRes = await fetch(`${apiBaseUrl}/pipeline/runs`, { headers });
      if (runsRes.ok) {
        const data = await runsRes.json();
        setRuns(data.runs || []);
      }

      // 2. Fetch Published Datasets
      const dsRes = await fetch(`${apiBaseUrl}/pipeline/datasets`, { headers });
      if (dsRes.ok) {
        const dsData = await dsRes.json();
        setDatasets(dsData || []);
      }
    } catch (err) {
      console.warn('Pipeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Trigger Run
  const handleTriggerRun = async () => {
    setTriggering(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/pipeline/runs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dataset_version: datasetVersionInput.trim() || 'v1.0.0',
          run_type: runTypeInput,
          artifact_type: artifactFilterInput.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.message || 'Failed to trigger pipeline run');
      }

      const runData = await res.json();
      onShowToast(`ETL Run ${runData.id.slice(0, 8)} started successfully!`);
      setIsTriggerModalOpen(false);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error triggering run';
      onShowToast(`Error: ${msg}`);
    } finally {
      setTriggering(false);
    }
  };

  // Handle Retry Run
  const handleRetryRun = async (runId: string) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/pipeline/runs/${runId}/retry`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.message || 'Retry failed');
      }

      onShowToast(`Pipeline run ${runId.slice(0, 8)} retried successfully`);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error retrying run';
      onShowToast(`Error: ${msg}`);
    }
  };

  // Handle Loupe Sync
  const handleSyncLoupe = async (version: string) => {
    setSyncingVersion(version);
    setSyncResult(null);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/pipeline/datasets/${version}/sync-loupe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ dry_run: false }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.message || 'Loupe sync failed');
      }

      const syncData: LoupeSyncResponseDTO = await res.json();
      setSyncResult(syncData);
      onShowToast(`Loupe Sync (${version}): ${syncData.status} (${syncData.record_count} observations delivered)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error syncing to Loupe';
      onShowToast(`Error: ${msg}`);
    } finally {
      setSyncingVersion(null);
    }
  };

  // Format Download Helper
  const getDownloadUrl = (version: string, format: string) => {
    return `${apiBaseUrl}/pipeline/datasets/${version}/export?format=${format}`;
  };

  const totalLoaded = runs.reduce((acc, r) => acc + (r.records_loaded || 0), 0);
  const totalDatasets = datasets.length;
  const avgQuality =
    datasets.length > 0
      ? (datasets.reduce((sum, d) => sum + (d.avg_quality_score || 0), 0) / datasets.length).toFixed(2)
      : '1.00';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Metrics Cards */}
      <div className="stats-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-emerald">🛰</div>
          <div className="kpi-content">
            <div className="stat-label">Published Observations</div>
            <div className="stat-value">{totalLoaded}</div>
            <div className="stat-sub">Gold layer verified features</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>📦</div>
          <div className="kpi-content">
            <div className="stat-label">Active Datasets</div>
            <div className="stat-value">{totalDatasets}</div>
            <div className="stat-sub">Verified dataset releases</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>★</div>
          <div className="kpi-content">
            <div className="stat-label">Avg Quality Score</div>
            <div className="stat-value">{avgQuality}</div>
            <div className="stat-sub">GPS + AI + Consensus metric</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>⚡</div>
          <div className="kpi-content">
            <div className="stat-label">ETL Pipeline Runs</div>
            <div className="stat-value">{runs.length}</div>
            <div className="stat-sub">Bronze → Silver → Gold</div>
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Verified Geospatial Data
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Canonical ground-truth records successfully verified through multi-layer consensus and PostGIS ingestion.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={fetchData}
            disabled={loading}
          >
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setIsTriggerModalOpen(true)}
          >
            <span>Compile Verified Dataset</span>
          </button>
        </div>
      </div>

      {/* Lineage / Architecture Pill Banner */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Verification Pipeline:</span>
          <span className="consensus-badge" style={{ background: 'rgba(99, 216, 255, 0.10)', color: 'var(--cyan-glow)', borderColor: 'var(--accent-brand-border)' }}>
            Bronze: Raw Field Submissions
          </span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span className="consensus-badge" style={{ background: 'rgba(45, 140, 255, 0.14)', color: 'var(--blue-soft)', borderColor: 'var(--border-default)' }}>
            Silver: AI &amp; Quorum Scored
          </span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span className="consensus-badge" style={{ background: 'rgba(16, 185, 129, 0.14)', color: 'var(--accent-emerald-text)', borderColor: 'var(--accent-emerald-border)' }}>
            Gold: PostGIS Verified Feeds
          </span>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          Authenticated SRID 4326 Export
        </span>
      </div>

      {/* Datasets Section */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Verified Geospatial Datasets
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {datasets.length} version{datasets.length === 1 ? '' : 's'} available
          </span>
        </div>

        {datasets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '8px', fontSize: '14px' }}>No datasets published yet.</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Click &quot;Trigger Pipeline Run&quot; above to ingest approved field submissions into the Gold layer.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {datasets.map((ds) => (
              <div
                key={ds.dataset_version}
                style={{
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  background: 'var(--bg-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                      Dataset {ds.dataset_version}
                    </span>
                    <span className="consensus-badge" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                      {ds.total_observations} Observations
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Quality Score: {ds.avg_quality_score.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Artifacts:{' '}
                    {Object.entries(ds.artifact_types)
                      .map(([type, count]) => `${type}: ${count}`)
                      .join(' • ') || 'Various'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Download Buttons */}
                  <a
                    href={getDownloadUrl(ds.dataset_version, 'geojson')}
                    target="_blank"
                    rel="noreferrer"
                    className="action-btn"
                    style={{ fontSize: '12px', padding: '6px 10px', textDecoration: 'none' }}
                  >
                    ⬇ GeoJSON
                  </a>
                  <a
                    href={getDownloadUrl(ds.dataset_version, 'json')}
                    target="_blank"
                    rel="noreferrer"
                    className="action-btn"
                    style={{ fontSize: '12px', padding: '6px 10px', textDecoration: 'none' }}
                  >
                    ⬇ JSON
                  </a>
                  <a
                    href={getDownloadUrl(ds.dataset_version, 'csv')}
                    target="_blank"
                    rel="noreferrer"
                    className="action-btn"
                    style={{ fontSize: '12px', padding: '6px 10px', textDecoration: 'none' }}
                  >
                    ⬇ CSV
                  </a>

                  {/* Sync to Downstream */}
                  <button
                    type="button"
                    className="action-btn action-btn-primary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => handleSyncLoupe(ds.dataset_version)}
                    disabled={syncingVersion === ds.dataset_version}
                  >
                    {syncingVersion === ds.dataset_version ? 'Syncing...' : 'Publish to Downstream ↗'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Downstream Sync Result Banner */}
      {syncResult && (
        <div style={{
          background: syncResult.dispatch_mode === 'live' ? '#ecfdf5' : '#eff6ff',
          border: `1px solid ${syncResult.dispatch_mode === 'live' ? '#a7f3d0' : '#bae6fd'}`,
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          fontSize: '13px',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            ✓ Verified Data Downstream Sync: {syncResult.status} ({syncResult.dispatch_mode})
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Endpoint: <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: '4px' }}>{syncResult.endpoint}</code> •{' '}
            Delivered: {syncResult.record_count} features • Checksum: {syncResult.checksum_sha256.slice(0, 16)}...
          </div>
        </div>
      )}

      {/* Historical Pipeline Runs */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Pipeline Execution History
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {runs.length} total run{runs.length === 1 ? '' : 's'}
          </span>
        </div>

        {runs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
            No pipeline executions recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 12px' }}>Run ID</th>
                  <th style={{ padding: '8px 12px' }}>Version</th>
                  <th style={{ padding: '8px 12px' }}>Mode</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Extracted</th>
                  <th style={{ padding: '8px 12px' }}>Loaded</th>
                  <th style={{ padding: '8px 12px' }}>Skipped</th>
                  <th style={{ padding: '8px 12px' }}>Time</th>
                  <th style={{ padding: '8px 12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  let statusBg = '#ecfdf5';
                  let statusColor = '#065f46';
                  let statusBorder = '#a7f3d0';
                  if (r.status === 'RUNNING') {
                    statusBg = '#eff6ff';
                    statusColor = '#1d4ed8';
                    statusBorder = '#bfdbfe';
                  } else if (r.status === 'FAILED') {
                    statusBg = '#fef2f2';
                    statusColor = '#991b1b';
                    statusBorder = '#fecaca';
                  } else if (r.status === 'RETRYING') {
                    statusBg = '#fffbeb';
                    statusColor = '#92400e';
                    statusBorder = '#fde68a';
                  }

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px' }}>
                        {r.id.slice(0, 8)}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.dataset_version}</td>
                      <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{r.run_type}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          className="consensus-badge"
                          style={{ background: statusBg, color: statusColor, borderColor: statusBorder }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{r.records_extracted}</td>
                      <td style={{ padding: '10px 12px', color: '#059669', fontWeight: 600 }}>{r.records_loaded}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{r.records_skipped}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.status === 'FAILED' && (
                          <button
                            type="button"
                            className="action-btn"
                            style={{ fontSize: '11px', padding: '4px 8px', color: '#b91c1c' }}
                            onClick={() => handleRetryRun(r.id)}
                          >
                            Retry ↺
                          </button>
                        )}
                        {r.status === 'COMPLETED' && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verified ✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trigger Run Modal */}
      {isTriggerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Trigger Downstream ETL Pipeline</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsTriggerModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Target Dataset Version
                </label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={datasetVersionInput}
                  onChange={(e) => setDatasetVersionInput(e.target.value)}
                  placeholder="e.g. v1.0.0 or v2026.10"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Run Mode
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="runType"
                      checked={runTypeInput === 'incremental'}
                      onChange={() => setRunTypeInput('incremental')}
                    />
                    <span>Incremental (Newly approved only)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="runType"
                      checked={runTypeInput === 'full_refresh'}
                      onChange={() => setRunTypeInput('full_refresh')}
                    />
                    <span>Full Refresh</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Artifact Filter (Optional)
                </label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={artifactFilterInput}
                  onChange={(e) => setArtifactFilterInput(e.target.value)}
                  placeholder="e.g. solar_installation (leave blank for all)"
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                ℹ Extracts only finalized, approved submissions with quorum consensus. Packages GeoJSON, JSON, and CSV exports with SHA-256 integrity checksums.
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px' }}>
              <button
                type="button"
                className="action-btn"
                onClick={() => setIsTriggerModalOpen(false)}
                disabled={triggering}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-btn action-btn-primary"
                onClick={handleTriggerRun}
                disabled={triggering}
              >
                {triggering ? 'Executing Pipeline...' : 'Start ETL Execution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
