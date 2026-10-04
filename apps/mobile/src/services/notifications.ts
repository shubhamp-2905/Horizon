/**
 * @file Push Notification Architecture for Horizon Contributor
 * Handles push token registration, device permission negotiation,
 * and high-priority notification handling for peer review assignments
 * and consensus token reward settlements.
 */

import { Platform } from 'react-native';
import { apiClient } from './api';

export type HorizonNotificationType =
  | 'CONSENSUS_SETTLED'
  | 'REVIEW_ASSIGNED'
  | 'TASK_EXPIRING'
  | 'REWARD_EARNED';

export interface HorizonNotificationPayload {
  type: HorizonNotificationType;
  title: string;
  body: string;
  data: {
    submissionId?: string;
    taskId?: string;
    rewardAmount?: number;
    consensusStatus?: string;
  };
}

export type NotificationListener = (notification: HorizonNotificationPayload) => void;

class NotificationService {
  private pushToken: string | null = null;
  private listeners: Set<NotificationListener> = new Set();

  /**
   * Register push notification token with backend.
   * Only called on genuine physical devices with user authorization.
   */
  async registerDeviceToken(token: string): Promise<boolean> {
    try {
      this.pushToken = token;
      const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      
      const baseUrl = apiClient.getBaseUrl();
      const tokenHeader = apiClient.getToken();
      const response = await fetch(`${baseUrl}/auth/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenHeader ? { Authorization: `Bearer ${tokenHeader}` } : {}),
        },
        body: JSON.stringify({
          push_token: token,
          device_type: deviceType,
        }),
      });

      return response.ok;
    } catch (err) {
      console.warn('[NotificationService] Failed to register push token with backend:', err);
      return false;
    }
  }

  /**
   * Subscribe to incoming notifications while app is in foreground or active.
   */
  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Dispatch notification to all active subscribers.
   */
  dispatch(notification: HorizonNotificationPayload): void {
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch (err) {
        console.error('[NotificationService] Error executing notification listener:', err);
      }
    }
  }

  /**
   * Get cached push token.
   */
  getToken(): string | null {
    return this.pushToken;
  }
}

export const notificationService = new NotificationService();
