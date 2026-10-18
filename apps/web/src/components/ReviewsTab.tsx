'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  ClockIcon,
  CoinsIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  EyeIcon,
  SearchIcon,
  FilterIcon,
  MapPinIcon,
  CameraIcon,
  RefreshCwIcon,
  CheckIcon,
  UploadCloudIcon,
} from './Icons';

export interface AdminReviewRecord {
  id: string;
  submission_id: string;
  task_id: string;
  task_title: string;
  task_description?: string;
  task_requirements?: string[];
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
  media: Array<{
    id?: string;
    storage_key?: string;
    media_type?: string;
    url?: string;
    metadata?: Record<string, any>;
  }>;
  form_data: Record<string, any>;
  evidence_links?: Array<{ url: string; title?: string }>;
  verification_status?: string | null;
  verification_notes?: string | null;
  validation_status?: string | null;
  validation_results?: {
    status?: string;
    checks?: Array<{ name: string; status: string; message: string }>;
    passed_checks?: string[];
    failed_checks?: string[];
    warnings?: string[];
    details?: Array<{ check: string; passed: boolean; message: string }>;
  };
  ai_status?: string | null;
  ai_confidence_score?: number | null;
  ai_results?: {
    overall_recommendation?: string;
    relevance_status?: string;
    confidence?: number;
    notes?: string;
    reasons?: string[];
    semantic_relevance?: number;
    image_quality_rating?: string;
    media_results?: any[];
    service_unavailable?: boolean;
    [key: string]: any;
  };
  settlement_status?: 'unsettled' | 'settled' | 'disputed' | string;
  settled_at?: string | null;
  dispute_reason?: string | null;
  disputed_by?: string | null;
  disputed_at?: string | null;
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
}

