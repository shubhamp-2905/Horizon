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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../services/api';
import type { AuthTokenResponse } from '@horizon/types';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import { HorizonButton } from '../components/ui/HorizonButton';

interface AuthScreenProps {
  onAuthenticated: (auth: AuthTokenResponse) => void;
  initialMode?: 'login' | 'register';
  onBackToIntro?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  initialMode = 'login',
  onBackToIntro,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');

  // Form Fields
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

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
      if (!username.trim() || username.trim().length < 3) {
        setValidationError('Username must be at least 3 characters.');
        return false;
      }
      if (!email.trim() || !email.includes('@') || !email.includes('.')) {
        setValidationError('Please provide a valid email address.');
        return false;
      }
      if (!password || password.length < 8) {
        setValidationError('Password must be at least 8 characters.');
        return false;
      }
      if (password !== confirmPassword) {
        setValidationError('Passwords do not match. Please re-enter.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage(null);
    setLoadingMessage(isLogin ? 'Signing in...' : 'Creating account...');

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
      const msg = err.message || (isLogin ? 'Sign in failed' : 'Registration failed');
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      setLoadingMessage(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.kavContainer,
        {
          backgroundColor: theme.background,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Control Bar: Back to Intro / Role pill + Theme Switcher */}
        <View style={styles.topControlRow}>
          {onBackToIntro ? (
            <TouchableOpacity
              style={[
                styles.backToIntroBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
              ]}
              onPress={onBackToIntro}
              activeOpacity={0.7}
            >
              <Text style={[styles.backToIntroText, { color: theme.textSecondary }]}>
                ← Back
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.platformBadge,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.platformBadgeText, { color: theme.electricPurple }]}>
                FIELD CONTRIBUTOR
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.themeToggleBtn,
              { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel="Toggle dark/light theme"
          >
            <Text style={[styles.themeToggleText, { color: theme.textSecondary }]}>
              {isDark ? '☀ Light' : '☾ Dark'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Brand Header */}
        <View style={styles.brandArea}>
          <View
            style={[
              styles.logoMark,
              {
                backgroundColor: theme.purpleMuted,
                borderColor: theme.borderHighlight,
                shadowColor: '#000000',
              },
            ]}
          >
            <Text style={[styles.logoSymbol, { color: theme.electricPurple }]}>◈</Text>
          </View>
          <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Horizon</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            {isLogin ? 'Sign in to access your contributor workspace' : 'Create an account to start contributing'}
          </Text>
        </View>

        {/* Main Authentication Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surfaceCard,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Tab Selector */}
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
                Sign In
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

          {/* Validation / Server Error Banners */}
          {validationError && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: theme.error },
              ]}
            >
              <Text style={[styles.errorBannerText, { color: theme.error }]}>
                {validationError}
              </Text>
            </View>
          )}

          {errorMessage && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: theme.error },
              ]}
            >
              <Text style={[styles.errorBannerText, { color: theme.error }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formContent}>
            {isLogin ? (
              /* LOGIN FIELDS */
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Username or Email
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="Enter your username or email"
                    placeholderTextColor={theme.textMuted}
                    value={emailOrUsername}
                    onChangeText={(t) => {
                      setEmailOrUsername(t);
                      if (validationError) setValidationError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>
                      Password
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.togglePwdText, { color: theme.electricPurple }]}>
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
                    placeholder="Enter your password"
                    placeholderTextColor={theme.textMuted}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (validationError) setValidationError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>
              </>
            ) : (
              /* REGISTRATION FIELDS */
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Username
                  </Text>
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
                    value={username}
                    onChangeText={(t) => {
                      setUsername(t);
                      if (validationError) setValidationError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Email Address
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="e.g. alex@example.com"
                    placeholderTextColor={theme.textMuted}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (validationError) setValidationError(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Full Name (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="e.g. Alex River"
                    placeholderTextColor={theme.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>
                      Password
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.togglePwdText, { color: theme.electricPurple }]}>
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
                    placeholder="At least 8 characters"
                    placeholderTextColor={theme.textMuted}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (validationError) setValidationError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Confirm Password
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="Re-enter your password"
                    placeholderTextColor={theme.textMuted}
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      if (validationError) setValidationError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>
              </>
            )}

            {/* In-flight Loading Status */}
            {loading && loadingMessage && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.electricPurple} />
                <Text style={[styles.loadingText, { color: theme.electricPurple }]}>
                  {loadingMessage}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <HorizonButton
              title={isLogin ? 'Sign In' : 'Create Account'}
              onPress={handleSubmit}
              loading={loading}
              variant="primary"
              size="lg"
              style={styles.submitBtn}
            />

            {/* Alternate Toggle Link */}
            <TouchableOpacity
              style={styles.switchModeRow}
              onPress={() => {
                setIsLogin(!isLogin);
                setErrorMessage(null);
                setValidationError(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.switchModeText, { color: theme.textSecondary }]}>
                {isLogin
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <Text style={{ color: theme.electricPurple, fontWeight: '700' }}>
                  {isLogin ? 'Create one' : 'Sign in'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  kavContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backToIntroBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  backToIntroText: {
    fontSize: 12,
    fontWeight: '700',
  },
  platformBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  platformBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  themeToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoSymbol: {
    fontSize: 26,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
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
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.xs,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  formContent: {
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  togglePwdText: {
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 6,
  },
  switchModeRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchModeText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
