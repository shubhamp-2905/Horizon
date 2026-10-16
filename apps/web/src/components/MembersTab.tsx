'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UsersIcon,
  SearchIcon,
  RefreshCwIcon,
  ChevronRightIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  CoinsIcon,
  ClockIcon,
  MapPinIcon,
  LayersIcon,
  EyeIcon,
  ArrowRightIcon,
} from './Icons';

export interface MemberLocationInfo {
  source: 'profile' | 'field_submission' | 'unavailable';
  display_text: string;
  latitude?: number | null;
  longitude?: number | null;
  recorded_at?: string | null;
  context_note?: string | null;
}

export interface MemberSummary {
  id: string;
  email: string;
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role: string;
  status: string;
  is_verified: boolean;
  created_at: string;
  last_active_at?: string | null;
  location: MemberLocationInfo;
  tkn_balance: number;
  available_balance: number;
  locked_balance: number;
  total_awarded_tkn: number;
  tasks_claimed_count: number;
  tasks_completed_count: number;
  submissions_count: number;
}

export interface MemberOverviewStats {
  total_registered_members: number;
  active_recently_count: number;
  recent_activity_window_days: number;
  members_awarded_tkn_count: number;
  online_members_count?: number | null;
}

export interface MemberTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  direction: 'credit' | 'debit';
  status: string;
  reference?: string | null;
  created_at: string;
  related_task_title?: string | null;
}

export interface MemberClaim {
  id: string;
  task_id: string;
  task_title: string;
  status: string;
  claimed_at: string;
  expires_at?: string | null;
  stake_amount: number;
}

export interface MemberSubmission {
  id: string;
  task_id: string;
  task_title: string;
  status: string;
  submitted_at: string;
  latitude?: number | null;
  longitude?: number | null;
  reward_amount?: number | null;
}

export interface MemberDetail extends MemberSummary {
  transactions: MemberTransaction[];
  claims: MemberClaim[];
  submissions: MemberSubmission[];
}

interface MembersTabProps {
  apiBaseUrl: string;
  adminToken?: string | null;
}

