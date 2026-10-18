'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { AdminTaskItem } from './OverviewTab';
import {
  SPREADSHEET_PROJECT_TYPES,
  SPREADSHEET_SECTIONS,
  SPREADSHEET_FACTORS,
  EXCLUDED_YELLOW_FACTORS,
  type SpreadsheetFactor,
  type SpreadsheetSection,
  type SpreadsheetProjectType,
} from '../data/spreadsheetData';

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

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type DataScarcityLevel = 'readily_available' | 'limited' | 'rare';
export type DataAvailabilityLevel = DataScarcityLevel | 'low' | 'medium' | 'high';

export const DIFFICULTY_NUMERIC_MAP: Record<DifficultyLevel, number> = {
  easy: 1.0,
  medium: 2.5,
  hard: 4.0,
};

export const DATA_SCARCITY_NUMERIC_MAP: Record<DataScarcityLevel, number> = {
  readily_available: 1.0,
  limited: 2.0,
  rare: 3.0,
};

export const DATA_AVAILABILITY_NUMERIC_MAP: Record<string, number> = {
  ...DATA_SCARCITY_NUMERIC_MAP,
  low: 1.0,
  medium: 2.0,
  high: 3.0,
};

export interface FieldExplanation {
  title: string;
  text: string;
  options?: Array<{ label: string; desc: string }>;
}

