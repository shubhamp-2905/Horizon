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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: '#F8F9FA',
          color: '#344054',
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        <img
          src="/logo.png"
          alt="Horizon Logo"
          style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover', boxShadow: '0 4px 14px rgba(21, 128, 61, 0.15)' }}
        />
        <span>Loading Horizon Operations Console...</span>
      </div>
    );
  }

  // Root route renders Admin Login directly
  return <AdminLogin />;
}
