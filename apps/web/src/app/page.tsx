'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLogin } from '../components/AdminLogin';

export default function RootPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('horizon_admin_token');
      if (token) {
        router.replace('/admin');
      } else {
        setCheckingAuth(false);
      }
    }
  }, [router]);

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-void)',
          color: 'var(--text-secondary)',
          fontSize: '13px',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <span>Loading Horizon Operations Console...</span>
      </div>
    );
  }

  // Root route renders Admin Login directly
  return <AdminLogin />;
}
