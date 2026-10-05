'use client';

import React, { useState } from 'react';
import {
  LogoMark,
  CompassIcon,
  MapPinIcon,
  LayersIcon,
  CameraIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ClockIcon,
  CoinsIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  SearchIcon,
  UploadCloudIcon,
  CheckIcon,
  XCircleIcon,
  UsersIcon,
} from './Icons';
import type { AdminTaskItem } from './OverviewTab';

interface ContributorPortalProps {
  tasks: AdminTaskItem[];
  onReturnToLanding: () => void;
}

interface ContributorClaim {
  task: AdminTaskItem;
  claimedAt: string;
  expiresInMinutes: number;
  status: 'claimed' | 'in_progress' | 'submitted';
}

interface ContributorSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  artifactType: string;
  submittedAt: string;
  photoCount: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  statusTimeline: 'collected' | 'submitted' | 'community_review' | 'admin_review' | 'verified' | 'rejected';
  votes: { approve: number; reject: number; flag: number; quorum: number };
  rewardAmount: number;
  stakeAmount: number;
}

interface CommunitySubmissionItem {
  id: string;
  taskTitle: string;
  artifactType: string;
  contributorHandle: string;
  submittedAt: string;
  latitude: number;
  longitude: number;
  observationSummary: string;
  imageUrl: string;
  userVote: 'none' | 'accept' | 'reject' | 'flag';
  votes: { approve: number; reject: number; flag: number; quorum: number };
}

