'use client';

import React, { useState, useEffect } from 'react';

interface AdminTask {
  id: string;
  title: string;
  description: string;
  artifact_type: string;
  status: string;
  difficulty: number;
  scarcity: number;
  base_reward: number;
  commitment_stake: number;
  estimated_effort_minutes: number;
  latitude: number;
  longitude: number;
  requirements: string[];
  created_at: string;
}

const INITIAL_DEMO_TASKS: AdminTask[] = [
  {
    id: 'demo-task-1',
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
  {
    id: 'demo-task-2',
    title: 'Rooftop Solar Array Inspection',
    description: 'Verify solar panel integrity, shading conditions, and inverter wiring.',
    artifact_type: 'solar_installation',
    status: 'published',
    difficulty: 2.5,
    scarcity: 1.8,
    base_reward: 200,
    commitment_stake: 30,
    estimated_effort_minutes: 35,
    latitude: 18.5312,
    longitude: 73.8445,
    requirements: ['Aerial canopy photo', 'Inverter serial code'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-task-3',
    title: 'Micro-Grid Transformer Substation',
    description: 'Inspect ground clearance and thermal hazard warnings.',
    artifact_type: 'telecom_tower',
    status: 'draft',
    difficulty: 1.5,
    scarcity: 1.0,
    base_reward: 100,
    commitment_stake: 15,
    estimated_effort_minutes: 20,
    latitude: 18.5089,
    longitude: 73.8631,
    requirements: ['Safety perimeter check', 'Substation meter reading'],
    created_at: new Date().toISOString(),
  },
];

export default function DashboardPage() {
  const [tasks, setTasks] = useState<AdminTask[]>(INITIAL_DEMO_TASKS);
  const [loading, setLoading] = useState(false);
  const [adminToken, setAdminToken] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artifactType, setArtifactType] = useState('water_source');
  const [baseReward, setBaseReward] = useState('150');
  const [commitmentStake, setCommitmentStake] = useState('20');
  const [difficulty, setDifficulty] = useState('2.0');
  const [scarcity, setScarcity] = useState('1.5');
  const [effortMinutes, setEffortMinutes] = useState('25');
  const [latitude, setLatitude] = useState('18.5204');
  const [longitude, setLongitude] = useState('73.8567');
  const [status, setStatus] = useState('published');
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDemoPreset = () => {
    setTitle('Community Water Source Survey');
    setDescription('Survey and verify public water dispensary status, flow, and cleanliness.');
    setArtifactType('water_source');
    setBaseReward('150');
    setCommitmentStake('20');
    setDifficulty('2.0');
    setScarcity('1.5');
    setEffortMinutes('25');
    setLatitude('18.5204');
    setLongitude('73.8567');
    setStatus('published');
    setFeedback('Loaded "Community Water Source Survey" demo parameters!');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedback('Error: Task title is required.');
      return;
    }

    setLoading(true);
    setFeedback(null);

    const newTaskPayload = {
      title,
      description,
      artifact_type: artifactType,
      status,
      difficulty: parseFloat(difficulty) || 1.0,
      scarcity: parseFloat(scarcity) || 1.0,
      base_reward: parseInt(baseReward, 10) || 50,
      commitment_stake: parseInt(commitmentStake, 10) || 10,
      estimated_effort_minutes: parseInt(effortMinutes, 10) || 30,
      latitude: parseFloat(latitude) || 18.5204,
      longitude: parseFloat(longitude) || 73.8567,
      requirements: ['Geotagged ground photo', 'Visual survey checklist'],
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      const res = await fetch('http://localhost:4000/api/v1/admin/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(newTaskPayload),
      });

      if (res.ok) {
        const created: AdminTask = await res.json();
        setTasks([created, ...tasks]);
        setFeedback(`Task "${created.title}" successfully created and saved to PostGIS!`);
        setTitle('');
        setDescription('');
      } else {
        // Local simulation fallback if standalone backend is not live
        const simulated: AdminTask = {
          ...newTaskPayload,
          id: `task-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        setTasks([simulated, ...tasks]);
        setFeedback(`Task "${simulated.title}" created (Simulation mode).`);
        setTitle('');
        setDescription('');
      }
    } catch {
      // Fallback
      const simulated: AdminTask = {
        ...newTaskPayload,
        id: `task-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setTasks([simulated, ...tasks]);
      setFeedback(`Task "${simulated.title}" created (Simulation mode).`);
      setTitle('');
      setDescription('');
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (task: AdminTask) => {
    const nextStatus = task.status === 'published' ? 'draft' : 'published';
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

      await fetch(`http://localhost:4000/api/v1/admin/tasks/${task.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch {
      // Ignore network errors in offline/dev
    }

    setTasks(
      tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
  };

  const totalRewardsBudget = tasks.reduce((sum, t) => sum + t.base_reward, 0);
  const publishedCount = tasks.filter((t) => t.status === 'published').length;

  return (
    <div className="dashboard-layout">
      {/* Navigation Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
          HORIZON
        </div>

        <nav>
          <a href="#" className="nav-item active">Overview</a>
          <a href="#task-management" className="nav-item">Task Management</a>
          <a href="#" className="nav-item">Contributors</a>
          <a href="#" className="nav-item">Token Escrow &amp; Ledger</a>
          <a href="#" className="nav-item">Geospatial PostGIS</a>
        </nav>
      </aside>

      {/* Main Console Content */}
      <main className="main-content">
        <header className="header">
          <h1>Horizon Admin &amp; Reviewer Console</h1>
          <p>Phase 2: Authoritative geospatial task creation, lifecycle publishing, and token stake escrow.</p>
        </header>

        {/* Metrics Grid */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Total Registered Tasks</div>
            <div className="metric-value">{tasks.length}</div>
            <div className="metric-status">PostGIS Spatial Database</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Published In Discovery</div>
            <div className="metric-value">{publishedCount}</div>
            <div className="metric-status">Active Contributor Scopes</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Draft / Internal Gaps</div>
            <div className="metric-value">{tasks.length - publishedCount}</div>
            <div className="metric-status">Pending Review</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Allocated Reward Pool</div>
            <div className="metric-value">{totalRewardsBudget} TOKENS</div>
            <div className="metric-status">Server-Authoritative Ledger</div>
          </div>
        </section>

        {feedback && (
          <div style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#38bdf8',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{feedback}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        <div className="console-grid" id="task-management">
          {/* Create Task Form */}
          <section className="form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Create Geospatial Task</h2>
              <button
                type="button"
                onClick={loadDemoPreset}
                className="btn-secondary"
                style={{ fontSize: '11px' }}
              >
                Load Demo Preset
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Community Water Source Survey"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description &amp; Scope</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Instructions for contributors..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Artifact Type</label>
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
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Status</label>
                  <select
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="published">Published (Discoverable)</option>
                    <option value="draft">Draft (Internal)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Base Reward</label>
                  <input
                    type="number"
                    className="form-input"
                    value={baseReward}
                    onChange={(e) => setBaseReward(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Commitment Stake</label>
                  <input
                    type="number"
                    className="form-input"
                    value={commitmentStake}
                    onChange={(e) => setCommitmentStake(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Difficulty (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Scarcity Factor</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={scarcity}
                    onChange={(e) => setScarcity(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Target Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating Task...' : 'Publish / Register Task'}
              </button>
            </form>
          </section>

          {/* Task Management Table */}
          <section className="table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Registered Tasks ({tasks.length})</h2>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>PostGIS SRID 4326</span>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title &amp; Type</th>
                  <th>Status</th>
                  <th>Reward</th>
                  <th>Stake</th>
                  <th>Coordinates</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>
                        {t.artifact_type.replace('_', ' ')}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${t.status}`}>
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-amber">+{t.base_reward}</td>
                    <td style={{ color: '#94A3B8' }}>{t.commitment_stake}</td>
                    <td>
                      <span className="pill-coord">
                        {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleTaskStatus(t)}
                        className="btn-secondary"
                      >
                        {t.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
