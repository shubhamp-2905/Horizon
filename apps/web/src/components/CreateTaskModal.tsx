'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { AdminTaskItem } from './OverviewTab';

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '240px',
        background: '#F8F9FA',
        borderRadius: '10px',
        border: '1px solid #EAECF0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#667085',
        fontSize: '13px',
      }}
    >
      🗺️ Loading Interactive Spatial Map...
    </div>
  ),
});

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
  const [showManualCoords, setShowManualCoords] = useState(false);
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
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create Geospatial Task</h2>
            <div className="modal-subtitle">Configure spatial boundaries, telemetry requirements, and economic rewards</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={loadDemoPreset}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>⚡ Load Spatial Preset</span>
            </button>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '72vh' }}>
            {validationError && (
              <div style={{
                background: '#FEF3F2',
                border: '1px solid #FECDCA',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#B42318',
                fontSize: '12px',
                marginBottom: '16px',
                fontWeight: 600,
              }}>
                {validationError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: '28px', alignItems: 'start' }}>
              {/* Left Column: Structured Form Sections */}
              <div>
                {/* 1. Basic Information */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', color: '#15803D', fontSize: '11px', fontWeight: 800 }}>1</span>
                    <span>Basic Information</span>
                  </div>
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
                      rows={3}
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
                  <div className="form-section-title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', color: '#15803D', fontSize: '11px', fontWeight: 800 }}>2</span>
                    <span>Location &amp; Spatial Scope (WGS84)</span>
                  </div>

                  {/* Interactive Map Pin Selector & Address Search */}
                  <div style={{ marginBottom: '14px' }}>
                    <LocationPickerMap
                      latitude={parseFloat(latitude) || 18.5204}
                      longitude={parseFloat(longitude) || 73.8567}
                      onChange={(newLat, newLng) => {
                        setLatitude(newLat.toFixed(6));
                        setLongitude(newLng.toFixed(6));
                        setValidationError(null);
                      }}
                      radiusMeters={50}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label className="form-label">Geographic Scope</label>
                    <input
                      type="text"
                      className="form-input-text"
                      value={geographicScope}
                      onChange={(e) => setGeographicScope(e.target.value)}
                      placeholder="Point Observation (Radius 50m)"
                    />
                  </div>

                  {/* Collapsible Manual Coordinates Override */}
                  <div style={{ paddingTop: '2px' }}>
                    <button
                      type="button"
                      onClick={() => setShowManualCoords(!showManualCoords)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#667085',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: '2px 0',
                        textDecoration: 'underline',
                        fontWeight: 500,
                      }}
                    >
                      {showManualCoords ? '▲ Hide manual coordinates' : '▼ Fine-tune coordinates manually'}
                    </button>

                    {showManualCoords && (
                      <div className="form-grid" style={{ marginTop: '8px', marginBottom: 0 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Latitude (°N)</label>
                          <input
                            type="text"
                            className="form-input-text"
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            placeholder="18.5204"
                            style={{ fontSize: '12px', height: '34px' }}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Longitude (°E)</label>
                          <input
                            type="text"
                            className="form-input-text"
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            placeholder="73.8567"
                            style={{ fontSize: '12px', height: '34px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Task Requirements */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', color: '#15803D', fontSize: '11px', fontWeight: 800 }}>3</span>
                    <span>Task Requirements</span>
                  </div>
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
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Required Form Fields</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={requiredFields}
                        onChange={(e) => setRequiredFields(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
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

                {/* 4. Economics & Escrow Stake */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', color: '#15803D', fontSize: '11px', fontWeight: 800 }}>4</span>
                    <span>Economics &amp; Escrow Stake</span>
                  </div>
                  <div className="form-grid" style={{ marginBottom: '14px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Base Reward (Tokens)</label>
                      <input
                        type="number"
                        className="form-input-text"
                        value={baseReward}
                        onChange={(e) => setBaseReward(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Commitment Stake (Tokens)</label>
                      <input
                        type="number"
                        className="form-input-text"
                        value={commitmentStake}
                        onChange={(e) => setCommitmentStake(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Difficulty Factor</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Scarcity Multiplier</label>
                      <input
                        type="text"
                        className="form-input-text"
                        value={scarcity}
                        onChange={(e) => setScarcity(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
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
                  <div className="form-section-title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', color: '#15803D', fontSize: '11px', fontWeight: 800 }}>5</span>
                    <span>Publishing State</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: status === 'published' ? '1.5px solid #15803D' : '1px solid #D0D5DD',
                        background: status === 'published' ? '#F0FDF4' : '#FFFFFF',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={status === 'published'}
                        onChange={() => setStatus('published')}
                        style={{ accentColor: '#15803D' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: status === 'published' ? '#15803D' : '#344054' }}>
                          Published
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          Open for contributor discovery
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: status === 'draft' ? '1.5px solid #475467' : '1px solid #D0D5DD',
                        background: status === 'draft' ? '#F8F9FA' : '#FFFFFF',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={status === 'draft'}
                        onChange={() => setStatus('draft')}
                        style={{ accentColor: '#475467' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: status === 'draft' ? '#101828' : '#344054' }}>
                          Draft
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          Saved internally, hidden from scouts
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Mobile Preview Card */}
              <div className="preview-card-wrap">
                <div className="preview-tag">LIVE CONTRIBUTOR MOBILE PREVIEW</div>
                <div className="preview-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="badge-artifact">
                      {artifactType.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 700 }}>
                      Proximity Ready · ~{effortMinutes || 25} min
                    </span>
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#101828', marginBottom: '8px', lineHeight: 1.3 }}>
                    {title || 'Untitled Geospatial Task'}
                  </div>

                  <div style={{ fontSize: '12px', color: '#475467', lineHeight: 1.5, marginBottom: '14px' }}>
                    {description || 'Task description summary will be displayed here to field contributors.'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #F2F4F7' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#ECFDF5', color: '#027A48', border: '1px solid #A6F4C5' }}>
                        +{baseReward || 150} TOKENS
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#FFFDF0', color: '#B54708', border: '1px solid #FEDF89' }}>
                        {commitmentStake || 20} STAKE
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                      Diff · {parseFloat(difficulty) <= 1.5 ? 'Easy' : parseFloat(difficulty) <= 2.5 ? 'Medium' : 'Hard'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '16px', padding: '16px', background: '#F8F9FA', borderRadius: '12px', border: '1px solid #EAECF0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#475467', marginBottom: '6px', letterSpacing: '0.8px' }}>
                    SPATIAL SPECIFICATION
                  </div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#101828', wordBreak: 'break-all' }}>
                    PostGIS: POINT({longitude} {latitude})
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
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
