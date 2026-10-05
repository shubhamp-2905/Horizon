'use client';

import React, { useState } from 'react';
import {
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  ClockIcon,
  UsersIcon,
  ShieldCheckIcon,
} from './Icons';

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

export interface PeerReviewItem {
  id: string;
  reviewer_username: string;
  decision: 'APPROVE' | 'REJECT' | 'FLAG';
  notes?: string;
  created_at: string;
}

export interface ConsensusItem {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED';
  pool_size: number;
  quorum: number;
  total_votes: number;
  approve_votes: number;
  reject_votes: number;
  flag_votes: number;
  settlement_status: 'unsettled' | 'settled' | 'disputed';
  dispute_reason?: string;
  resolution_notes?: string;
  reviews: PeerReviewItem[];
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
  consensus: ConsensusItem;
  verification_status: 'pending' | 'approved' | 'rejected' | 'flagged' | 'disputed';
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
    consensus: {
      status: 'APPROVED',
      pool_size: 3,
      quorum: 2,
      total_votes: 2,
      approve_votes: 2,
      reject_votes: 0,
      flag_votes: 0,
      settlement_status: 'settled',
      reviews: [
        {
          id: 'pr_01',
          reviewer_username: 'reviewer_maya',
          decision: 'APPROVE',
          notes: 'High visual fidelity. Valve mechanism matches regional infrastructure type.',
          created_at: new Date(Date.now() - 3200000).toISOString(),
        },
        {
          id: 'pr_02',
          reviewer_username: 'reviewer_kiran',
          decision: 'APPROVE',
          notes: 'GPS telemetry confirmed against satellite basemap. All checks satisfied.',
          created_at: new Date(Date.now() - 3000000).toISOString(),
        },
      ],
    },
    verification_status: 'approved',
  },
  {
    id: 'sub_da052732_361d',
    task_id: '8a1c93f0-4521-419b-a012-78d91a2bc45e',
    task_title: 'Solar Mini-Grid Installation Check',
    artifact_type: 'renewable_energy',
    contributor_email: 'marcus.k@horizon.dev',
    status: 'under_review',
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
    consensus: {
      status: 'PENDING',
      pool_size: 3,
      quorum: 2,
      total_votes: 1,
      approve_votes: 1,
      reject_votes: 0,
      flag_votes: 0,
      settlement_status: 'unsettled',
      reviews: [
        {
          id: 'pr_03',
          reviewer_username: 'reviewer_maya',
          decision: 'APPROVE',
          notes: 'Array looks intact despite slight reflection on inverter readout.',
          created_at: new Date(Date.now() - 6500000).toISOString(),
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
    status: 'disputed',
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
    consensus: {
      status: 'DISPUTED',
      pool_size: 3,
      quorum: 2,
      total_votes: 2,
      approve_votes: 0,
      reject_votes: 1,
      flag_votes: 1,
      settlement_status: 'disputed',
      dispute_reason: 'Flagged for suspected stock photo re-upload and inaccurate GPS telemetry.',
      reviews: [
        {
          id: 'pr_04',
          reviewer_username: 'reviewer_kiran',
          decision: 'FLAG',
          notes: 'Suspected stock photo from web. EXIF creation date conflicts with submission time.',
          created_at: new Date(Date.now() - 10000000).toISOString(),
        },
        {
          id: 'pr_05',
          reviewer_username: 'reviewer_maya',
          decision: 'REJECT',
          notes: 'Unusable photo quality, severe blur, and missing second required photo.',
          created_at: new Date(Date.now() - 9800000).toISOString(),
        },
      ],
    },
    verification_status: 'disputed',
  },
];

export const SubmissionsTab: React.FC = () => {
  const [submissions, setSubmissions] = useState<AdminSubmissionItem[]>(DEMO_SUBMISSIONS);
  const [selectedSub, setSelectedSub] = useState<AdminSubmissionItem>(DEMO_SUBMISSIONS[0]);
  const [filter, setFilter] = useState<'all' | 'PASSED' | 'WARNING' | 'FAILED'>('all');
  const [customVoteNote, setCustomVoteNote] = useState<string>('');
  const [disputeReasonInput, setDisputeReasonInput] = useState<string>('');
  const [showDisputeModal, setShowDisputeModal] = useState<boolean>(false);

  const filtered = filter === 'all' ? submissions : submissions.filter((s) => s.validation_status === filter);

  // Direct Admin Action
  const handleDecision = (subId: string, decision: 'approved' | 'rejected') => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, verification_status: decision, status: decision } : s))
    );
    if (selectedSub && selectedSub.id === subId) {
      setSelectedSub({ ...selectedSub, verification_status: decision, status: decision });
    }
  };

  // Peer Review Action
  const handlePeerVote = (decision: 'APPROVE' | 'REJECT' | 'FLAG') => {
    const newReview: PeerReviewItem = {
      id: `pr_${Date.now()}`,
      reviewer_username: 'current_reviewer',
      decision,
      notes: customVoteNote || (decision === 'APPROVE' ? 'Verified valid site telemetry.' : 'Flagged during inspection.'),
      created_at: new Date().toISOString(),
    };

    const cur = selectedSub.consensus;
    const newReviews = [...cur.reviews, newReview];
    const totalVotes = newReviews.length;
    const approveVotes = newReviews.filter((r) => r.decision === 'APPROVE').length;
    const rejectVotes = newReviews.filter((r) => r.decision === 'REJECT').length;
    const flagVotes = newReviews.filter((r) => r.decision === 'FLAG').length;

    let newStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED' = cur.status;
    let settlementStatus = cur.settlement_status;

    if (totalVotes >= cur.quorum) {
      if (flagVotes > 0) {
        newStatus = 'DISPUTED';
      } else if (approveVotes / totalVotes > 0.5 && approveVotes > rejectVotes) {
        newStatus = 'APPROVED';
        settlementStatus = 'settled';
      } else if (rejectVotes / totalVotes > 0.5 && rejectVotes > approveVotes) {
        newStatus = 'REJECTED';
        settlementStatus = 'settled';
      } else {
        newStatus = 'DISPUTED';
      }
    }

    const updatedConsensus: ConsensusItem = {
      ...cur,
      total_votes: totalVotes,
      approve_votes: approveVotes,
      reject_votes: rejectVotes,
      flag_votes: flagVotes,
      status: newStatus,
      settlement_status: settlementStatus,
      reviews: newReviews,
    };

    const updatedSub: AdminSubmissionItem = {
      ...selectedSub,
      consensus: updatedConsensus,
      verification_status: newStatus === 'APPROVED' ? 'approved' : newStatus === 'REJECTED' ? 'rejected' : newStatus === 'DISPUTED' ? 'disputed' : 'pending',
    };

    setSubmissions((prev) => prev.map((s) => (s.id === selectedSub.id ? updatedSub : s)));
    setSelectedSub(updatedSub);
    setCustomVoteNote('');
  };

  // Dispute Raising
  const handleRaiseDispute = () => {
    if (!disputeReasonInput.trim()) return;
    const updatedConsensus: ConsensusItem = {
      ...selectedSub.consensus,
      status: 'DISPUTED',
      settlement_status: 'disputed',
      dispute_reason: disputeReasonInput.trim(),
    };
    const updatedSub: AdminSubmissionItem = {
      ...selectedSub,
      consensus: updatedConsensus,
      verification_status: 'disputed',
    };
    setSubmissions((prev) => prev.map((s) => (s.id === selectedSub.id ? updatedSub : s)));
    setSelectedSub(updatedSub);
    setDisputeReasonInput('');
    setShowDisputeModal(false);
  };

  // Dispute Resolution (Admin)
  const handleResolveDispute = (action: 'approve' | 'reject_refund' | 'reject_slash') => {
    let newStatus: 'APPROVED' | 'REJECTED' = 'APPROVED';
    let note = '';
    if (action === 'approve') {
      newStatus = 'APPROVED';
      note = 'Dispute resolved by Admin: Approved and reward disbursed.';
    } else if (action === 'reject_refund') {
      newStatus = 'REJECTED';
      note = 'Dispute resolved by Admin: Rejected with stake refunded in good faith.';
    } else {
      newStatus = 'REJECTED';
      note = 'Dispute resolved by Admin: Confirmed Fraud. Commitment stake SLASHED and burned.';
    }

    const updatedConsensus: ConsensusItem = {
      ...selectedSub.consensus,
      status: newStatus,
      settlement_status: 'settled',
      resolution_notes: note,
    };
    const updatedSub: AdminSubmissionItem = {
      ...selectedSub,
      consensus: updatedConsensus,
      verification_status: newStatus === 'APPROVED' ? 'approved' : 'rejected',
    };
    setSubmissions((prev) => prev.map((s) => (s.id === selectedSub.id ? updatedSub : s)));
    setSelectedSub(updatedSub);
  };

  const renderBadge = (status: 'PASSED' | 'WARNING' | 'FAILED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED') => {
    switch (status) {
      case 'PASSED':
      case 'APPROVED':
        return (
          <span className="status-pill status-pill-passed">
            <CheckCircle2Icon size={12} />
            <span>{status === 'APPROVED' ? 'Approved' : 'Passed'}</span>
          </span>
        );
      case 'WARNING':
      case 'DISPUTED':
        return (
          <span className="status-pill status-pill-warning">
            <AlertTriangleIcon size={12} />
            <span>{status === 'DISPUTED' ? 'Disputed' : 'Warning'}</span>
          </span>
        );
      case 'FAILED':
      case 'REJECTED':
        return (
          <span className="status-pill status-pill-failed">
            <XCircleIcon size={12} />
            <span>{status === 'REJECTED' ? 'Rejected' : 'Failed'}</span>
          </span>
        );
      default:
        return (
          <span className="status-pill status-pill-draft">
            <ClockIcon size={12} />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div>
      {/* 5-Stage Operational Overview Banner */}
      <div className="stat-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Verification, AI Quality & Peer Consensus Pipeline
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Deterministic spatial validation + AI multimodal inference + Distributed peer consensus with slashing governance
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

        {/* 5-Step Pipeline Stepper */}
        <div className="pipeline-stepper">
          <div className="pipeline-step completed">
            <span className="pipeline-step-badge">1</span>
            <span>Spatial & Field Intake</span>
          </div>
          <span className="pipeline-separator">→</span>
          <div className={`pipeline-step ${selectedSub?.validation_status === 'PASSED' ? 'completed' : selectedSub?.validation_status === 'WARNING' ? 'warning' : 'failed'}`}>
            <span className="pipeline-step-badge">2</span>
            <span>Deterministic Audit</span>
          </div>
          <span className="pipeline-separator">→</span>
          <div className={`pipeline-step ${selectedSub?.ai_quality.overall_status === 'PASSED' ? 'completed' : selectedSub?.ai_quality.overall_status === 'WARNING' ? 'warning' : 'failed'}`}>
            <span className="pipeline-step-badge">3</span>
            <span>AI Quality Evaluation</span>
          </div>
          <span className="pipeline-separator">→</span>
          <div className={`pipeline-step ${selectedSub?.consensus.status === 'APPROVED' ? 'completed' : selectedSub?.consensus.status === 'DISPUTED' ? 'warning' : 'active'}`}>
            <span className="pipeline-step-badge">4</span>
            <span>Peer Consensus (Phase 6)</span>
          </div>
          <span className="pipeline-separator">→</span>
          <div className={`pipeline-step ${selectedSub?.consensus.settlement_status === 'settled' ? 'completed' : 'active'}`}>
            <span className="pipeline-step-badge">5</span>
            <span>Token Settlement</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Submissions Queue List */}
        <div className="stat-card">
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Incoming Submissions Queue ({filtered.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map((sub) => {
              const isSelected = selectedSub?.id === sub.id;
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSub(sub)}
                  style={{
                    border: isSelected ? '1px solid var(--accent-brand-border)' : '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    background: isSelected ? 'rgba(45, 140, 255, 0.12)' : 'var(--bg-card)',
                    boxShadow: isSelected ? '0 0 16px rgba(99, 216, 255, 0.22)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sub.task_title}
                    </div>
                    {renderBadge(sub.validation_status)}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    By: {sub.contributor_email} · Fix: ±{sub.gps_accuracy}m · {sub.photo_count} photos
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Consensus: <strong style={{ color: sub.consensus.status === 'APPROVED' ? 'var(--status-success)' : sub.consensus.status === 'DISPUTED' ? 'var(--status-warning)' : 'var(--text-secondary)' }}>{sub.consensus.status}</strong> ({sub.consensus.total_votes}/{sub.consensus.quorum} votes)
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      AI Score: <strong>{Math.round(sub.ai_quality.confidence * 100)}%</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Deep Verification & Peer Review Inspector */}
        {selectedSub && (
          <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Stage 1: Submission Intake */}
            <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  1. Observation Intake: {selectedSub.id}
                </span>
                <span className="status-pill status-pill-active" style={{ textTransform: 'capitalize' }}>
                  {selectedSub.status}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Task: <strong>{selectedSub.task_title}</strong> ({selectedSub.artifact_type})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                GPS: {selectedSub.latitude.toFixed(6)}, {selectedSub.longitude.toFixed(6)} (±{selectedSub.gps_accuracy}m) · Captured: {new Date(selectedSub.captured_at).toLocaleTimeString()}
              </div>
            </div>

            {/* Stage 2: Automated Validation */}
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

            {/* Stage 3: AI Image Quality Evaluation */}
            <div className="ai-quality-card">
              <div className="ai-quality-header">
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    3. AI Multimodal Evaluation
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Confidence: {Math.round(selectedSub.ai_quality.confidence * 100)}% · Reason: {selectedSub.ai_quality.primary_reason}
                  </div>
                </div>
                {renderBadge(selectedSub.ai_quality.overall_status)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedSub.ai_quality.media_results.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      background: 'var(--bg-card)',
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
                      <span>Sharpness: {img.blur_score}</span>
                      <span style={{ textTransform: 'capitalize' }}>Exposure: {img.exposure}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage 4: Phase 6 Distributed Peer Consensus & Quorum */}
            <div className="consensus-card">
              <div className="consensus-header">
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    4. Distributed Peer Consensus (Phase 6)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Quorum: {selectedSub.consensus.total_votes}/{selectedSub.consensus.quorum} votes cast · Pool Size: {selectedSub.consensus.pool_size} · Settlement: {selectedSub.consensus.settlement_status}
                  </div>
                </div>
                {renderBadge(selectedSub.consensus.status)}
              </div>

              {/* Tally Breakdown */}
              <div className="consensus-tally-bar">
                <div className="consensus-tally-item">
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Approvals</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--status-success)' }}>
                    {selectedSub.consensus.approve_votes}
                  </div>
                </div>
                <div className="consensus-tally-item">
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rejections</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--status-error)' }}>
                    {selectedSub.consensus.reject_votes}
                  </div>
                </div>
                <div className="consensus-tally-item">
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Flags</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--token-amber-text)' }}>
                    {selectedSub.consensus.flag_votes}
                  </div>
                </div>
              </div>

              {/* Dispute Alert Banner if Disputed */}
              {selectedSub.consensus.status === 'DISPUTED' && (
                <div className="dispute-banner">
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>⚠ Contested Submission / Dispute Active</div>
                  <div>{selectedSub.consensus.dispute_reason || 'Contested due to conflicting peer reviews or suspected fraud flag.'}</div>
                </div>
              )}

              {/* Cast Ballots List */}
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', margin: '10px 0 6px 0' }}>
                Reviewer Ballots ({selectedSub.consensus.reviews.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedSub.consensus.reviews.map((rev) => (
                  <div key={rev.id} className="consensus-ballot">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        👤 {rev.reviewer_username}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: rev.decision === 'APPROVE' ? 'var(--accent-emerald-subtle)' : rev.decision === 'FLAG' ? 'var(--token-amber-subtle)' : 'var(--status-error-subtle)',
                          color: rev.decision === 'APPROVE' ? 'var(--accent-emerald-text)' : rev.decision === 'FLAG' ? 'var(--token-amber-text)' : 'var(--status-error-text)',
                        }}
                      >
                        {rev.decision}
                      </span>
                    </div>
                    {rev.notes && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        "{rev.notes}"
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Reviewer Peer Voting Controls */}
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Cast Peer Review Ballot
                </div>
                <input
                  type="text"
                  placeholder="Review notes / evidence findings (required for Reject/Flag)..."
                  value={customVoteNote}
                  onChange={(e) => setCustomVoteNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    marginBottom: '8px',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handlePeerVote('APPROVE')}
                    className="btn btn-emerald btn-sm"
                    style={{ flex: 1 }}
                  >
                    ✓ Vote Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeerVote('REJECT')}
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1 }}
                  >
                    ✕ Vote Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeerVote('FLAG')}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, borderColor: 'var(--token-amber)', color: 'var(--token-amber-text)' }}
                  >
                    🚩 Vote Flag
                  </button>
                </div>
              </div>

              {/* Dispute Resolution Actions for Admin if Disputed */}
              {selectedSub.consensus.status === 'DISPUTED' && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--token-amber-text)', marginBottom: '6px' }}>
                    ⚖ Administrative Dispute Resolution
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleResolveDispute('approve')}
                      className="btn btn-emerald btn-sm"
                      style={{ width: '100%', textAlign: 'center' }}
                    >
                      ✓ Resolve: Approve & Disburse Reward
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveDispute('reject_refund')}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', textAlign: 'center' }}
                    >
                      ✕ Resolve: Reject & Refund Stake (In Good Faith)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveDispute('reject_slash')}
                      className="btn btn-danger btn-sm"
                      style={{ width: '100%', textAlign: 'center', background: '#991b1b', color: '#ffffff' }}
                    >
                      ⚡ Resolve: Reject & SLASH Stake (Confirmed Fraud)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Stage 5: Final Admin Decision */}
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  5. Final Administrator Decision
                </span>
                {selectedSub.consensus.status !== 'DISPUTED' && (
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(true)}
                    style={{ fontSize: '11px', color: 'var(--cyan-glow)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Flag / Escalated Audit
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleDecision(selectedSub.id, 'approved')}
                  disabled={selectedSub.verification_status === 'approved'}
                  className="btn btn-emerald"
                  style={{ flex: 1, padding: '10px 16px', fontWeight: 700 }}
                >
                  ✓ ACCEPT (Commit to Verified Data)
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision(selectedSub.id, 'rejected')}
                  disabled={selectedSub.verification_status === 'rejected'}
                  className="btn btn-danger"
                  style={{ flex: 1, padding: '10px 16px', fontWeight: 700 }}
                >
                  ✕ REJECT
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Raise Submission Dispute / Appeal
              </h3>
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="btn btn-ghost btn-sm"
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Detail the basis for disputing this submission (e.g. false flag, satellite occlusion, GPS multipath):
              </div>
              <textarea
                rows={4}
                value={disputeReasonInput}
                onChange={(e) => setDisputeReasonInput(e.target.value)}
                placeholder="Enter detailed dispute grounds (min 5 characters)..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRaiseDispute}
                disabled={disputeReasonInput.trim().length < 5}
                className="btn btn-primary btn-sm"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
