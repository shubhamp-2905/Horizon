import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { colors, radius } from '../../theme/colors';
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

  const isEligibleToSubmit = missingItemsCount === 0;

  const handleSubmit = async () => {
    if (!isEligibleToSubmit) {
      setErrorStatus(`Cannot submit: ${missingItemsCount} required collection item(s) are missing.`);
      return;
    }

    setSubmitting(true);
    setErrorStatus(null);
    try {
      await onSubmitSurvey();
      setSubmittedModalVisible(true);
    } catch (err: any) {
      setErrorStatus(err.message || 'Failed to submit field collection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>GROUND-TRUTH SUBMISSION REVIEW</Text>
        <Text style={styles.summarySub}>
          Verify all spatial, imagery, and observation evidence before locking field records.
        </Text>
      </View>

      {/* Incomplete Warning Callout */}
      {!isEligibleToSubmit && (
        <View style={styles.incompleteBox}>
          <Text style={styles.incompleteIcon}>⚠</Text>
          <View style={styles.incompleteTextCol}>
            <Text style={styles.incompleteTitle}>
              {missingItemsCount} required {missingItemsCount > 1 ? 'items' : 'item'} missing
            </Text>
            <Text style={styles.incompleteSub}>
              Tap any incomplete section below to jump directly to that step.
            </Text>
          </View>
        </View>
      )}

      {/* Checklist Sections */}
      <View style={styles.checklist}>
        {/* 1. Location Card */}
        <TouchableOpacity
          style={[styles.checkCard, !hasGps && styles.checkCardIncomplete]}
          onPress={() => onNavigateToStep('location')}
          activeOpacity={0.7}
        >
          <View style={styles.checkCardLeft}>
            <View
              style={[
                styles.statusIconCircle,
                hasGps ? styles.circleSuccess : styles.circlePending,
              ]}
            >
              <Text style={[styles.statusIconText, hasGps ? styles.textSuccess : styles.textPending]}>
                {hasGps ? '✓' : '!'}
              </Text>
            </View>

            <View>
              <Text style={styles.checkSectionTitle}>LOCATION</Text>
              <Text style={styles.checkSectionDetail}>
                {hasGps
                  ? `Captured • ± ${gpsAccuracy}m (${submission?.latitude?.toFixed(4)}, ${submission?.longitude?.toFixed(4)})`
                  : 'Missing GPS satellite fix'}
              </Text>
            </View>
          </View>

          <View style={styles.checkCardRight}>
            <Text style={[styles.statusPill, hasGps ? styles.pillSuccess : styles.pillPending]}>
              {hasGps ? `± ${gpsAccuracy}m` : 'Required'}
            </Text>
            <Text style={styles.chevron}>→</Text>
          </View>
        </TouchableOpacity>

        {/* 2. Photos Card */}
        <TouchableOpacity
          style={[styles.checkCard, !photosComplete && styles.checkCardIncomplete]}
          onPress={() => onNavigateToStep('images')}
          activeOpacity={0.7}
        >
          <View style={styles.checkCardLeft}>
            <View
              style={[
                styles.statusIconCircle,
                photosComplete ? styles.circleSuccess : styles.circlePending,
              ]}
            >
              <Text
                style={[
                  styles.statusIconText,
                  photosComplete ? styles.textSuccess : styles.textPending,
                ]}
              >
                {photosComplete ? '✓' : '!'}
              </Text>
            </View>

            <View>
              <Text style={styles.checkSectionTitle}>PHOTOS</Text>
              <Text style={styles.checkSectionDetail}>
                {photoCount} of {requiredPhotos} required evidence photos
              </Text>
            </View>
          </View>

          <View style={styles.checkCardRight}>
            <Text
              style={[
                styles.statusPill,
                photosComplete ? styles.pillSuccess : styles.pillPending,
              ]}
            >
              {photoCount}/{requiredPhotos}
            </Text>
            <Text style={styles.chevron}>→</Text>
          </View>
        </TouchableOpacity>

        {/* 3. Observations Card */}
        <TouchableOpacity
          style={[styles.checkCard, !observationsComplete && styles.checkCardIncomplete]}
          onPress={() => onNavigateToStep('observations')}
          activeOpacity={0.7}
        >
          <View style={styles.checkCardLeft}>
            <View
              style={[
                styles.statusIconCircle,
                observationsComplete ? styles.circleSuccess : styles.circlePending,
              ]}
            >
              <Text
                style={[
                  styles.statusIconText,
                  observationsComplete ? styles.textSuccess : styles.textPending,
                ]}
              >
                {observationsComplete ? '✓' : '!'}
              </Text>
            </View>

            <View>
              <Text style={styles.checkSectionTitle}>OBSERVATIONS</Text>
              <Text style={styles.checkSectionDetail}>
                {completedFieldCount} of {requiredFields.length} complete
              </Text>
            </View>
          </View>

          <View style={styles.checkCardRight}>
            <Text
              style={[
                styles.statusPill,
                observationsComplete ? styles.pillSuccess : styles.pillPending,
              ]}
            >
              {completedFieldCount}/{requiredFields.length}
            </Text>
            <Text style={styles.chevron}>→</Text>
          </View>
        </TouchableOpacity>

        {/* 4. Notes & Target Sync Card */}
        <View style={styles.checkCard}>
          <View style={styles.checkCardLeft}>
            <View style={[styles.statusIconCircle, styles.circleSuccess]}>
              <Text style={[styles.statusIconText, styles.textSuccess]}>✓</Text>
            </View>

            <View>
              <Text style={styles.checkSectionTitle}>LOCAL REPOSITORY</Text>
              <Text style={styles.checkSectionDetail}>Saved on device in SQLite</Text>
            </View>
          </View>

          <View style={styles.checkCardRight}>
            <Text style={[styles.statusPill, styles.pillSuccess]}>Ready</Text>
          </View>
        </View>

        {/* 5. Sync Target Card */}
        <View style={styles.checkCard}>
          <View style={styles.checkCardLeft}>
            <View style={[styles.statusIconCircle, styles.circleSuccess]}>
              <Text style={[styles.statusIconText, styles.textSuccess]}>✓</Text>
            </View>

            <View>
              <Text style={styles.checkSectionTitle}>SYNC QUEUE</Text>
              <Text style={styles.checkSectionDetail}>
                {isOffline
                  ? 'Offline — will sync immediately once connected'
                  : 'Online — ready for instant verification'}
              </Text>
            </View>
          </View>

          <View style={styles.checkCardRight}>
            <Text style={[styles.statusPill, styles.pillSuccess]}>
              {isOffline ? 'Offline' : 'Online'}
            </Text>
          </View>
        </View>
      </View>

      {/* Error Callout */}
      {errorStatus && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorStatus}</Text>
        </View>
      )}

      {/* Submit Button Section */}
      <View style={styles.submitSection}>
        <HorizonButton
          title={
            submitting
              ? 'Finalizing Field Survey...'
              : isEligibleToSubmit
              ? `Submit Survey & Claim +${task.base_reward} TOKENS`
              : `Missing ${missingItemsCount} Required Item${missingItemsCount > 1 ? 's' : ''}`
          }
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isEligibleToSubmit}
          size="lg"
          variant="primary"
          style={styles.submitBtn}
        />

        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Observations</Text>
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={submittedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSubmittedModalVisible(false);
          onNavigateToStep('overview');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalCheckCircle}>
              <Text style={styles.modalCheckText}>✓</Text>
            </View>

            <Text style={styles.modalTitle}>Field Survey Submitted</Text>
            <Text style={styles.modalSubtitle}>
              {isOffline
                ? 'Your field survey and photos have been locked and saved locally in SQLite. The SyncEngine will synchronize your evidence as soon as internet connectivity returns.'
                : 'Your field ground-truth submission has been queued and synchronized with the Horizon verification engine.'}
            </Text>

            <View style={styles.modalSummaryBox}>
              <View style={styles.modalSumRow}>
                <Text style={styles.modalSumLabel}>Reward Potential</Text>
                <Text style={styles.modalSumReward}>+{task.base_reward} TOKENS</Text>
              </View>
              <View style={styles.modalSumRow}>
                <Text style={styles.modalSumLabel}>Escrow Stake</Text>
                <Text style={styles.modalSumVal}>{task.commitment_stake} TOKENS (Pending Release)</Text>
              </View>
              <View style={styles.modalSumRow}>
                <Text style={styles.modalSumLabel}>Sync Status</Text>
                <Text style={styles.modalSumValGreen}>
                  {isOffline ? 'Saved Offline (Pending Sync)' : 'Synchronized to Cloud'}
                </Text>
              </View>
            </View>

            <HorizonButton
              title="Return to Task Overview"
              onPress={() => {
                setSubmittedModalVisible(false);
                onNavigateToStep('overview');
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
  summaryHeader: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  summarySub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  incompleteBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    gap: 10,
  },
  incompleteIcon: {
    fontSize: 20,
    color: colors.tokenGold,
  },
  incompleteTextCol: {
    flex: 1,
  },
  incompleteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.tokenGold,
    marginBottom: 2,
  },
  incompleteSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  checklist: {
    gap: 10,
  },
  checkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  checkCardIncomplete: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: colors.surfaceSubtle,
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
  circleSuccess: {
    backgroundColor: colors.accentGreenMuted,
    borderWidth: 1,
    borderColor: colors.accentGreen,
  },
  circlePending: {
    backgroundColor: colors.tokenGoldMuted,
    borderWidth: 1,
    borderColor: colors.tokenGold,
  },
  statusIconText: {
    fontSize: 12,
    fontWeight: '900',
  },
  textSuccess: {
    color: colors.accentGreen,
  },
  textPending: {
    color: colors.tokenGold,
  },
  checkSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  checkSectionDetail: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  checkCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  pillSuccess: {
    backgroundColor: colors.accentGreenMuted,
    color: colors.accentGreen,
  },
  pillPending: {
    backgroundColor: colors.tokenGoldMuted,
    color: colors.tokenGold,
  },
  chevron: {
    fontSize: 14,
    color: colors.textMuted,
  },
  errorBox: {
    backgroundColor: colors.statusErrorMuted,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorText: {
    fontSize: 11,
    color: colors.statusError,
  },
  submitSection: {
    gap: 12,
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
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalCheckCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentGreenMuted,
    borderWidth: 2,
    borderColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalCheckText: {
    fontSize: 26,
    color: colors.accentGreen,
    fontWeight: '900',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  modalSummaryBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textMuted,
    fontWeight: '600',
  },
  modalSumVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSumReward: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.tokenGold,
  },
  modalSumValGreen: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentGreen,
  },
});
