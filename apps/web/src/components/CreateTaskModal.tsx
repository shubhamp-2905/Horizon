'use client';

import React, { useState } from 'react';
import type { AdminTaskItem } from './OverviewTab';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newTask: Omit<AdminTaskItem, 'id' | 'created_at'>) => Promise<void>;
  loading: boolean;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artifactType, setArtifactType] = useState('water_source');
  const [latitude, setLatitude] = useState('18.5204');
  const [longitude, setLongitude] = useState('73.8567');
  const [geographicScope, setGeographicScope] = useState('Point Observation (Radius 50m)');
  const [requiredEvidence, setRequiredEvidence] = useState('2 geotagged high-resolution photographs\nPhysical condition confirmation');
  const [requiredFields, setRequiredFields] = useState('Operating condition, Water flow rate');
  const [mediaRequirements, setMediaRequirements] = useState('Wide contextual overview, Close-up label');
  const [baseReward, setBaseReward] = useState('150');
  const [commitmentStake, setCommitmentStake] = useState('20');
  const [difficulty, setDifficulty] = useState('2.0');
  const [scarcity, setScarcity] = useState('1.5');
  const [effortMinutes, setEffortMinutes] = useState('25');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const loadDemoPreset = () => {
    setTitle('Community Water Source Survey');
    setDescription('Survey and verify public water dispensary status, flow rate, and contamination risk.');
    setArtifactType('water_source');
    setLatitude('18.5204');
    setLongitude('73.8567');
    setGeographicScope('Point Observation (SRID 4326)');
    setRequiredEvidence('2 geotagged photos\nFlow rate test\nSafety label verification');
    setRequiredFields('Dispensary condition, Flow rate (L/min), Water clarity');
    setMediaRequirements('Ground level entrance photo, Dispenser serial barcode');
    setBaseReward('150');
    setCommitmentStake('20');
    setDifficulty('2.0');
    setScarcity('1.5');
    setEffortMinutes('25');
    setStatus('published');
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError('Task Title is required.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setValidationError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setValidationError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    const requirementsList = requiredEvidence
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        artifact_type: artifactType,
        status,
        difficulty: parseFloat(difficulty) || 1.0,
        scarcity: parseFloat(scarcity) || 1.0,
        base_reward: parseInt(baseReward, 10) || 50,
        commitment_stake: parseInt(commitmentStake, 10) || 10,
        estimated_effort_minutes: parseInt(effortMinutes, 10) || 25,
        latitude: latNum,
        longitude: lngNum,
        requirements: requirementsList.length > 0 ? requirementsList : ['Geotagged ground observation'],
      });
      onClose();
    } catch {
      // Error handled by parent toast
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="modal-title">Create Geospatial Task</h2>
            <button
              type="button"
              onClick={loadDemoPreset}
              className="btn btn-secondary btn-sm"
            >
              Load Demo Preset
            </button>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '72vh' }}>
            {validationError && (
              <div style={{
                background: 'var(--status-error-subtle)',
                border: '1px solid var(--status-error)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'var(--status-error)',
                fontSize: '12px',
                marginBottom: '16px',
                fontWeight: 600,
              }}>
                {validationError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
              {/* Left Column: Form Fields */}
              <div>
                {/* 1. Basic Information */}
                <div className="form-section">
                  <div className="form-section-title">1. Basic Information</div>
                  <div className="form-group">
                    <label className="form-label">Task Title</label>
                    <input
                      type="text"
                      className="form-input-text"
                      placeholder="e.g. Community Water Source Survey"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description & Objective</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Specify observation goals, required accuracy, and target feature details..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Artifact Category</label>
                    <select
                      className="form-select"
                      value={artifactType}
                      onChange={(e) => setArtifactType(e.target.value)}
                    >
                      <option value="water_source">Water Source</option>
                      <option value="solar_installation">Solar Installation</option>
                      <option value="traffic_flow">Traffic Flow</option>
                      <option value="emergency_shelter">Emergency Shelter</option>
                      <option value="telecom_tower">Telecom Tower</option>
                      <option value="infrastructure">Public Infrastructure</option>
                    </select>
                  </div>
                </div>

                {/* 2. Location & Geographic Scope */}
                <div className="form-section">
                  <div className="form-section-title">2. Location & Spatial Scope (WGS84)</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Latitude</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="18.5204"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Longitude</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="73.8567"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Geographic Scope</label>
                    <input
                      type="text"
                      className="form-input-text"
                      value={geographicScope}
                      onChange={(e) => setGeographicScope(e.target.value)}
                    />
                  </div>
                </div>

                {/* 3. Task Requirements */}
                <div className="form-section">
                  <div className="form-section-title">3. Task Requirements</div>
                  <div className="form-group">
                    <label className="form-label">Required Evidence (one per line)</label>
                    <textarea
                      className="form-textarea"
                      value={requiredEvidence}
                      onChange={(e) => setRequiredEvidence(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Required Form Fields</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={requiredFields}
                        onChange={(e) => setRequiredFields(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Media Requirements</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={mediaRequirements}
                        onChange={(e) => setMediaRequirements(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Economics & Stake */}
                <div className="form-section">
                  <div className="form-section-title">4. Economics & Escrow Stake</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Base Reward (Tokens)</label>
                      <input
                        type="number"
                        className="form-input-text"
                        value={baseReward}
                        onChange={(e) => setBaseReward(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Commitment Stake (Tokens)</label>
                      <input
                        type="number"
                        className="form-input-text"
                        value={commitmentStake}
                        onChange={(e) => setCommitmentStake(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Difficulty Factor</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Scarcity Multiplier</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={scarcity}
                        onChange={(e) => setScarcity(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Estimated Effort (min)</label>
                      <input
                        type="number"
                        className="form-input-text"
                        value={effortMinutes}
                        onChange={(e) => setEffortMinutes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Publishing Status */}
                <div className="form-section" style={{ marginBottom: 0 }}>
                  <div className="form-section-title">5. Publishing State</div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="radio"
                        name="status"
                        checked={status === 'published'}
                        onChange={() => setStatus('published')}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>
                        Published (Immediately open for contributor discovery)
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="radio"
                        name="status"
                        checked={status === 'draft'}
                        onChange={() => setStatus('draft')}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        Draft (Saved internally)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Mobile Preview */}
              <div>
                <div className="preview-tag">LIVE CONTRIBUTOR MOBILE PREVIEW</div>
                <div className="preview-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="badge-artifact">
                      {artifactType.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                      Proximity Ready · ~{effortMinutes || 25} min
                    </span>
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {title || 'Untitled Geospatial Task'}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '12px' }}>
                    {description || 'Task description summary will be displayed here to field contributors.'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className="badge-token">+{baseReward || 150} TOKENS</span>
                      <span className="badge-stake">{commitmentStake || 20} STAKE</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Diff · {parseFloat(difficulty) <= 1.5 ? 'Easy' : parseFloat(difficulty) <= 2.5 ? 'Medium' : 'Hard'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.8px' }}>
                    SPATIAL SPECIFICATION
                  </div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    PostGIS: POINT({longitude} {latitude})
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    SRID: 4326 (WGS84 Ellipsoid)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving to PostGIS...' : 'Save & Publish Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
