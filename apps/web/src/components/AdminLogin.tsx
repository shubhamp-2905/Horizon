'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoMark, ArrowRightIcon, ShieldCheckIcon, AlertTriangleIcon, ActivityIcon } from './Icons';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://horizon-backend-api.onrender.com/api/v1').replace(/\/+$/, '');

export const AdminLogin: React.FC = () => {
  const router = useRouter();
  const [ident, setIdent] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ident.trim() || !password) {
      setErrorMsg('Please enter both administrator identifier and password.');
      return;
    }

    setLoading(true);
    setIsWarmingUp(false);
    setErrorMsg(null);

    const warmUpTimer = setTimeout(() => setIsWarmingUp(true), 3500);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_or_username: ident.trim(),
          password: password,
        }),
        signal: controller.signal,
      });

      clearTimeout(warmUpTimer);
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        // Check role
        if (data.user?.role !== 'admin' && data.user?.role !== 'reviewer') {
          setErrorMsg('Access denied. Administrator privileges required.');
          return;
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('horizon_admin_token', data.access_token);
          localStorage.setItem('horizon_admin_user', JSON.stringify(data.user));
        }
        router.push('/admin');
      } else if (res.status === 401) {
        setErrorMsg('Invalid administrative credentials. Please verify your credentials.');
      } else if (res.status === 403) {
        setErrorMsg('Access denied. Administrator or reviewer privileges required.');
      } else if (res.status === 429) {
        setErrorMsg('Too many authentication attempts. Please wait a moment and try again.');
      } else {
        const errJson = await res.json().catch(() => null);
        const detailMsg = typeof errJson?.detail === 'string' ? errJson.detail : (errJson?.detail?.message || null);
        setErrorMsg(detailMsg || `Authentication server returned status ${res.status}. Please try again.`);
      }
    } catch (err: any) {
      clearTimeout(warmUpTimer);
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') {
        setErrorMsg('Connection to authentication endpoint timed out (20s). If the backend is waking up, please retry in a few moments.');
      } else {
        setErrorMsg('Network error connecting to authentication endpoint. Please verify backend service connectivity.');
      }
    } finally {
      clearTimeout(warmUpTimer);
      clearTimeout(timeoutId);
      setLoading(false);
      setIsWarmingUp(false);
    }
  };

  return (
    <div className="admin-login-layout">
      {/* Subtle atmospheric Horizon curve glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '400px',
          background: 'radial-gradient(ellipse at 50% 10%, rgba(45, 140, 255, 0.15) 0%, rgba(99, 216, 255, 0.04) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="admin-login-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="admin-login-header">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '8px' }}>
            <img
              src="/logo.png"
              alt="Horizon Logo"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                objectFit: 'cover',
                marginBottom: '14px',
                boxShadow: '0 4px 16px rgba(21, 128, 61, 0.18)',
              }}
            />
            <h1 className="admin-login-title" style={{ fontSize: '26px', fontWeight: 800 }}>Horizon</h1>
            <p className="admin-login-sub" style={{ fontSize: '14px', fontWeight: 500, color: '#64748B' }}>Admin Dashboard</p>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--status-error-subtle)',
              border: '1px solid var(--status-error-border)',
              color: 'var(--status-error-text)',
              fontSize: '12px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangleIcon size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {isWarmingUp && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              color: '#1D4ED8',
              fontSize: '12px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              animation: 'pulse 2s infinite',
            }}
          >
            <ActivityIcon size={16} />
            <span>Connecting to backend services... If idle, the server on Render may take 10-15s to wake up.</span>
          </div>
        )}

        <form onSubmit={handleSignIn}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-ident">
              Username or Email
            </label>
            <input
              id="admin-ident"
              type="text"
              className="form-input"
              value={ident}
              onChange={(e) => setIdent(e.target.value)}
              placeholder="admin@horizon.dev"
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px', fontSize: '14px', fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? (
              <span>{isWarmingUp ? 'Waking up server...' : 'Authenticating...'}</span>
            ) : (
              <>
                <span>Sign In to Console</span>
                <ArrowRightIcon size={16} />
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: '26px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheckIcon size={13} color="var(--cyan-glow)" />
            <span>RBAC Protected</span>
          </span>
          <span>SRID 4326</span>
        </div>
      </div>
    </div>
  );
};
