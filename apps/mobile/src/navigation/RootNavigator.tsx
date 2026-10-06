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
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';

type Tab = 'home' | 'discover' | 'tasks' | 'wallet';

export const RootNavigator: React.FC = () => {
  const { theme, isDark, toggleTheme } = useTheme();
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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.surface}
      />

      {/* Top Application Bar */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.divider,
          },
        ]}
      >
        <View style={styles.brandGroup}>
          <View
            style={[
              styles.brandIconCircle,
              {
                backgroundColor: theme.purpleMuted,
                borderColor: theme.borderHighlight,
              },
            ]}
          >
            <Text style={[styles.brandIconText, { color: theme.electricPurple }]}>◈</Text>
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>HORIZON</Text>
            <Text style={[styles.userName, { color: theme.textMuted }]}>{auth.user.username}</Text>
          </View>
        </View>

        <View style={styles.topRight}>
          {/* Balance Pill */}
          <TouchableOpacity
            style={[
              styles.balancePill,
              {
                backgroundColor: theme.purpleMuted,
                borderColor: theme.borderHighlight,
              },
            ]}
            onPress={() => {
              setSelectedTask(null);
              setCurrentTab('wallet');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.balanceDot, { backgroundColor: theme.electricPurple }]} />
            <Text style={[styles.balancePillText, { color: theme.electricPurple }]}>
              {availableTokens} HZN
            </Text>
          </TouchableOpacity>

          {/* Theme Switcher Toggle */}
          <TouchableOpacity
            style={[
              styles.themeToggleBtn,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Text style={[styles.themeToggleText, { color: theme.textSecondary }]}>
              {isDark ? '☀' : '☾'}
            </Text>
          </TouchableOpacity>

          {/* Exit Button */}
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.7}>
            <Text style={[styles.signOutText, { color: theme.textMuted }]}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Content View */}
      <View style={[styles.content, { backgroundColor: theme.background }]}>
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
      <View
        style={[
          styles.bottomNav,
          {
            backgroundColor: theme.navigation,
            borderTopColor: theme.navigationBorder,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.navItem, currentTab === 'home' && !selectedTask && styles.activeNavItem]}
          onPress={() => {
            setSelectedTask(null);
            setCurrentTab('home');
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.navSymbol,
              { color: theme.textMuted },
              currentTab === 'home' && !selectedTask && { color: theme.electricPurple },
            ]}
          >
            ⌂
          </Text>
          <Text
            style={[
              styles.navText,
              { color: theme.textMuted },
              currentTab === 'home' && !selectedTask && { color: theme.textPrimary, fontWeight: '800' },
            ]}
          >
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
          <Text
            style={[
              styles.navSymbol,
              { color: theme.textMuted },
              currentTab === 'discover' && !selectedTask && { color: theme.electricPurple },
            ]}
          >
            ◎
          </Text>
          <Text
            style={[
              styles.navText,
              { color: theme.textMuted },
              currentTab === 'discover' && !selectedTask && { color: theme.textPrimary, fontWeight: '800' },
            ]}
          >
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
          <Text
            style={[
              styles.navSymbol,
              { color: theme.textMuted },
              currentTab === 'tasks' && !selectedTask && { color: theme.electricPurple },
            ]}
          >
            ▤
          </Text>
          <Text
            style={[
              styles.navText,
              { color: theme.textMuted },
              currentTab === 'tasks' && !selectedTask && { color: theme.textPrimary, fontWeight: '800' },
            ]}
          >
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
          <Text
            style={[
              styles.navSymbol,
              { color: theme.textMuted },
              currentTab === 'wallet' && !selectedTask && { color: theme.electricPurple },
            ]}
          >
            ◈
          </Text>
          <Text
            style={[
              styles.navText,
              { color: theme.textMuted },
              currentTab === 'wallet' && !selectedTask && { color: theme.textPrimary, fontWeight: '800' },
            ]}
          >
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
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 14,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  userName: {
    fontSize: 11,
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
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    gap: 6,
  },
  balanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  balancePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  themeToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  signOutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radius.xs,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
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
  },
  navText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
