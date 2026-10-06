import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { radius } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

export type SurveyStep = 'overview' | 'location' | 'images' | 'observations' | 'review';

export interface StepStatus {
  hasLocation: boolean;
  photoCount: number;
  requiredPhotos: number;
  hasObservations: boolean;
  observationsCount: number;
  requiredObservationsCount: number;
}

interface FieldStepIndicatorProps {
  currentStep: SurveyStep;
  stepStatus: StepStatus;
  onSelectStep: (step: SurveyStep) => void;
  canNavigateForward?: boolean;
}

const STEPS: Array<{ key: SurveyStep; label: string; index: number }> = [
  { key: 'overview', label: 'Overview', index: 1 },
  { key: 'location', label: 'Location', index: 2 },
  { key: 'images', label: 'Images', index: 3 },
  { key: 'observations', label: 'Observations', index: 4 },
  { key: 'review', label: 'Review', index: 5 },
];

export const FieldStepIndicator: React.FC<FieldStepIndicatorProps> = ({
  currentStep,
  stepStatus,
  onSelectStep,
}) => {
  const { theme, isDark } = useTheme();
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  const isStepComplete = (key: SurveyStep): boolean => {
    switch (key) {
      case 'overview':
        return true;
      case 'location':
        return stepStatus.hasLocation;
      case 'images':
        return stepStatus.photoCount >= stepStatus.requiredPhotos;
      case 'observations':
        return (
          stepStatus.requiredObservationsCount > 0
            ? stepStatus.observationsCount >= stepStatus.requiredObservationsCount
            : stepStatus.hasObservations
        );
      case 'review':
        return false;
    }
  };

  const getStepSubtitle = (key: SurveyStep): string => {
    switch (key) {
      case 'overview':
        return 'Task Scope';
      case 'location':
        return stepStatus.hasLocation ? '✓ GPS Captured' : 'Pending GPS';
      case 'images':
        return `${stepStatus.photoCount}/${stepStatus.requiredPhotos} Photos`;
      case 'observations':
        return stepStatus.observationsCount > 0
          ? `${stepStatus.observationsCount}/${stepStatus.requiredObservationsCount} Fields`
          : 'Pending Data';
      case 'review':
        return 'Finalize & Submit';
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderBottomColor: theme.border,
        },
      ]}
    >
      {/* Top Banner: Step X of 5 */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.counterBadge,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.borderLight,
            },
          ]}
        >
          <Text style={[styles.counterText, { color: theme.textSecondary }]}>
            STEP {currentIndex + 1} OF 5
          </Text>
        </View>
        <Text style={[styles.currentStepLabel, { color: theme.primaryLight }]}>
          {STEPS[currentIndex]?.label.toUpperCase()}
        </Text>
      </View>

      {/* Interactive Breadcrumb Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stepsRow}
      >
        {STEPS.map((step, idx) => {
          const isActive = step.key === currentStep;
          const isComplete = isStepComplete(step.key);
          const isPast = idx < currentIndex;

          return (
            <React.Fragment key={step.key}>
              <TouchableOpacity
                onPress={() => onSelectStep(step.key)}
                style={[
                  styles.stepNode,
                  {
                    backgroundColor: isActive
                      ? theme.primaryMuted
                      : isComplete
                      ? theme.card
                      : theme.surfaceElevated,
                    borderColor: isActive
                      ? theme.primary
                      : isComplete
                      ? isDark ? 'rgba(124, 58, 237, 0.45)' : 'rgba(124, 58, 237, 0.3)'
                      : theme.borderLight,
                  },
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: isActive
                        ? theme.primary
                        : isComplete
                        ? theme.primaryMuted
                        : theme.surfaceElevated,
                      borderColor: isActive || isComplete ? theme.primary : theme.borderLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.iconText,
                      {
                        color: isActive
                          ? '#FFFFFF'
                          : isComplete
                          ? theme.primary
                          : theme.textSecondary,
                        fontWeight: isActive || isComplete ? '800' : '700',
                      },
                    ]}
                  >
                    {isComplete ? '✓' : step.index}
                  </Text>
                </View>

                <View style={styles.stepTextGroup}>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: isActive
                          ? theme.primaryLight
                          : isComplete
                          ? theme.textPrimary
                          : theme.textSecondary,
                        fontWeight: isActive ? '700' : isComplete ? '600' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {step.label}
                  </Text>
                  <Text
                    style={[styles.stepSubtitle, { color: theme.textMuted }]}
                    numberOfLines={1}
                  >
                    {getStepSubtitle(step.key)}
                  </Text>
                </View>
              </TouchableOpacity>

              {idx < STEPS.length - 1 && (
                <View
                  style={[
                    styles.connectorLine,
                    {
                      backgroundColor:
                        isPast || (idx === 0 && isComplete)
                          ? theme.primary
                          : theme.borderLight,
                    },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  counterBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  counterText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  currentStepLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  stepNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 6,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 10,
  },
  stepTextGroup: {
    maxWidth: 90,
  },
  stepLabel: {
    fontSize: 11,
  },
  stepSubtitle: {
    fontSize: 9,
    marginTop: 1,
  },
  connectorLine: {
    width: 14,
    height: 2,
    marginHorizontal: 4,
  },
});
