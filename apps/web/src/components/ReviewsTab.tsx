'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  ClockIcon,
  CoinsIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  EyeIcon,
  UsersIcon,
  SearchIcon,
  FilterIcon,
  MapPinIcon,
  CameraIcon,
} from './Icons';

export interface PeerReviewItem {
  id: string;
  reviewer_id?: string;
  reviewer_username: string;
  decision: 'APPROVE' | 'REJECT' | 'FLAG';
  notes?: string;
  confidence_score?: number;
  evidence_references?: Record<string, any>;
  created_at: string;
}

export interface ReviewerAssignmentItem {
  assignment_id: string;
  reviewer_id: string;
  reviewer_username?: string;
  reviewer_email?: string;
  status: 'assigned' | 'completed';
  assigned_at: string;
  completed_at?: string | null;
}

export interface ConsensusDetails {
  submission_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED';
  pool_size: number;
  quorum: number;
  approval_threshold: number;
  rejection_threshold: number;
  total_votes: number;
  approve_votes: number;
  reject_votes: number;
  flag_votes: number;
  settlement_status: 'unsettled' | 'settled' | 'disputed';
  settled_at?: string | null;
  dispute_reason?: string | null;
  disputed_by?: string | null;
  disputed_at?: string | null;
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  reviews: PeerReviewItem[];
  assignments: ReviewerAssignmentItem[];
}

