'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ContributorPortal } from '../../components/ContributorPortal';
import type { AdminTaskItem } from '../../components/OverviewTab';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');

const INITIAL_DEMO_TASKS: AdminTaskItem[] = [
  {
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
  {
    id: '8a1c93f0-4521-419b-a012-78d91a2bc45e',
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
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '9b3e12a8-12cd-48ea-b248-18e9741fd230',
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
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function ContributorPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<AdminTaskItem[]>(INITIAL_DEMO_TASKS);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/tasks?page_size=50`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data.tasks && data.tasks.length > 0) {
          const mappedTasks: AdminTaskItem[] = data.tasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            artifact_type: t.artifact_type,
            status: t.status || 'published',
            difficulty: t.difficulty || 1.0,
            scarcity: t.scarcity || 1.0,
            base_reward: t.base_reward || 50,
            commitment_stake: t.commitment_stake || 10,
            estimated_effort_minutes: t.estimated_effort_minutes || 25,
            latitude: t.latitude || 18.5204,
            longitude: t.longitude || 73.8567,
            requirements: t.requirements || ['Geotagged ground observation'],
            created_at: t.created_at || new Date().toISOString(),
          }));
          setTasks(mappedTasks);
        }
      }
    } catch {
      // offline fallback
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <ContributorPortal
      tasks={tasks}
      onReturnToLanding={() => router.push('/')}
      onOpenAdminConsole={() => router.push('/admin')}
    />
  );
}
