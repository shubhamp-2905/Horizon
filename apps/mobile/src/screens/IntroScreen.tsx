import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import { HorizonButton } from '../components/ui/HorizonButton';
import { apiClient } from '../services/api';

interface IntroScreenProps {
  onStartContributing: () => void;
  onSignIn: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({
  onStartContributing,
  onSignIn,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  // Pre-warm the backend in the background while the user views the intro
  useEffect(() => {
    apiClient.checkHealth().catch(() => {});
  }, []);

  return (
    <View
      style={[
        styles.outerContainer,
        {
          backgroundColor: theme.background,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header: Badge + Theme Toggle */}
        <View style={styles.topRow}>
          <View
            style={[
              styles.platformPill,
              { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.platformPillText, { color: theme.electricPurple }]}>
              FIELD CONTRIBUTOR
            </Text>
          </View>

        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.logoCircle,
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
          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Ground-Truth Geospatial Data Network
          </Text>
        </View>

        {/* Introduction Cards */}
        <View style={styles.cardsContainer}>
          {/* Card 1 */}
          <View
            style={[
              styles.introCard,
              { backgroundColor: theme.surfaceCard, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.purpleMuted, borderColor: theme.borderHighlight },
              ]}
            >
              <Text style={[styles.iconText, { color: theme.electricPurple }]}>◎</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Discover Nearby Sites
              </Text>
              <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                Explore physical locations in your vicinity that need on-the-ground mapping and verification.
              </Text>
            </View>
          </View>

          {/* Card 2 */}
          <View
            style={[
              styles.introCard,
              { backgroundColor: theme.surfaceCard, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.purpleMuted, borderColor: theme.borderHighlight },
              ]}
            >
              <Text style={[styles.iconText, { color: theme.electricPurple }]}>▤</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Capture Field Observations
              </Text>
              <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                Record accurate GPS coordinates, capture geotagged photos, and report site conditions.
              </Text>
            </View>
          </View>

          {/* Card 3 */}
          <View
            style={[
              styles.introCard,
              { backgroundColor: theme.surfaceCard, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.purpleMuted, borderColor: theme.borderHighlight },
              ]}
            >
              <Text style={[styles.iconText, { color: theme.electricPurple }]}>◈</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Earn Contributor Rewards
              </Text>
              <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                Help keep community maps up to date and earn verified TKN rewards for every accepted submission.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <HorizonButton
            title="Start Contributing"
            onPress={onStartContributing}
            variant="primary"
            size="lg"
            style={styles.primaryButton}
          />

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { borderColor: theme.border, backgroundColor: theme.surfaceSubtle },
            ]}
            onPress={onSignIn}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  platformPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  platformPillText: {
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
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoSymbol: {
    fontSize: 30,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 14,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