export const TASK_ECONOMICS_EXPLANATIONS: Record<string, FieldExplanation> = {
  baseReward: {
    title: 'Base Reward',
    text: 'The starting token reward for successfully completing the task. The final reward may depend on the existing reward calculation rules.',
  },
  commitmentStake: {
    title: 'Commitment Stake',
    text: 'Tokens temporarily locked when reserving a task. The stake is handled according to the existing verification, settlement, and refund rules.',
  },
  taskDifficulty: {
    title: 'Task Difficulty',
    text: 'Indicates the effort and verification required from contributors:',
    options: [
      { label: 'Easy', desc: 'A straightforward task requiring relatively little effort.' },
      { label: 'Medium', desc: 'A task requiring a moderate amount of effort or verification.' },
      { label: 'Hard', desc: 'A task requiring greater effort, complexity, or verification.' },
    ],
  },
  dataScarcity: {
    title: 'Data Scarcity',
    text: 'Indicates how difficult it is to obtain suitable data for this task. This setting may affect the internal reward calculation.',
    options: [
      { label: 'Readily Available', desc: 'Suitable data is easy to obtain.' },
      { label: 'Limited', desc: 'Suitable data exists, but coverage is incomplete or access is difficult.' },
      { label: 'Rare', desc: 'Suitable data is difficult to find or largely missing.' },
    ],
  },
  dataAvailability: {
    title: 'Data Scarcity',
    text: 'Indicates how difficult it is to obtain suitable data for this task. This setting may affect the internal reward calculation.',
    options: [
      { label: 'Readily Available', desc: 'Suitable data is easy to obtain.' },
      { label: 'Limited', desc: 'Suitable data exists, but coverage is incomplete or access is difficult.' },
      { label: 'Rare', desc: 'Suitable data is difficult to find or largely missing.' },
    ],
  },
  estimatedEffort: {
    title: 'Estimated Effort (minutes)',
    text: 'The approximate time a contributor may need to complete the task.',
  },
};

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
  const [artifactType, setArtifactType] = useState('Real Estate Development');
  const [latitude, setLatitude] = useState('18.5204');
  const [longitude, setLongitude] = useState('73.8567');
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [geographicScope, setGeographicScope] = useState('Spatial Parcel Boundary (SRID 4326)');
  const [requiredEvidence, setRequiredEvidence] = useState(
    'Official Title / Cadastral Deed Certificate (PDF / Image)\n' +
    'Zoning & Planning Authority Permitted Use Notice\n' +
    'Ground-truth Geotagged Site Inspection Photographs\n' +
    'Government Portal or GIS Registry Evidence URL'
  );
  const [requiredFields, setRequiredFields] = useState('Disputed Ownership, Flood Risk, Road Connectivity, Soil Permeability');
  const [mediaRequirements, setMediaRequirements] = useState('Title Documents, Topographical Survey, Site Photos (up to 50 files)');
  const [baseReward, setBaseReward] = useState('250');
  const [commitmentStake, setCommitmentStake] = useState('30');
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('medium');
  const [dataScarcity, setDataScarcity] = useState<DataScarcityLevel>('limited');
  const [effortMinutes, setEffortMinutes] = useState('45');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [selectedDomain, setSelectedDomain] = useState<string>('Tenure & Governance');
  const [selectedFactors, setSelectedFactors] = useState<string[]>(() =>
    SPREADSHEET_FACTORS.filter((f: SpreadsheetFactor) => f.relevance.includes('Real Estate Development')).map((f: SpreadsheetFactor) => f.id)
  );

  // Task Economics Field Info Popover State
  const [activeInfoField, setActiveInfoField] = useState<string | null>(null);

  const renderInfoIcon = (fieldKey: string, align: 'left' | 'center' | 'right' = 'center') => {
    const isActive = activeInfoField === fieldKey;
    const info = TASK_ECONOMICS_EXPLANATIONS[fieldKey];
    if (!info) return null;

    const popoverPositionStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: 'calc(100% + 10px)',
      width: '280px',
      maxWidth: 'calc(100vw - 36px)',
      backgroundColor: '#EAF7EE',
      color: '#1E293B',
      borderRadius: '8px',
      padding: '12px 14px',
      boxShadow: '0 10px 25px -5px rgba(16, 24, 40, 0.12), 0 8px 10px -6px rgba(16, 24, 40, 0.08)',
      zIndex: 1000,
      fontSize: '12px',
      lineHeight: 1.45,
      border: '1px solid #B7DEC1',
      textAlign: 'left',
    };

    const arrowStyle: React.CSSProperties = {
      position: 'absolute',
      top: '100%',
      width: 0,
      height: 0,
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
      borderTop: '6px solid #B7DEC1',
    };

    if (align === 'left') {
      popoverPositionStyle.left = '-10px';
      arrowStyle.left = '16px';
    } else if (align === 'right') {
      popoverPositionStyle.right = '-10px';
      popoverPositionStyle.left = 'auto';
      arrowStyle.right = '16px';
    } else {
      popoverPositionStyle.left = '50%';
      popoverPositionStyle.transform = 'translateX(-50%)';
      arrowStyle.left = '50%';
      arrowStyle.transform = 'translateX(-50%)';
    }

    return (
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveInfoField(isActive ? null : fieldKey);
          }}
          aria-label={`Info for ${info.title}`}
          style={{
            background: isActive ? '#ECFDF5' : '#F2F4F7',
            color: isActive ? '#15803D' : '#344054',
            border: isActive ? '1px solid #15803D' : '1px solid #D0D5DD',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '11px',
            lineHeight: '14px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s ease',
          }}
          title={info.title}
        >
          i
        </button>

        {isActive && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={popoverPositionStyle}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #D1EAD7', paddingBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#166534', fontSize: '12.5px' }}>
                {info.title}
              </span>
              <button
                type="button"
                onClick={() => setActiveInfoField(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#475467',
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: '0 2px',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Close tooltip"
              >
                ✕
              </button>
            </div>

            <div style={{ color: '#1E293B', fontSize: '11.5px', lineHeight: 1.45 }}>
              {info.text}
            </div>

            {info.options && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #D1EAD7', paddingTop: '6px' }}>
                {info.options.map((opt) => (
                  <div key={opt.label} style={{ fontSize: '11px', color: '#1E293B', lineHeight: 1.4 }}>
                    <strong style={{ color: '#166534' }}>{opt.label}:</strong> {opt.desc}
                  </div>
                ))}
              </div>
            )}

            <div style={arrowStyle} />
          </div>
        )}
      </span>
    );
  };

  if (!isOpen) return null;

  const currentProjectType = SPREADSHEET_PROJECT_TYPES[artifactType] || SPREADSHEET_PROJECT_TYPES['Real Estate Development'];

  const handleArtifactTypeChange = (newType: string) => {
    setArtifactType(newType);
    const relevant = SPREADSHEET_FACTORS.filter((f: SpreadsheetFactor) => f.relevance.includes(newType)).map((f: SpreadsheetFactor) => f.id);
    setSelectedFactors(relevant);
    const pt = SPREADSHEET_PROJECT_TYPES[newType];
    if (pt) {
      setDescription(`Assess parcel suitability for ${newType}. Verify tenure security, environmental risk factors, and development access parameters.`);
    }
  };

  const loadSpreadsheetPreset = () => {
    setTitle('Real Estate Development - Site Due Diligence & Zoning Survey');
    setDescription(SPREADSHEET_PROJECT_TYPES['Real Estate Development'].description);
    setArtifactType('Real Estate Development');
    setLatitude('18.5204');
    setLongitude('73.8567');
    setGeographicScope('Spatial Parcel Boundary (SRID 4326)');
    setRequiredEvidence(
      'Official Title / Cadastral Deed Certificate (PDF / Image)\n' +
      'Zoning & Planning Authority Permitted Use Notice\n' +
      'Ground-truth Geotagged Site Inspection Photographs\n' +
      'Government Portal or GIS Registry Evidence URL'
    );
    setRequiredFields('Disputed Ownership, Flood Risk, Road Connectivity, Soil Permeability');
    setMediaRequirements('Title Documents, Topographical Survey, Site Photos (up to 50 files)');
    setBaseReward('250');
    setCommitmentStake('30');
    setDifficultyLevel('medium');
    setDataScarcity('limited');
    setEffortMinutes('45');
    setStatus('published');
    setSelectedFactors(SPREADSHEET_FACTORS.filter((f: SpreadsheetFactor) => f.relevance.includes('Real Estate Development')).map((f: SpreadsheetFactor) => f.id));
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
        difficulty: DIFFICULTY_NUMERIC_MAP[difficultyLevel] ?? 2.5,
        scarcity: DATA_SCARCITY_NUMERIC_MAP[dataScarcity] ?? 2.0,
        base_reward: parseInt(baseReward, 10) || 50,
        commitment_stake: parseInt(commitmentStake, 10) || 10,
        estimated_effort_minutes: parseInt(effortMinutes, 10) || 45,
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
      <div className="modal-card" onClick={(e) => { e.stopPropagation(); if (activeInfoField) setActiveInfoField(null); }} style={{ maxWidth: '960px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create Spreadsheet-Driven Task</h2>
            <div className="modal-subtitle">Configured from Google Sheets (7 Project Types &amp; 29 Assessment Factors)</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={loadSpreadsheetPreset}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>⚡ Load Spreadsheet Preset</span>
            </button>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '74vh' }}>
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
                {/* 1. Basic Information & Spreadsheet Project Type */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', color: '#15803D', fontSize: '11px', fontWeight: 800 }}>1</span>
                    <span>Basic Information &amp; Project Type (Tab 1)</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Task Title</label>
                    <input
                      type="text"
                      className="form-input-text"
                      placeholder="e.g. Commercial Site Due Diligence & Zoning Survey"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description &amp; Objective</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Specify observation goals, required accuracy, and target feature details..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Project Type (Source: Tab 1)</label>
                      {currentProjectType && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
                          Target Profile: {currentProjectType.user_profile}
                        </span>
                      )}
                    </div>
                    <select
                      className="form-select"
                      value={artifactType}
                      onChange={(e) => handleArtifactTypeChange(e.target.value)}
                    >
                      {Object.values(SPREADSHEET_PROJECT_TYPES).map((pt: SpreadsheetProjectType) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.title} ({pt.user_profile})
                        </option>
                      ))}
                    </select>
                    {currentProjectType && (
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', lineHeight: 1.4 }}>
                        {currentProjectType.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* 1B. Spreadsheet Assessment Factors Checklist (Tab 2: 29 Factors) */}
                <div className="form-section">
                  <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', color: '#15803D', fontSize: '11px', fontWeight: 800 }}>✓</span>
                      <span>Assessment Factors ({selectedFactors.length} Active / 29 Total)</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Source: Tab 2</span>
                  </div>

                  {/* Informational Notice: 10 Field Questions vs 6 Automated Factors */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    marginBottom: '10px',
                    fontSize: '11px',
                    color: '#166534',
                  }}>
                    <span>💡</span>
                    <span>
                      Contributor field survey is streamlined to a <strong>maximum of 10 observable questions</strong>. The 6 yellow-highlighted factors and GIS metrics are processed by automated backend pipelines.
                    </span>
                  </div>

                  {/* Domain Tabs */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {SPREADSHEET_SECTIONS.map((sec: SpreadsheetSection) => {
                      const isDomainActive = selectedDomain === sec.title;
                      const count = SPREADSHEET_FACTORS.filter((f: SpreadsheetFactor) => f.section === sec.title && selectedFactors.includes(f.id)).length;
                      const total = SPREADSHEET_FACTORS.filter((f: SpreadsheetFactor) => f.section === sec.title).length;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setSelectedDomain(sec.title)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: isDomainActive ? 700 : 500,
                            borderRadius: '6px',
                            border: isDomainActive ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                            background: isDomainActive ? '#ECFDF5' : '#FFFFFF',
                            color: isDomainActive ? '#065F46' : '#64748B',
                            cursor: 'pointer',
                          }}
                        >
                          {sec.icon} {sec.title} ({count}/{total})
                        </button>
                      );
                    })}
                  </div>

                  {/* Factor items checklist */}
                  <div style={{ maxHeight: '190px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px', background: '#FAFAFA' }}>
                    {SPREADSHEET_FACTORS.filter((f: SpreadsheetFactor) => f.section === selectedDomain).map((factor: SpreadsheetFactor) => {
                      const isChecked = selectedFactors.includes(factor.id);
                      return (
                        <label
                          key={factor.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: isChecked ? '#FFFFFF' : 'transparent',
                            border: isChecked ? '1px solid #E2E8F0' : '1px solid transparent',
                            cursor: 'pointer',
                            fontSize: '12px',
                            marginBottom: '4px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFactors((prev) => [...prev, factor.id]);
                              } else {
                                setSelectedFactors((prev) => prev.filter((id) => id !== factor.id));
                              }
                            }}
                            style={{ marginTop: '3px' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, color: '#0F172A' }}>{factor.label}</span>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: factor.factor_type === 'Risk' ? '#FEF2F2' : '#F0FDF4',
                                color: factor.factor_type === 'Risk' ? '#B91C1C' : '#15803D',
                              }}>
                                {factor.factor_type}
                              </span>
                              {EXCLUDED_YELLOW_FACTORS.some((yf) => yf.factor.toLowerCase() === factor.label.toLowerCase()) && (
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: '#FEF9C3',
                                  color: '#854D0E',
                                  border: '1px solid #FDE047',
                                }}>
                                  Automated GIS
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                              <strong>Metric:</strong> {factor.metric}
                            </div>
                          </div>
                        </label>
                      );
                    })}
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

                {/* 4. Task Economics */}
                <div className="form-section">
                  <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', color: '#15803D', fontSize: '11px', fontWeight: 800 }}>4</span>
                      <span>Task Economics &amp; Incentives</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#15803D', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                      Horizon Escrow Protocol
                    </span>
                  </div>

                  {/* Polished, Aligned Economics Card Container */}
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Row 1: Token Rewards & Commitment Stake */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '24px', marginBottom: '6px' }}>
                          <label className="form-label" style={{ marginBottom: 0, fontSize: '12px', fontWeight: 600, color: '#344054' }}>
                            Base Reward (Tokens)
                          </label>
                          {renderInfoIcon('baseReward', 'left')}
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="form-input-text"
                            value={baseReward}
                            onChange={(e) => setBaseReward(e.target.value)}
                            style={{ height: '42px', boxSizing: 'border-box', width: '100%', fontSize: '13px', paddingRight: '48px', borderRadius: '8px', border: '1px solid #D0D5DD', background: '#FFFFFF' }}
                            placeholder="50"
                            min={1}
                          />
                          <span style={{ position: 'absolute', right: '12px', fontSize: '11px', fontWeight: 700, color: '#15803D', pointerEvents: 'none' }}>
                            TKN
                          </span>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '24px', marginBottom: '6px' }}>
                          <label className="form-label" style={{ marginBottom: 0, fontSize: '12px', fontWeight: 600, color: '#344054' }}>
                            Commitment Stake (Tokens)
                          </label>
                          {renderInfoIcon('commitmentStake', 'right')}
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="form-input-text"
                            value={commitmentStake}
                            onChange={(e) => setCommitmentStake(e.target.value)}
                            style={{ height: '42px', boxSizing: 'border-box', width: '100%', fontSize: '13px', paddingRight: '48px', borderRadius: '8px', border: '1px solid #D0D5DD', background: '#FFFFFF' }}
                            placeholder="10"
                            min={0}
                          />
                          <span style={{ position: 'absolute', right: '12px', fontSize: '11px', fontWeight: 700, color: '#B45309', pointerEvents: 'none' }}>
                            TKN
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Difficulty, Scarcity, and Estimated Effort (Strictly Aligned) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '24px', marginBottom: '6px' }}>
                          <label className="form-label" style={{ marginBottom: 0, fontSize: '12px', fontWeight: 600, color: '#344054', whiteSpace: 'nowrap' }}>
                            Task Difficulty
                          </label>
                          {renderInfoIcon('taskDifficulty', 'left')}
                        </div>
                        <select
                          className="form-select"
                          value={difficultyLevel}
                          onChange={(e) => setDifficultyLevel(e.target.value as DifficultyLevel)}
                          aria-label="Task Difficulty"
                          style={{ height: '42px', boxSizing: 'border-box', width: '100%', fontSize: '13px', borderRadius: '8px', border: '1px solid #D0D5DD', background: '#FFFFFF', padding: '0 10px' }}
                        >
                          <option value="easy">Easy (1.0x)</option>
                          <option value="medium">Medium (2.5x)</option>
                          <option value="hard">Hard (4.0x)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '24px', marginBottom: '6px' }}>
                          <label className="form-label" style={{ marginBottom: 0, fontSize: '12px', fontWeight: 600, color: '#344054', whiteSpace: 'nowrap' }}>
                            Data Scarcity
                          </label>
                          {renderInfoIcon('dataScarcity', 'center')}
                        </div>
                        <select
                          className="form-select"
                          value={dataScarcity}
                          onChange={(e) => setDataScarcity(e.target.value as DataScarcityLevel)}
                          aria-label="Data Scarcity"
                          style={{ height: '42px', boxSizing: 'border-box', width: '100%', fontSize: '13px', borderRadius: '8px', border: '1px solid #D0D5DD', background: '#FFFFFF', padding: '0 10px' }}
                        >
                          <option value="readily_available">Readily Available</option>
                          <option value="limited">Limited</option>
                          <option value="rare">Rare</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '24px', marginBottom: '6px' }}>
                          <label className="form-label" style={{ marginBottom: 0, fontSize: '12px', fontWeight: 600, color: '#344054', whiteSpace: 'nowrap' }}>
                            Estimated Effort (min)
                          </label>
                          {renderInfoIcon('estimatedEffort', 'right')}
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="form-input-text"
                            value={effortMinutes}
                            onChange={(e) => setEffortMinutes(e.target.value)}
                            placeholder="45"
                            min={5}
                            style={{ height: '42px', boxSizing: 'border-box', width: '100%', fontSize: '13px', paddingRight: '40px', borderRadius: '8px', border: '1px solid #D0D5DD', background: '#FFFFFF' }}
                          />
                          <span style={{ position: 'absolute', right: '12px', fontSize: '11px', color: '#64748B', pointerEvents: 'none' }}>
                            min
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Live Financial Economics Live Metrics */}
                    <div style={{ paddingTop: '10px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748B', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⚡ Hourly Payout Rate:</span>
                        <strong style={{ color: '#15803D', fontWeight: 700 }}>
                          {effortMinutes && Number(effortMinutes) > 0
                            ? `~${((Number(baseReward) || 0) / (Number(effortMinutes) / 60)).toFixed(0)} TKN/hr`
                            : '—'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔒 Commitment Stake Ratio:</span>
                        <strong style={{ color: '#B45309', fontWeight: 700 }}>
                          {baseReward && Number(baseReward) > 0
                            ? `${(((Number(commitmentStake) || 0) / Number(baseReward)) * 100).toFixed(0)}%`
                            : '0%'}
                        </strong>
                        <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>(refunded upon approval)</span>
                      </div>
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

              {/* Right Column: User Preview */}
              <div className="preview-card-wrap">
                <div className="preview-tag">User Preview</div>
                <div className="preview-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="badge-artifact">
                      {artifactType.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 700 }}>
                      Proximity Ready · ~{effortMinutes || 45} minutes
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