export const MembersTab: React.FC<MembersTabProps> = ({ apiBaseUrl, adminToken }) => {
  // Stats state
  const [stats, setStats] = useState<MemberOverviewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Members list state
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Selected Member Detail Modal
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'ledger' | 'tasks'>('overview');

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [adminToken]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/members/stats`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to load member statistics (HTTP ${res.status})`);
      }
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setStatsError(err.message || 'Error fetching stats');
    } finally {
      setStatsLoading(false);
    }
  }, [apiBaseUrl, getAuthHeaders]);

  // Fetch Members List
  const fetchMembers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      if (searchQuery.trim()) {
        params.set('query', searchQuery.trim());
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`${apiBaseUrl}/admin/members?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch members list (HTTP ${res.status})`);
      }
      const data = await res.json();
      setMembers(data.members || data.items || []);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      setListError(err.message || 'Error fetching members');
    } finally {
      setListLoading(false);
    }
  }, [apiBaseUrl, getAuthHeaders, page, pageSize, searchQuery, statusFilter, sortBy, sortOrder]);

  // Fetch Member Details
  const fetchMemberDetail = useCallback(
    async (memberId: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/admin/members/${memberId}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          throw new Error(`Failed to retrieve member details (HTTP ${res.status})`);
        }
        const data = await res.json();
        setDetailData(data);
      } catch (err: any) {
        setDetailError(err.message || 'Error loading member details');
      } finally {
        setDetailLoading(false);
      }
    },
    [apiBaseUrl, getAuthHeaders]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchMemberDetail(selectedMemberId);
    } else {
      setDetailData(null);
    }
  }, [selectedMemberId, fetchMemberDetail]);

  const handleRefresh = () => {
    fetchStats();
    fetchMembers();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Never active';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Never active';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'MB';
  };

  return (
    <div>
      {/* 3.1 Members Overview Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '24px' }}>
        {/* Card 1: Total Registered */}
        <div className="kpi-card" id="kpi-registered-members">
          <div className="kpi-icon-wrap kpi-icon-blue">
            <UsersIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Registered Members</div>
            <div className="stat-value">
              {statsLoading ? '...' : stats ? stats.total_registered_members.toLocaleString() : '—'}
            </div>
            <div className="stat-sub">Excludes system administrators</div>
          </div>
        </div>

        {/* Card 2: Active Recently (30d) */}
        <div className="kpi-card" id="kpi-active-recently">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <ClockIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Active Recently</div>
            <div className="stat-value">
              {statsLoading ? '...' : stats ? stats.active_recently_count.toLocaleString() : '—'}
            </div>
            <div className="stat-sub">
              {stats ? `Activity in last ${stats.recent_activity_window_days} days` : 'Last 30-day window'}
            </div>
          </div>
        </div>

        {/* Card 3: Awarded TKN */}
        <div className="kpi-card" id="kpi-awarded-members">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <CoinsIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Rewarded Members</div>
            <div className="stat-value">
              {statsLoading ? '...' : stats ? stats.members_awarded_tkn_count.toLocaleString() : '—'}
            </div>
            <div className="stat-sub">Received completed TKN awards</div>
          </div>
        </div>

        {/* Card 4: Real-time Online Telemetry Status */}
        <div className="kpi-card" id="kpi-online-status">
          <div className="kpi-icon-wrap kpi-icon-gray">
            <MapPinIcon size={20} />
          </div>
          <div className="kpi-content">
            <div className="stat-label">Session Telemetry</div>
            <div className="stat-value" style={{ fontSize: '18px', fontWeight: 700 }}>
              Event-Driven
            </div>
            <div className="stat-sub" title="Horizon records activity on claims and submissions without battery-draining continuous heartbeats">
              Persistent tracking avoided
            </div>
          </div>
        </div>
      </div>

      {statsError && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--status-error-subtle)',
            border: '1px solid var(--status-error-border)',
            color: 'var(--status-error-text)',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangleIcon size={16} />
            <span>Failed to refresh member statistics: {statsError}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchStats}>
            Retry
          </button>
        </div>
      )}

      {/* 3.3 Search, Filtering, and Sorting Controls */}
      <div className="controls-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div className="search-bar" style={{ minWidth: '260px', flex: 1, maxWidth: '400px' }}>
            <SearchIcon size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search member by username or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
          >
            <option value="created_at">Sort by Join Date</option>
            <option value="last_active_at">Sort by Last Active</option>
            <option value="tkn_balance">Sort by TKN Balance</option>
            <option value="username">Sort by Username</option>
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title="Toggle ascending / descending sort order"
          >
            {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCwIcon size={14} className={listLoading || statsLoading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 3.2 Members Table */}
      <div className="table-container" style={{ position: 'relative' }}>
        {listError ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <div style={{ color: 'var(--status-error-text)', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
              Failed to load member records: {listError}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchMembers}>
              Retry Query
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th>Last Active</th>
                  <th>Location</th>
                  <th>TKN Balance</th>
                  <th>Tasks</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listLoading && members.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <RefreshCwIcon size={16} className="spinning" />
                        <span>Querying registered members ledger...</span>
                      </div>
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '56px 16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--text-muted)' }}>
                        <UsersIcon size={24} />
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {searchQuery.trim() || statusFilter !== 'all' ? 'No matching members found' : 'No registered members yet'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto' }}>
                        {searchQuery.trim() || statusFilter !== 'all'
                          ? 'Try adjusting your search keywords or filter criteria.'
                          : 'As field contributors sign up and participate in data collection, they will appear in this directory.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const initials = getInitials(m.full_name || m.username, m.email);
                    const isStatusActive = m.status === 'active';
                    return (
                      <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedMemberId(m.id)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {m.avatar_url ? (
                              <img
                                src={m.avatar_url}
                                alt={m.username}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #15803D 0%, #059669 100%)',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  flexShrink: 0,
                                }}
                              >
                                {initials}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                                {m.full_name || m.username}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                @{m.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {m.email}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {formatDateOnly(m.created_at)}
                        </td>
                        <td style={{ fontSize: '12px', color: m.last_active_at ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {formatDateTime(m.last_active_at)}
                        </td>
                        <td style={{ fontSize: '12px', maxWidth: '240px' }}>
                          <span
                            title={m.location.context_note || m.location.display_text}
                            style={{
                              color: m.location.source === 'unavailable' ? 'var(--text-muted)' : 'var(--text-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <MapPinIcon size={13} color={m.location.source === 'unavailable' ? '#94A3B8' : '#15803D'} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                              {m.location.display_text}
                            </span>
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#15803D', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                            {m.tkn_balance.toLocaleString()} TKN
                          </div>
                          {m.locked_balance > 0 && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              ({m.locked_balance} locked)
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <div>
                            <strong>{m.tasks_claimed_count}</strong> claimed
                          </div>
                          <div style={{ fontSize: '11px', color: '#15803D' }}>
                            <strong>{m.tasks_completed_count}</strong> verified
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${isStatusActive ? 'status-pill-passed' : 'status-pill-warning'}`}>
                            {isStatusActive ? <CheckCircle2Icon size={12} /> : <AlertTriangleIcon size={12} />}
                            <span style={{ textTransform: 'capitalize' }}>{m.status}</span>
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMemberId(m.id);
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            Showing <strong>{members.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> -{' '}
            <strong>{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> registered members
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1 || listLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span style={{ padding: '0 6px', fontWeight: 600 }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages || listLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 3.4 Member Detail Modal / Drawer View */}
      {selectedMemberId && (
        <div className="modal-overlay" onClick={() => setSelectedMemberId(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #15803D 0%, #059669 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '15px',
                  }}
                >
                  {detailData ? getInitials(detailData.full_name || detailData.username, detailData.email) : '...'}
                </div>
                <div>
                  <h2 className="modal-title" style={{ fontSize: '18px', margin: 0 }}>
                    {detailData ? detailData.full_name || detailData.username : 'Member Profile'}
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {detailData?.email} · Member ID: <span style={{ fontFamily: 'monospace' }}>{selectedMemberId.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedMemberId(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Sub-tabs */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '0 24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
              }}
            >
              <button
                type="button"
                onClick={() => setDetailTab('overview')}
                style={{
                  padding: '12px 14px',
                  fontSize: '13px',
                  fontWeight: detailTab === 'overview' ? 700 : 500,
                  color: detailTab === 'overview' ? '#15803D' : 'var(--text-secondary)',
                  borderBottom: detailTab === 'overview' ? '2px solid #15803D' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                }}
              >
                Overview & Location
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('ledger')}
                style={{
                  padding: '12px 14px',
                  fontSize: '13px',
                  fontWeight: detailTab === 'ledger' ? 700 : 500,
                  color: detailTab === 'ledger' ? '#15803D' : 'var(--text-secondary)',
                  borderBottom: detailTab === 'ledger' ? '2px solid #15803D' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                }}
              >
                Token Ledger ({detailData?.transactions?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('tasks')}
                style={{
                  padding: '12px 14px',
                  fontSize: '13px',
                  fontWeight: detailTab === 'tasks' ? 700 : 500,
                  color: detailTab === 'tasks' ? '#15803D' : 'var(--text-secondary)',
                  borderBottom: detailTab === 'tasks' ? '2px solid #15803D' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                }}
              >
                Tasks & Submissions ({detailData?.claims?.length ?? 0})
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {detailLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCwIcon size={20} className="spinning" />
                  <div style={{ marginTop: '8px', fontSize: '13px' }}>Loading member audit dossier...</div>
                </div>
              ) : detailError ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--status-error-text)' }}>
                  {detailError}
                </div>
              ) : detailData ? (
                <>
                  {detailTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Financial Balance Summary */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: '12px',
                        }}
                      >
                        <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Available Balance
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                            {detailData.available_balance.toLocaleString()} TKN
                          </div>
                        </div>

                        <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Locked In Commitments
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                            {detailData.locked_balance.toLocaleString()} TKN
                          </div>
                        </div>

                        <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Cumulative Awarded
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                            {detailData.total_awarded_tkn.toLocaleString()} TKN
                          </div>
                        </div>
                      </div>

                      {/* Location & Activity Context */}
                      <div
                        style={{
                          padding: '16px',
                          background: 'var(--bg-input)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <MapPinIcon size={16} color="#15803D" />
                          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            Location Information & Operational Context
                          </h3>
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {detailData.location.display_text}
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          {detailData.location.context_note}
                        </div>

                        {detailData.location.latitude && detailData.location.longitude && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '8px 12px',
                              background: 'var(--bg-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Coordinates: {detailData.location.latitude.toFixed(6)}, {detailData.location.longitude.toFixed(6)} · Captured:{' '}
                            {formatDateTime(detailData.location.recorded_at)}
                          </div>
                        )}
                      </div>

                      {/* Account Timestamps & Security Details */}
                      <div
                        style={{
                          padding: '16px',
                          background: 'var(--bg-input)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                          Account Metadata
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Registered: </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {formatDateTime(detailData.created_at)}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Last Activity: </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {formatDateTime(detailData.last_active_at)}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Account Status: </span>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                              {detailData.status}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Role: </span>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                              {detailData.role}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === 'ledger' && (
                    <div>
                      {detailData.transactions.length === 0 ? (
                        <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No token transactions recorded for this member.
                        </div>
                      ) : (
                        <table className="data-table" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Direction</th>
                              <th>Amount</th>
                              <th>Reference / Task</th>
                              <th>Date</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.transactions.map((tx) => (
                              <tr key={tx.id}>
                                <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                  {tx.transaction_type.replace(/_/g, ' ')}
                                </td>
                                <td>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: tx.direction === 'credit' ? '#DCFCE7' : '#FEE2E2',
                                      color: tx.direction === 'credit' ? '#15803D' : '#DC2626',
                                    }}
                                  >
                                    {tx.direction.toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                                  {tx.direction === 'credit' ? '+' : '-'}
                                  {tx.amount.toLocaleString()} TKN
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>
                                  {tx.related_task_title || tx.reference || '—'}
                                </td>
                                <td style={{ color: 'var(--text-muted)' }}>
                                  {formatDateTime(tx.created_at)}
                                </td>
                                <td>
                                  <span style={{ textTransform: 'capitalize', fontSize: '11px', color: '#15803D', fontWeight: 600 }}>
                                    {tx.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {detailTab === 'tasks' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                          Task Claims ({detailData.claims.length})
                        </h4>
                        {detailData.claims.length === 0 ? (
                          <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '12px' }}>
                            No task claims recorded.
                          </div>
                        ) : (
                          <table className="data-table" style={{ fontSize: '12px' }}>
                            <thead>
                              <tr>
                                <th>Task Title</th>
                                <th>Stake</th>
                                <th>Status</th>
                                <th>Claimed At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.claims.map((c) => (
                                <tr key={c.id}>
                                  <td style={{ fontWeight: 600 }}>{c.task_title}</td>
                                  <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{c.stake_amount} TKN</td>
                                  <td style={{ textTransform: 'capitalize' }}>{c.status}</td>
                                  <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(c.claimed_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                          Submissions History ({detailData.submissions.length})
                        </h4>
                        {detailData.submissions.length === 0 ? (
                          <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '12px' }}>
                            No submissions submitted by this member.
                          </div>
                        ) : (
                          <table className="data-table" style={{ fontSize: '12px' }}>
                            <thead>
                              <tr>
                                <th>Task Title</th>
                                <th>Status</th>
                                <th>Coordinates</th>
                                <th>Submitted At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.submissions.map((s) => (
                                <tr key={s.id}>
                                  <td style={{ fontWeight: 600 }}>{s.task_title}</td>
                                  <td style={{ textTransform: 'capitalize' }}>{s.status}</td>
                                  <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                                    {s.latitude && s.longitude ? `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}` : '—'}
                                  </td>
                                  <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(s.submitted_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedMemberId(null)}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
