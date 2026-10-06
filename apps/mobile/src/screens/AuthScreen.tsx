import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { apiClient } from '../services/api';
import type { AuthTokenResponse } from '@horizon/types';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import { HorizonButton } from '../components/ui/HorizonButton';

interface AuthScreenProps {
  onAuthenticated: (auth: AuthTokenResponse) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [emailOrUsername, setEmailOrUsername] = useState('scout_alex');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('Contributor123!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const isSubmittingRef = React.useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState(apiClient.getBaseUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const [serverTesting, setServerTesting] = useState(false);

  const testServerConnection = async () => {
    apiClient.setBaseUrl(serverUrl.trim());
    setServerTesting(true);
    setServerStatus(null);
    try {
      const res = await apiClient.checkHealth();
      setServerStatus(`🟢 Connected to Horizon API (${res.status})`);
    } catch (err: any) {
      setServerStatus(`🔴 Unreachable (${err.message || 'Network request failed'})`);
    } finally {
      setServerTesting(false);
    }
  };

  const validateForm = (): boolean => {
    setValidationError(null);
    setErrorMessage(null);

    if (isLogin) {
      if (!emailOrUsername.trim()) {
        setValidationError('Please enter your username or email address.');
        return false;
      }
      if (!password) {
        setValidationError('Please enter your password.');
        return false;
      }
    } else {
      if (!email.trim() || !email.includes('@')) {
        setValidationError('Please provide a valid email address.');
        return false;
      }
      if (!username.trim() || username.length < 3) {
        setValidationError('Username must be at least 3 characters long.');
        return false;
      }
      if (!password || password.length < 8) {
        setValidationError('Password must be at least 8 characters long.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (loading || isSubmittingRef.current) return;
    if (!validateForm()) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setErrorMessage(null);
    setLoadingStage('Signing in...');

    const stageTimer = setTimeout(() => {
      if (isSubmittingRef.current) {
        setLoadingStage('Connecting to cloud server...');
      }
    }, 3500);

    try {
      let authResponse: AuthTokenResponse;
      if (isLogin) {
        authResponse = await apiClient.login(emailOrUsername.trim(), password);
      } else {
        authResponse = await apiClient.register({
          email: email.trim().toLowerCase(),
          username: username.trim(),
          password,
          full_name: fullName.trim() || undefined,
        });
      }
      onAuthenticated(authResponse);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication request failed');
    } finally {
      clearTimeout(stageTimer);
      setLoading(false);
      setLoadingStage(null);
      isSubmittingRef.current = false;
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.kavContainer, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Row with Theme Toggle */}
        <View style={styles.topControlRow}>
          <View style={styles.platformBadge}>
            <Text style={[styles.platformBadgeText, { color: theme.textMuted }]}>FIELD CONTRIBUTOR</Text>
          </View>
          <TouchableOpacity
            style={[styles.themeToggleBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Text style={[styles.themeToggleText, { color: theme.textSecondary }]}>
              {isDark ? '☀ Light' : '☾ Dark'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Brand & Logo Header */}
        <View style={styles.brandArea}>
          <View
            style={[
              styles.logoMark,
              {
                backgroundColor: theme.purpleMuted,
                borderColor: theme.borderHighlight,
                shadowColor: theme.secondaryPurple,
              },
            ]}
          >
            <Text style={[styles.logoSymbol, { color: theme.electricPurple }]}>◈</Text>
          </View>
          <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Horizon</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Geospatial Field Collection Network
          </Text>
        </View>

        {/* Starter Balance Info Card */}
        <View
          style={[
            styles.starterBalanceCard,
            {
              backgroundColor: theme.surfaceCard,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.starterTopRow}>
            <Text style={[styles.starterLabel, { color: theme.textSecondary }]}>Starter Grant</Text>
            <View
              style={[
                styles.starterPill,
                {
                  backgroundColor: theme.purpleMuted,
                  borderColor: theme.borderHighlight,
                },
              ]}
            >
              <Text style={[styles.starterPillText, { color: theme.electricPurple }]}>100 HZN</Text>
            </View>
          </View>
          <Text style={[styles.starterExplanation, { color: theme.textMuted }]}>
            Verified contributors receive 100 starter tokens in an immutable ledger for task commitment stakes.
          </Text>
        </View>

        {/* Form Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surfaceCard,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Tab Switcher */}
          <View style={[styles.tabContainer, { backgroundColor: theme.surfaceSubtle }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                isLogin && styles.activeTab,
                isLogin && { backgroundColor: theme.surfaceCard },
              ]}
              onPress={() => {
                setIsLogin(true);
                setErrorMessage(null);
                setValidationError(null);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: theme.textMuted },
                  isLogin && { color: theme.electricPurple, fontWeight: '700' },
                ]}
              >
                Log In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                !isLogin && styles.activeTab,
                !isLogin && { backgroundColor: theme.surfaceCard },
              ]}
              onPress={() => {
                setIsLogin(false);
                setErrorMessage(null);
                setValidationError(null);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: theme.textMuted },
                  !isLogin && { color: theme.electricPurple, fontWeight: '700' },
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Feedback */}
          {(errorMessage || validationError) && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: theme.statusErrorMuted,
                  borderColor: theme.statusError,
                },
              ]}
            >
              <Text style={[styles.errorIcon, { color: theme.statusError }]}>⚠</Text>
              <Text style={[styles.errorText, { color: theme.statusError }]}>
                {errorMessage || validationError}
              </Text>
            </View>
          )}

          {isLogin ? (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Username or Email</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="e.g. scout_alex"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  value={emailOrUsername}
                  onChangeText={(val) => {
                    setEmailOrUsername(val);
                    if (validationError) setValidationError(null);
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.passwordLabelRow}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.visibilityBtn}
                  >
                    <Text style={[styles.visibilityText, { color: theme.electricPurple }]}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="Enter password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (validationError) setValidationError(null);
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="contributor@horizon.dev"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (validationError) setValidationError(null);
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Username</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="e.g. scout_ranger"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={(val) => {
                    setUsername(val);
                    if (validationError) setValidationError(null);
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name (Optional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="Alex River"
                  placeholderTextColor={theme.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.passwordLabelRow}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.visibilityBtn}
                  >
                    <Text style={[styles.visibilityText, { color: theme.electricPurple }]}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (validationError) setValidationError(null);
                  }}
                />
              </View>
            </View>
          )}

          <HorizonButton
            title={
              loading
                ? (isLogin ? 'Signing In...' : 'Creating Account...')
                : (isLogin ? 'Sign In' : 'Create Contributor Account')
            }
            onPress={handleSubmit}
            loading={loading}
            size="lg"
            variant="primary"
          />

          {loadingStage && (
            <View style={styles.loadingStageBox}>
              <ActivityIndicator size="small" color={theme.electricPurple} />
              <Text style={[styles.loadingStageText, { color: theme.textMuted }]}>{loadingStage}</Text>
            </View>
          )}
        </View>

        {/* Backend Configuration Accordion */}
        <View style={styles.serverConfigContainer}>
          <TouchableOpacity
            style={styles.serverConfigHeader}
            onPress={() => setShowServerConfig(!showServerConfig)}
            activeOpacity={0.7}
          >
            <View style={styles.serverConfigHeaderLeft}>
              <Text style={[styles.serverConfigTitle, { color: theme.textMuted }]}>BACKEND ENDPOINT</Text>
              <Text style={[styles.serverConfigActiveUrl, { color: theme.textSecondary }]} numberOfLines={1}>
                {serverUrl}
              </Text>
            </View>
            <Text style={[styles.serverConfigToggle, { color: theme.electricPurple }]}>
              {showServerConfig ? 'Close ▲' : 'Configure ▼'}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={[styles.serverConfigBody, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
              <Text style={[styles.serverHelpText, { color: theme.textMuted }]}>
                Production mobile APK connects securely over HTTPS to the deployed Horizon FastAPI backend.
              </Text>

              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={[styles.presetPill, { backgroundColor: theme.purpleMuted, borderColor: theme.borderHighlight }]}
                  onPress={() => {
                    const u = 'https://horizon-backend-api.onrender.com/api/v1';
                    setServerUrl(u);
                    apiClient.setBaseUrl(u);
                    setServerStatus(null);
                  }}
                >
                  <Text style={[styles.presetPillText, { color: theme.electricPurple }]}>☁ Production Cloud</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.serverInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="https://your-api.onrender.com/api/v1"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.pingButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                onPress={testServerConnection}
                disabled={serverTesting}
              >
                <Text style={[styles.pingButtonText, { color: theme.textPrimary }]}>
                  {serverTesting ? 'Testing connection...' : 'Ping Server'}
                </Text>
              </TouchableOpacity>

              {serverStatus && (
                <Text
                  style={[
                    styles.serverStatusText,
                    serverStatus.startsWith('🟢') ? { color: theme.statusSuccess } : { color: theme.statusError },
                  ]}
                >
                  {serverStatus}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  kavContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  platformBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  themeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoSymbol: {
    fontSize: 22,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  starterBalanceCard: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  starterTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  starterLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  starterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  starterPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  starterExplanation: {
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 3,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.xs,
  },
  activeTab: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 14,
  },
  errorIcon: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  form: {
    gap: 14,
    marginBottom: 18,
  },
  inputGroup: {
    gap: 6,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  visibilityBtn: {
    padding: 2,
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  loadingStageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  loadingStageText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  serverConfigContainer: {
    marginTop: 8,
  },
  serverConfigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  serverConfigHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  serverConfigTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  serverConfigActiveUrl: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  serverConfigToggle: {
    fontSize: 11,
    fontWeight: '700',
  },
  serverConfigBody: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    marginTop: 8,
    gap: 10,
  },
  serverHelpText: {
    fontSize: 11,
    lineHeight: 15,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  serverInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  pingButton: {
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  pingButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  serverStatusText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
});
