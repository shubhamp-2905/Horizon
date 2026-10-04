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
  SatelliteIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  UsersIcon,
  DatabaseIcon,
  WifiOffIcon,
} from './Icons';
import type { AdminTaskItem } from './OverviewTab';

interface LandingPageProps {
  tasks: AdminTaskItem[];
  onStartContributing: () => void;
  onOpenAdminConsole: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  tasks,
  onStartContributing,
  onOpenAdminConsole,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [calcTasksPerWeek, setCalcTasksPerWeek] = useState<number>(4);
  const [selectedArtifact, setSelectedArtifact] = useState<string>('water_source');

  // Estimate earnings based on calculator
  const avgReward = selectedArtifact === 'solar_installation' ? 200 : selectedArtifact === 'telecom_tower' ? 175 : 150;
  const monthlyEarnings = calcTasksPerWeek * avgReward * 4;

  const faqs = [
    {
      q: 'What is Horizon?',
      a: 'Horizon is a decentralized geospatial ground-truth collection and validation infrastructure. It bridges the critical resolution and freshness gap between orbital satellite telemetry and on-the-ground reality by mobilizing a global network of incentivized local contributors.',
    },
    {
      q: 'Why does Horizon exist?',
      a: 'Earth observation satellites provide macroscopic views but suffer from cloud occlusion, sensor resolution limits (30cm–10m/px), and latency. Critical infrastructure like microgrid solar arrays, rural water dispensaries, and telecom masts require verified, centimeter-level ground inspection to confirm operating status.',
    },
    {
      q: 'How does field data collection work?',
      a: 'Contributors discover geospatial tasks within their radius, navigate to the target coordinates, and collect geotagged photographic evidence and structured observations. Horizon works offline-first using local SQLite storage, automatically syncing when cellular or Wi-Fi connectivity resumes.',
    },
    {
      q: 'How are submissions verified without central trust?',
      a: 'Every submission undergoes a multi-layer verification pipeline: (1) Deterministic geometric and EXIF sensor validation, (2) AI multimodal computer vision quality scoring (blur detection, exposure, and asset classification), and (3) Byzantine-fault-tolerant peer consensus review with dispute arbitration.',
    },
    {
      q: 'How does the token and reward system operate?',
      a: 'Contributors stake a small commitment stake (e.g. 20 HZN) when claiming a task to prevent task hoarding and spam. Upon successful verification and consensus approval, their stake is returned in full along with the task base reward (e.g. 150 HZN). Malicious or fraudulent attempts forfeit their stake to the protocol escrow pool.',
    },
    {
      q: 'What downstream impact do contributions create?',
      a: 'Verified datasets are published into high-precision PostGIS feeds and ingested directly by downstream intelligence pipelines like Loupe ML models for climate resilience, municipal infrastructure auditing, and open geospatial research.',
    },
  ];

