import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
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

interface FieldErrors {
  emailOrUsername?: string;
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Pure React Native vector eye icon with an eye-off diagonal slash line.
 * Provides accessible, dependency-free visuals matching the app theme.
 */
const EyeIcon: React.FC<{ visible: boolean; color: string }> = ({ visible, color }) => {
  return (
    <View style={styles.eyeContainer} pointerEvents="none">
      <View style={[styles.eyeOutline, { borderColor: color }]}>
        <View style={[styles.eyePupil, { backgroundColor: color }]} />
      </View>
      {!visible && <View style={[styles.eyeSlashLine, { backgroundColor: color }]} />}
    </View>
  );
};

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  initialMode = 'login',
  onBackToIntro,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<any>(null);
  const [isLogin, setIsLogin] = useState(initialMode === 'login');

  // Form Fields
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password Visibility States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Active Focus State
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const scrollToField = (field: string) => {
    // Smoothly scroll down so inputs and submit button stay in view above the soft keyboard
    setTimeout(() => {
      if (field === 'password' || field === 'confirmPassword' || field === 'email') {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 150);
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    setErrorMessage(null);

    if (isLogin) {
      if (!emailOrUsername.trim()) {
        errors.emailOrUsername = 'Please enter your username or email address.';
      }
      if (!password) {
        errors.password = 'Please enter your password.';
      }
    } else {
      if (!username.trim() || username.trim().length < 3) {
        errors.username = 'Username must be at least 3 characters.';
      }
      if (!email.trim() || !email.includes('@') || !email.includes('.')) {
        errors.email = 'Please provide a valid email address.';
      }
      if (!password || password.length < 8) {
        errors.password = 'Password must be at least 8 characters.';
      }
      if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match. Please re-enter.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
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

  const switchMode = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setErrorMessage(null);
    setFieldErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.kavContainer, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom + 28, 44),
          },
        ]}
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
              accessibilityRole="button"
              accessibilityLabel="Back"
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
            accessibilityRole="button"
            accessibilityLabel="Toggle Theme"
          >
            <Text style={[styles.themeToggleText, { color: theme.textSecondary }]}>
              {isDark ? '☀ Light' : '☾ Dark'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Brand Header */}
        <View style={styles.brandArea}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.brandLogo}
            resizeMode="cover"
          />
          <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Horizon</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            {isLogin
              ? 'Sign in to access your contributor workspace'
              : 'Create an account to start contributing'}
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
              onPress={() => switchMode(true)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isLogin }}
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
              onPress={() => switchMode(false)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: !isLogin }}
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

          {/* Top Server Error Banner */}
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
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor:
                          focusedField === 'emailOrUsername'
                            ? theme.borderHighlight || theme.electricPurple
                            : fieldErrors.emailOrUsername
                            ? theme.error
                            : theme.border,
                      },
                      focusedField === 'emailOrUsername' && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={[styles.inputElement, { color: theme.textPrimary }]}
                      placeholder="Enter your username or email"
                      placeholderTextColor={theme.textMuted}
                      value={emailOrUsername}
                      onChangeText={(t) => {
                        setEmailOrUsername(t);
                        if (fieldErrors.emailOrUsername) {
                          setFieldErrors((prev) => ({ ...prev, emailOrUsername: undefined }));
                        }
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      onFocus={() => setFocusedField('emailOrUsername')}
                      onBlur={() => setFocusedField(null)}
                      textContentType="username"
                      autoComplete="username"
                    />
                  </View>
                  {fieldErrors.emailOrUsername && (
                    <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                      {fieldErrors.emailOrUsername}
                    </Text>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Password
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor:
                          focusedField === 'password'
                            ? theme.borderHighlight || theme.electricPurple
                            : fieldErrors.password
                            ? theme.error
                            : theme.border,
                      },
                      focusedField === 'password' && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={[styles.inputElement, { color: theme.textPrimary }]}
                      placeholder="Enter your password"
                      placeholderTextColor={theme.textMuted}
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      onFocus={() => {
                        setFocusedField('password');
                        scrollToField('password');
                      }}
                      onBlur={() => setFocusedField(null)}
                      textContentType="password"
                      autoComplete="current-password"
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword((prev) => !prev)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <EyeIcon visible={showPassword} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password && (
                    <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                      {fieldErrors.password}
                    </Text>
                  )}
                </View>
              </>
            ) : (
              /* REGISTRATION FIELDS */
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Username
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor:
                          focusedField === 'username'
                            ? theme.borderHighlight || theme.electricPurple
                            : fieldErrors.username
                            ? theme.error
                            : theme.border,
                      },
                      focusedField === 'username' && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={[styles.inputElement, { color: theme.textPrimary }]}
                      placeholder="e.g. scout_alex"
                      placeholderTextColor={theme.textMuted}
                      value={username}
                      onChangeText={(t) => {
                        setUsername(t);
                        if (fieldErrors.username) {
                          setFieldErrors((prev) => ({ ...prev, username: undefined }));
                        }
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      textContentType="username"
                      autoComplete="username"
                    />
                  </View>
                  {fieldErrors.username && (
                    <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                      {fieldErrors.username}
                    </Text>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Email Address
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor:
                          focusedField === 'email'
                            ? theme.borderHighlight || theme.electricPurple
                            : fieldErrors.email
                            ? theme.error
                            : theme.border,
                      },
                      focusedField === 'email' && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={[styles.inputElement, { color: theme.textPrimary }]}
                      placeholder="e.g. alex@example.com"
                      placeholderTextColor={theme.textMuted}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (fieldErrors.email) {
                          setFieldErrors((prev) => ({ ...prev, email: undefined }));
                        }
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      onFocus={() => {
                        setFocusedField('email');
                        scrollToField('email');
                      }}
                      onBlur={() => setFocusedField(null)}
                      textContentType="emailAddress"
                      autoComplete="email"
                    />
                  </View>
                  {fieldErrors.email && (
                    <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                      {fieldErrors.email}
                    </Text>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Full Name (Optional)
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor:
                          focusedField === 'fullName'
                            ? theme.borderHighlight || theme.electricPurple
                            : theme.border,
                      },
                      focusedField === 'fullName' && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={[styles.inputElement, { color: theme.textPrimary }]}
                      placeholder="e.g. Alex River"
                      placeholderTextColor={theme.textMuted}
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      editable={!loading}
                      onFocus={() => setFocusedField('fullName')}
                      onBlur={() => setFocusedField(null)}
                      textContentType="name"
                      autoComplete="name"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Password
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor:
                          focusedField === 'password'
                            ? theme.borderHighlight || theme.electricPurple
                            : fieldErrors.password
                            ? theme.error
                            : theme.border,
                      },
                      focusedField === 'password' && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={[styles.inputElement, { color: theme.textPrimary }]}
                      placeholder="At least 8 characters"
                      placeholderTextColor={theme.textMuted}
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      onFocus={() => {
                        setFocusedField('password');
                        scrollToField('password');
                      }}
                      onBlur={() => setFocusedField(null)}
                      textContentType="newPassword"
                      autoComplete="new-password"
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword((prev) => !prev)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <EyeIcon visible={showPassword} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password && (
                    <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                      {fieldErrors.password}
                    </Text>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Confirm Password
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor:
                          focusedField === 'confirmPassword'
                            ? theme.borderHighlight || theme.electricPurple
                            : fieldErrors.confirmPassword
                            ? theme.error
                            : theme.border,
                      },
                      focusedField === 'confirmPassword' && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={[styles.inputElement, { color: theme.textPrimary }]}
                      placeholder="Re-enter your password"
                      placeholderTextColor={theme.textMuted}
                      value={confirmPassword}
                      onChangeText={(t) => {
                        setConfirmPassword(t);
                        if (fieldErrors.confirmPassword) {
                          setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      onFocus={() => {
                        setFocusedField('confirmPassword');
                        scrollToField('confirmPassword');
                      }}
                      onBlur={() => setFocusedField(null)}
                      textContentType="newPassword"
                      autoComplete="new-password"
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <EyeIcon visible={showConfirmPassword} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.confirmPassword && (
                    <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                      {fieldErrors.confirmPassword}
                    </Text>
                  )}
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
              onPress={() => switchMode(!isLogin)}
              activeOpacity={0.7}
            >
              <Text style={[styles.switchModeText, { color: theme.textSecondary }]}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
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
    flexGrow: 1,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: 22,
  },
  brandLogo: {
    width: 68,
    height: 68,
    borderRadius: 18,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 290,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 4,
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
    shadowOpacity: 0.08,
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
    marginBottom: 16,
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
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  inputFocused: {
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  inputElement: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
    height: 44,
  },
  eyeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  eyeContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  eyeOutline: {
    width: 18,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  eyeSlashLine: {
    position: 'absolute',
    width: 20,
    height: 1.6,
    transform: [{ rotate: '-45deg' }],
    borderRadius: 1,
  },
  fieldErrorText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    marginLeft: 2,
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
    marginTop: 8,
  },
  switchModeRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchModeText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
