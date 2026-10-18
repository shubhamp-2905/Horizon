'use client';

import React, { useState, useEffect } from 'react';
import { CameraIcon, RefreshCwIcon, AlertTriangleIcon } from './Icons';
import type { ActiveEvidencePreview } from './SubmissionsTab';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://horizon-backend-api.onrender.com/api/v1').replace(/\/+$/, '');

interface AuthenticatedEvidenceImageProps {
  submissionId: string;
  media: any;
  adminToken?: string | null;
  alt?: string;
  height?: string | number;
  onPreview?: (preview: ActiveEvidencePreview) => void;
}

export const AuthenticatedEvidenceImage: React.FC<AuthenticatedEvidenceImageProps> = ({
  submissionId,
  media,
  adminToken,
  alt,
  height = '140px',
  onPreview,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const fileName =
    media.metadata?.file_name ||
    media.metadata?.filename ||
    (media.storage_key ? media.storage_key.split('/').pop() : 'Ground Evidence');
  const fileSize = media.metadata?.file_size_bytes || media.metadata?.file_size;
  const mediaType = media.media_type || 'image/jpeg';

  useEffect(() => {
    let isCancelled = false;
    let createdUrl: string | null = null;

    // 1. Direct Base64 data (if present)
    const base64Data = media.metadata?.image_base64 || media.metadata?.base64;
    if (base64Data) {
      const dataUri = base64Data.startsWith('data:')
        ? base64Data
        : `data:${mediaType};base64,${base64Data}`;
      setBlobUrl(dataUri);
      setLoading(false);
      setError(null);
      return;
    }

    // 2. Direct external URL (e.g., S3 or external CDN not requiring local API auth)
    if (
      media.url &&
      typeof media.url === 'string' &&
      media.url.startsWith('http') &&
      !media.url.includes('/api/v1/submissions/')
    ) {
      setBlobUrl(media.url);
      setLoading(false);
      setError(null);
      return;
    }

    // 3. Authenticated Content Endpoint with Authorization Header & Query Fallback
    async function fetchEvidenceBlob() {
      setLoading(true);
      setError(null);

      try {
        const token =
          adminToken ||
          (typeof window !== 'undefined' ? localStorage.getItem('horizon_admin_token') : null);

        const targetEndpoint = `${API_BASE_URL}/submissions/${submissionId}/media/${media.id}/content`;
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const urlWithToken = token
          ? `${targetEndpoint}?token=${encodeURIComponent(token)}`
          : targetEndpoint;

        const res = await fetch(urlWithToken, {
          headers,
          cache: 'force-cache',
        });

        if (!res.ok) {
          throw new Error(`Media fetch returned HTTP ${res.status}`);
        }

        const blob = await res.blob();
        if (isCancelled) return;

        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
        setLoading(false);
        setError(null);
      } catch (err: any) {
        if (isCancelled) return;
        setError(err.message || 'Failed to load evidence');
        setLoading(false);
      }
    }

    fetchEvidenceBlob();

    return () => {
      isCancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [submissionId, media.id, adminToken, retryCount, mediaType, media.metadata, media.url]);

  const handleCardClick = () => {
    if (onPreview) {
      const fallbackUrl =
        blobUrl ||
        `${API_BASE_URL}/submissions/${submissionId}/media/${media.id}/content${
          adminToken ? `?token=${encodeURIComponent(adminToken)}` : ''
        }`;

      onPreview({
        url: fallbackUrl,
        fileName,
        fileSize,
        mediaType,
        id: media.id,
        storageKey: media.storage_key,
      });
    }
  };

  return (
    <div
      style={{
        height,
        background: '#0B0F19',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onPreview ? 'pointer' : 'default',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: '6px',
      }}
      onClick={handleCardClick}
      title={`Inspect ${fileName}`}
    >
      {loading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            color: '#94A3B8',
            fontSize: '11px',
            padding: '12px',
          }}
        >
          <RefreshCwIcon size={20} className="animate-spin" color="#10B981" />
          <span>Loading evidence...</span>
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: '#CBD5E1',
            padding: '12px',
            textAlign: 'center',
            width: '100%',
            height: '100%',
            background: '#1E293B',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CameraIcon size={22} color="#94A3B8" />
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Preview Unavailable</span>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            style={{
              background: '#334155',
              border: 'none',
              borderRadius: '4px',
              color: '#F8FAFC',
              fontSize: '10px',
              padding: '2px 8px',
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && blobUrl && (
        <>
          <img
            src={blobUrl}
            alt={alt || fileName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform 0.2s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(4px)',
              color: '#FFFFFF',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              pointerEvents: 'none',
              letterSpacing: '0.3px',
            }}
          >
            Zoom ↗
          </div>
        </>
      )}
    </div>
  );
};