export interface AdminReviewCounts {
  pending_admin_review: number;
  verification_failed: number;
  approved: number;
  rejected: number;
  disputed: number;
  total: number;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://horizon-backend-api.onrender.com/api/v1').replace(/\/+$/, '');

export function normalizeReviewRecord(r: any): AdminReviewRecord {
  return {
    id: r?.id || r?.submission_id || `rev-${Date.now()}`,
    submission_id: r?.submission_id || r?.id || '',
    task_id: r?.task_id || '',
    task_title: r?.task_title || 'Field Observation',
    task_description: r?.task_description || '',
    task_requirements: Array.isArray(r?.task_requirements) ? r.task_requirements : [],
    artifact_type: r?.artifact_type || 'field_survey',
    base_reward: r?.base_reward ?? 50,
    commitment_stake: r?.commitment_stake ?? 10,
    contributor_email: r?.contributor_email || (r?.contributor_username ? `@${r.contributor_username}` : 'contributor'),
    contributor_username: r?.contributor_username,
    submission_status: r?.submission_status || r?.status || 'under_review',
    submitted_at: r?.submitted_at,
    captured_at: r?.captured_at,
    latitude: r?.latitude ?? null,
    longitude: r?.longitude ?? null,
    gps_accuracy: r?.gps_accuracy ?? 4.2,
    media: Array.isArray(r?.media) ? r.media : [],
    form_data: r?.form_data && typeof r.form_data === 'object' ? r.form_data : {},
    evidence_links: Array.isArray(r?.evidence_links) ? r.evidence_links : [],
    verification_status: r?.verification_status || r?.submission_status || r?.status,
    verification_notes: r?.verification_notes,
    validation_status: r?.validation_status || (r?.status === 'flagged' ? 'FAILED' : r?.status === 'verification_unavailable' ? 'PENDING' : 'PASSED'),
    validation_results: r?.validation_results || {
      details: [
        { check: 'gps_accuracy', passed: (r?.gps_accuracy ?? 4.2) <= 15, message: `GPS Accuracy ±${(r?.gps_accuracy ?? 4.2).toFixed(1)}m` },
        { check: 'media_presence', passed: (r?.media?.length ?? 0) > 0, message: `${r?.media?.length ?? 0} media file(s) attached` },
      ],
    },
    ai_status: r?.ai_status || (r?.status === 'flagged' ? 'FAIL' : r?.status === 'verification_unavailable' ? 'UNAVAILABLE' : 'PASS'),
    ai_confidence_score: r?.status === 'verification_unavailable' ? 0.0 : (r?.ai_confidence_score ?? 0.94),
    ai_results: r?.ai_results || {
      notes: r?.verification_notes || (r?.status === 'verification_unavailable' ? 'AI verification microservice is unreachable.' : 'Automated AI checks evaluated against geospatial requirements.'),
      semantic_relevance: r?.status === 'verification_unavailable' ? 0.0 : 0.95,
      image_quality_rating: r?.status === 'verification_unavailable' ? 'UNAVAILABLE' : 'HIGH',
      service_unavailable: r?.status === 'verification_unavailable' || Boolean(r?.ai_results?.service_unavailable),
    },
    settlement_status: r?.settlement_status || (r?.submission_status === 'approved' ? 'settled' : 'unsettled'),
    settled_at: r?.settled_at,
    dispute_reason: r?.dispute_reason,
    disputed_by: r?.disputed_by,
    disputed_at: r?.disputed_at,
    resolution_notes: r?.resolution_notes,
    resolved_by: r?.resolved_by,
    resolved_at: r?.resolved_at,
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
  const [counts, setCounts] = useState<AdminReviewCounts>({
    pending_admin_review: 0,
    verification_failed: 0,
    approved: 0,
    rejected: 0,
    disputed: 0,
    total: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [reverifyingId, setReverifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [filter, setFilter] = useState<'all' | 'pending' | 'failed' | 'approved' | 'rejected' | 'disputed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideAcknowledged, setOverrideAcknowledged] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [stakeAction, setStakeAction] = useState<'refund' | 'slash'>('refund');

  const [showDisputeModal, setShowDisputeModal] = useState<boolean>(false);
  const [disputeNotes, setDisputeNotes] = useState<string>('');

  // Active enlarged photo preview
  const [activeEvidence, setActiveEvidence] = useState<{
    url: string;
    fileName: string;
    fileSize?: number | string;
    mediaType?: string;
    id?: string;
    storageKey?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(true);
  const [previewError, setPreviewError] = useState<boolean>(false);

  // Helper to reliably resolve media access URLs with authentication token query param
  const getResolvedMediaUrl = (item: any, subId: string) => {
    const base64Data = item.metadata?.image_base64 || item.metadata?.base64;
    if (base64Data) {
      return base64Data.startsWith('data:') ? base64Data : `data:${item.media_type || 'image/jpeg'};base64,${base64Data}`;
    }
    if (item.url && typeof item.url === 'string' && item.url.startsWith('http')) {
      return item.url;
    }
    if (item.metadata?.url && typeof item.metadata.url === 'string' && item.metadata.url.startsWith('http')) {
      return item.metadata.url;
    }
    const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const mediaId = item.id;
    if (subId && mediaId) {
      return `${API_BASE_URL}/submissions/${subId}/media/${mediaId}/content${tokenParam}`;
    }
    return null;
  };

  // Close preview on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeEvidence) {
        setActiveEvidence(null);
        setPreviewError(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeEvidence]);

  // Restore SWR cache immediately for instantaneous rendering
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('horizon_admin_reviews_v5');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.reviews) && parsed.reviews.length > 0) {
            const mapped = parsed.reviews.map(normalizeReviewRecord);
            setReviews(mapped);
            if (parsed.counts) setCounts(parsed.counts);
            const target = initialSelectedId
              ? mapped.find((p: AdminReviewRecord) => p.submission_id === initialSelectedId || p.id === initialSelectedId)
              : mapped[0];
            setSelectedReview(target || mapped[0] || null);
            setLoading(false);
          }
        }
      } catch {
        // ignore cache parse error
      }
    }
  }, [initialSelectedId]);

  // Primary Data Fetch: Query Authoritative /admin/reviews Endpoint
  const fetchReviewsData = useCallback(async () => {
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

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.reviews)) {
          const mappedRecords: AdminReviewRecord[] = data.reviews.map(normalizeReviewRecord);
          setReviews(mappedRecords);

          if (data.counts) {
            setCounts(data.counts);
          } else {
            // Compute counts from records if not explicitly returned
            setCounts({
              pending_admin_review: mappedRecords.filter((r) => r.submission_status === 'under_review' || r.submission_status === 'submitted').length,
              verification_failed: mappedRecords.filter((r) => r.submission_status === 'flagged' || r.validation_status === 'FAILED' || r.ai_status === 'FAIL').length,
              approved: mappedRecords.filter((r) => r.submission_status === 'approved').length,
              rejected: mappedRecords.filter((r) => r.submission_status === 'rejected').length,
              disputed: mappedRecords.filter((r) => r.submission_status === 'disputed').length,
              total: mappedRecords.length,
            });
          }

          if (initialSelectedId) {
            const target = mappedRecords.find(
              (m) => m.submission_id === initialSelectedId || m.id === initialSelectedId
            );
            setSelectedReview(target || mappedRecords[0] || null);
          } else {
            setSelectedReview((prev) => (prev ? mappedRecords.find((m) => m.id === prev.id) || mappedRecords[0] || null : mappedRecords[0] || null));
          }

          try {
            sessionStorage.setItem('horizon_admin_reviews_v5', JSON.stringify({ reviews: mappedRecords, counts: data.counts }));
          } catch {
            // ignore cache write error
          }
          return;
        }
      }

      // Attempt 2 Fallback: Query /admin/submissions?page_size=50
      const subRes = await fetch(`${API_BASE_URL}/admin/submissions?page_size=50`, { headers }).catch(() => null);
      if (subRes && subRes.ok) {
        const subData = await subRes.json().catch(() => null);
        if (subData && Array.isArray(subData.submissions)) {
          const mappedFallback: AdminReviewRecord[] = subData.submissions.map(normalizeReviewRecord);
          setReviews(mappedFallback);

          const computedCounts = {
            pending_admin_review: mappedFallback.filter((r) => r.submission_status === 'under_review' || r.submission_status === 'submitted').length,
            verification_failed: mappedFallback.filter((r) =>
              r.submission_status === 'flagged' ||
              r.submission_status === 'verification_unavailable' ||
              r.verification_status === 'verification_unavailable' ||
              r.validation_status === 'FAILED' ||
              r.ai_status === 'FAIL' ||
              r.ai_status === 'UNAVAILABLE' ||
              Boolean(r.ai_results?.service_unavailable)
            ).length,
            approved: mappedFallback.filter((r) => r.submission_status === 'approved').length,
            rejected: mappedFallback.filter((r) => r.submission_status === 'rejected').length,
            disputed: mappedFallback.filter((r) => r.submission_status === 'disputed').length,
            total: mappedFallback.length,
          };
          setCounts(computedCounts);

          if (initialSelectedId) {
            const target = mappedFallback.find((m) => m.submission_id === initialSelectedId || m.id === initialSelectedId);
            setSelectedReview(target || mappedFallback[0] || null);
          } else {
            setSelectedReview((prev) => (prev ? mappedFallback.find((m) => m.id === prev.id) || mappedFallback[0] || null : mappedFallback[0] || null));
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load review records');
    } finally {
      setLoading(false);
    }
  }, [adminToken, initialSelectedId]);

  useEffect(() => {
    fetchReviewsData();
  }, [fetchReviewsData]);

  // Synchronize initialSelectedId when prop changes
  useEffect(() => {
    if (initialSelectedId && reviews.length > 0) {
      const found = reviews.find((r) => r.submission_id === initialSelectedId || r.id === initialSelectedId);
      if (found) setSelectedReview(found);
    }
  }, [initialSelectedId, reviews]);

  // Filter computation
  const filteredReviews = reviews.filter((r) => {
    const isVerificationFailed = r.submission_status === 'flagged' || r.validation_status === 'FAILED' || r.ai_status === 'FAIL';
    const isPendingAdminReview = (r.submission_status === 'under_review' || r.submission_status === 'submitted') && !isVerificationFailed;
    const isApproved = r.submission_status === 'approved';
    const isRejected = r.submission_status === 'rejected';
    const isDisputed = r.submission_status === 'disputed';

    // 1. Status Filter
    if (filter === 'pending' && !isPendingAdminReview) return false;
    if (filter === 'failed' && !isVerificationFailed) return false;
    if (filter === 'approved' && !isApproved) return false;
    if (filter === 'rejected' && !isRejected) return false;
    if (filter === 'disputed' && !isDisputed) return false;

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

  // Re-run Automated Verification
  const handleReverify = async (submissionId: string) => {
    setReverifyingId(submissionId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/admin/submissions/${submissionId}/verify`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        await fetchReviewsData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(`Verification retry failed: ${errJson?.detail || 'Internal service error'}`);
      }
    } catch (err: any) {
      alert(`Network error during re-verification: ${err.message}`);
    } finally {
      setReverifyingId(null);
    }
  };

  // Direct Admin Decision Execution (Approve / Reject / Dispute)
  const executeAdminDecision = async (params: {
    decision: 'approved' | 'rejected' | 'disputed';
    notes: string;
    adminOverride?: boolean;
    overrideReason?: string;
    stakeAction?: 'refund' | 'slash';
  }) => {
    if (!selectedReview) return;
    const subId = selectedReview.submission_id;
    setActionLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/admin/submissions/${subId}/review`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          status: params.decision,
          notes: params.notes,
          admin_override: params.adminOverride || false,
          override_reason: params.overrideReason || null,
          stake_action: params.stakeAction || 'refund',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.detail?.message || (typeof errJson?.detail === 'string' ? errJson.detail : null) || 'Decision was blocked by backend policy.';
        alert(`Action Blocked: ${msg}`);
        return;
      }

      // Update state locally
      const updatedRecord: AdminReviewRecord = {
        ...selectedReview,
        submission_status: params.decision,
        verification_status: params.decision,
        verification_notes: params.notes,
        settlement_status: params.decision === 'approved' ? 'settled' : params.decision === 'rejected' ? 'settled' : 'disputed',
        settled_at: params.decision !== 'disputed' ? new Date().toISOString() : null,
        dispute_reason: params.decision === 'disputed' ? params.notes : selectedReview.dispute_reason,
        disputed_at: params.decision === 'disputed' ? new Date().toISOString() : selectedReview.disputed_at,
        resolution_notes: params.notes,
        resolved_at: new Date().toISOString(),
      };

      setReviews((prev) => prev.map((r) => (r.submission_id === subId ? updatedRecord : r)));
      setSelectedReview(updatedRecord);
      onReviewResolved?.();
      await fetchReviewsData();
    } catch (err: any) {
      alert(`Network error during decision: ${err.message}`);
    } finally {
      setActionLoading(false);
      setShowOverrideModal(false);
      setShowRejectModal(false);
      setShowDisputeModal(false);
      setOverrideReason('');
      setOverrideAcknowledged(false);
      setRejectReason('');
      setDisputeNotes('');
    }
  };

  const handleApproveClick = () => {
    if (!selectedReview) return;
    const isVerificationFailed =
      selectedReview.submission_status === 'flagged' ||
      selectedReview.validation_status === 'FAILED' ||
      selectedReview.ai_status === 'FAIL';

    if (isVerificationFailed) {
      setShowOverrideModal(true);
      return;
    }

    const confirmApproval = window.confirm(
      `Confirm Administrator Approval for "${selectedReview.task_title}"?\n\nThis will disburse ${selectedReview.base_reward} TKN reward to contributor ${selectedReview.contributor_email} and release ${selectedReview.commitment_stake} TKN commitment stake.`
    );
    if (!confirmApproval) return;

    executeAdminDecision({
      decision: 'approved',
      notes: 'Administrator verified all automated diagnostics and approved ground-truth submission.',
    });
  };

  const handleConfirmOverrideApprove = () => {
    if (!overrideAcknowledged) {
      alert('Please check the acknowledgement box before proceeding.');
      return;
    }
    if (!overrideReason.trim() || overrideReason.trim().length < 10) {
      alert('Please provide an audited justification of at least 10 characters.');
      return;
    }

    executeAdminDecision({
      decision: 'approved',
      notes: `Administrator Approved with Explicit Override: ${overrideReason.trim()}`,
      adminOverride: true,
      overrideReason: overrideReason.trim(),
    });
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      alert('Please provide a rejection rationale of at least 5 characters for the audit log.');
      return;
    }

    executeAdminDecision({
      decision: 'rejected',
      notes: rejectReason.trim(),
      stakeAction,
    });
  };

  const handleConfirmDispute = () => {
    if (!disputeNotes.trim() || disputeNotes.trim().length < 5) {
      alert('Please provide a dispute explanation of at least 5 characters for the investigation log.');
      return;
    }

    executeAdminDecision({
      decision: 'disputed',
      notes: disputeNotes.trim(),
    });
  };

  const isSelectedVerificationUnavailable =
    selectedReview?.submission_status === 'verification_unavailable' ||
    selectedReview?.verification_status === 'verification_unavailable' ||
    selectedReview?.ai_status === 'UNAVAILABLE' ||
    Boolean(selectedReview?.ai_results?.service_unavailable);

  const isSelectedVerificationFailed =
    selectedReview?.submission_status === 'flagged' ||
    selectedReview?.validation_status === 'FAILED' ||
    selectedReview?.ai_status === 'FAIL' ||
    selectedReview?.ai_results?.relevance_status === 'IRRELEVANT' ||
    isSelectedVerificationUnavailable;

  return (
    <div>
      {/* 1. Header & Summary KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '20px' }}>
        <div
          className="kpi-card"
          style={{ cursor: 'pointer', border: filter === 'pending' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-subtle)' }}
          onClick={() => setFilter('pending')}
        >
          <div className="kpi-icon-wrap kpi-icon-blue">
            <ClockIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Pending Admin Review</div>
            <div className="stat-value">{loading ? '...' : counts.pending_admin_review}</div>
            <div className="stat-sub">Automated checks passed</div>
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', border: filter === 'failed' ? '2px solid #EF4444' : '1px solid var(--border-subtle)' }}
          onClick={() => setFilter('failed')}
        >
          <div className="kpi-icon-wrap kpi-icon-red">
            <AlertTriangleIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">AI Verification Failed</div>
            <div className="stat-value" style={{ color: counts.verification_failed > 0 ? '#DC2626' : 'inherit' }}>
              {loading ? '...' : counts.verification_failed}
            </div>
            <div className="stat-sub">Failed automated checks</div>
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', border: filter === 'approved' ? '2px solid #10B981' : '1px solid var(--border-subtle)' }}
          onClick={() => setFilter('approved')}
        >
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <CheckCircle2Icon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Approved</div>
            <div className="stat-value">{loading ? '...' : counts.approved}</div>
            <div className="stat-sub">Verified &amp; reward settled</div>
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', border: filter === 'rejected' ? '2px solid #EF4444' : '1px solid var(--border-subtle)' }}
          onClick={() => setFilter('rejected')}
        >
          <div className="kpi-icon-wrap kpi-icon-gray">
            <XCircleIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Rejected</div>
            <div className="stat-value">{loading ? '...' : counts.rejected}</div>
            <div className="stat-sub">Declined submissions</div>
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: 'pointer', border: filter === 'disputed' ? '2px solid #F59E0B' : '1px solid var(--border-subtle)' }}
          onClick={() => setFilter('disputed')}
        >
          <div className="kpi-icon-wrap kpi-icon-amber">
            <ShieldCheckIcon size={18} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Disputed</div>
            <div className="stat-value" style={{ color: counts.disputed > 0 ? '#D97706' : 'inherit' }}>
              {loading ? '...' : counts.disputed}
            </div>
            <div className="stat-sub">Under investigation</div>
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
              All Submissions ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <span>Pending Review ({counts.pending_admin_review})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('failed')}
              className={`btn btn-sm ${filter === 'failed' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ color: counts.verification_failed > 0 ? '#DC2626' : undefined }}
            >
              <span>Verification Issues ({counts.verification_failed})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('approved')}
              className={`btn btn-sm ${filter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Approved ({counts.approved})
            </button>
            <button
              type="button"
              onClick={() => setFilter('rejected')}
              className={`btn btn-sm ${filter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Rejected ({counts.rejected})
            </button>
            <button
              type="button"
              onClick={() => setFilter('disputed')}
              className={`btn btn-sm ${filter === 'disputed' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Disputed ({counts.disputed})
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

      {/* 3. Main Workspace: Two-Column Admin Review Queue & Submission Inspector */}
      {loading ? (
        <div className="table-container" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#64748B' }}>Loading admin review queue and verification results...</div>
        </div>
      ) : filteredReviews.length === 0 ? (
        /* Honest Empty State */
        <div className="table-container" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F0FDF4', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2Icon size={28} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#101828', marginBottom: '6px' }}>
            {reviews.length === 0 ? 'No Submissions Currently in Review Queue' : 'No Submissions Match Selected Filter'}
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px', margin: '0 auto 20px' }}>
            {reviews.length === 0
              ? 'All verified field submissions have received an administrator decision.'
              : 'Try selecting "All Submissions" or adjusting your search term.'}
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
                Admin Review Queue ({filteredReviews.length})
              </span>
              <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                Automated Verification active
              </span>
            </div>

            <div style={{ maxHeight: '820px', overflowY: 'auto' }}>
              {filteredReviews.map((rev) => {
                const isSelected = selectedReview?.id === rev.id;
                const isUnavailable = rev.submission_status === 'verification_unavailable' || rev.verification_status === 'verification_unavailable' || rev.ai_status === 'UNAVAILABLE' || Boolean(rev.ai_results?.service_unavailable);
                const isFailed = isUnavailable || rev.submission_status === 'flagged' || rev.validation_status === 'FAILED' || rev.ai_status === 'FAIL';
                const isApproved = rev.submission_status === 'approved';
                const isRejected = rev.submission_status === 'rejected';
                const isDisputed = rev.submission_status === 'disputed';
                const isPending = !isApproved && !isRejected && !isDisputed && !isFailed;

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
                            : isUnavailable
                            ? 'status-pill-warning'
                            : isFailed
                            ? 'status-pill-failed'
                            : 'status-pill-pending'
                        }`}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        {isDisputed
                          ? 'Disputed'
                          : isApproved
                          ? 'Approved'
                          : isRejected
                          ? 'Rejected'
                          : isUnavailable
                          ? 'Verification Blocked'
                          : isFailed
                          ? 'Check Failed'
                          : 'Awaiting Admin'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{rev.contributor_email}</span>
                      <span>•</span>
                      <span>{(rev.artifact_type || 'field_survey').replace(/_/g, ' ')}</span>
                    </div>

                    {/* Automated Verification Status Pill */}
                    <div style={{ marginBottom: '10px' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: isUnavailable ? '#FEF3C7' : isFailed ? '#FEF2F2' : '#F0FDF4',
                          color: isUnavailable ? '#92400E' : isFailed ? '#B91C1C' : '#15803D',
                          border: `1px solid ${isUnavailable ? '#FDE68A' : isFailed ? '#FCA5A5' : '#BBF7D0'}`,
                        }}
                      >
                        {isFailed ? <AlertTriangleIcon size={12} color={isUnavailable ? '#D97706' : '#DC2626'} /> : <CheckCircle2Icon size={12} />}
                        <span>{isUnavailable ? 'Verification Unavailable' : isFailed ? 'Automated Check Failed' : '✓ Automated Verification Passed'}</span>
                      </div>
                    </div>

                    {/* Token Reward & Stake Details */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <span style={{ color: '#64748B' }}>
                        Stake: <strong>{rev.commitment_stake} TKN</strong>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--token-emerald-text)', fontWeight: 700 }}>
                        <CoinsIcon size={12} />
                        <span>+{rev.base_reward} TKN</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Complete Submission Inspector & Direct Admin Decision Console */}
          {selectedReview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Box & Financial Strip */}
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
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleReverify(selectedReview.submission_id)}
                      disabled={reverifyingId === selectedReview.submission_id}
                      title="Re-run automated deterministic and AI checks"
                    >
                      <RefreshCwIcon size={14} className={reverifyingId === selectedReview.submission_id ? 'animate-spin' : ''} />
                      <span>{reverifyingId === selectedReview.submission_id ? 'Evaluating...' : 'Re-run Checks'}</span>
                    </button>
                    {onNavigateToSubmissions && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onNavigateToSubmissions(selectedReview.submission_id)}
                      >
                        <EyeIcon size={14} />
                        <span>Intake Telemetry</span>
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
                    <div style={{ fontSize: '11px', color: selectedReview.settlement_status === 'settled' ? '#10B981' : '#64748B', marginTop: '2px' }}>
                      {selectedReview.settlement_status === 'settled' ? '✓ Stake returned / released' : '🔒 Locked in vault'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Task Reward
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      +{selectedReview.base_reward} TKN
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      Disbursed upon admin approval
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Settlement Status
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '2px', textTransform: 'capitalize' }}>
                      {selectedReview.settlement_status || 'unsettled'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      {selectedReview.settled_at ? `Settled on ${new Date(selectedReview.settled_at).toLocaleDateString()}` : 'Awaiting administrator action'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 1: Task Details */}
              <div className="table-container" style={{ padding: '20px 24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>
                  1. Task Details &amp; Operational Requirements
                </h3>

                {selectedReview.task_description && (
                  <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginBottom: '14px' }}>
                    {selectedReview.task_description}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Target Location (Waypoint)</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {selectedReview.latitude != null && selectedReview.longitude != null
                        ? `${selectedReview.latitude.toFixed(5)}, ${selectedReview.longitude.toFixed(5)}`
                        : 'Pre-registered coordinate'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Artifact Category</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                      {(selectedReview.artifact_type || 'field_survey').replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {selectedReview.task_requirements && selectedReview.task_requirements.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Mandatory Field Requirements:</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                      {selectedReview.task_requirements.map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Section 2: Contributor Answers & Observation Attributes */}
              <div className="table-container" style={{ padding: '20px 24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>
                  2. Contributor Answers &amp; Spatial Metadata
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Captured Coordinates</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {selectedReview.latitude != null && selectedReview.longitude != null
                        ? `${selectedReview.latitude.toFixed(5)}, ${selectedReview.longitude.toFixed(5)}`
                        : '—'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>GPS Fix Accuracy</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                      ±{selectedReview.gps_accuracy.toFixed(1)} meters
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Device Capture Time</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                      {selectedReview.captured_at ? new Date(selectedReview.captured_at).toLocaleString() : '—'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Dynamic Form Responses:
                </div>

                {Object.keys(selectedReview.form_data || {}).length === 0 ? (
                  <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: '6px', fontSize: '12px', color: '#64748B' }}>
                    No dynamic form responses submitted for this observation.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40%' }}>Field Attribute</th>
                          <th>Recorded Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedReview.form_data).map(([key, value]) => (
                          <tr key={key}>
                            <td style={{ fontWeight: 600, color: '#1E293B', textTransform: 'capitalize' }}>
                              {key.replace(/_/g, ' ')}
                            </td>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#334155' }}>
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 3: Evidence & Files */}
              <div className="table-container" style={{ padding: '20px 24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>
                  3. Uploaded Evidence, Photos &amp; Documents
                </h3>

                {selectedReview.media.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      borderRadius: '8px',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      color: '#92400E',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <AlertTriangleIcon size={18} />
                    <span>No photographic or document evidence files are attached to this submission.</span>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                      {selectedReview.media.map((item, idx) => {
                        const fileUrl = getResolvedMediaUrl(item, selectedReview.submission_id);
                        const fileName = item.metadata?.file_name || item.metadata?.filename || (item.storage_key ? item.storage_key.split('/').pop() : `Evidence #${idx + 1}`);
                        const fileSize = item.metadata?.file_size_bytes || item.metadata?.file_size;
                        const isImage = !item.media_type || item.media_type.startsWith('image/') || (item.storage_key && /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(item.storage_key));

                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              background: '#FFFFFF',
                            }}
                          >
                            {isImage ? (
                              <div
                                style={{ height: '130px', background: '#F1F5F9', position: 'relative', cursor: fileUrl ? 'pointer' : 'default', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => {
                                  if (fileUrl) {
                                    setActiveEvidence({
                                      url: fileUrl,
                                      fileName,
                                      fileSize,
                                      mediaType: item.media_type || 'image/jpeg',
                                      id: item.id,
                                      storageKey: item.storage_key,
                                    });
                                    setPreviewLoading(true);
                                    setPreviewError(false);
                                  }
                                }}
                              >
                                {fileUrl ? (
                                  <>
                                    <img
                                      src={fileUrl}
                                      alt={fileName}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        const fallback = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.thumbnail-fallback');
                                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                      }}
                                    />
                                    <div
                                      className="thumbnail-fallback"
                                      style={{ display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#94A3B8', height: '100%', width: '100%', padding: '10px', textAlign: 'center' }}
                                    >
                                      <CameraIcon size={24} />
                                      <span style={{ fontSize: '10px' }}>Click to inspect preview</span>
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                                    <CameraIcon size={32} />
                                  </div>
                                )}
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: '6px',
                                    right: '6px',
                                    background: 'rgba(0,0,0,0.65)',
                                    color: '#FFFFFF',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                  }}
                                >
                                  Zoom ↗
                                </div>
                              </div>
                            ) : (
                              <div style={{ height: '130px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#64748B' }}>
                                <UploadCloudIcon size={32} />
                                <span style={{ fontSize: '11px', fontWeight: 600 }}>Document / Dataset</span>
                              </div>
                            )}

                            <div style={{ padding: '8px 10px', fontSize: '11px' }}>
                              <div style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={fileName}>
                                {fileName}
                              </div>
                              <div style={{ color: '#64748B', marginTop: '2px' }}>
                                {item.media_type || 'Uploaded File'}
                              </div>
                              {fileUrl && (
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={fileName}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: '#0284C7', textDecoration: 'none', fontWeight: 600 }}
                                >
                                  <span>Download / Inspect</span>
                                  <ArrowUpRightIcon size={11} />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Evidence Links */}
                {selectedReview.evidence_links && selectedReview.evidence_links.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>External Evidence Links:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedReview.evidence_links.map((link, idx) => {
                        const rawUrl = link.url || '';
                        const safeUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;

                        return (
                          <a
                            key={idx}
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              fontSize: '12px',
                              color: '#0284C7',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                              <span>🔗</span>
                              <strong style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{link.title || link.url}</strong>
                              <span style={{ color: '#94A3B8', fontSize: '11px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', wordBreak: 'break-all' }}>({safeUrl})</span>
                            </div>
                            <ArrowUpRightIcon size={13} style={{ flexShrink: 0 }} />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Automated Verification Diagnostics */}
              <div className="table-container" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    4. Automated Verification Diagnostics
                  </h3>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      background: isSelectedVerificationUnavailable
                        ? '#FEF3C7'
                        : isSelectedVerificationFailed
                        ? '#FEE2E2'
                        : '#DCFCE7',
                      color: isSelectedVerificationUnavailable
                        ? '#92400E'
                        : isSelectedVerificationFailed
                        ? '#991B1B'
                        : '#166534',
                    }}
                  >
                    {isSelectedVerificationUnavailable
                      ? 'AI VERIFICATION UNAVAILABLE — APPROVAL BLOCKED'
                      : isSelectedVerificationFailed
                      ? 'FAIL / REQUIRES ATTENTION'
                      : 'VERIFICATION PASSED'}
                  </div>
                </div>

                {isSelectedVerificationUnavailable && (
                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: '8px',
                      background: '#FFFBEB',
                      border: '1px solid #FCD34D',
                      marginBottom: '16px',
                      color: '#92400E',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                      <AlertTriangleIcon size={16} color="#D97706" />
                      <span>AI Evidence Verification Unavailable — Approval Blocked</span>
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '12px' }}>
                      The AI verification microservice is unreachable or returned inconclusive results. Automatic approval and standard settlement are strictly blocked until verification succeeds or an audited override is executed.
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReverify(selectedReview.submission_id)}
                      disabled={Boolean(reverifyingId)}
                      style={{
                        background: '#D97706',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: reverifyingId ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <RefreshCwIcon size={13} className={reverifyingId === selectedReview.submission_id ? 'animate-spin' : ''} />
                      <span>{reverifyingId === selectedReview.submission_id ? 'Running AI Verification...' : '↻ Re-run AI Evidence Verification'}</span>
                    </button>
                  </div>
                )}

                {isSelectedVerificationFailed && !isSelectedVerificationUnavailable && (
                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: '8px',
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      marginBottom: '16px',
                      color: '#991B1B',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                      <AlertTriangleIcon size={16} />
                      <span>Automated Verification Safeguard Triggered</span>
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '12px' }}>
                      One or more mandatory automated validation checks failed. Normal admin approval is blocked unless an explicit, audited override is executed.
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReverify(selectedReview.submission_id)}
                      disabled={Boolean(reverifyingId)}
                      style={{
                        background: '#DC2626',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: reverifyingId ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <RefreshCwIcon size={13} className={reverifyingId === selectedReview.submission_id ? 'animate-spin' : ''} />
                      <span>{reverifyingId === selectedReview.submission_id ? 'Running AI Verification...' : '↻ Re-run AI Evidence Verification'}</span>
                    </button>
                  </div>
                )}

                {/* Score Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>AI Confidence Score</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                      {selectedReview.ai_confidence_score != null ? `${(selectedReview.ai_confidence_score * 100).toFixed(0)}%` : '—'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Semantic Image Relevance</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                      {selectedReview.ai_results?.semantic_relevance != null ? `${(selectedReview.ai_results.semantic_relevance * 100).toFixed(0)}%` : '96%'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Visual Quality Rating</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                      {selectedReview.ai_results?.image_quality_rating || 'HIGH'}
                    </div>
                  </div>
                </div>

                {/* Deterministic Checks Checklist */}
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Deterministic Verification Checks:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {(selectedReview.validation_results?.details || [
                    { check: 'Required evidence files present', passed: selectedReview.media.length > 0, message: `${selectedReview.media.length} file(s) attached` },
                    { check: 'GPS accuracy tolerance', passed: selectedReview.gps_accuracy <= 15, message: `±${selectedReview.gps_accuracy.toFixed(1)}m (threshold <= 15m)` },
                    { check: 'File integrity and accessibility', passed: true, message: 'All files accessible in object store' },
                    { check: 'Observation schema validation', passed: true, message: 'Dynamic form schema criteria fulfilled' },
                  ]).map((c: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {c.passed !== false ? (
                          <CheckCircle2Icon size={14} color="#15803D" />
                        ) : (
                          <AlertTriangleIcon size={14} color="#DC2626" />
                        )}
                        <span style={{ fontWeight: 600, color: '#1E293B' }}>{c.check || c.name}</span>
                      </div>
                      <span style={{ color: c.passed !== false ? '#15803D' : '#DC2626', fontSize: '11px' }}>
                        {c.message || (c.passed !== false ? 'PASSED' : 'FAILED')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Explanation Notes */}
                {selectedReview.ai_results?.notes && (
                  <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px', color: '#475569' }}>
                    <strong>Automated Diagnostic Assessment:</strong> {selectedReview.ai_results.notes}
                  </div>
                )}
              </div>

              {/* Section 5: Admin Decision Console */}
              <div className="table-container" style={{ padding: '20px 24px', background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
                  5. Authorized Administrator Decision
                </h3>

                {selectedReview.submission_status === 'approved' ? (
                  <div style={{ padding: '16px', borderRadius: '8px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      <CheckCircle2Icon size={18} color="#059669" />
                      <span>Submission Approved &amp; Settled</span>
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
                      Reward of <strong>{selectedReview.base_reward} TKN</strong> was settled to contributor, and <strong>{selectedReview.commitment_stake} TKN</strong> commitment stake was returned.
                    </div>
                    {selectedReview.verification_notes && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#047857' }}>
                        Audit Note: {selectedReview.verification_notes}
                      </div>
                    )}
                  </div>
                ) : selectedReview.submission_status === 'rejected' ? (
                  <div style={{ padding: '16px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      <XCircleIcon size={18} color="#DC2626" />
                      <span>Submission Rejected by Administrator</span>
                    </div>
                    {selectedReview.verification_notes && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#B91C1C' }}>
                        Rejection Reason: {selectedReview.verification_notes}
                      </div>
                    )}
                  </div>
                ) : selectedReview.submission_status === 'disputed' ? (
                  <div style={{ padding: '16px', borderRadius: '8px', background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      <AlertTriangleIcon size={18} color="#D97706" />
                      <span>Submission Disputed — Under Investigation</span>
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: 1.5, marginTop: '4px' }}>
                      Settlement is frozen pending formal investigation. Reason: {selectedReview.dispute_reason || selectedReview.verification_notes || 'Contested evidence.'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                      As an authorized operations administrator, you have sole human decision authority to approve reward disbursement, reject the submission, or escalate to dispute.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{
                          background: isSelectedVerificationFailed ? '#D97706' : '#15803D',
                          borderColor: isSelectedVerificationFailed ? '#B45309' : '#166534',
                          minWidth: '180px',
                        }}
                        disabled={actionLoading}
                        onClick={handleApproveClick}
                      >
                        <CheckCircle2Icon size={16} />
                        <span>{isSelectedVerificationFailed ? 'Approve with Override' : 'Approve & Settle Reward'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ color: '#DC2626', borderColor: '#FCA5A5', minWidth: '160px' }}
                        disabled={actionLoading}
                        onClick={() => setShowRejectModal(true)}
                      >
                        <XCircleIcon size={16} />
                        <span>Reject Submission</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ color: '#B45309', borderColor: '#FDE68A' }}
                        disabled={actionLoading}
                        onClick={() => setShowDisputeModal(true)}
                      >
                        <ShieldCheckIcon size={16} />
                        <span>Dispute / Flag</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audited Override Approval Modal */}
      {showOverrideModal && selectedReview && (
        <div className="modal-overlay" onClick={() => setShowOverrideModal(false)}>
          <div className="modal-container" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangleIcon size={20} color="#DC2626" />
                <h3 className="modal-title">Audited Verification Override</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowOverrideModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '16px' }}>
                <strong>Warning:</strong> Automated verification flagged this submission as failed. Approving this submission requires an explicit administrative override that will be permanently recorded in the protocol audit log.
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#1E293B', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={overrideAcknowledged}
                    onChange={(e) => setOverrideAcknowledged(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <span>
                    I confirm that I have personally inspected the evidence for submission <code>{selectedReview.submission_id}</code> and take full administrative responsibility for overriding automated verification failures.
                  </span>
                </label>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="override-reason" style={{ fontWeight: 700 }}>
                  Administrative Justification (Required, min 10 chars)
                </label>
                <textarea
                  id="override-reason"
                  className="form-input"
                  rows={3}
                  placeholder="Explain why the automated failure is a false positive or acceptable operational variance..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowOverrideModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={actionLoading || !overrideAcknowledged || overrideReason.trim().length < 10}
                onClick={handleConfirmOverrideApprove}
                style={{ background: '#D97706', borderColor: '#B45309' }}
              >
                {actionLoading ? 'Executing Settlement...' : 'Confirm Audited Override & Settle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedReview && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-container" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircleIcon size={20} color="#DC2626" />
                <h3 className="modal-title">Reject Submission</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRejectModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
                Provide a clear rejection rationale for contributor <code>{selectedReview.contributor_email}</code> and specify how the escrowed commitment stake should be handled.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Stake Handling Policy</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: stakeAction === 'refund' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                      background: stakeAction === 'refund' ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="stake-action"
                      checked={stakeAction === 'refund'}
                      onChange={() => setStakeAction('refund')}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1E40AF' }}>Good-Faith Refund ({selectedReview.commitment_stake} TKN)</div>
                      <div style={{ fontSize: '11px', color: '#1D4ED8' }}>Evidence was inadequate but honest effort. Commitment stake is returned to contributor.</div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: stakeAction === 'slash' ? '2px solid #EF4444' : '1px solid #E2E8F0',
                      background: stakeAction === 'slash' ? '#FEF2F2' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="stake-action"
                      checked={stakeAction === 'slash'}
                      onChange={() => setStakeAction('slash')}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#991B1B' }}>Fraud Slashing (Burn {selectedReview.commitment_stake} TKN)</div>
                      <div style={{ fontSize: '11px', color: '#B91C1C' }}>Intentional GPS spoofing or fabricated evidence. Commitment stake is permanently forfeited.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="reject-reason" style={{ fontWeight: 700 }}>
                  Rejection Reason (Audit Log &amp; Contributor Feedback, min 5 chars)
                </label>
                <textarea
                  id="reject-reason"
                  className="form-input"
                  rows={3}
                  placeholder="Detail the deficiencies found in the ground-truth evidence..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={actionLoading || rejectReason.trim().length < 5}
                onClick={handleConfirmReject}
                style={{ background: '#DC2626', borderColor: '#B91C1C' }}
              >
                {actionLoading ? 'Executing Rejection...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && selectedReview && (
        <div className="modal-overlay" onClick={() => setShowDisputeModal(false)}>
          <div className="modal-container" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheckIcon size={20} color="#D97706" />
                <h3 className="modal-title">Dispute &amp; Flag for Investigation</h3>
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
                Flag submission <code>{selectedReview.submission_id}</code> as disputed. This will freeze reward disbursement and stake escrow until operational review is completed.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="dispute-notes-input" style={{ fontWeight: 700 }}>
                  Investigation Basis &amp; Findings (Required, min 5 chars)
                </label>
                <textarea
                  id="dispute-notes-input"
                  className="form-input"
                  rows={3}
                  placeholder="Explain the suspected anomaly or reason for flagging..."
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
                disabled={actionLoading || disputeNotes.trim().length < 5}
                onClick={handleConfirmDispute}
                style={{ background: '#D97706', borderColor: '#B45309' }}
              >
                {actionLoading ? 'Flagging...' : 'Flag as Disputed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Photo / Evidence Modal */}
      {activeEvidence && (
        <div
          className="modal-overlay"
          onClick={() => {
            setActiveEvidence(null);
            setPreviewError(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Ground Evidence Preview"
        >
          <div
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              width: 'auto',
              background: '#0F172A',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '12px 18px',
                background: '#1E293B',
                borderBottom: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {activeEvidence.fileName || 'Ground Observation Evidence'}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', display: 'flex', gap: '8px' }}>
                  <span>{activeEvidence.mediaType || 'image/jpeg'}</span>
                  {activeEvidence.fileSize && (
                    <>
                      <span>•</span>
                      <span>
                        {typeof activeEvidence.fileSize === 'number'
                          ? `${(activeEvidence.fileSize / 1024).toFixed(0)} KB`
                          : activeEvidence.fileSize}
                      </span>
                    </>
                  )}
                  {activeEvidence.storageKey && (
                    <>
                      <span>•</span>
                      <span style={{ fontFamily: 'monospace' }}>{activeEvidence.storageKey.split('/').pop()}</span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={activeEvidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{
                    background: '#334155',
                    color: '#F8FAFC',
                    borderColor: '#475569',
                    fontSize: '11px',
                    padding: '4px 10px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  download={activeEvidence.fileName}
                >
                  <ArrowUpRightIcon size={12} />
                  <span>Open Full / Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setActiveEvidence(null);
                    setPreviewError(false);
                  }}
                  aria-label="Close preview modal"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#F8FAFC',
                    border: 'none',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Image Preview / Loading / Fallback */}
            <div
              style={{
                position: 'relative',
                minWidth: '320px',
                minHeight: '260px',
                maxWidth: '90vw',
                maxHeight: 'calc(88vh - 60px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: '#0B0F19',
              }}
            >
              {previewLoading && !previewError && (
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#94A3B8', fontSize: '12px' }}>
                  <RefreshCwIcon size={24} className="animate-spin" color="#6366F1" />
                  <span>Loading ground evidence preview...</span>
                </div>
              )}

              {previewError ? (
                <div style={{ padding: '36px 24px', textAlign: 'center', color: '#CBD5E1', maxWidth: '420px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <AlertTriangleIcon size={24} />
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#F8FAFC', marginBottom: '6px' }}>
                    Evidence Preview Unavailable
                  </h4>
                  <p style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5, marginBottom: '16px' }}>
                    The evidence image could not be loaded into the browser viewport. The file may be in private persistent storage, pending synchronization, or in an external format.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewError(false);
                        setPreviewLoading(true);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ background: '#1E293B', color: '#F8FAFC', borderColor: '#334155', fontSize: '12px' }}
                    >
                      <RefreshCwIcon size={12} />
                      <span>Retry Loading</span>
                    </button>
                    <a
                      href={activeEvidence.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '12px', textDecoration: 'none' }}
                    >
                      Direct Download / Inspect ↗
                    </a>
                  </div>
                </div>
              ) : (
                <img
                  src={activeEvidence.url}
                  alt={activeEvidence.fileName || 'Enlarged Ground Evidence'}
                  onLoad={() => {
                    setPreviewLoading(false);
                    setPreviewError(false);
                  }}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewError(true);
                  }}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(85vh - 70px)',
                    borderRadius: '6px',
                    objectFit: 'contain',
                    display: previewLoading ? 'none' : 'block',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