  return (
    <div className="landing-shell">
      {/* Top Navigation Bar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <div className="brand-logo-mark" style={{ width: '38px', height: '38px' }}>
              <LogoMark size={22} />
            </div>
            <div>
              <span className="landing-logo-text">HORIZON</span>
              <span style={{ fontSize: '10px', color: 'var(--accent-orange-text)', display: 'block', fontWeight: 700, letterSpacing: '0.8px', marginTop: '-2px' }}>
                GEOSPATIAL PROTOCOL
              </span>
            </div>
          </div>

          <nav className="landing-nav-links">
            <a href="#why-horizon" className="landing-nav-link">Why Horizon</a>
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#verification" className="landing-nav-link">Verification</a>
            <a href="#tokenomics" className="landing-nav-link">Tokenomics</a>
            <a href="#tasks" className="landing-nav-link">Live Tasks</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </nav>

          <div className="landing-nav-actions">
            <button
              type="button"
              onClick={onOpenAdminConsole}
              className="btn btn-secondary btn-sm"
              title="Access Enterprise Reviewer & PostGIS Console"
            >
              <span>Admin Console</span>
            </button>

            <button
              type="button"
              onClick={onStartContributing}
              className="btn btn-primary btn-sm"
              style={{ padding: '7px 16px', fontWeight: 700 }}
            >
              <span>Start Contributing</span>
              <ArrowRightIcon size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-glow-bg" />

        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            <span>PostGIS SRID 4326 · Decentralized Ground-Truth Protocol</span>
          </div>

          <h1 className="hero-headline">
            The Ground-Truth Layer for the <span className="hero-headline-gradient">Physical World</span>
          </h1>

          <p className="hero-lead">
            Horizon bridges the critical gap between orbital satellite telemetry and on-the-ground reality.
            Earn tokens by capturing verified geospatial field data, backed by cryptographic proofs,
            multimodal AI evaluation, and distributed peer consensus.
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              onClick={onStartContributing}
              className="btn btn-primary btn-lg"
              style={{ fontSize: '15px', padding: '14px 28px' }}
            >
              <span>Start Contributing Now</span>
              <ArrowRightIcon size={16} />
            </button>

            <button
              type="button"
              onClick={onOpenAdminConsole}
              className="btn btn-secondary btn-lg"
              style={{ fontSize: '15px', padding: '14px 24px' }}
            >
              <span>Enterprise Admin Console</span>
              <ArrowUpRightIcon size={16} />
            </button>
          </div>

          {/* Radar / Coordinates Display */}
          <div style={{
            marginTop: '36px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 18px',
            background: 'rgba(20, 23, 32, 0.75)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            backdropFilter: 'blur(10px)',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-orange-text)', fontWeight: 700 }}>
              <CompassIcon size={14} />
              <span>ACTIVE SCAN</span>
            </span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span className="font-mono">18.5204° N, 73.8567° E</span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span style={{ color: 'var(--status-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-success)' }} />
              Quorum Synchronized
            </span>
          </div>

          {/* Hero Live Metrics Strip */}
          <div className="hero-metrics-strip">
            <div className="hero-metric-item">
              <div className="hero-metric-val">100%</div>
              <div className="hero-metric-label">Offline-First Resilient</div>
            </div>
            <div className="hero-metric-item">
              <div className="hero-metric-val">SRID 4326</div>
              <div className="hero-metric-label">Precision Geodetic WGS84</div>
            </div>
            <div className="hero-metric-item">
              <div className="hero-metric-val">&plusmn;2.4m</div>
              <div className="hero-metric-label">Average GPS Accuracy</div>
            </div>
            <div className="hero-metric-item">
              <div className="hero-metric-val">{tasks.length} Points</div>
              <div className="hero-metric-label">Active Field Tasks</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Why Horizon Exists (Orbital vs Ground Truth) */}
      <section id="why-horizon" className="section-container" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="section-header">
          <div className="section-tag">The Geospatial Gap</div>
          <h2 className="section-title">Satellites See the Planet. Horizon Verifies Reality.</h2>
          <p className="section-desc">
            Orbital remote sensing is essential for macro-scale trends, but high-stakes decisions
            require ground truth that satellites cannot resolve.
          </p>
        </div>

