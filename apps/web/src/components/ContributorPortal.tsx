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
  SparklesIcon,
  ArrowRightIcon,
  SearchIcon,
  UploadCloudIcon,
  CheckIcon,
  WifiOffIcon,
  RefreshCwIcon,
} from './Icons';
import type { AdminTaskItem } from './OverviewTab';

interface ContributorPortalProps {
  tasks: AdminTaskItem[];
  onReturnToLanding: () => void;
  onOpenAdminConsole: () => void;
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
  stages: {
    intake: 'PASSED';
    deterministic: 'PASSED' | 'PENDING';
    ai_quality: 'PASSED' | 'WARNING' | 'PENDING';
    consensus: 'APPROVED' | 'PENDING' | 'DISPUTED';
    settlement: 'SETTLED' | 'PENDING';
  };
  votes: { approve: number; reject: number; total: number; quorum: number };
  rewardAmount: number;
  stakeAmount: number;
}

export const ContributorPortal: React.FC<ContributorPortalProps> = ({
  tasks,
  onReturnToLanding,
  onOpenAdminConsole,
}) => {
  const [activeTab, setActiveTab] = useState<'discover' | 'claimed' | 'tracking' | 'wallet'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [radiusFilter, setRadiusFilter] = useState<number>(10);

  // User state
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

  // Contributor submissions tracking
  const [submissions, setSubmissions] = useState<ContributorSubmission[]>([
    {
      id: 'sub_001_hzn',
      taskId: '8a1c93f0-4521-419b-a012-78d91a2bc45e',
      taskTitle: 'Rooftop Solar Array Inspection',
      artifactType: 'solar_installation',
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
      photoCount: 2,
      latitude: 18.5312,
      longitude: 73.8445,
      accuracy: 2.1,
      stages: {
        intake: 'PASSED',
        deterministic: 'PASSED',
        ai_quality: 'PASSED',
        consensus: 'APPROVED',
        settlement: 'SETTLED',
      },
      votes: { approve: 3, reject: 0, total: 3, quorum: 3 },
      rewardAmount: 200,
      stakeAmount: 30,
    },
    {
      id: 'sub_002_hzn',
      taskId: '4ffea264-89ec-402f-b470-f4a058729ddd',
      taskTitle: 'Community Water Source Survey',
      artifactType: 'water_source',
      submittedAt: new Date(Date.now() - 600000).toISOString(),
      photoCount: 2,
      latitude: 18.5204,
      longitude: 73.8567,
      accuracy: 1.8,
      stages: {
        intake: 'PASSED',
        deterministic: 'PASSED',
        ai_quality: 'PASSED',
        consensus: 'PENDING',
        settlement: 'PENDING',
      },
      votes: { approve: 2, reject: 0, total: 2, quorum: 3 },
      rewardAmount: 150,
      stakeAmount: 20,
    },
  ]);

  // Field Data Collection Modal State
  const [activeCollectionTask, setActiveCollectionTask] = useState<AdminTaskItem | null>(null);
  const [collectionStep, setCollectionStep] = useState<number>(1);
  const [gpsLocked, setGpsLocked] = useState<boolean>(true);
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(2.4);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
  ]);
  const [formData, setFormData] = useState<Record<string, string>>({
    condition: 'Operational - Good',
    notes: 'Ground unit is active with clear serial indicator. No visible leak detected.',
    reading: '42.5 L/min',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Claim Task Action
  const handleClaimTask = (task: AdminTaskItem) => {
    if (availableTokens < task.commitment_stake) {
      showToast(`Insufficient balance. You need ${task.commitment_stake} HZN to stake this task.`);
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
    showToast(`Task "${task.title}" claimed! ${task.commitment_stake} HZN locked in escrow.`);
    setActiveTab('claimed');
  };

  // Complete & Submit Collection
  const handleSubmitCollection = () => {
    if (!activeCollectionTask) return;

    const newSub: ContributorSubmission = {
      id: `sub_${Date.now().toString().slice(-6)}`,
      taskId: activeCollectionTask.id,
      taskTitle: activeCollectionTask.title,
      artifactType: activeCollectionTask.artifact_type,
      submittedAt: new Date().toISOString(),
      photoCount: uploadedPhotos.length,
      latitude: activeCollectionTask.latitude,
      longitude: activeCollectionTask.longitude,
      accuracy: gpsAccuracy,
      stages: {
        intake: 'PASSED',
        deterministic: 'PASSED',
        ai_quality: 'PASSED',
        consensus: 'PENDING',
        settlement: 'PENDING',
      },
      votes: { approve: 1, reject: 0, total: 1, quorum: 3 },
      rewardAmount: activeCollectionTask.base_reward,
      stakeAmount: activeCollectionTask.commitment_stake,
    };

    setSubmissions((prev) => [newSub, ...prev]);
    setClaimedTasks((prev) => prev.filter((c) => c.task.id !== activeCollectionTask.id));
    setActiveCollectionTask(null);
    setCollectionStep(1);
    setActiveTab('tracking');
    showToast(`Observation for "${activeCollectionTask.title}" submitted to verification queue!`);
  };

  const filteredTasks = tasks.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    if (selectedCategory !== 'all' && t.artifact_type !== selectedCategory) return false;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Application Bar */}
      <header className="contributor-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={onReturnToLanding}
            title="Return to Horizon Landing"
          >
            <div className="brand-logo-mark" style={{ width: '34px', height: '34px' }}>
              <LogoMark size={18} />
            </div>
            <div>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                HORIZON SCOUT
              </span>
              <span style={{ fontSize: '10px', color: 'var(--accent-orange-text)', display: 'block', fontWeight: 700, letterSpacing: '0.6px' }}>
                CONTRIBUTOR PORTAL
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '16px' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'discover' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('discover')}
            >
              <CompassIcon size={14} />
              <span>Discover Tasks</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'claimed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('claimed')}
            >
              <ClockIcon size={14} />
              <span>My Claims ({claimedTasks.length})</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'tracking' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('tracking')}
            >
              <ShieldCheckIcon size={14} />
              <span>Verification Tracker</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'wallet' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('wallet')}
            >
              <CoinsIcon size={14} />
              <span>Wallet &amp; Escrow</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Contributor Balance Pill */}
          <div className="contributor-balance-pill">
            <span className="contributor-balance-dot" />
            <span className="contributor-balance-text">
              {availableTokens} HZN
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              ({lockedStake} staked)
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenAdminConsole}
            className="btn btn-secondary btn-sm"
            title="Switch to Enterprise Admin Console"
          >
            <span>Admin Console</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main style={{ flex: 1, padding: '28px 32px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        {/* ========================================================================= */}
        {/* TAB 1: DISCOVER TASKS */}
        {/* ========================================================================= */}
        {activeTab === 'discover' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                  Nearby Field Tasks
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Discover geofenced verification gaps within your operating radius.
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <SearchIcon size={13} />
                  </span>
                  <input
                    type="text"
                    className="search-input"
                    style={{ paddingLeft: '30px', minWidth: '220px' }}
                    placeholder="Filter tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  className="filter-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Domains</option>
                  <option value="water_source">Water Sources</option>
                  <option value="solar_installation">Solar Arrays</option>
                  <option value="telecom_tower">Telecom / Grid</option>
                </select>

                <select
                  className="filter-select"
                  value={radiusFilter}
                  onChange={(e) => setRadiusFilter(parseInt(e.target.value))}
                >
                  <option value={5}>Within 5 km</option>
                  <option value={10}>Within 10 km</option>
                  <option value={25}>Within 25 km</option>
                </select>
              </div>
            </div>

            {/* Task Discovery Cards Grid */}
            <div className="task-grid-cards">
              {filteredTasks.map((task, idx) => {
                const isClaimed = claimedTasks.some((c) => c.task.id === task.id);
                const simulatedDistance = (1.2 + idx * 0.9).toFixed(1);

                return (
                  <div key={task.id} className="contributor-task-card">
                    <div className="task-card-header">
                      <span className="badge-artifact">
                        {task.artifact_type.replace(/_/g, ' ')}
                      </span>
                      <span className="task-card-reward">
                        +{task.base_reward} HZN
                      </span>
                    </div>

                    <h3 className="task-card-title">{task.title}</h3>
                    <p className="task-card-desc">{task.description}</p>

                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Required Evidence
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(task.requirements || ['2 geotagged photos', 'Visual inspection']).map((req, rIdx) => (
                          <div key={rIdx} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckIcon size={12} color="var(--accent-orange)" />
                            <span>{req}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="task-card-meta">
                      <div className="task-card-meta-item">
                        <MapPinIcon size={13} color="var(--accent-orange)" />
                        <span>{simulatedDistance} km away</span>
                      </div>
                      <div className="task-card-meta-item">
                        <ClockIcon size={13} />
                        <span>~{task.estimated_effort_minutes || 25} min</span>
                      </div>
                      <div className="task-card-meta-item">
                        <CoinsIcon size={13} />
                        <span>{task.commitment_stake} stake</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                      {isClaimed ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', borderColor: 'var(--accent-orange-border)', color: 'var(--accent-orange-text)' }}
                          onClick={() => {
                            setActiveCollectionTask(task);
                            setCollectionStep(1);
                          }}
                        >
                          <CameraIcon size={14} />
                          <span>Start Field Collection</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%' }}
                          onClick={() => handleClaimTask(task)}
                        >
                          <span>Claim Mission ({task.commitment_stake} HZN Stake)</span>
                          <ArrowRightIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY CLAIMED TASKS */}
        {/* ========================================================================= */}
        {activeTab === 'claimed' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                Active Claimed Tasks ({claimedTasks.length})
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Tasks currently locked under your commitment stake. Complete and submit ground evidence before expiration.
              </p>
            </div>

            {claimedTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <ClockIcon size={40} />
                </div>
                <div className="empty-state-title">No Active Claims</div>
                <div className="empty-state-desc">
                  Explore available tasks nearby to stake and claim your next field observation.
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('discover')}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '16px' }}
                >
                  Discover Tasks Nearby
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {claimedTasks.map((claim) => (
                  <div key={claim.task.id} className="stat-card" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '20px', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span className="badge-artifact">
                          {claim.task.artifact_type.replace(/_/g, ' ')}
                        </span>
                        <span className="status-pill status-pill-claimed">
                          Claimed ({claim.expiresInMinutes}m remaining)
                        </span>
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                        {claim.task.title}
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {claim.task.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div>
                        <strong>Coordinates:</strong> {claim.task.latitude.toFixed(4)}, {claim.task.longitude.toFixed(4)}
                      </div>
                      <div>
                        <strong>Bounty:</strong> <span style={{ color: 'var(--accent-orange-text)', fontWeight: 700 }}>+{claim.task.base_reward} HZN</span> ({claim.task.commitment_stake} HZN staked in escrow)
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setActiveCollectionTask(claim.task);
                          setCollectionStep(1);
                        }}
                      >
                        <CameraIcon size={15} />
                        <span>Open Field Collector</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: VERIFICATION TRACKER */}
        {/* ========================================================================= */}
        {activeTab === 'tracking' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                Verification &amp; Settlement Pipeline
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Live multi-layer audit status for your field submissions. Track deterministic checks, AI scoring, and quorum votes.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {submissions.map((sub) => (
                <div key={sub.id} className="stat-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                          {sub.taskTitle}
                        </span>
                        <span className="badge-artifact">{sub.artifactType}</span>
                        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ID: {sub.id}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Submitted {new Date(sub.submittedAt).toLocaleTimeString()} · Accuracy ±{sub.accuracy}m · {sub.photoCount} photos uploaded
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-orange-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                        +{sub.rewardAmount} HZN
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Stake refund: {sub.stakeAmount} HZN
                      </div>
                    </div>
                  </div>

                  {/* 5-Stage Visualizer */}
                  <div className="pipeline-stepper" style={{ marginBottom: '12px' }}>
                    <div className="pipeline-step completed">
                      <span className="pipeline-step-badge">✓</span>
                      <span>1. GPS Intake</span>
                    </div>
                    <span className="pipeline-separator">→</span>
                    <div className={`pipeline-step ${sub.stages.deterministic === 'PASSED' ? 'completed' : 'active'}`}>
                      <span className="pipeline-step-badge">{sub.stages.deterministic === 'PASSED' ? '✓' : '2'}</span>
                      <span>2. Deterministic</span>
                    </div>
                    <span className="pipeline-separator">→</span>
                    <div className={`pipeline-step ${sub.stages.ai_quality === 'PASSED' ? 'completed' : 'active'}`}>
                      <span className="pipeline-step-badge">{sub.stages.ai_quality === 'PASSED' ? '✓' : '3'}</span>
                      <span>3. AI Quality (94%)</span>
                    </div>
                    <span className="pipeline-separator">→</span>
                    <div className={`pipeline-step ${sub.stages.consensus === 'APPROVED' ? 'completed' : 'active'}`}>
                      <span className="pipeline-step-badge">{sub.stages.consensus === 'APPROVED' ? '✓' : '4'}</span>
                      <span>4. Quorum ({sub.votes.approve}/{sub.votes.quorum})</span>
                    </div>
                    <span className="pipeline-separator">→</span>
                    <div className={`pipeline-step ${sub.stages.settlement === 'SETTLED' ? 'completed' : 'active'}`}>
                      <span className="pipeline-step-badge">{sub.stages.settlement === 'SETTLED' ? '✓' : '5'}</span>
                      <span>5. Settlement</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      {sub.stages.settlement === 'SETTLED' ? (
                        <strong style={{ color: 'var(--status-success)' }}>✓ Quorum Achieved · Reward Disbursed to Wallet</strong>
                      ) : (
                        <span style={{ color: 'var(--accent-orange-text)' }}>⏳ Awaiting {sub.votes.quorum - sub.votes.approve} additional reviewer vote to reach supermajority</span>
                      )}
                    </span>
                    <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      PostGIS SRID 4326 Point Confirmed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: WALLET & ESCROW LEDGER */}
        {/* ========================================================================= */}
        {activeTab === 'wallet' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                Contributor Wallet &amp; Escrow
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Double-entry token account backing your commitment stakes and mission bounties.
              </p>
            </div>

            <div className="stats-grid">
              <div className="kpi-card">
                <div className="kpi-icon-wrap kpi-icon-amber">
                  <CoinsIcon size={20} />
                </div>
                <div className="kpi-content">
                  <div className="stat-label">Available Balance</div>
                  <div className="stat-value">{availableTokens} HZN</div>
                  <div className="stat-sub">Ready to stake on missions</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrap kpi-icon-blue">
                  <ShieldCheckIcon size={20} />
                </div>
                <div className="kpi-content">
                  <div className="stat-label">Locked in Escrow</div>
                  <div className="stat-value">{lockedStake} HZN</div>
                  <div className="stat-sub">Active task commitments</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrap kpi-icon-emerald">
                  <CheckCircle2Icon size={20} />
                </div>
                <div className="kpi-content">
                  <div className="stat-label">Lifetime Earned</div>
                  <div className="stat-value">350 HZN</div>
                  <div className="stat-sub">From 2 verified missions</div>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="table-container">
              <div className="table-header-bar">
                <div className="table-title">Recent Wallet Activity</div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="badge-artifact">TASK REWARD</span>
                    </td>
                    <td>Rooftop Solar Array Inspection (#sub_001_hzn)</td>
                    <td>
                      <span style={{ color: 'var(--status-success)', fontWeight: 700, fontFamily: 'monospace' }}>
                        +200 HZN
                      </span>
                    </td>
                    <td>
                      <span className="status-pill status-pill-passed">✓ Settled</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>1 hour ago</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-artifact">STAKE LOCK</span>
                    </td>
                    <td>Community Water Source Survey (#sub_002_hzn)</td>
                    <td>
                      <span style={{ color: 'var(--accent-orange-text)', fontWeight: 700, fontFamily: 'monospace' }}>
                        -20 HZN
                      </span>
                    </td>
                    <td>
                      <span className="status-pill status-pill-draft">⏳ In Escrow</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>15 mins ago</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-artifact">STARTER GRANT</span>
                    </td>
                    <td>Initial Contributor Onboarding Provisioning</td>
                    <td>
                      <span style={{ color: 'var(--status-success)', fontWeight: 700, fontFamily: 'monospace' }}>
                        +100 HZN
                      </span>
                    </td>
                    <td>
                      <span className="status-pill status-pill-passed">✓ Complete</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>2 days ago</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 4-STEP FIELD DATA COLLECTION MODAL */}
      {/* ========================================================================= */}
      {activeCollectionTask && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
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
                className="modal-close-btn"
                onClick={() => setActiveCollectionTask(null)}
              >
                ✕
              </button>
            </div>

            {/* Stepper Header */}
            <div style={{ padding: '12px 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: collectionStep >= 1 ? 'var(--accent-orange)' : 'var(--bg-elevated)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: collectionStep >= 2 ? 'var(--accent-orange)' : 'var(--bg-elevated)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: collectionStep >= 3 ? 'var(--accent-orange)' : 'var(--bg-elevated)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: collectionStep >= 4 ? 'var(--accent-orange)' : 'var(--bg-elevated)' }} />
            </div>

            <div className="modal-body">
              {/* STEP 1: GPS Lock & Geofence Confirmation */}
              {collectionStep === 1 && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                    Step 1: Geofence &amp; GNSS Coordinate Lock
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                    Confirm your device has locked on to high-precision hardware GNSS coordinates inside the task geofence.
                  </p>

                  <div style={{ padding: '18px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        DEVICE SENSOR TELEMETRY
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-success)' }} />
                        GNSS Hardware Fix Active
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Latitude</div>
                        <div className="font-mono" style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                          {activeCollectionTask.latitude.toFixed(6)}° N
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Longitude</div>
                        <div className="font-mono" style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                          {activeCollectionTask.longitude.toFixed(6)}° E
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Horizontal Accuracy:</span>
                      <strong style={{ color: 'var(--status-success)', fontFamily: 'JetBrains Mono, monospace' }}>±{gpsAccuracy} meters</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Spatial Geofence Distance:</span>
                      <strong style={{ color: 'var(--accent-orange-text)', fontFamily: 'JetBrains Mono, monospace' }}>8.4 meters (INSIDE 50m GEOFENCE)</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Ground Evidence Photo Capture */}
              {collectionStep === 2 && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                    Step 2: Geotagged Photographic Evidence
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                    Capture high-resolution ground photos complying with task evidence specifications.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    {uploadedPhotos.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)', height: '160px', background: '#000' }}>
                        <img
                          src={url}
                          alt="Field Evidence"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 10px', background: 'rgba(0,0,0,0.7)', fontSize: '10px', color: '#ffffff', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Photo #{idx + 1}</span>
                          <span style={{ color: 'var(--accent-orange-text)' }}>EXIF Tagged</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', textAlign: 'center' }}>
                    <CameraIcon size={24} color="var(--accent-orange)" style={{ margin: '0 auto 6px auto' }} />
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                      Add Additional Angle / Serial Photo
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Supports JPEG/PNG up to 15MB with EXIF preservation
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Dynamic Observation Form */}
              {collectionStep === 3 && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                    Step 3: Field Observation Checklist
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                    Complete the domain-specific parameters for this {activeCollectionTask.artifact_type.replace(/_/g, ' ')}.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Operating Condition Status</label>
                    <select
                      className="form-select"
                      value={formData.condition}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    >
                      <option value="Operational - Good">Operational - Normal / Good</option>
                      <option value="Operational - Requires Maintenance">Operational - Minor Wear / Needs Service</option>
                      <option value="Decommissioned / Faulty">Decommissioned / Non-Functional</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Metric Reading / Serial Observation</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.reading}
                      onChange={(e) => setFormData({ ...formData, reading: e.target.value })}
                      placeholder="e.g. Inverter ID or Flow Rate"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">In-Situ Observer Notes</label>
                    <textarea
                      rows={3}
                      className="form-textarea"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Describe access conditions, obstacles, or safety hazards..."
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: Review, Local Hash & Submit */}
              {collectionStep === 4 && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                    Step 4: Cryptographic Review &amp; Submit
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                    Review your observation payload. A SHA-256 evidence digest will be generated and signed.
                  </p>

                  <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', marginBottom: '16px', fontSize: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Task: </span>
                        <strong>{activeCollectionTask.title}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Photos: </span>
                        <strong>{uploadedPhotos.length} Geotagged Media</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>GPS Fix: </span>
                        <span className="font-mono">±{gpsAccuracy}m accuracy</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Condition: </span>
                        <strong>{formData.condition}</strong>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Local SHA-256 Digest:</span>
                      <div className="font-mono" style={{ fontSize: '11px', color: 'var(--accent-orange-text)', marginTop: '2px' }}>
                        e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-emerald-border)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--accent-emerald-text)' }}>
                    <CheckCircle2Icon size={16} />
                    <span>
                      Offline queue active. Observation is cryptographically cached locally and will auto-sync upon network contact.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Navigation Footer */}
            <div className="modal-footer">
              {collectionStep > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCollectionStep((s) => s - 1)}
                >
                  Previous Step
                </button>
              )}

              {collectionStep < 4 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCollectionStep((s) => s + 1)}
                >
                  <span>Continue</span>
                  <ArrowRightIcon size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmitCollection}
                >
                  <UploadCloudIcon size={16} />
                  <span>Submit Observation to Verification Queue</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="toast-banner">
          <CheckCircle2Icon size={16} color="var(--accent-orange)" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
