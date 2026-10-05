'use client';

import React from 'react';
import {
  LogoMark,
  MapPinIcon,
  LayersIcon,
  CameraIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  SatelliteIcon,
  UsersIcon,
  DatabaseIcon,
} from './Icons';
import type { AdminTaskItem } from './OverviewTab';

interface LandingPageProps {
  tasks: AdminTaskItem[];
  onStartContributing: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  tasks,
  onStartContributing,
}) => {
  const publishedTasks = tasks.filter((t) => t.status === 'published');

  return (
    <div className="landing-shell">
      {/* Top Navigation Bar — Clean Contributor Experience */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo" onClick={onStartContributing}>
            <div className="brand-logo-mark" style={{ width: '36px', height: '36px' }}>
              <LogoMark size={20} />
            </div>
            <div>
              <span className="landing-logo-text">HORIZON</span>
              <span style={{ fontSize: '10px', color: 'var(--cyan-glow)', display: 'block', fontWeight: 700, letterSpacing: '0.8px', marginTop: '-2px' }}>
                GEOSPATIAL PROTOCOL
              </span>
            </div>
          </div>

          <nav className="landing-nav-links">
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#protocol" className="landing-nav-link">Verification</a>
            <a href="#tasks" className="landing-nav-link">Available Tasks</a>
          </nav>

          <div className="landing-nav-actions">
            <button
              type="button"
              onClick={onStartContributing}
              className="btn btn-primary btn-sm"
              style={{ padding: '8px 18px', fontWeight: 700 }}
            >
              <span>Start Contributing</span>
              <ArrowRightIcon size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section — Orbital Atmosphere & Horizon Light */}
      <section className="hero-section">
        {/* Orbital Curvature Backdrop */}
        <div className="hero-orbital-backdrop" />
        <div className="hero-glow-bg" />

        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            <span>PostGIS SRID 4326 · Ground-Truth Layer</span>
          </div>

          <h1 className="hero-headline">
            Building the verified layer of the <span className="hero-headline-gradient">physical world.</span>
          </h1>

          <p className="hero-lead">
            A decentralized platform for collecting and verifying real-world geospatial ground truth with cryptographic proof, AI evaluation, and peer consensus.
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              onClick={onStartContributing}
              className="btn btn-primary btn-lg"
              style={{ minWidth: '180px' }}
            >
              <span>Start Contributing</span>
              <ArrowRightIcon size={16} />
            </button>

            <a
              href="#tasks"
              className="btn btn-secondary btn-lg"
              style={{ minWidth: '160px' }}
            >
              <span>Explore Horizon</span>
            </a>
          </div>

          {/* Visual Product Flow Strip: Physical World → Field Observation → Community Review → Admin Verification → Verified Data */}
          <div className="flow-strip">
            <div className="flow-step-item">
              <CameraIcon size={14} color="var(--cyan-glow)" />
              <span>Field Observation</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step-item">
              <ShieldCheckIcon size={14} color="var(--cyan-glow)" />
              <span>AI Validation</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step-item">
              <UsersIcon size={14} color="var(--cyan-glow)" />
              <span>Community Review</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step-item">
              <SatelliteIcon size={14} color="var(--cyan-glow)" />
              <span>Admin Verification</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step-item">
              <DatabaseIcon size={14} color="var(--accent-emerald-text)" />
              <span style={{ color: 'var(--accent-emerald-text)' }}>Verified Data</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Storytelling Section: 3 Pillars */}
      <section id="how-it-works" className="section-container">
        <div className="section-header">
          <span className="section-tag">Architecture</span>
          <h2 className="section-title">How Horizon Works</h2>
          <p className="section-subtitle">
            From field sensor telemetry to cryptographically verified datasets.
          </p>
        </div>

        <div className="feature-grid-3">
          <div className="feature-card">
            <div className="feature-icon">
              <MapPinIcon size={22} />
            </div>
            <h3 className="feature-card-title">1. Collect Field Data</h3>
            <p className="feature-card-desc">
              Discover nearby geographic waypoints. Capture GPS-locked photographic evidence and structured physical observations with cryptographic sensor timestamps.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <UsersIcon size={22} />
            </div>
            <h3 className="feature-card-title">2. Community Review</h3>
            <p className="feature-card-desc">
              Community reviewers inspect collected ground evidence to cast Accept, Reject, or Flag judgements, providing robust consensus signals without modifying original contributor records.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <DatabaseIcon size={22} />
            </div>
            <h3 className="feature-card-title">3. Verified Data</h3>
            <p className="feature-card-desc">
              Passed contributions undergo final administrative verification and commit to high-precision PostGIS feeds, providing authoritative ground truth for maps and spatial intelligence.
            </p>
          </div>
        </div>
      </section>

      {/* Live Available Tasks Section */}
      <section id="tasks" className="section-container" style={{ paddingTop: '20px' }}>
        <div className="section-header">
          <span className="section-tag">Active Tasks</span>
          <h2 className="section-title">Explore Field Collection</h2>
          <p className="section-subtitle">
            Live geospatial observation points currently open for contributor claims and reward settlement.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {publishedTasks.map((task) => (
            <div
              key={task.id}
              className="stat-card"
              style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={onStartContributing}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="badge-artifact">
                  {task.artifact_type.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--cyan-glow)', fontFamily: 'JetBrains Mono, monospace' }}>
                  +{task.base_reward} HZN
                </span>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                {task.title}
              </h3>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '18px', flex: 1 }}>
                {task.description}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--cyan-glow)', fontWeight: 600 }}>
                  <span>Claim Task</span>
                  <ArrowRightIcon size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button
            type="button"
            onClick={onStartContributing}
            className="btn btn-primary btn-lg"
          >
            <span>Join Network &amp; Start Contributing</span>
            <ArrowRightIcon size={16} />
          </button>
        </div>
      </section>

      {/* Clean Contributor Footer — No Administrative Entry Points */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '40px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LogoMark size={20} />
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>HORIZON</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>· Geospatial Ground-Truth Infrastructure</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Horizon Protocol. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
