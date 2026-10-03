import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { MyTasksScreen } from '../screens/MyTasksScreen';
import { apiClient } from '../services/api';
import type { AuthTokenResponse, TaskResponseDTO } from '@horizon/types';
import { colors, radius } from '../theme/colors';

type Tab = 'home' | 'discover' | 'tasks' | 'wallet';

export const RootNavigator: React.FC = () => {
  const [auth, setAuth] = useState<AuthTokenResponse | null>(null);
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [selectedTask, setSelectedTask] = useState<TaskResponseDTO | null>(null);
  const [availableTokens, setAvailableTokens] = useState<number>(100);

  // Restore cached session if available on startup
  useEffect(() => {
    const existing = apiClient.getCurrentSession();
    if (existing && existing.access_token) {
      setAuth(existing);
      setAvailableTokens(existing.user?.available_tokens ?? 100);
    }
  }, []);

  const handleAuthenticated = (authData: AuthTokenResponse) => {
    // Instant local state transition without waiting for redundant network roundtrips
    setAuth(authData);
    setAvailableTokens(authData.user?.available_tokens ?? 100);
    apiClient.saveSession(authData);
  };

  const handleSignOut = () => {
    apiClient.clearSession();
    setAuth(null);
    setCurrentTab('home');
    setSelectedTask(null);
  };

  const handleTaskClaimSuccess = () => {
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
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

      {/* Top Application Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <View style={styles.brandIconCircle}>
            <Text style={styles.brandIconText}>◈</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>HORIZON</Text>
            <Text style={styles.userName}>{auth.user.username}</Text>
          </View>
        </View>

        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.balancePill}
            onPress={() => {
              setSelectedTask(null);
              setCurrentTab('wallet');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.balanceDot} />
            <Text style={styles.balancePillText}>{availableTokens} TOKENS</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.7}>
            <Text style={styles.signOutText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Content View */}
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
            onSelectTask={(task) => setSelectedTask(task)}
            user={auth.user}
          />
        ) : currentTab === 'discover' ? (
          <DiscoverScreen onSelectTask={(task) => setSelectedTask(task)} />
        ) : currentTab === 'tasks' ? (
          <MyTasksScreen
            onSelectClaimedTask={(task) => setSelectedTask(task)}
            onExploreMore={() => setCurrentTab('discover')}
          />
        ) : (
          <WalletScreen />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, currentTab === 'home' && !selectedTask && styles.activeNavItem]}
          onPress={() => {
            setSelectedTask(null);
            setCurrentTab('home');
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.navSymbol, currentTab === 'home' && !selectedTask && styles.activeNavSymbol]}>
            ⌂
          </Text>
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
          activeOpacity={0.8}
        >
          <Text style={[styles.navSymbol, currentTab === 'discover' && !selectedTask && styles.activeNavSymbol]}>
            ◎
          </Text>
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
          activeOpacity={0.8}
        >
          <Text style={[styles.navSymbol, currentTab === 'tasks' && !selectedTask && styles.activeNavSymbol]}>
            ▤
          </Text>
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
          activeOpacity={0.8}
        >
          <Text style={[styles.navSymbol, currentTab === 'wallet' && !selectedTask && styles.activeNavSymbol]}>
            ◈
          </Text>
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
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 14,
    color: colors.accentGreen,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  userName: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGreenMuted,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    gap: 6,
  },
  balanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentGreen,
  },
  balancePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accentGreen,
    letterSpacing: 0.4,
  },
  signOutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.xs,
  },
  signOutText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingBottom: 14,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  activeNavItem: {
    opacity: 1,
  },
  navSymbol: {
    fontSize: 18,
    color: colors.textMuted,
  },
  activeNavSymbol: {
    color: colors.accentGreen,
  },
  navText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  activeNavText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
});