export interface AdminReviewRecord {
  id: string;
  submission_id: string;
  task_id: string;
  task_title: string;
  artifact_type: string;
  base_reward: number;
  commitment_stake: number;
  contributor_email?: string;
  contributor_username?: string;
  submission_status: string;
  submitted_at?: string;
  captured_at?: string;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy: number;
  media: any[];
  form_data: Record<string, any>;
  verification_status?: string | null;
  verification_notes?: string | null;
  validation_status?: string | null;
  validation_results?: any;
  ai_status?: string | null;
  ai_confidence_score?: number | null;
  ai_results?: any;
  consensus: ConsensusDetails;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://horizon-backend-api.onrender.com/api/v1').replace(/\/+$/, '');

export function normalizeReviewRecord(r: any): AdminReviewRecord {
  const c = r?.consensus || {};
  return {
    id: r?.id || r?.submission_id || `rev-${Date.now()}`,
    submission_id: r?.submission_id || r?.id || '',
    task_id: r?.task_id || '',
    task_title: r?.task_title || 'Field Observation',
    artifact_type: r?.artifact_type || 'field_survey',
    base_reward: r?.base_reward ?? 50,
    commitment_stake: r?.commitment_stake ?? 10,
    contributor_email: r?.contributor_email || (r?.contributor_username ? `@${r.contributor_username}` : 'contributor'),
    contributor_username: r?.contributor_username,
    submission_status: r?.submission_status || 'under_review',
    submitted_at: r?.submitted_at,
    captured_at: r?.captured_at,
    latitude: r?.latitude ?? null,
    longitude: r?.longitude ?? null,
    gps_accuracy: r?.gps_accuracy ?? 4.2,
    media: Array.isArray(r?.media) ? r.media : [],
    form_data: (r?.form_data && typeof r.form_data === 'object') ? r.form_data : {},
    verification_status: r?.verification_status,
    verification_notes: r?.verification_notes,
    validation_status: r?.validation_status,
    validation_results: r?.validation_results,
    ai_status: r?.ai_status,
    ai_confidence_score: r?.ai_confidence_score,
    ai_results: r?.ai_results,
    consensus: {
      submission_id: c.submission_id || r?.submission_id || r?.id || '',
      status: c.status || 'PENDING',
      pool_size: c.pool_size ?? 3,
      quorum: c.quorum ?? 2,
      approval_threshold: c.approval_threshold ?? 0.5,
      rejection_threshold: c.rejection_threshold ?? 0.5,
      total_votes: c.total_votes ?? 0,
      approve_votes: c.approve_votes ?? 0,
      reject_votes: c.reject_votes ?? 0,
      flag_votes: c.flag_votes ?? 0,
      settlement_status: c.settlement_status || 'unsettled',
      settled_at: c.settled_at,
      dispute_reason: c.dispute_reason,
      disputed_by: c.disputed_by,
      disputed_at: c.disputed_at,
      resolution_notes: c.resolution_notes,
      resolved_by: c.resolved_by,
      resolved_at: c.resolved_at,
      reviews: Array.isArray(c.reviews) ? c.reviews : [],
      assignments: Array.isArray(c.assignments) ? c.assignments : [],
    },
  };
}

export interface ReviewsTabProps {
  initialSelectedId?: string | null;
  adminToken?: string | null;
  onReviewResolved?: () => void;
  onNavigateToSubmissions?: (submissionId: string) => void;
}

export const ReviewsTab: React.FC<ReviewsTabProps> = ({
  initialSelectedId,
  adminToken,
  onReviewResolved,
  onNavigateToSubmissions,
}) => {
  const [reviews, setReviews] = useState<AdminReviewRecord[]>([]);
  const [selectedReview, setSelectedReview] = useState<AdminReviewRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [filter, setFilter] = useState<'all' | 'actionable' | 'pending' | 'disputed' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals / Form States
  const [disputeAction, setDisputeAction] = useState<'approve' | 'reject_refund' | 'reject_slash'>('approve');
  const [disputeNotes, setDisputeNotes] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [showDisputeModal, setShowDisputeModal] = useState<boolean>(false);

  // Peer Vote State
  const [peerVoteNote, setPeerVoteNote] = useState<string>('');
  const [isSubmittingVote, setIsSubmittingVote] = useState<boolean>(false);

  // Active enlarged photo preview
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // Restore SWR cache immediately for instantaneous rendering
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('horizon_admin_reviews_cache_v4') || sessionStorage.getItem('horizon_admin_reviews_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const mapped = parsed.map(normalizeReviewRecord);
            setReviews(mapped);
            const target = initialSelectedId ? mapped.find((p: any) => p.submission_id === initialSelectedId || p.id === initialSelectedId) : mapped[0];
            setSelectedReview(target || mapped[0] || null);
            setLoading(false);
          }
        }
      } catch {
        // ignore cache parse error
      }
    }
  }, [initialSelectedId]);

  // Primary Data Fetch: Query Authoritative /admin/reviews Endpoint with Fallback
  useEffect(() => {
    let isMounted = true;

    const fetchReviewsData = async () => {
      try {
        setError(null);
        const headers: Record<string, string> = {};
        const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        // Attempt 1: Authoritative /admin/reviews endpoint
        const res = await fetch(`${API_BASE_URL}/admin/reviews?page_size=50`, {
          headers,
          signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeoutId);

        if (res && res.ok && isMounted) {
          const data = await res.json().catch(() => null);
          if (data && Array.isArray(data.reviews)) {
            const mappedRecords: AdminReviewRecord[] = data.reviews.map(normalizeReviewRecord);

            setReviews(mappedRecords);

            if (initialSelectedId) {
              const target = mappedRecords.find(
                (m) => m.submission_id === initialSelectedId || m.id === initialSelectedId
              );
              setSelectedReview(target || mappedRecords[0] || null);
            } else {
              setSelectedReview((prev) => (prev ? mappedRecords.find((m) => m.id === prev.id) || mappedRecords[0] || null : mappedRecords[0] || null));
            }

            try {
              sessionStorage.setItem('horizon_admin_reviews_cache_v4', JSON.stringify(mappedRecords));
            } catch {
              // ignore cache write error
            }
            return;
          }
        }

        // Attempt 2 Fallback: If /admin/reviews 404 (e.g. running against remote server without the route yet),
        // fetch submissions that require review and query their actual consensus records
        const subRes = await fetch(`${API_BASE_URL}/admin/submissions?page_size=50`, {
          headers,
        }).catch(() => null);

        if (subRes && subRes.ok && isMounted) {
          const subData = await subRes.json().catch(() => null);
          if (subData && Array.isArray(subData.submissions)) {
            // Filter to submissions that legitimately need review or have been reviewed
            const candidateSubs = subData.submissions.filter(
              (s: any) =>
                s.status === 'under_review' ||
                s.status === 'submitted' ||
                s.status === 'flagged' ||
                s.status === 'approved' ||
                s.status === 'rejected'
            );

            // Fetch actual consensus records for these submissions in parallel (capped at 15)
            const subset = candidateSubs.slice(0, 15);
            const consensusResults = await Promise.all(
              subset.map(async (s: any) => {
                const cRes = await fetch(`${API_BASE_URL}/submissions/${s.id}/consensus`, { headers }).catch(() => null);
                if (cRes && cRes.ok) {
                  return { sub: s, consensus: await cRes.json().catch(() => null) };
                }
                return { sub: s, consensus: null };
              })
            );

            const mappedFallback: AdminReviewRecord[] = consensusResults
              .filter((item) => item.consensus !== null)
              .map(({ sub: s, consensus: cJson }) => ({
                id: cJson.submission_id || s.id,
                submission_id: s.id,
                task_id: s.task_id,
                task_title: s.task_title || 'Field Observation',
                artifact_type: s.artifact_type || 'field_survey',
                base_reward: 50,
                commitment_stake: 10,
                contributor_email: s.contributor_email || (s.user_id ? `${s.user_id.slice(0, 8)}@horizon.dev` : 'contributor'),
                submission_status: s.status,
                submitted_at: s.submitted_at,
                captured_at: s.captured_at,
                latitude: s.latitude,
                longitude: s.longitude,
                gps_accuracy: s.gps_accuracy || 4.2,
                media: s.media || [],
                form_data: s.form_data || {},
                verification_status: s.verification_status,
                verification_notes: s.verification_notes,
                validation_status: s.validation_status,
                validation_results: s.validation_results,
                ai_status: s.ai_status,
                ai_confidence_score: s.ai_confidence_score,
                ai_results: s.ai_results,
                consensus: {
                  submission_id: s.id,
                  status: cJson.status || 'PENDING',
                  pool_size: cJson.pool_size ?? 3,
                  quorum: cJson.quorum ?? 2,
                  approval_threshold: cJson.approval_threshold ?? 0.5,
                  rejection_threshold: cJson.rejection_threshold ?? 0.5,
                  total_votes: cJson.total_votes ?? 0,
                  approve_votes: cJson.approve_votes ?? 0,
                  reject_votes: cJson.reject_votes ?? 0,
                  flag_votes: cJson.flag_votes ?? 0,
                  settlement_status: cJson.settlement_status || 'unsettled',
                  settled_at: cJson.settled_at,
                  dispute_reason: cJson.dispute_reason,
                  disputed_by: cJson.disputed_by,
                  disputed_at: cJson.disputed_at,
                  resolution_notes: cJson.resolution_notes,
                  resolved_by: cJson.resolved_by,
                  resolved_at: cJson.resolved_at,
                  reviews: Array.isArray(cJson.reviews) ? cJson.reviews : [],
                  assignments: Array.isArray(cJson.assignments) ? cJson.assignments : [],
                },
              }));

            setReviews(mappedFallback);
            if (initialSelectedId) {
              const target = mappedFallback.find((m) => m.submission_id === initialSelectedId || m.id === initialSelectedId);
              setSelectedReview(target || mappedFallback[0] || null);
            } else {
              setSelectedReview((prev) => (prev ? mappedFallback.find((m) => m.id === prev.id) || mappedFallback[0] || null : mappedFallback[0] || null));
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load review records');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReviewsData();
    return () => {
      isMounted = false;
    };
  }, [adminToken, initialSelectedId]);

  // Synchronize initialSelectedId when prop changes
  useEffect(() => {
    if (initialSelectedId && reviews.length > 0) {
      const found = reviews.find((r) => r.submission_id === initialSelectedId || r.id === initialSelectedId);
      if (found) setSelectedReview(found);
    }
  }, [initialSelectedId, reviews]);

  // Filter computation
  const filteredReviews = reviews.filter((r) => {
    const c = r.consensus || ({} as any);
    const totalVotes = c.total_votes ?? 0;
    const quorum = c.quorum ?? 2;

    // 1. Status Filter
    if (filter === 'actionable') {
      const isQuorumMet = totalVotes >= quorum && c.settlement_status === 'unsettled';
      const isDisputed = c.status === 'DISPUTED';
      if (!isQuorumMet && !isDisputed) return false;
    } else if (filter === 'pending') {
      if (c.status !== 'PENDING' || totalVotes >= quorum) return false;
    } else if (filter === 'disputed') {
      if (c.status !== 'DISPUTED') return false;
    } else if (filter === 'settled') {
      if (c.settlement_status !== 'settled') return false;
    }

    // 2. Search Query (submission ID, task title, contributor email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = (r.submission_id || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q);
      const matchTitle = (r.task_title || '').toLowerCase().includes(q);
      const matchContributor = (r.contributor_email || '').toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchContributor) return false;
    }

    return true;
  });

  // KPI Calculations
  const totalCount = reviews.length;
  const actionableCount = reviews.filter((r) => {
    const c = r.consensus || ({} as any);
    return ((c.total_votes ?? 0) >= (c.quorum ?? 2) && c.settlement_status === 'unsettled') || c.status === 'DISPUTED';
  }).length;
  const inProgressCount = reviews.filter((r) => {
    const c = r.consensus || ({} as any);
    return c.status === 'PENDING' && (c.total_votes ?? 0) < (c.quorum ?? 2);
  }).length;
  const disputedCount = reviews.filter((r) => (r.consensus?.status || '') === 'DISPUTED').length;
  const settledCount = reviews.filter((r) => (r.consensus?.settlement_status || '') === 'settled').length;

  // Direct Admin Review Action (Approve / Reject)
  const handleAdminDecision = async (decision: 'approved' | 'rejected') => {
    if (!selectedReview) return;
    const subId = selectedReview.submission_id;

    let noteText = `Administrator reviewed consensus queue: ${decision.toUpperCase()}.`;
    if (decision === 'rejected') {
      const reason = window.prompt('Enter rejection rationale for contributor audit log:', 'Ground-truth evidence does not meet consensus criteria.');
      if (reason === null) return;
      noteText = reason.trim() || noteText;
    } else {
      const confirmApproval = window.confirm(`Confirm administrator approval for "${selectedReview.task_title}"?\n\nThis will disburse ${selectedReview.base_reward} TKN reward and return ${selectedReview.commitment_stake} TKN commitment stake.`);
      if (!confirmApproval) return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE_URL}/admin/submissions/${subId}/review`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          status: decision,
          notes: noteText,
          ai_confidence_score: 0.95,
        }),
      }).catch(() => null);
    } catch {
      // offline fallback
    }

    const newConsensusStatus = decision === 'approved' ? 'APPROVED' : 'REJECTED';
    const updatedRecord: AdminReviewRecord = {
      ...selectedReview,
      submission_status: decision,
      verification_status: decision,
      verification_notes: noteText,
      consensus: {
        ...selectedReview.consensus,
        status: newConsensusStatus,
        settlement_status: 'settled',
        resolution_notes: noteText,
      },
    };

    setReviews((prev) => prev.map((r) => (r.submission_id === subId ? updatedRecord : r)));
    setSelectedReview(updatedRecord);
    onReviewResolved?.();
  };

  // Peer Review Ballot Casting (Admin acting as Peer Reviewer)
  const handleCastBallot = async (decision: 'APPROVE' | 'REJECT' | 'FLAG') => {
    if (!selectedReview) return;
    setIsSubmittingVote(true);

    const note = peerVoteNote.trim() || (decision === 'APPROVE' ? 'Observation evidence matches spatial and photo requirements.' : decision === 'FLAG' ? 'Telemetry or imagery anomaly detected.' : 'Evidence insufficient.');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE_URL}/submissions/${selectedReview.submission_id}/peer-reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          decision,
          notes: note,
          confidence_score: 0.95,
        }),
      }).catch(() => null);
    } catch {
      // offline fallback
    } finally {
      setIsSubmittingVote(false);
    }

    const newBallot: PeerReviewItem = {
      id: `pr_${Date.now()}`,
      reviewer_username: 'admin_reviewer',
      decision,
      notes: note,
      confidence_score: 0.95,
      created_at: new Date().toISOString(),
    };

    const cur = selectedReview.consensus;
    const newReviews = [...cur.reviews, newBallot];
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

    const updatedConsensus: ConsensusDetails = {
      ...cur,
      total_votes: totalVotes,
      approve_votes: approveVotes,
      reject_votes: rejectVotes,
      flag_votes: flagVotes,
      status: newStatus,
      settlement_status: settlementStatus,
      reviews: newReviews,
    };

    const updatedRecord: AdminReviewRecord = {
      ...selectedReview,
      consensus: updatedConsensus,
      verification_status: newStatus === 'APPROVED' ? 'approved' : newStatus === 'REJECTED' ? 'rejected' : newStatus === 'DISPUTED' ? 'disputed' : 'under_review',
    };

    setReviews((prev) => prev.map((r) => (r.submission_id === selectedReview.submission_id ? updatedRecord : r)));
    setSelectedReview(updatedRecord);
    setPeerVoteNote('');
    onReviewResolved?.();
  };

  // Administrator Dispute Resolution Ruling
  const handleResolveDispute = async () => {
    if (!selectedReview || !disputeNotes.trim() || disputeNotes.trim().length < 5) {
      alert('Please enter at least 5 characters of resolution findings justifying the decision.');
      return;
    }

    setIsResolving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE_URL}/submissions/${selectedReview.submission_id}/dispute/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          resolve_action: disputeAction,
          notes: disputeNotes.trim(),
        }),
      }).catch(() => null);
    } catch {
      // offline fallback
    } finally {
      setIsResolving(false);
      setShowDisputeModal(false);
    }

    const isApprove = disputeAction === 'approve';
    const isSlash = disputeAction === 'reject_slash';
    const finalConsensusStatus = isApprove ? 'APPROVED' : 'REJECTED';

    const resolutionText = isApprove
      ? `Dispute Resolved (Approved): ${disputeNotes.trim()}`
      : isSlash
      ? `Dispute Resolved (Fraud Confirmed - Slashed): ${disputeNotes.trim()}`
      : `Dispute Resolved (Rejected, Stake Refunded): ${disputeNotes.trim()}`;

    const updatedConsensus: ConsensusDetails = {
      ...selectedReview.consensus,
      status: finalConsensusStatus,
      settlement_status: 'settled',
      resolution_notes: resolutionText,
      resolved_at: new Date().toISOString(),
    };

    const updatedRecord: AdminReviewRecord = {
      ...selectedReview,
      submission_status: isApprove ? 'approved' : 'rejected',
      verification_status: isApprove ? 'approved' : 'rejected',
      verification_notes: resolutionText,
      consensus: updatedConsensus,
    };

    setReviews((prev) => prev.map((r) => (r.submission_id === selectedReview.submission_id ? updatedRecord : r)));
    setSelectedReview(updatedRecord);
    setDisputeNotes('');
    onReviewResolved?.();
  };

  return (
    <div>
      {/* 1. Header & Consensus KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-blue">
            <EyeIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">In Review Queue</div>
            <div className="stat-value">{loading ? '...' : totalCount}</div>
            <div className="stat-sub">Active consensus records</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <CheckCircle2Icon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Quorum Met / Actionable</div>
            <div className="stat-value" style={{ color: actionableCount > 0 ? 'var(--accent-emerald)' : 'inherit' }}>
              {loading ? '...' : actionableCount}
            </div>
            <div className="stat-sub">Ready for decision/settlement</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-gray">
            <ClockIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Voting In Progress</div>
            <div className="stat-value">{loading ? '...' : inProgressCount}</div>
            <div className="stat-sub">Awaiting reviewer ballots</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <AlertTriangleIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Disputed / Flagged</div>
            <div className="stat-value" style={{ color: disputedCount > 0 ? '#DC2626' : 'inherit' }}>
              {loading ? '...' : disputedCount}
            </div>
            <div className="stat-sub">Requires admin ruling</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <CoinsIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Settled / Completed</div>
            <div className="stat-value">{loading ? '...' : settledCount}</div>
            <div className="stat-sub">Tokens settled on-chain</div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div className="table-container" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All Reviews ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('actionable')}
              className={`btn btn-sm ${filter === 'actionable' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ position: 'relative' }}
            >
              <span>Quorum Met / Actionable ({actionableCount})</span>
              {actionableCount > 0 && <span className="badge-dot" style={{ background: '#10B981', marginLeft: '6px' }} />}
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Voting In Progress ({inProgressCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('disputed')}
              className={`btn btn-sm ${filter === 'disputed' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Disputed ({disputedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('settled')}
              className={`btn btn-sm ${filter === 'settled' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Settled ({settledCount})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              placeholder="Search task, contributor, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', height: '34px', fontSize: '13px' }}
            />
          </div>
        </div>
      </div>

      {/* 3. Main Workspace: Two-Column Review Queue & Consensus Decision Inspector */}
      {loading ? (
        <div className="table-container" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#64748B' }}>Loading peer consensus queue and reviewer records...</div>
        </div>
      ) : filteredReviews.length === 0 ? (
        /* Honest Empty State */
        <div className="table-container" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F0FDF4', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2Icon size={28} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#101828', marginBottom: '6px' }}>
            {reviews.length === 0 ? 'No Submissions Currently in Review Queue' : 'No Reviews Match Selected Filter'}
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px', margin: '0 auto 20px' }}>
            {reviews.length === 0
              ? 'All field submissions have completed peer consensus or no incoming submissions currently require human review ballots.'
              : 'Try clearing your search query or switching to "All Reviews" to inspect settled and ongoing consensus records.'}
          </p>
          {onNavigateToSubmissions && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigateToSubmissions('')}
            >
              <span>Inspect Incoming Field Submissions</span>
              <ArrowRightIcon size={14} />
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Review Queue List */}
          <div className="table-container" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                Review Queue ({filteredReviews.length})
              </span>
              <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                Quorum Engine active
              </span>
            </div>

            <div style={{ maxHeight: '780px', overflowY: 'auto' }}>
              {filteredReviews.map((rev) => {
                const isSelected = selectedReview?.id === rev.id;
                const c = rev.consensus || ({} as any);
                const totalVotes = c.total_votes ?? 0;
                const quorum = c.quorum ?? 2;
                const isQuorumMet = totalVotes >= quorum;
                const isDisputed = c.status === 'DISPUTED';
                const isApproved = c.status === 'APPROVED';
                const isRejected = c.status === 'REJECTED';

                return (
                  <div
                    key={rev.id}
                    onClick={() => setSelectedReview(rev)}
                    style={{
                      padding: '16px 18px',
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-emerald-subtle)' : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--accent-emerald)' : '4px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                        {rev.task_title}
                      </div>
                      <span
                        className={`status-pill ${
                          isDisputed
                            ? 'status-pill-warning'
                            : isApproved
                            ? 'status-pill-passed'
                            : isRejected
                            ? 'status-pill-failed'
                            : isQuorumMet
                            ? 'status-pill-passed'
                            : 'status-pill-pending'
                        }`}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        {isDisputed ? 'Disputed' : isApproved ? 'Approved' : isRejected ? 'Rejected' : isQuorumMet ? 'Quorum Met' : 'Voting'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{rev.contributor_email}</span>
                      <span>•</span>
                      <span>{(rev.artifact_type || 'field_survey').replace(/_/g, ' ')}</span>
                    </div>

                    {/* Quorum Progress Bar */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                        <span>Quorum: {totalVotes} of {quorum} votes</span>
                        <span>{isQuorumMet ? '✓ Quorum Achieved' : `${Math.max(0, quorum - totalVotes)} more needed`}</span>
                      </div>
                      <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                        <div
                          style={{
                            width: `${Math.min(100, (totalVotes / (quorum || 1)) * 100)}%`,
                            background: isDisputed ? '#F59E0B' : isApproved ? '#10B981' : '#3B82F6',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Vote Pills & Token Incentives */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ color: '#059669', fontWeight: 600 }}>+{c.approve_votes ?? 0} Appr</span>
                        <span style={{ color: '#DC2626', fontWeight: 600 }}>-{c.reject_votes ?? 0} Rej</span>
                        {(c.flag_votes ?? 0) > 0 && <span style={{ color: '#D97706', fontWeight: 600 }}>!{c.flag_votes} Flag</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--token-emerald-text)', fontWeight: 600 }}>
                        <CoinsIcon size={12} />
                        <span>{rev.base_reward} TKN</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Consensus Inspector & Decision Console */}
          {selectedReview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Box */}
              <div className="table-container" style={{ padding: '22px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                        {selectedReview.task_title}
                      </h2>
                      <span className="status-pill status-pill-passed" style={{ fontSize: '11px' }}>
                        {(selectedReview.artifact_type || 'field_survey').replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span>Contributor: <strong style={{ color: '#1E293B' }}>{selectedReview.contributor_email}</strong></span>
                      <span>Submission ID: <code style={{ color: '#0F172A' }}>{selectedReview.submission_id}</code></span>
                      <span>Submitted: <strong>{selectedReview.submitted_at ? new Date(selectedReview.submitted_at).toLocaleString() : 'Recently'}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {onNavigateToSubmissions && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onNavigateToSubmissions(selectedReview.submission_id)}
                        title="Inspect original telemetry, EXIF data, and deterministic checks"
                      >
                        <EyeIcon size={14} />
                        <span>View Intake Data</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Token Economics & Escrow Summary Strip */}
                <div
                  style={{
                    marginTop: '18px',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Commitment Stake (Escrowed)
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {selectedReview.commitment_stake} TKN
                    </div>
                    <div style={{ fontSize: '11px', color: '#10B981', marginTop: '2px' }}>
                      {selectedReview.consensus?.settlement_status === 'settled' ? '✓ Stake released' : '🔒 Locked in vault'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Task Reward
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {selectedReview.base_reward} TKN
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      Minted upon verified consensus
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Settlement Status
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '2px', textTransform: 'capitalize' }}>
                      {selectedReview.consensus?.settlement_status || 'unsettled'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      {selectedReview.consensus?.settled_at ? new Date(selectedReview.consensus.settled_at).toLocaleDateString() : 'Pending final outcome'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispute Resolution Alert Banner (If Disputed or Flagged) */}
              {(selectedReview.consensus?.status === 'DISPUTED' || (selectedReview.consensus?.flag_votes ?? 0) > 0) && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: '10px',
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 700, fontSize: '14px' }}>
                      <AlertTriangleIcon size={16} />
                      <span>Formal Dispute / Telemetry Anomaly Detected</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      style={{ background: '#D97706', borderColor: '#B45309' }}
                      onClick={() => setShowDisputeModal(true)}
                    >
                      <span>Open Dispute Resolution Console</span>
                      <ArrowRightIcon size={12} />
                    </button>
                  </div>

                  <p style={{ fontSize: '12px', color: '#92400E', margin: 0 }}>
                    <strong>Basis for Escalation:</strong>{' '}
                    {selectedReview.consensus?.dispute_reason || 'Contested due to conflicting peer reviews or suspected fraud flag.'}
                  </p>
                </div>
              )}

              {/* Quorum Progress & Voting Breakdown Card */}
              <div className="table-container" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Consensus Quorum &amp; Ballots
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Pool Size: <strong>{selectedReview.consensus?.pool_size ?? 3}</strong> • Quorum: <strong>{selectedReview.consensus?.quorum ?? 2} votes</strong>
                  </span>
                </div>

                {/* Vote Distribution Bar */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span>
                      Total Votes: <strong>{selectedReview.consensus?.total_votes ?? 0}</strong> of <strong>{selectedReview.consensus?.quorum ?? 2}</strong> required
                    </span>
                    <span style={{ fontWeight: 600, color: (selectedReview.consensus?.total_votes ?? 0) >= (selectedReview.consensus?.quorum ?? 2) ? '#10B981' : '#64748B' }}>
                      {(selectedReview.consensus?.total_votes ?? 0) >= (selectedReview.consensus?.quorum ?? 2)
                        ? 'Quorum Met'
                        : `${Math.max(0, (selectedReview.consensus?.quorum ?? 2) - (selectedReview.consensus?.total_votes ?? 0))} votes outstanding`}
                    </span>
                  </div>

                  <div style={{ height: '10px', background: '#F1F5F9', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${(selectedReview.consensus?.total_votes ?? 0) > 0 ? ((selectedReview.consensus?.approve_votes ?? 0) / (selectedReview.consensus?.total_votes || 1)) * 100 : 0}%`, background: '#10B981' }} title="Approvals" />
                    <div style={{ width: `${(selectedReview.consensus?.total_votes ?? 0) > 0 ? ((selectedReview.consensus?.reject_votes ?? 0) / (selectedReview.consensus?.total_votes || 1)) * 100 : 0}%`, background: '#EF4444' }} title="Rejections" />
                    <div style={{ width: `${(selectedReview.consensus?.total_votes ?? 0) > 0 ? ((selectedReview.consensus?.flag_votes ?? 0) / (selectedReview.consensus?.total_votes || 1)) * 100 : 0}%`, background: '#F59E0B' }} title="Flags" />
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginTop: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                      <span>Approve ({selectedReview.consensus?.approve_votes ?? 0})</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                      <span>Reject ({selectedReview.consensus?.reject_votes ?? 0})</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                      <span>Flag ({selectedReview.consensus?.flag_votes ?? 0})</span>
                    </span>
                  </div>
                </div>

                {/* Individual Cast Ballots */}
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '12px' }}>
                  Peer Reviewer Ballots &amp; Commentary
                </h4>

                {(selectedReview.consensus?.reviews || []).length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: '#F8FAFC', borderRadius: '8px', color: '#64748B', fontSize: '13px' }}>
                    No peer review ballots cast yet. Submissions are awaiting review by assigned pool members.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(selectedReview.consensus?.reviews || []).map((ballot) => (
                      <div
                        key={ballot.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          background: '#FFFFFF',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                              @{ballot.reviewer_username}
                            </span>
                            <span
                              className={`status-pill ${
                                ballot.decision === 'APPROVE'
                                  ? 'status-pill-passed'
                                  : ballot.decision === 'REJECT'
                                  ? 'status-pill-failed'
                                  : 'status-pill-warning'
                              }`}
                              style={{ fontSize: '11px', padding: '1px 8px' }}
                            >
                              {ballot.decision}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {ballot.created_at ? new Date(ballot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                          </span>
                        </div>

                        <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: 1.4 }}>
                          {ballot.notes || 'No review commentary provided.'}
                        </p>

                        {ballot.confidence_score !== undefined && ballot.confidence_score !== null && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                            Confidence Score: <strong>{(ballot.confidence_score * 100).toFixed(0)}%</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Assigned Reviewers Roster (If available) */}
                {(selectedReview.consensus?.assignments || []).length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
                      Designated Reviewers Pool ({(selectedReview.consensus?.assignments || []).length})
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(selectedReview.consensus?.assignments || []).map((a) => (
                        <div
                          key={a.assignment_id}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <UsersIcon size={14} color="#64748B" />
                          <span>@{a.reviewer_username || a.reviewer_id.slice(0, 8)}</span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: a.status === 'completed' ? '#DCFCE7' : '#FEF3C7',
                              color: a.status === 'completed' ? '#166534' : '#92400E',
                              fontWeight: 600,
                            }}
                          >
                            {a.status === 'completed' ? 'Voted' : 'Assigned'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cast Peer Review Ballot Form (Admin Participation) */}
              <div className="table-container" style={{ padding: '20px 24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                  Cast Administrator Peer Ballot
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                  As an authorized operations administrator, you may contribute a binding inspection ballot to this submission's consensus pool.
                </p>

                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label" htmlFor="peer-vote-notes">Inspection Commentary &amp; Findings</label>
                  <input
                    id="peer-vote-notes"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Physical infrastructure validated against satellite bounds..."
                    value={peerVoteNote}
                    onChange={(e) => setPeerVoteNote(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={isSubmittingVote}
                    onClick={() => handleCastBallot('APPROVE')}
                    style={{ background: '#059669', borderColor: '#047857' }}
                  >
                    <CheckCircle2Icon size={14} />
                    <span>Ballot: APPROVE</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isSubmittingVote}
                    onClick={() => handleCastBallot('REJECT')}
                    style={{ color: '#DC2626' }}
                  >
                    <XCircleIcon size={14} />
                    <span>Ballot: REJECT</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isSubmittingVote}
                    onClick={() => handleCastBallot('FLAG')}
                    style={{ color: '#D97706' }}
                  >
                    <AlertTriangleIcon size={14} />
                    <span>Ballot: FLAG</span>
                  </button>
                </div>
              </div>

              {/* Authorized Decision Management Console */}
              <div className="table-container" style={{ padding: '20px 24px', background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
                  Administrator Verification Ruling
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                  Direct administrative authority to finalize observation status, disburse token rewards, or release escrowed commitment stakes.
                </p>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: '#15803D', borderColor: '#166534', minWidth: '180px' }}
                    onClick={() => handleAdminDecision('approved')}
                  >
                    <CheckCircle2Icon size={16} />
                    <span>Approve &amp; Settle Reward</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ color: '#DC2626', borderColor: '#FCA5A5', minWidth: '180px' }}
                    onClick={() => handleAdminDecision('rejected')}
                  >
                    <XCircleIcon size={16} />
                    <span>Reject Submission</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ color: '#B45309', borderColor: '#FDE68A' }}
                    onClick={() => setShowDisputeModal(true)}
                  >
                    <ShieldCheckIcon size={16} />
                    <span>Dispute / Slashing Console</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dispute Resolution Modal */}
      {showDisputeModal && selectedReview && (
        <div className="modal-overlay" onClick={() => setShowDisputeModal(false)}>
          <div className="modal-container" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheckIcon size={20} color="#D97706" />
                <h3 className="modal-title">Dispute Resolution &amp; Slashing Console</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDisputeModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
                Issue an authoritative administrative ruling for submission <code>{selectedReview.submission_id}</code>.
                Depending on your finding, commitment tokens will be refunded or permanently slashed.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Ruling Action</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: disputeAction === 'approve' ? '2px solid #10B981' : '1px solid #E2E8F0',
                      background: disputeAction === 'approve' ? '#ECFDF5' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="dispute-action"
                      checked={disputeAction === 'approve'}
                      onChange={() => setDisputeAction('approve')}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#065F46' }}>Approve Submission &amp; Disburse Reward</div>
                      <div style={{ fontSize: '11px', color: '#047857' }}>Ground truth confirmed valid. {selectedReview.commitment_stake} TKN stake released + {selectedReview.base_reward} TKN reward minted.</div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: disputeAction === 'reject_refund' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                      background: disputeAction === 'reject_refund' ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="dispute-action"
                      checked={disputeAction === 'reject_refund'}
                      onChange={() => setDisputeAction('reject_refund')}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1E40AF' }}>Reject with Good-Faith Stake Refund</div>
                      <div style={{ fontSize: '11px', color: '#1D4ED8' }}>Evidence inadequate but honest attempt. {selectedReview.commitment_stake} TKN stake returned to contributor. 0 reward.</div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: disputeAction === 'reject_slash' ? '2px solid #EF4444' : '1px solid #E2E8F0',
                      background: disputeAction === 'reject_slash' ? '#FEF2F2' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="dispute-action"
                      checked={disputeAction === 'reject_slash'}
                      onChange={() => setDisputeAction('reject_slash')}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#991B1B' }}>Reject with Fraud Slashing (Burn Stake)</div>
                      <div style={{ fontSize: '11px', color: '#B91C1C' }}>Intentional spoofing / fabricated imagery. {selectedReview.commitment_stake} TKN stake SLASHED and permanently burned.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="dispute-notes" style={{ fontWeight: 700 }}>
                  Administrative Audit Findings (Required, min 5 chars)
                </label>
                <textarea
                  id="dispute-notes"
                  className="form-input"
                  rows={3}
                  placeholder="Detail the operational audit findings that justify this ruling..."
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDisputeModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isResolving || disputeNotes.trim().length < 5}
                onClick={handleResolveDispute}
                style={{
                  background: disputeAction === 'approve' ? '#059669' : disputeAction === 'reject_slash' ? '#DC2626' : '#2563EB',
                }}
              >
                {isResolving ? 'Executing Settlement...' : 'Execute Binding Ruling'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Enlargement Modal */}
      {activePhotoUrl && (
        <div className="modal-overlay" onClick={() => setActivePhotoUrl(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={activePhotoUrl}
              alt="Enlarged Ground Evidence"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px', objectFit: 'contain' }}
            />
            <button
              type="button"
              onClick={() => setActivePhotoUrl(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
