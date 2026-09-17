import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { MyTasksScreen } from '../screens/MyTasksScreen';
import { apiClient } from '../services/api';
import type { AuthTokenResponse, TaskResponseDTO } from '@horizon/types';

type Tab = 'home' | 'discover' | 'tasks' | 'wallet';

export const RootNavigator: React.FC = () => {
  const [auth, setAuth] = useState<AuthTokenResponse | null>(null);
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [selectedTask, setSelectedTask] = useState<TaskResponseDTO | null>(null);
  const [availableTokens, setAvailableTokens] = useState<number>(100);

  const handleAuthenticated = (authData: AuthTokenResponse) => {
    setAuth(authData);
    // Fetch initial wallet balance
    apiClient
      .getWallet()
      .then((w) => setAvailableTokens(w.available_balance))
      .catch(() => setAvailableTokens(100));
  };

  const handleSignOut = () => {
    apiClient.setToken(null);
    setAuth(null);
    setCurrentTab('home');
    setSelectedTask(null);
  };

  const handleTaskClaimSuccess = () => {
    // Refresh balance and transition to My Tasks
    apiClient
      .getWallet()
      .then((w) => setAvailableTokens(w.available_balance))
      .catch(() => {});
    setSelectedTask(null);
    setCurrentTab('tasks');
  };

  if (!auth) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.userBadge}>
          <Text style={styles.userIcon}>👤</Text>
          <Text style={styles.userName}>{auth.user.username}</Text>
        </View>
        <View style={styles.topRight}>
          <View style={styles.tokenPill}>
            <Text style={styles.tokenPillText}>{availableTokens} TOKENS</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {selectedTask ? (
          <TaskDetailScreen
            task={selectedTask}
            availableTokens={availableTokens}
            onBack={() => setSelectedTask(null)}
            onClaimSuccess={handleTaskClaimSuccess}
          />
        ) : currentTab === 'home' ? (
          <HomeScreen
            onNavigate={(tab) => setCurrentTab(tab)}
            user={auth.user}
          />
        ) : currentTab === 'discover' ? (
          <DiscoverScreen
            onSelectTask={(task) => setSelectedTask(task)}
          />
        ) : currentTab === 'tasks' ? (
          <MyTasksScreen
            onSelectClaimedTask={(task) => setSelectedTask(task)}
            onExploreMore={() => setCurrentTab('discover')}
          />
        ) : (
          <WalletScreen />
        )}
      </View>

      {/* Bottom Navigation Tabs */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, currentTab === 'home' && !selectedTask && styles.activeNavItem]}
          onPress={() => {
            setSelectedTask(null);
            setCurrentTab('home');
          }}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navText, currentTab === 'home' && !selectedTask && styles.activeNavText]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'discover' && !selectedTask && styles.activeNavItem]}
          onPress={() => {
            setSelectedTask(null);
            setCurrentTab('discover');
          }}
        >
          <Text style={styles.navIcon}>🛰️</Text>
          <Text style={[styles.navText, currentTab === 'discover' && !selectedTask && styles.activeNavText]}>
            Discover
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'tasks' && !selectedTask && styles.activeNavItem]}
          onPress={() => {
            setSelectedTask(null);
            setCurrentTab('tasks');
          }}
        >
          <Text style={styles.navIcon}>📋</Text>
          <Text style={[styles.navText, currentTab === 'tasks' && !selectedTask && styles.activeNavText]}>
            My Tasks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'wallet' && !selectedTask && styles.activeNavItem]}
          onPress={() => {
            setSelectedTask(null);
            setCurrentTab('wallet');
          }}
        >
          <Text style={styles.navIcon}>💎</Text>
          <Text style={[styles.navText, currentTab === 'wallet' && !selectedTask && styles.activeNavText]}>
            Wallet
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userIcon: {
    fontSize: 16,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenPill: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tokenPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FBBF24',
  },
  signOutBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  signOutText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 8,
    paddingBottom: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  activeNavItem: {
    opacity: 1,
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  activeNavText: {
    color: '#38BDF8',
    fontWeight: '700',
  },
});
