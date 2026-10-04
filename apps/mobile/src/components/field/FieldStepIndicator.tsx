import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, radius } from '../../theme/colors';

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
    <View style={styles.container}>
      {/* Top Banner: Step X of 5 */}
      <View style={styles.headerRow}>
        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>STEP {currentIndex + 1} OF 5</Text>
        </View>
        <Text style={styles.currentStepLabel}>
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
                  isActive && styles.stepNodeActive,
                  isComplete && !isActive && styles.stepNodeComplete,
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconCircle,
                    isActive && styles.iconCircleActive,
                    isComplete && styles.iconCircleComplete,
                  ]}
                >
                  <Text
                    style={[
                      styles.iconText,
                      isActive && styles.iconTextActive,
                      isComplete && styles.iconTextComplete,
                    ]}
                  >
                    {isComplete ? '✓' : step.index}
                  </Text>
                </View>

                <View style={styles.stepTextGroup}>
                  <Text
                    style={[
                      styles.stepLabel,
                      isActive && styles.stepLabelActive,
                      isComplete && styles.stepLabelComplete,
                    ]}
                    numberOfLines={1}
                  >
                    {step.label}
                  </Text>
                  <Text style={styles.stepSubtitle} numberOfLines={1}>
                    {getStepSubtitle(step.key)}
                  </Text>
                </View>
              </TouchableOpacity>

              {idx < STEPS.length - 1 && (
                <View
                  style={[
                    styles.connectorLine,
                    (isPast || (idx === 0 && isComplete)) && styles.connectorLineActive,
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
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
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
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  counterText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  currentStepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentOrange,
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
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 6,
  },
  stepNodeActive: {
    backgroundColor: colors.accentOrangeMuted,
    borderColor: colors.accentOrange,
  },
  stepNodeComplete: {
    borderColor: 'rgba(255, 107, 0, 0.4)',
    backgroundColor: colors.surfaceCard,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: colors.accentOrange,
    borderColor: colors.accentOrange,
  },
  iconCircleComplete: {
    backgroundColor: colors.accentOrangeMuted,
    borderColor: colors.accentOrange,
  },
  iconText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  iconTextActive: {
    color: '#07080A',
    fontWeight: '800',
  },
  iconTextComplete: {
    color: colors.accentOrange,
    fontWeight: '800',
  },
  stepTextGroup: {
    maxWidth: 90,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepLabelActive: {
    color: colors.accentOrange,
    fontWeight: '700',
  },
  stepLabelComplete: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  stepSubtitle: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  connectorLine: {
    width: 14,
    height: 2,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 4,
  },
  connectorLineActive: {
    backgroundColor: colors.accentOrange,
  },
});
