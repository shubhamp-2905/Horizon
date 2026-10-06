import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { radius } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { HorizonButton } from '../ui/HorizonButton';
import type { SurveyStep } from './FieldStepIndicator';
import type { LocalMediaRecord, LocalSubmissionRecord } from '../../database/schema';
import type { TaskResponseDTO, TaskFormSchemaResponseDTO } from '@horizon/types';

interface ReviewSubmitStepProps {
  task: TaskResponseDTO;
  schema: TaskFormSchemaResponseDTO | null;
  submission: LocalSubmissionRecord | null;
  mediaList: LocalMediaRecord[];
  onNavigateToStep: (step: SurveyStep) => void;
  onSubmitSurvey: () => Promise<void>;
  onBack: () => void;
  isOffline?: boolean;
}

export const ReviewSubmitStep: React.FC<ReviewSubmitStepProps> = ({
  task,
  schema,
  submission,
  mediaList,
  onNavigateToStep,
  onSubmitSurvey,
  onBack,
  isOffline = false,
}) => {
  const { theme, isDark } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [submittedModalVisible, setSubmittedModalVisible] = useState(false);

  // Validate items
  const hasGps = !!(submission?.latitude && submission?.longitude);
  const gpsAccuracy = submission?.gps_accuracy ? Math.round(submission.gps_accuracy) : 8;

  const requiredPhotos = schema?.minimum_photos || 2;
  const photoCount = mediaList.length;
  const photosComplete = photoCount >= requiredPhotos;

  const requiredFields = (schema?.fields || []).filter((f) => f.required);
  const formData = submission?.form_data || {};
  const completedFieldCount = requiredFields.filter(
    (f) => formData[f.id] !== undefined && formData[f.id] !== '' && formData[f.id] !== null
  ).length;
  const observationsComplete =
    requiredFields.length === 0 || completedFieldCount >= requiredFields.length;

  // Total missing count
  let missingItemsCount = 0;
  if (!hasGps) missingItemsCount++;
  if (!photosComplete) missingItemsCount++;
  if (!observationsComplete) missingItemsCount++;

  const isFormComplete = missingItemsCount === 0;

  const handleSubmit = async () => {
    if (!isFormComplete) {
      setErrorStatus('Please fulfill all mandatory survey prerequisites before submitting.');
      return;
    }

    setSubmitting(true);
    setErrorStatus(null);
    try {
      await onSubmitSurvey();
      setSubmittedModalVisible(true);
    } catch (err: any) {
      setErrorStatus(err.message || 'Failed to finalize and queue submission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Offline Status Notice */}
      {isOffline && (
        <View
          style={[
            styles.offlineBanner,
            {
              backgroundColor: theme.primaryMuted,
              borderColor: theme.borderLight,
            },
          ]}
        >
          <View style={[styles.offlineDot, { backgroundColor: theme.primary }]} />
          <Text style={[styles.offlineText, { color: theme.primaryLight }]}>
            Offline Mode: Finalized package will be queued in SQLite and automatically synchronized when connectivity returns.
          </Text>
        </View>
      )}

      {/* Summary Header Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            shadowColor: isDark ? '#000000' : '#4C1D95',
          },
        ]}
      >
        <Text style={[styles.summaryTitle, { color: theme.textMuted }]}>PRE-FLIGHT AUDIT & VERIFICATION</Text>
        <Text style={[styles.summarySub, { color: theme.textSecondary }]}>
          Verify that all mandatory geospatial evidence meets consensus criteria before locking.
        </Text>
      </View>

      {/* Readiness Warning if Incomplete */}
      {!isFormComplete && (
        <View
          style={[
            styles.incompleteBox,
            {
              backgroundColor: theme.tokenGoldMuted,
              borderColor: 'rgba(217, 119, 6, 0.35)',
            },
          ]}
        >
          <Text style={[styles.incompleteIcon, { color: theme.tokenGold }]}>⚠</Text>
          <View style={styles.incompleteTextCol}>
            <Text style={[styles.incompleteTitle, { color: theme.tokenGold }]}>
              {missingItemsCount} SURVEY {missingItemsCount === 1 ? 'ITEM' : 'ITEMS'} PENDING
            </Text>
            <Text style={[styles.incompleteSub, { color: theme.textSecondary }]}>
              Tap the pending rows below to navigate directly to the incomplete step.
            </Text>
          </View>
        </View>
      )}

      {/* Section Checklist */}
      <View style={styles.checklist}>
        {/* Item 1: Location */}
        <TouchableOpacity
          style={[
            styles.checkCard,
            {
              backgroundColor: theme.card,
              borderColor: hasGps ? theme.border : theme.tokenGold,
            },
          ]}
          onPress={() => onNavigateToStep('location')}
          activeOpacity={0.75}
        >
          <View style={styles.checkCardLeft}>
            <View
              style={[
                styles.statusIconCircle,
                hasGps
                  ? { backgroundColor: theme.successMuted, borderColor: theme.success, borderWidth: 1 }
                  : { backgroundColor: theme.tokenGoldMuted, borderColor: theme.tokenGold, borderWidth: 1 },
              ]}
            >
              <Text style={{ color: hasGps ? theme.success : theme.tokenGold, fontWeight: '800' }}>
                {hasGps ? '✓' : '!'}
              </Text>
            </View>
            <View>
              <Text style={[styles.checkTitle, { color: theme.textPrimary }]}>GPS Coordinates</Text>
              <Text style={[styles.checkSub, { color: theme.textSecondary }]}>
                {hasGps
                  ? `${submission?.latitude?.toFixed(5)}°N, ${submission?.longitude?.toFixed(5)}°E (±${gpsAccuracy}m)`
                  : 'Satellite coordinates missing'}
              </Text>
            </View>
          </View>
          <Text style={[styles.editLink, { color: theme.primaryLight }]}>Edit →</Text>
        </TouchableOpacity>

        {/* Item 2: Images */}
        <TouchableOpacity
          style={[
            styles.checkCard,
            {
              backgroundColor: theme.card,
              borderColor: photosComplete ? theme.border : theme.tokenGold,
            },
          ]}
          onPress={() => onNavigateToStep('images')}
          activeOpacity={0.75}
        >
          <View style={styles.checkCardLeft}>
            <View
              style={[
                styles.statusIconCircle,
                photosComplete
                  ? { backgroundColor: theme.successMuted, borderColor: theme.success, borderWidth: 1 }
                  : { backgroundColor: theme.tokenGoldMuted, borderColor: theme.tokenGold, borderWidth: 1 },
              ]}
            >
              <Text style={{ color: photosComplete ? theme.success : theme.tokenGold, fontWeight: '800' }}>
                {photosComplete ? '✓' : '!'}
              </Text>
            </View>
            <View>
              <Text style={[styles.checkTitle, { color: theme.textPrimary }]}>Field Photos</Text>
              <Text style={[styles.checkSub, { color: theme.textSecondary }]}>
                {photosComplete
                  ? `${photoCount} of ${requiredPhotos} photos captured`
                  : `Need ${requiredPhotos - photoCount} more photo(s)`}
              </Text>
            </View>
          </View>
          <Text style={[styles.editLink, { color: theme.primaryLight }]}>Edit →</Text>
        </TouchableOpacity>

        {/* Item 3: Observations */}
        <TouchableOpacity
          style={[
            styles.checkCard,
            {
              backgroundColor: theme.card,
              borderColor: observationsComplete ? theme.border : theme.tokenGold,
            },
          ]}
          onPress={() => onNavigateToStep('observations')}
          activeOpacity={0.75}
        >
          <View style={styles.checkCardLeft}>
            <View
              style={[
                styles.statusIconCircle,
                observationsComplete
                  ? { backgroundColor: theme.successMuted, borderColor: theme.success, borderWidth: 1 }
                  : { backgroundColor: theme.tokenGoldMuted, borderColor: theme.tokenGold, borderWidth: 1 },
              ]}
            >
              <Text style={{ color: observationsComplete ? theme.success : theme.tokenGold, fontWeight: '800' }}>
                {observationsComplete ? '✓' : '!'}
              </Text>
            </View>
            <View>
              <Text style={[styles.checkTitle, { color: theme.textPrimary }]}>Attribute Observations</Text>
              <Text style={[styles.checkSub, { color: theme.textSecondary }]}>
                {requiredFields.length === 0
                  ? 'No required fields'
                  : observationsComplete
                  ? `${completedFieldCount} of ${requiredFields.length} attributes filled`
                  : `${requiredFields.length - completedFieldCount} mandatory field(s) empty`}
              </Text>
            </View>
          </View>
          <Text style={[styles.editLink, { color: theme.primaryLight }]}>Edit →</Text>
        </TouchableOpacity>
      </View>

      {/* Economics Summary Card */}
      <View
        style={[
          styles.economicsCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            shadowColor: isDark ? '#000000' : '#4C1D95',
          },
        ]}
      >
        <Text style={[styles.ecoSectionTitle, { color: theme.textMuted }]}>INCENTIVE OUTCOME</Text>
        <View style={styles.ecoRow}>
          <View>
            <Text style={[styles.ecoLabel, { color: theme.textMuted }]}>POTENTIAL REWARD</Text>
            <Text style={[styles.ecoReward, { color: theme.primaryLight }]}>+{task.base_reward} HZN</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.ecoLabel, { color: theme.textMuted }]}>STAKE RETURN</Text>
            <Text style={[styles.ecoStake, { color: theme.tokenGold }]}>+{task.commitment_stake} HZN</Text>
          </View>
        </View>
      </View>

      {/* Error Callout */}
      {errorStatus && (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: theme.errorMuted,
              borderColor: theme.error,
            },
          ]}
        >
          <Text style={[styles.errorText, { color: theme.error }]}>{errorStatus}</Text>
        </View>
      )}

      {/* Primary Submit Button */}
      <View style={styles.submitSection}>
        <HorizonButton
          title={
            submitting
              ? 'Finalizing Evidence Package...'
              : !isFormComplete
              ? `Resolve ${missingItemsCount} Missing Prerequisites`
              : 'Sign & Finalize Submission'
          }
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isFormComplete}
          size="lg"
          variant={isFormComplete ? 'primary' : 'outline'}
          style={styles.submitBtn}
        />

        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>← Back to Observations</Text>
        </TouchableOpacity>
      </View>

      {/* Successful Submission Modal */}
      <Modal visible={submittedModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                shadowColor: isDark ? '#000000' : '#4C1D95',
              },
            ]}
          >
            <View
              style={[
                styles.modalCheckCircle,
                {
                  backgroundColor: theme.primaryMuted,
                  borderColor: theme.primary,
                },
              ]}
            >
              <Text style={[styles.modalCheckText, { color: theme.primaryLight }]}>✓</Text>
            </View>

            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Field Survey Finalized
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {isOffline
                ? 'Your evidence package is stored locally in SQLite and will upload automatically when online.'
                : 'Your submission has been queued and dispatched to the verification pipeline.'}
            </Text>

            <View
              style={[
                styles.modalSummaryBox,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.modalSumRow}>
                <Text style={[styles.modalSumLabel, { color: theme.textMuted }]}>Artifact Task</Text>
                <Text style={[styles.modalSumVal, { color: theme.textPrimary }]} numberOfLines={1}>
                  {task.title}
                </Text>
              </View>
              <View style={styles.modalSumRow}>
                <Text style={[styles.modalSumLabel, { color: theme.textMuted }]}>Photos Attached</Text>
                <Text style={[styles.modalSumVal, { color: theme.textPrimary }]}>{photoCount} Images</Text>
              </View>
              <View style={styles.modalSumRow}>
                <Text style={[styles.modalSumLabel, { color: theme.textMuted }]}>Reward Value</Text>
                <Text style={[styles.modalSumReward, { color: theme.primaryLight }]}>+{task.base_reward} HZN</Text>
              </View>
              <View style={styles.modalSumRow}>
                <Text style={[styles.modalSumLabel, { color: theme.textMuted }]}>Pipeline Phase</Text>
                <Text style={[styles.modalSumValGreen, { color: theme.primaryLight }]}>
                  {isOffline ? 'Offline Queue' : 'Peer Verification'}
                </Text>
              </View>
            </View>

            <HorizonButton
              title="Return to Tasks Overview"
              onPress={() => {
                setSubmittedModalVisible(false);
                onBack();
              }}
              size="md"
              variant="primary"
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
    gap: 8,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  offlineText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  summaryCard: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  summarySub: {
    fontSize: 12,
    lineHeight: 18,
  },
  incompleteBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    gap: 10,
  },
  incompleteIcon: {
    fontSize: 20,
  },
  incompleteTextCol: {
    flex: 1,
  },
  incompleteTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  incompleteSub: {
    fontSize: 11,
  },
  checklist: {
    gap: 10,
  },
  checkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
  },
  checkCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkSub: {
    fontSize: 11,
    marginTop: 2,
  },
  editLink: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  economicsCard: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
  },
  ecoSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  ecoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ecoLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ecoReward: {
    fontSize: 18,
    fontWeight: '900',
  },
  ecoStake: {
    fontSize: 18,
    fontWeight: '900',
  },
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
  },
  submitSection: {
    gap: 10,
    marginTop: 6,
  },
  submitBtn: {
    width: '100%',
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 6, 11, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCheckCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalCheckText: {
    fontSize: 26,
    fontWeight: '900',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  modalSummaryBox: {
    width: '100%',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  modalSumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSumLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalSumVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalSumReward: {
    fontSize: 14,
    fontWeight: '900',
  },
  modalSumValGreen: {
    fontSize: 12,
    fontWeight: '700',
  },
});
