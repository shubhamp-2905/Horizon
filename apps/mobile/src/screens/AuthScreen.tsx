import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { apiClient } from '../services/api';
import type { AuthTokenResponse } from '@horizon/types';
import { colors, radius } from '../theme/colors';
import { HorizonButton } from '../components/ui/HorizonButton';

interface AuthScreenProps {
  onAuthenticated: (auth: AuthTokenResponse) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
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
    // Prevent duplicate submissions and concurrent taps
    if (loading || isSubmittingRef.current) return;
    if (!validateForm()) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setErrorMessage(null);
    setLoadingStage('Signing in...');

    // Feedback for cloud cold starts
    const stageTimer = setTimeout(() => {
      if (isSubmittingRef.current) {
        setLoadingStage('Connecting to cloud server (Render free tier may take 15–30s to wake up)...');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Brand & Logo Header */}
      <View style={styles.brandArea}>
        <View style={styles.logoMark}>
          <Text style={styles.logoSymbol}>◈</Text>
        </View>
        <Text style={styles.brandTitle}>Horizon</Text>
        <Text style={styles.brandSubtitle}>Geospatial Field Collection Network</Text>
      </View>

      {/* Starter Balance Info Card */}
      <View style={styles.starterBalanceCard}>
        <View style={styles.starterTopRow}>
          <Text style={styles.starterLabel}>Starter Grant</Text>
          <View style={styles.starterPill}>
            <Text style={styles.starterPillText}>100 HZN</Text>
          </View>
        </View>
        <Text style={styles.starterExplanation}>
          Verified contributors receive 100 starter tokens in an immutable ledger for task commitment stakes.
        </Text>
      </View>

      {/* Form Card */}
      <View style={styles.card}>
        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, isLogin && styles.activeTab]}
            onPress={() => {
              setIsLogin(true);
              setErrorMessage(null);
              setValidationError(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLogin && styles.activeTab]}
            onPress={() => {
              setIsLogin(false);
              setErrorMessage(null);
              setValidationError(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Error Feedback */}
        {(errorMessage || validationError) && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorText}>{errorMessage || validationError}</Text>
          </View>
        )}

        {isLogin ? (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username or Email</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. scout_alex"
                placeholderTextColor={colors.textMuted}
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
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.visibilityBtn}
                >
                  <Text style={styles.visibilityText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={colors.textMuted}
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
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="contributor@horizon.dev"
                placeholderTextColor={colors.textMuted}
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
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. scout_ranger"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  if (validationError) setValidationError(null);
                }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Alex River"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.visibilityBtn}
                >
                  <Text style={styles.visibilityText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Minimum 8 characters"
                placeholderTextColor={colors.textMuted}
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
          disabled={loading}
          size="lg"
          style={styles.submitBtn}
        />

        {loadingStage && (
          <View style={styles.loadingStageBox}>
            <Text style={styles.loadingStageText}>{loadingStage}</Text>
          </View>
        )}

        {/* Server Connection Indicator / Config for Expo Go & LAN */}
        <View style={styles.serverCard}>
          <TouchableOpacity
            style={styles.serverCardHeader}
            onPress={() => setShowServerConfig(!showServerConfig)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.serverLabel}>Backend Endpoint</Text>
              <Text style={styles.serverUrlText} numberOfLines={1}>{serverUrl}</Text>
            </View>
            <Text style={styles.serverToggleText}>{showServerConfig ? 'Close' : 'Configure'}</Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverConfigBody}>
              <Text style={styles.serverHelpText}>
                Expo Go connects over Wi-Fi. Modify host IP if running on a physical phone.
              </Text>
              
              {/* Quick Preset Selector */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => {
                    const u = 'https://horizon-backend-api.onrender.com/api/v1';
                    setServerUrl(u);
                    apiClient.setBaseUrl(u);
                    setServerStatus(null);
                  }}
                >
                  <Text style={styles.presetPillText}>☁ Render</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => {
                    const u = 'http://10.67.243.54:4000/api/v1';
                    setServerUrl(u);
                    apiClient.setBaseUrl(u);
                    setServerStatus(null);
                  }}
                >
                  <Text style={styles.presetPillText}>📶 Wi-Fi LAN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => {
                    const u = 'http://localhost:4000/api/v1';
                    setServerUrl(u);
                    apiClient.setBaseUrl(u);
                    setServerStatus(null);
                  }}
                >
                  <Text style={styles.presetPillText}>💻 Localhost</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.serverInput}
                value={serverUrl}
                onChangeText={(val) => {
                  setServerUrl(val);
                  apiClient.setBaseUrl(val.trim());
                  setServerStatus(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.pingButton}
                onPress={testServerConnection}
                disabled={serverTesting}
              >
                <Text style={styles.pingButtonText}>
                  {serverTesting ? 'Testing connection...' : 'Ping Server'}
                </Text>
              </TouchableOpacity>
              {serverStatus && (
                <Text style={[styles.serverStatusText, serverStatus.startsWith('🟢') ? styles.serverStatusSuccess : styles.serverStatusError]}>
                  {serverStatus}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentOrangeMuted,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoSymbol: {
    fontSize: 20,
    color: colors.accentOrange,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  starterBalanceCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 16,
  },
  starterTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  starterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  starterPill: {
    backgroundColor: colors.accentOrangeMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.3)',
  },
  starterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentOrange,
  },
  starterExplanation: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  activeTab: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.accentOrange,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.accentOrange,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorIcon: {
    fontSize: 14,
    color: colors.statusError,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.statusError,
    fontWeight: '500',
  },
  form: {
    gap: 12,
    marginBottom: 18,
  },
  inputGroup: {
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visibilityBtn: {
    padding: 2,
  },
  visibilityText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  submitBtn: {
    marginBottom: 16,
  },
  serverCard: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 12,
  },
  serverCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  serverUrlText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  serverToggleText: {
    fontSize: 12,
    color: colors.accentOrange,
    fontWeight: '600',
  },
  serverConfigBody: {
    marginTop: 10,
    gap: 8,
  },
  serverHelpText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  serverInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  pingButton: {
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pingButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  serverStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  serverStatusSuccess: {
    color: colors.statusSuccess,
  },
  serverStatusError: {
    color: colors.statusError,
  },
  loadingStageBox: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.accentOrangeMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.3)',
    alignItems: 'center',
  },
  loadingStageText: {
    fontSize: 12,
    color: colors.accentOrange,
    fontWeight: '500',
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  presetPill: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