export const ContributorPortal: React.FC<ContributorPortalProps> = ({
  tasks,
  onReturnToLanding,
}) => {
  // Navigation tabs: Home | Tasks | Community | My Contributions | Profile
  const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'community' | 'contributions' | 'profile'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [contributionsFilter, setContributionsFilter] = useState<string>('all');

  // User Token & Stake State
  const [availableTokens, setAvailableTokens] = useState<number>(100);
  const [lockedStake, setLockedStake] = useState<number>(20);

  // Active claimed tasks
  const [claimedTasks, setClaimedTasks] = useState<ContributorClaim[]>([
    {
      task: tasks[0] || {
        id: '4ffea264-89ec-402f-b470-f4a058729ddd',
        title: 'Community Water Source Survey',
        description: 'Document water dispensary condition, flow rate, and contamination risk.',
        artifact_type: 'water_source',
        status: 'published',
        difficulty: 2.0,
        scarcity: 1.5,
        base_reward: 150,
        commitment_stake: 20,
        estimated_effort_minutes: 25,
        latitude: 18.5204,
        longitude: 73.8567,
        requirements: ['2 geotagged photos', 'Flow rate test', 'Safety label confirmation'],
        created_at: new Date().toISOString(),
      },
      claimedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      expiresInMinutes: 45,
      status: 'claimed',
    },
  ]);

  // Contributor's own submissions
  const [mySubmissions, setMySubmissions] = useState<ContributorSubmission[]>([
    {
      id: 'sub_001_hzn',
      taskId: '8a1c93f0-4521-419b-a012-78d91a2bc45e',
      taskTitle: 'Rooftop Solar Array Inspection',
      artifactType: 'solar_installation',
      submittedAt: '3 hours ago',
      photoCount: 2,
      latitude: 18.5312,
      longitude: 73.8445,
      accuracy: 2.1,
      statusTimeline: 'verified',
      votes: { approve: 3, reject: 0, flag: 0, quorum: 3 },
      rewardAmount: 200,
      stakeAmount: 30,
    },
    {
      id: 'sub_002_hzn',
      taskId: '4ffea264-89ec-402f-b470-f4a058729ddd',
      taskTitle: 'Community Water Source Survey',
      artifactType: 'water_source',
      submittedAt: '25 min ago',
      photoCount: 2,
      latitude: 18.5204,
      longitude: 73.8567,
      accuracy: 1.8,
      statusTimeline: 'community_review',
      votes: { approve: 2, reject: 0, flag: 0, quorum: 3 },
      rewardAmount: 150,
      stakeAmount: 20,
    },
  ]);

  // Community Review Queue (Submissions from other contributors awaiting review)
  const [communitySubmissions, setCommunitySubmissions] = useState<CommunitySubmissionItem[]>([
    {
      id: 'comm_sub_101',
      taskTitle: 'Community Water Source Survey',
      artifactType: 'water_source',
      contributorHandle: 'scout_maya',
      submittedAt: '12 min ago',
      latitude: 18.52043,
      longitude: 73.85672,
      observationSummary: 'Manual hand pump functional. Clean clarity, concrete drainage slab intact, zero biological contamination runoff.',
      imageUrl: '/horizon_orbit_glow.jpg',
      userVote: 'none',
      votes: { approve: 2, reject: 0, flag: 0, quorum: 3 },
    },
    {
      id: 'comm_sub_102',
      taskTitle: 'Rooftop Solar Array Inspection',
      artifactType: 'solar_installation',
      contributorHandle: 'scout_kavita',
      submittedAt: '35 min ago',
      latitude: 18.53121,
      longitude: 73.84458,
      observationSummary: '12-panel monocrystalline string verified. Slight dust accumulation on lower row; digital inverter reads 4.2kW operating output.',
      imageUrl: '/horizon_orbit_glow.jpg',
      userVote: 'none',
      votes: { approve: 1, reject: 0, flag: 1, quorum: 3 },
    },
    {
      id: 'comm_sub_103',
      taskTitle: 'Micro-Grid Transformer Substation',
      artifactType: 'telecom_tower',
      contributorHandle: 'scout_arjun',
      submittedAt: '1 hour ago',
      latitude: 18.50892,
      longitude: 73.86315,
      observationSummary: 'Substation enclosure fence securely locked. Warning signs legible, ground earthing wire inspected and undamaged.',
      imageUrl: '/horizon_orbit_glow.jpg',
      userVote: 'none',
      votes: { approve: 0, reject: 0, flag: 0, quorum: 2 },
    },
  ]);

  // Field Data Collection Modal State
  const [activeCollectionTask, setActiveCollectionTask] = useState<AdminTaskItem | null>(null);
  const [collectionStep, setCollectionStep] = useState<number>(1);
  const [gpsLocked, setGpsLocked] = useState<boolean>(true);
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(2.4);
  const [observationNotes, setObservationNotes] = useState<string>('');
  const [flowStatus, setFlowStatus] = useState<string>('functional');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Community Review Action (ACCEPT | REJECT | FLAG strictly — NO EDIT ACCESS)
  const handleCommunityVote = (subId: string, decision: 'accept' | 'reject' | 'flag') => {
    setCommunitySubmissions((prev) =>
      prev.map((sub) => {
        if (sub.id !== subId) return sub;
        const newVotes = { ...sub.votes };
        if (decision === 'accept') newVotes.approve += 1;
        if (decision === 'reject') newVotes.reject += 1;
        if (decision === 'flag') newVotes.flag += 1;
        return {
          ...sub,
          userVote: decision,
          votes: newVotes,
        };
      })
    );

    const labels = {
      accept: 'Accepted ("This submission looks valid")',
      reject: 'Rejected ("This submission appears incorrect")',
      flag: 'Flagged ("This submission needs attention")',
    };
    showToast(`Review recorded: ${labels[decision]}`);
  };

  // Claim Task Handler
  const handleClaimTask = (task: AdminTaskItem) => {
    if (availableTokens < task.commitment_stake) {
      showToast('Insufficient HZN token balance for commitment stake.');
      return;
    }

    setAvailableTokens((prev) => prev - task.commitment_stake);
    setLockedStake((prev) => prev + task.commitment_stake);

    const newClaim: ContributorClaim = {
      task,
      claimedAt: new Date().toISOString(),
      expiresInMinutes: 60,
      status: 'claimed',
    };

    setClaimedTasks((prev) => [newClaim, ...prev]);
    showToast(`Task "${task.title}" claimed. ${task.commitment_stake} HZN staked in protocol escrow.`);
  };

  // Finalize Submission
  const handleSubmitCollection = () => {
    if (!activeCollectionTask) return;

    const newSub: ContributorSubmission = {
      id: `sub_${Date.now().toString(36)}`,
      taskId: activeCollectionTask.id,
      taskTitle: activeCollectionTask.title,
      artifactType: activeCollectionTask.artifact_type,
      submittedAt: 'Just now',
      photoCount: 2,
      latitude: activeCollectionTask.latitude,
      longitude: activeCollectionTask.longitude,
      accuracy: gpsAccuracy,
      statusTimeline: 'submitted',
      votes: { approve: 0, reject: 0, flag: 0, quorum: 3 },
      rewardAmount: activeCollectionTask.base_reward,
      stakeAmount: activeCollectionTask.commitment_stake,
    };

    setMySubmissions((prev) => [newSub, ...prev]);
    setClaimedTasks((prev) => prev.filter((c) => c.task.id !== activeCollectionTask.id));
    setActiveCollectionTask(null);
    setCollectionStep(1);
    setActiveTab('contributions');
    showToast('Field observation submitted! Queued for Community Review.');
  };

  // Filtered Tasks
  const filteredTasks = tasks.filter((t) => {
    if (t.status !== 'published') return false;
    const matchesCategory = selectedCategory === 'all' || t.artifact_type === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filtered My Contributions
  const filteredContributions = mySubmissions.filter((sub) => {
    if (contributionsFilter === 'all') return true;
    if (contributionsFilter === 'active') return sub.statusTimeline === 'collected' || sub.statusTimeline === 'submitted';
    if (contributionsFilter === 'under_review') return sub.statusTimeline === 'community_review' || sub.statusTimeline === 'admin_review';
    if (contributionsFilter === 'verified') return sub.statusTimeline === 'verified';
    if (contributionsFilter === 'rejected') return sub.statusTimeline === 'rejected';
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Bar — Contributor Experience */}
      <header className="contributor-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={onReturnToLanding}
          >
            <div className="brand-logo-mark" style={{ width: '34px', height: '34px' }}>
              <LogoMark size={18} />
            </div>
            <div>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                HORIZON
              </span>
              <span style={{ fontSize: '10px', color: 'var(--cyan-glow)', display: 'block', fontWeight: 700, letterSpacing: '0.6px', marginTop: '-2px' }}>
                CONTRIBUTOR
              </span>
            </div>
          </div>

          {/* User Navigation (Section 23: Home, Tasks, Community, My Contributions, Profile) */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'home' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('home')}
            >
              Home
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'tasks' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('tasks')}
            >
              Tasks
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'community' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('community')}
            >
              Community Review
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'contributions' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('contributions')}
            >
              My Contributions
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
          </nav>
        </div>

        {/* Token Balance Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="contributor-balance-pill">
            <span className="contributor-balance-dot" />
            <span className="contributor-balance-text">{availableTokens} HZN Available</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({lockedStake} staked)</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onReturnToLanding}
          >
            <span>Exit Portal</span>
          </button>
        </div>
      </header>

      {/* Main Contributor Viewport */}
      <main className="content-viewport" style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        {/* =========================================================================
            TAB 1: USER DASHBOARD (Section 22)
            ========================================================================= */}
        {activeTab === 'home' && (
          <div>
            {/* My Activity Metrics */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
                My Activity
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Overview of your field collections, consensus reviews, and token balance.
              </p>
            </div>

            <div className="stats-grid">
              <div className="kpi-card">
                <div className="kpi-icon-wrap kpi-icon-blue">
                  <LayersIcon size={20} />
                </div>
                <div className="kpi-content">
                  <div className="stat-label">Active Contributions</div>
                  <div className="stat-value">{claimedTasks.length + mySubmissions.filter((s) => s.statusTimeline !== 'verified').length}</div>
                  <div className="stat-sub">In progress or review</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrap kpi-icon-blue">
                  <UsersIcon size={20} />
                </div>
                <div className="kpi-content">
                  <div className="stat-label">Pending Reviews</div>
                  <div className="stat-value">{communitySubmissions.filter((c) => c.userVote === 'none').length}</div>
                  <div className="stat-sub">Community submissions</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrap kpi-icon-emerald">
                  <CheckCircle2Icon size={20} />
                </div>
                <div className="kpi-content">
                  <div className="stat-label">Verified Contributions</div>
                  <div className="stat-value">{mySubmissions.filter((s) => s.statusTimeline === 'verified').length}</div>
                  <div className="stat-sub">Committed to ground truth</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrap kpi-icon-blue">
                  <CoinsIcon size={20} />
                </div>
                <div className="kpi-content">
                  <div className="stat-label">Token Balance</div>
                  <div className="stat-value">{availableTokens} HZN</div>
                  <div className="stat-sub">{lockedStake} HZN locked in stake</div>
                </div>
              </div>
            </div>

            {/* Quick Actions (Section 22) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '32px',
              }}
            >
              <div
                className="stat-card"
                style={{ cursor: 'pointer', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => setActiveTab('tasks')}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Explore Tasks</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Discover nearby collection waypoints</div>
                </div>
                <ArrowRightIcon size={16} color="var(--cyan-glow)" />
              </div>

              <div
                className="stat-card"
                style={{ cursor: 'pointer', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => setActiveTab('contributions')}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>My Contributions</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Track status and verification progress</div>
                </div>
                <ArrowRightIcon size={16} color="var(--cyan-glow)" />
              </div>

              <div
                className="stat-card"
                style={{ cursor: 'pointer', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => setActiveTab('community')}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Community Review</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Review ground truth from peers</div>
                </div>
                <ArrowRightIcon size={16} color="var(--cyan-glow)" />
              </div>
            </div>

            {/* Available Tasks Preview (Section 22) */}
            <div className="table-container">
              <div className="table-header-bar">
                <div>
                  <div className="table-title">Available Nearby Tasks</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Proximity tasks within your radius</div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('tasks')}
                >
                  <span>View All Tasks</span>
                  <ArrowRightIcon size={12} />
                </button>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Category</th>
                    <th>Coordinates</th>
                    <th>Bounty</th>
                    <th>Stake</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.slice(0, 3).map((task) => (
                    <tr key={task.id}>
                      <td>
                        <div className="table-cell-title">{task.title}</div>
                        <div className="table-cell-desc">{task.description}</div>
                      </td>
                      <td>
                        <span className="badge-artifact">
                          {task.artifact_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontSize: '12px' }}>
                        {task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>
                          +{task.base_reward} HZN
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                          {task.commitment_stake} HZN
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleClaimTask(task)}
                        >
                          <span>Claim Task</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: TASKS DISCOVERY & FIELD COLLECTION
            ========================================================================= */}
        {activeTab === 'tasks' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                  Available Geospatial Tasks
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Discover field collection waypoints, commit stake, and collect ground evidence.
                </p>
              </div>

              {/* Search & Filter */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="filter-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="water_source">Water Sources</option>
                  <option value="solar_installation">Solar Arrays</option>
                  <option value="telecom_tower">Telecom &amp; Grid</option>
                </select>
              </div>
            </div>

            {/* Active Claimed Tasks Strip if any */}
            {claimedTasks.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cyan-glow)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Active Claimed Tasks ({claimedTasks.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                  {claimedTasks.map((claim) => (
                    <div
                      key={claim.task.id}
                      className="stat-card"
                      style={{ border: '1px solid var(--accent-brand-border)', background: 'rgba(45, 140, 255, 0.08)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <span className="badge-artifact">
                          {claim.task.artifact_type.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>
                          +{claim.task.base_reward} HZN
                        </span>
                      </div>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                        {claim.task.title}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        {claim.task.description}
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%' }}
                        onClick={() => {
                          setActiveCollectionTask(claim.task);
                          setCollectionStep(1);
                        }}
                      >
                        <CameraIcon size={14} />
                        <span>Begin Field Data Collection</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {filteredTasks.map((task) => (
                <div key={task.id} className="stat-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span className="badge-artifact">
                      {task.artifact_type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>
                      +{task.base_reward} HZN
                    </span>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                    {task.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px', flex: 1 }}>
                    {task.description}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}
                    </span>
                    <span>{task.commitment_stake} HZN stake</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => handleClaimTask(task)}
                  >
                    <span>Commit Stake &amp; Claim</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: COMMUNITY REVIEW (Sections 8, 9, 10, 25)
            ========================================================================= */}
        {activeTab === 'community' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <UsersIcon size={20} color="var(--cyan-glow)" />
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                  Community Review
                </h2>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Help verify real-world geospatial data. Review submitted evidence and provide your independent judgement.
              </p>
            </div>

            <div className="community-grid">
              {communitySubmissions.map((item) => (
                <div key={item.id} className="community-card">
                  {/* Photo Evidence */}
                  <div className="community-media-thumb">
                    <img src={item.imageUrl} alt={item.taskTitle} />
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <span className="badge-artifact">{item.artifactType.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '11px', background: 'rgba(5, 9, 20, 0.85)', padding: '4px 8px', borderRadius: '4px', color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {item.latitude.toFixed(4)}°, {item.longitude.toFixed(4)}°
                    </div>
                  </div>

                  {/* Context and Observations */}
                  <div className="community-card-body">
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                        {item.taskTitle}
                      </h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Submitted by <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>@{item.contributorHandle}</span> · {item.submittedAt}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Contributor Observation:</strong>
                      {item.observationSummary}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>Community Consensus:</span>
                      <strong style={{ color: 'var(--cyan-glow)' }}>
                        {item.votes.approve} Accept · {item.votes.reject} Reject · {item.votes.flag} Flag
                      </strong>
                    </div>

                    {/* Review Actions — ACCEPT | REJECT | FLAG strictly (NO EDIT ACCESS) */}
                    <div className="community-actions-bar">
                      <button
                        type="button"
                        className="btn-vote-accept"
                        onClick={() => handleCommunityVote(item.id, 'accept')}
                        disabled={item.userVote !== 'none'}
                        style={{ opacity: item.userVote === 'accept' ? 1 : item.userVote !== 'none' ? 0.4 : 1 }}
                      >
                        ✓ Accept
                      </button>
                      <button
                        type="button"
                        className="btn-vote-reject"
                        onClick={() => handleCommunityVote(item.id, 'reject')}
                        disabled={item.userVote !== 'none'}
                        style={{ opacity: item.userVote === 'reject' ? 1 : item.userVote !== 'none' ? 0.4 : 1 }}
                      >
                        ✕ Reject
                      </button>
                      <button
                        type="button"
                        className="btn-vote-flag"
                        onClick={() => handleCommunityVote(item.id, 'flag')}
                        disabled={item.userVote !== 'none'}
                        style={{ opacity: item.userVote === 'flag' ? 1 : item.userVote !== 'none' ? 0.4 : 1 }}
                      >
                        ⚠ Flag
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: MY CONTRIBUTIONS (Section 24)
            ========================================================================= */}
        {activeTab === 'contributions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                  My Field Contributions
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Track the verification lifecycle of your submitted geospatial observations.
                </p>
              </div>

              {/* Status Filters (Section 24: Active, Submitted, Under Review, Verified, Rejected) */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {['all', 'active', 'under_review', 'verified', 'rejected'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`btn btn-sm ${contributionsFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setContributionsFilter(cat)}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {cat.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {filteredContributions.map((sub) => {
                // Steps: Collected -> Submitted -> Community Review -> Admin Review -> Verified
                const steps = [
                  { key: 'collected', label: 'Collected' },
                  { key: 'submitted', label: 'Submitted' },
                  { key: 'community_review', label: 'Community Review' },
                  { key: 'admin_review', label: 'Admin Review' },
                  { key: 'verified', label: 'Verified' },
                ];

                const currentStepIdx =
                  sub.statusTimeline === 'collected'
                    ? 0
                    : sub.statusTimeline === 'submitted'
                    ? 1
                    : sub.statusTimeline === 'community_review'
                    ? 2
                    : sub.statusTimeline === 'admin_review'
                    ? 3
                    : sub.statusTimeline === 'verified'
                    ? 4
                    : 2;

                return (
                  <div key={sub.id} className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge-artifact">{sub.artifactType.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {sub.id}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '6px' }}>
                          {sub.taskTitle}
                        </h3>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>
                          +{sub.rewardAmount} HZN
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {sub.stakeAmount} HZN stake
                        </div>
                      </div>
                    </div>

                    {/* Status Timeline Stepper (Section 24) */}
                    <div className="status-stepper">
                      <div className="stepper-line" />
                      {steps.map((st, idx) => {
                        const isCompleted = idx < currentStepIdx || sub.statusTimeline === 'verified';
                        const isActive = idx === currentStepIdx && sub.statusTimeline !== 'verified';
                        return (
                          <div
                            key={st.key}
                            className={`stepper-step ${isCompleted ? 'completed' : isActive ? 'active' : ''}`}
                          >
                            <div className="stepper-circle">
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            <span className="stepper-label">{st.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span>Submitted: {sub.submittedAt} · Telemetry accuracy: ±{sub.accuracy}m</span>
                      <span>Consensus: {sub.votes.approve}/{sub.votes.quorum} votes</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: PROFILE & REPUTATION
            ========================================================================= */}
        {activeTab === 'profile' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                Contributor Profile
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Field reputation score, token earnings, and participation history.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: '24px', alignItems: 'start' }}>
              <div className="stat-card">
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'var(--gradient-horizon)',
                      margin: '0 auto 14px auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      fontWeight: 800,
                      color: '#ffffff',
                      boxShadow: 'var(--shadow-blue-glow)',
                    }}
                  >
                    AR
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Alex River</h3>
                  <div style={{ fontSize: '12px', color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>
                    @scout_alex
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Field Reputation:</span>
                    <strong style={{ color: 'var(--accent-emerald-text)' }}>98.6% (Tier 1 Scout)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Available Tokens:</span>
                    <strong style={{ color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>{availableTokens} HZN</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Escrowed Stake:</span>
                    <strong style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{lockedStake} HZN</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Verified:</span>
                    <strong style={{ color: '#ffffff' }}>14 Contributions</strong>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '14px' }}>
                  Protocol Ledger Activity
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Verified Submission Reward</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rooftop Solar Array Inspection</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--accent-emerald-text)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>+200 HZN</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>3 hours ago</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Initial Protocol Grant</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Network onboard allowance</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--cyan-glow)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>+100 HZN</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1 day ago</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Field Data Collection Modal */}
      {activeCollectionTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <span className="badge-artifact" style={{ marginBottom: '4px' }}>
                  {activeCollectionTask.artifact_type.replace(/_/g, ' ')}
                </span>
                <h2 className="modal-title">
                  In-Situ Collection: {activeCollectionTask.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveCollectionTask(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Stepper Progress */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: collectionStep >= 1 ? 'var(--blue-horizon)' : 'var(--bg-elevated)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: collectionStep >= 2 ? 'var(--blue-horizon)' : 'var(--bg-elevated)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: collectionStep >= 3 ? 'var(--blue-horizon)' : 'var(--bg-elevated)' }} />
            </div>

            {/* Step 1: GNSS Lock */}
            {collectionStep === 1 && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Step 1: GNSS Hardware Fix &amp; Proximity Check
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Verify that your mobile sensor is locked inside the task boundary.
                </p>

                <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sensor Coordinates:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#ffffff' }}>
                      {activeCollectionTask.latitude.toFixed(6)}° N, {activeCollectionTask.longitude.toFixed(6)}° E
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Horizontal Accuracy:</span>
                    <span style={{ color: 'var(--accent-emerald-text)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>±{gpsAccuracy}m (Lock Active)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Geofence:</span>
                    <span style={{ color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>INSIDE 50m TARGET</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setCollectionStep(2)}
                >
                  <span>Confirm Location &amp; Proceed</span>
                  <ArrowRightIcon size={14} />
                </button>
              </div>
            )}

            {/* Step 2: Photographic Evidence */}
            {collectionStep === 2 && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Step 2: Geotagged Photographic Evidence
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Capture clear ground observations complying with requirements.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ height: '140px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)', position: 'relative' }}>
                    <img src="/horizon_orbit_glow.jpg" alt="Evidence 1" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: '6px', left: '6px', fontSize: '10px', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '2px', color: '#fff' }}>
                      Photo #1 (EXIF Tagged)
                    </span>
                  </div>
                  <div style={{ height: '140px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)', position: 'relative' }}>
                    <img src="/horizon_orbit_glow.jpg" alt="Evidence 2" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: '6px', left: '6px', fontSize: '10px', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '2px', color: '#fff' }}>
                      Photo #2 (EXIF Tagged)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setCollectionStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => setCollectionStep(3)}
                  >
                    <span>Proceed to Notes</span>
                    <ArrowRightIcon size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Observations & Submit */}
            {collectionStep === 3 && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Step 3: Physical Ground Observations
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Enter structured observations and field notes for community verification.
                </p>

                <div className="form-group">
                  <label className="form-label">Operating Condition</label>
                  <select
                    className="form-input"
                    value={flowStatus}
                    onChange={(e) => setFlowStatus(e.target.value)}
                  >
                    <option value="functional">Fully Operational &amp; Functional</option>
                    <option value="maintenance_required">Maintenance Required</option>
                    <option value="non_operational">Non-Operational / Damaged</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label">Field Notes</label>
                  <textarea
                    rows={3}
                    className="form-input"
                    placeholder="Describe physical condition, accessibility, or hazard notes..."
                    value={observationNotes}
                    onChange={(e) => setObservationNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setCollectionStep(2)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={handleSubmitCollection}
                  >
                    <span>Submit for Verification</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-banner">
          <CheckCircle2Icon size={16} color="var(--cyan-glow)" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
