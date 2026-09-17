import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { apiClient } from '../services/api';
import type { AuthTokenResponse } from '@horizon/types';

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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let authResponse: AuthTokenResponse;
      if (isLogin) {
        authResponse = await apiClient.login(emailOrUsername, password);
      } else {
        authResponse = await apiClient.register({
          email,
          username,
          password,
          full_name: fullName || undefined,
        });
      }
      onAuthenticated(authResponse);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.brandContainer}>
        <Text style={styles.brandTitle}>HORIZON</Text>
        <Text style={styles.brandTagline}>Geospatial Ground-Truth Contribution Network</Text>
      </View>

      <View style={styles.starterBanner}>
        <Text style={styles.starterIcon}>🎁</Text>
        <View style={styles.starterTextContainer}>
          <Text style={styles.starterTitle}>100 Starter Tokens Included</Text>
          <Text style={styles.starterSubtitle}>
            Every verified contributor starts with 100 tokens to commit to initial collection tasks.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, isLogin && styles.activeTab]}
            onPress={() => {
              setIsLogin(true);
              setErrorMessage(null);
            }}
          >
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLogin && styles.activeTab]}
            onPress={() => {
              setIsLogin(false);
              setErrorMessage(null);
            }}
          >
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Join as Contributor</Text>
          </TouchableOpacity>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {isLogin ? (
          <View style={styles.form}>
            <Text style={styles.label}>Username or Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. scout_alex or scout@horizon.io"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              value={emailOrUsername}
              onChangeText={setEmailOrUsername}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your secure password"
              placeholderTextColor="#64748B"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="contributor@horizon.io"
              placeholderTextColor="#64748B"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. scout_ranger"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />

            <Text style={styles.label}>Full Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Jane Doe"
              placeholderTextColor="#64748B"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 8 characters"
              placeholderTextColor="#64748B"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isLogin ? 'Sign In to Horizon' : 'Activate Contributor Account'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  brandContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  starterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  starterIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  starterTextContainer: {
    flex: 1,
  },
  starterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  starterSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#38BDF8',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
});