        <div className="comparison-box">
          <div className="comparison-side comparison-side-left">
            <div className="comparison-tag comparison-tag-satellite">
              <SatelliteIcon size={14} />
              <span>Orbital Telemetry Alone</span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '14px' }}>
              The Resolution & Latency Blindspot
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ color: 'var(--status-error)', fontWeight: 800 }}>✕</span>
                <span><strong>Cloud & Vegetation Occlusion:</strong> Optical sensors fail under dense canopy, overcast skies, or indoor/sub-canopy assets.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ color: 'var(--status-error)', fontWeight: 800 }}>✕</span>
                <span><strong>Resolution Limits:</strong> 30cm to 10m per pixel cannot verify whether a water pump is operating, an inverter is wired, or structural fatigue exists.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ color: 'var(--status-error)', fontWeight: 800 }}>✕</span>
                <span><strong>Outdated Revisit Cycles:</strong> Orbital revisit schedules leave critical infrastructure uninspected for weeks or months.</span>
              </li>
            </ul>
          </div>

          <div className="comparison-side comparison-side-right">
            <div className="comparison-tag comparison-tag-horizon">
              <ShieldCheckIcon size={14} />
              <span>Horizon Ground-Truth Protocol</span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '14px' }}>
              Centimeter-Grade, Cryptographic In-Situ Verification
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ color: 'var(--accent-orange)', fontWeight: 800 }}>✓</span>
                <span><strong>Hardware-Attested Spatial Fix:</strong> Multi-constellation GNSS with real-time accuracy circles and geofenced proof-of-proximity.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ color: 'var(--accent-orange)', fontWeight: 800 }}>✓</span>
                <span><strong>Multimodal AI Quality Evaluator:</strong> Automated blur analysis, exposure rating, and EXIF tamper-proof hashing before peer review.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ color: 'var(--accent-orange)', fontWeight: 800 }}>✓</span>
                <span><strong>Byzantine-Resilient Peer Quorum:</strong> Distributed consensus ensures independent verification and slashed penalties for fraudulent telemetry.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 2: How It Works */}
      <section id="how-it-works" className="section-container" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="section-header">
          <div className="section-tag">Contributor Journey</div>
          <h2 className="section-title">How Field Data Collection Works</h2>
          <p className="section-desc">
            A seamless workflow engineered for first-time field contributors and enterprise reviewers alike.
          </p>
        </div>

        <div className="flow-grid-4">
          <div className="flow-card">
            <div className="flow-number">01 / DISCOVERY & STAKE</div>
            <div className="flow-title">Claim Geofenced Task</div>
            <p className="flow-desc">
              Browse available tasks near your location. Lock a small commitment stake from your wallet to reserve the task and prevent spam claims.
            </p>
          </div>

          <div className="flow-card">
            <div className="flow-number">02 / IN-SITU CAPTURE</div>
            <div className="flow-title">Collect Ground Evidence</div>
            <p className="flow-desc">
              Visit the point of interest. Capture high-resolution photos and log observation metrics. Works 100% offline with zero mobile signal.
            </p>
          </div>

          <div className="flow-card">
            <div className="flow-number">03 / MULTI-LAYER AUDIT</div>
            <div className="flow-title">AI & Quorum Consensus</div>
            <p className="flow-desc">
              Automated deterministic rules audit spatial proximity, AI inspects image sharpness and exposure, and independent peer reviewers vote.
            </p>
          </div>

          <div className="flow-card">
            <div className="flow-number">04 / SETTLEMENT</div>
            <div className="flow-title">Instant Token Reward</div>
            <p className="flow-desc">
              Upon quorum confirmation, your staked tokens are unlocked instantly, plus your base reward is credited to your ledger balance.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button
            type="button"
            onClick={onStartContributing}
            className="btn btn-primary"
            style={{ padding: '12px 28px', fontSize: '14px' }}
          >
            <span>Start Your First Collection</span>
            <ArrowRightIcon size={16} />
          </button>
        </div>
      </section>

      {/* Section 3: Verification Engine */}
      <section id="verification" className="section-container" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="section-header">
          <div className="section-tag">Protocol Integrity</div>
          <h2 className="section-title">Multi-Layer Verification Architecture</h2>
          <p className="section-desc">
            Ground-truth data must be indisputable. Horizon employs three distinct layers of defense against bad data, spoofing, and fraud.
          </p>
        </div>

        <div className="feature-grid-3">
          <div className="feature-card">
            <div className="feature-card-icon">
              <CompassIcon size={24} />
            </div>
            <h3 className="feature-card-title">1. Deterministic Spatial Audit</h3>
            <p className="feature-card-text">
              Verifies GPS coordinates against PostGIS task boundaries using ST_DWithin geofencing. Validates timestamp temporal windows, hardware mock-location detection, and EXIF sensor metadata.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card-icon">
              <SparklesIcon size={24} />
            </div>
            <h3 className="feature-card-title">2. AI Multimodal Evaluation</h3>
            <p className="feature-card-text">
              Computer vision algorithms evaluate Laplacian blur scores, exposure variance, resolution thresholds, and object category classification. Low-quality or obscured photos are flagged before reviewer time is spent.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card-icon">
              <ShieldCheckIcon size={24} />
            </div>
            <h3 className="feature-card-title">3. Peer Quorum Consensus & Slashing</h3>
            <p className="feature-card-text">
              Decentralized peer reviewers inspect evidence against requirements. Reaching supermajority quorum triggers automated escrow payout. Suspected malicious submissions are slashed to safeguard the ledger.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Tokenomics & Calculator */}
      <section id="tokenomics" className="section-container" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="section-header">
          <div className="section-tag">Economics & Incentives</div>
          <h2 className="section-title">Proof-of-Commitment Tokenomics</h2>
          <p className="section-desc">
            Aligning economic incentives to guarantee authentic field telemetry and reward dependable contributors.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="stat-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <CoinsIcon size={20} color="var(--accent-orange)" />
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>100 HZN Starter Provisioning</h4>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Every new verified contributor receives an initial 100 HZN starter grant to stake their first batch of field missions immediately.
                </p>
              </div>

              <div className="stat-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <ShieldCheckIcon size={20} color="var(--accent-orange)" />
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Commitment Staking & Escrow</h4>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Staking 15–30 HZN ensures contributors have "skin in the game". No more phantom claims or abandoned assignments clogging the network.
                </p>
              </div>

              <div className="stat-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <CheckCircle2Icon size={20} color="var(--status-success)" />
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Automated Escrow Release</h4>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Upon successful consensus, your stake returns to your balance plus task bounty (50–300 HZN depending on difficulty and scarcity).
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Calculator */}
          <div className="stat-card" style={{ padding: '32px', border: '1px solid var(--accent-orange-border)', boxShadow: 'var(--shadow-card), 0 0 30px rgba(255, 107, 0, 0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
              Contributor Reward Estimator
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Estimate your monthly earnings based on field activity:
            </p>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tasks Completed Per Week:</span>
                <span style={{ color: 'var(--accent-orange-text)', fontFamily: 'JetBrains Mono, monospace', fontSize: '15px' }}>{calcTasksPerWeek} tasks</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={calcTasksPerWeek}
                onChange={(e) => setCalcTasksPerWeek(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-orange)' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Primary Task Domain:
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', padding: '10px' }}
                value={selectedArtifact}
                onChange={(e) => setSelectedArtifact(e.target.value)}
              >
                <option value="water_source">Water Infrastructure (~150 HZN/task)</option>
                <option value="solar_installation">Rooftop Solar Array (~200 HZN/task)</option>
                <option value="telecom_tower">Telecom / Microgrid (~175 HZN/task)</option>
              </select>
            </div>

            <div style={{ padding: '20px', background: 'rgba(255, 107, 0, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-orange-border)', textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '4px' }}>
                Estimated Monthly Earnings
              </div>
              <div style={{ fontSize: '36px', fontWeight: 900, color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                {monthlyEarnings.toLocaleString()} <span style={{ fontSize: '18px', color: 'var(--accent-orange-text)' }}>HZN</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                ~{(monthlyEarnings / 10).toFixed(0)} USD protocol equivalent value
              </div>
            </div>

            <button
              type="button"
              onClick={onStartContributing}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              <span>Join Contributor Network</span>
              <ArrowRightIcon size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Section 5: Live Tasks Explorer */}
      <section id="tasks" className="section-container" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="section-header">
          <div className="section-tag">Active Missions</div>
          <h2 className="section-title">Explore Active Field Tasks</h2>
          <p className="section-desc">
            Real observation gaps currently registered in PostGIS SRID 4326 awaiting verification.
          </p>
        </div>

        <div className="task-grid-cards">
          {tasks.slice(0, 3).map((task) => (
            <div key={task.id} className="contributor-task-card">
              <div className="task-card-header">
                <span className="badge-artifact">
                  {task.artifact_type.replace(/_/g, ' ')}
                </span>
                <span className="task-card-reward">
                  +{task.base_reward} HZN
                </span>
              </div>

              <h4 className="task-card-title">{task.title}</h4>
              <p className="task-card-desc">{task.description}</p>

              <div className="task-card-meta">
                <div className="task-card-meta-item">
                  <MapPinIcon size={13} color="var(--accent-orange)" />
                  <span className="font-mono">
                    {task.latitude.toFixed(3)}, {task.longitude.toFixed(3)}
                  </span>
                </div>
                <div className="task-card-meta-item">
                  <ClockIcon size={13} />
                  <span>~{task.estimated_effort_minutes || 25}m</span>
                </div>
                <div className="task-card-meta-item">
                  <CoinsIcon size={13} />
                  <span>{task.commitment_stake} stake</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onStartContributing}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '16px', width: '100%', justifyContent: 'space-between' }}
              >
                <span>Claim &amp; Collect</span>
                <ArrowRightIcon size={14} color="var(--accent-orange)" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Section 6: FAQ */}
      <section id="faq" className="section-container" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="section-header">
          <div className="section-tag">Knowledge Base</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-desc">
            Everything you need to know about the Horizon verification protocol.
          </p>
        </div>

        <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="stat-card"
                style={{ padding: '20px 24px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                onClick={() => setActiveFaq(isOpen ? null : idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                    {faq.q}
                  </h4>
                  <span style={{ fontSize: '16px', color: 'var(--accent-orange-text)', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    +
                  </span>
                </div>
                {isOpen && (
                  <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="section-container" style={{ paddingTop: '20px', paddingBottom: '90px' }}>
        <div className="cta-banner">
          <h2 className="cta-title">Ready to Map the Physical World?</h2>
          <p className="cta-desc">
            Join thousands of spatial contributors mapping critical infrastructure,
            verifying environmental assets, and earning protocol rewards.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            <button
              type="button"
              onClick={onStartContributing}
              className="btn btn-primary btn-lg"
            >
              <span>Start Contributing Now</span>
              <ArrowRightIcon size={16} />
            </button>
            <button
              type="button"
              onClick={onOpenAdminConsole}
              className="btn btn-secondary btn-lg"
            >
              <span>Explore Admin Console</span>
            </button>
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div style={{ maxWidth: '340px' }}>
            <div className="landing-logo" style={{ marginBottom: '14px' }}>
              <div className="brand-logo-mark" style={{ width: '32px', height: '32px' }}>
                <LogoMark size={18} />
              </div>
              <span className="landing-logo-text" style={{ fontSize: '16px' }}>HORIZON</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Decentralized geospatial field-data collection and verification protocol.
              Powered by PostGIS SRID 4326, multimodal AI quality scoring, and distributed peer consensus.
            </p>
          </div>

          <div>
            <h5 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#ffffff', marginBottom: '14px' }}>
              Protocol
            </h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <li>PostGIS SRID 4326 Standards</li>
              <li>Byzantine Quorum Consensus</li>
              <li>Loupe ML Downstream Pipeline</li>
              <li>Proof-of-Commitment Staking</li>
            </ul>
          </div>

          <div>
            <h5 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#ffffff', marginBottom: '14px' }}>
              Applications
            </h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <li>
                <button
                  type="button"
                  onClick={onStartContributing}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-orange-text)', cursor: 'pointer', padding: 0, fontSize: '13px', fontWeight: 600 }}
                >
                  Contributor Web Portal →
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenAdminConsole}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '13px' }}
                >
                  Enterprise Admin Console →
                </button>
              </li>
              <li style={{ color: 'var(--text-muted)' }}>Android Contributor App (Expo)</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>&copy; 2026 Horizon Geospatial Foundation. Open Verification Architecture.</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>PostGIS Active</span>
            <span>FastAPI v1</span>
            <span>Next.js 14 App Router</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
