import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { apiClient } from '../services/api';
import type { TaskResponseDTO, TaskFormSchemaResponseDTO } from '@horizon/types';
import { radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { HorizonButton } from '../components/ui/HorizonButton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SyncStatusBadge } from '../components/ui/SyncStatusBadge';
import { syncEngine, type SyncEngineState } from '../offline/syncEngine';
import {
  taskRepo,
  claimRepo,
  submissionRepo,
} from '../offline/repositories';
import type {
  LocalMediaRecord,
  LocalSubmissionRecord,
} from '../database/schema';

// Step components
import {
  FieldStepIndicator,
  type SurveyStep,
  type StepStatus,
} from '../components/field/FieldStepIndicator';
import {
  LocationCaptureStep,
  type LocationData,
} from '../components/field/LocationCaptureStep';
import { ImageCollectionStep } from '../components/field/ImageCollectionStep';
import { ObservationFormStep } from '../components/field/ObservationFormStep';
import { ReviewSubmitStep } from '../components/field/ReviewSubmitStep';

interface TaskDetailScreenProps {
  task: TaskResponseDTO;
  availableTokens: number;
  onBack: () => void;
  onClaimSuccess: () => void;
}

export type TaskFieldStatus =
  | 'Available'
  | 'Claimed'
  | 'In Progress'
  | 'Draft Saved'
  | 'Submitted';

export const TaskDetailScreen: React.FC<TaskDetailScreenProps> = ({
  task,
  availableTokens,
  onBack,
  onClaimSuccess,
}) => {
  const { theme, isDark } = useTheme();

  // Navigation & Step state
  const [currentStep, setCurrentStep] = useState<SurveyStep>('overview');

  // Task & Schema data
  const [schema, setSchema] = useState<TaskFormSchemaResponseDTO | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Claim & Economics state
  const [isClaimed, setIsClaimed] = useState(false);
  const [claimRecord, setClaimRecord] = useState<any>(null);
  const [committing, setCommitting] = useState(false);
  const [claimSuccessModalVisible, setClaimSuccessModalVisible] = useState(false);
  const [claimedStake, setClaimedStake] = useState<number>(task.commitment_stake);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Submission & Media state
  const [currentDraft, setCurrentDraft] = useState<LocalSubmissionRecord | null>(null);
  const [mediaList, setMediaList] = useState<LocalMediaRecord[]>([]);

  // Sync Engine State
  const [syncState, setSyncState] = useState<SyncEngineState>(syncEngine.getState());

  const canAffordStake = availableTokens >= task.commitment_stake;
  const deficit = task.commitment_stake - availableTokens;

  // Subscribe to sync engine
  useEffect(() => {
    const unsub = syncEngine.subscribe(setSyncState);
    return unsub;
  }, []);

  // Initialize Task, Schema, Claim, and Draft
  const loadTaskContext = useCallback(async () => {
    setSchemaLoading(true);

    try {
      // 1. Check Claims
      const cachedClaims = await claimRepo.getCachedClaims();
      const existingClaim = cachedClaims.find(
        (c) => c.task_id === task.id && (c.status === 'claimed' || c.status === 'active')
      );

      if (existingClaim) {
        setIsClaimed(true);
        setClaimRecord(existingClaim);
        setClaimedStake(existingClaim.stake_amount);
      } else {
        // Online check
        try {
          const myTasks = await apiClient.getMyTasks();
          const onlineClaim = myTasks.find(
            (c) => c.task.id === task.id && (c.status === 'claimed' || c.status === 'active')
          );
          if (onlineClaim) {
            setIsClaimed(true);
            setClaimRecord(onlineClaim);
            setClaimedStake(onlineClaim.stake_amount);
            claimRepo.cacheClaims(myTasks).catch(() => {});
          }
        } catch {
          // Keep offline state
        }
      }

      // 2. Load Schema (Cached then API)
      const cachedSchema = await taskRepo.getCachedFormSchema(task.id);
      if (cachedSchema) {
        setSchema({
          task_id: cachedSchema.task_id,
          version: cachedSchema.version,
          fields: cachedSchema.fields,
          minimum_photos: cachedSchema.minimum_photos,
          instructions: cachedSchema.instructions,
        });
      }

      try {
        const remoteSchema = await apiClient.getTaskFormSchema(task.id);
        setSchema(remoteSchema);
        taskRepo.cacheFormSchema(task.id, remoteSchema).catch(() => {});
      } catch {
        // Keep cached schema
      }

      // 3. Load or restore local draft
      const draft = await submissionRepo.getOrCreateDraft(
        task.id,
        'current_user',
        existingClaim?.claim_id,
        task.latitude && task.longitude
          ? { latitude: task.latitude, longitude: task.longitude, accuracy: 8.0 }
          : undefined
      );
      setCurrentDraft(draft);

      // 4. Load local media records
      const media = await submissionRepo.getMediaForSubmission(draft.local_submission_id);
      setMediaList(media);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading task survey context');
    } finally {
      setSchemaLoading(false);
    }
  }, [task.id, task.latitude, task.longitude]);

  useEffect(() => {
    loadTaskContext();
  }, [loadTaskContext]);

  // Handle committing / claiming task
  const handleCommit = async () => {
    if (!canAffordStake) {
      setErrorMessage(
        `Insufficient available tokens: Required ${task.commitment_stake} TKN, but your wallet only has ${availableTokens} TKN available.`
      );
      return;
    }

    setCommitting(true);
    setErrorMessage(null);
    try {
      const claimRes = await apiClient.claimTask(task.id);
      setIsClaimed(true);
      setClaimRecord(claimRes);
      setClaimedStake(claimRes.stake_amount || task.commitment_stake);
      setClaimSuccessModalVisible(true);

      // Cache claim locally
      await claimRepo.cacheClaims([
        {
          claim_id: claimRes.claim_id,
          task_id: task.id,
          stake_amount: claimRes.stake_amount || task.commitment_stake,
          status: 'claimed',
          claimed_at: new Date().toISOString(),
          task,
        } as any,
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to establish task commitment.');
    } finally {
      setCommitting(false);
    }
  };

  // Location Step Handler
  const handleLocationSaved = async (loc: LocationData) => {
    if (!currentDraft) return;
    const updated = await submissionRepo.saveDraftObservations(
      currentDraft.local_submission_id,
      currentDraft.form_data,
      {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
      }
    );
    setCurrentDraft(updated);
  };

  // Image Step Handlers
  const handleCapturePhoto = async (
    uri: string,
    metadata: Record<string, unknown> = {}
  ) => {
    if (!currentDraft) return;
    const newMedia = await submissionRepo.attachLocalMedia(
      currentDraft.local_submission_id,
      uri,
      (metadata.mime_type as string) || 'image/jpeg',
      metadata
    );
    setMediaList((prev) => [...prev, newMedia]);
  };

  const handleDeletePhoto = async (localMediaId: string) => {
    await submissionRepo.deleteLocalMedia(localMediaId);
    setMediaList((prev) => prev.filter((m) => m.local_media_id !== localMediaId));
  };

  // Observation Step Handler
  const handleSaveObservations = async (data: Record<string, unknown>) => {
    if (!currentDraft) return;
    const updated = await submissionRepo.saveDraftObservations(
      currentDraft.local_submission_id,
      data
    );
    setCurrentDraft(updated);
  };

  // Review & Submit Handler
  const handleSubmitSurvey = async () => {
    if (!currentDraft) {
      throw new Error('No local submission draft found');
    }

    // Queue submission operations
    await syncEngine.queueSubmissionForSync(currentDraft.local_submission_id);

    // If online, perform sync and confirm server persistence
    if (syncEngine.isOnline()) {
      const syncResult = await syncEngine.syncNow();
      if (syncResult.failed > 0 && syncResult.succeeded === 0) {
        throw new Error(syncEngine.getState().lastError || 'Server could not persist submission. Saved locally in offline queue.');
      }
    }

    const updated = await submissionRepo.getDraft(currentDraft.local_submission_id);
    if (updated) {
      setCurrentDraft(updated);
    }
  };

  // Calculate field status for Overview badge
  const getFieldStatus = (): TaskFieldStatus => {
    if (currentDraft?.local_status === 'READY_TO_SYNC') {
      return 'Submitted';
    }
    if (
      currentDraft &&
      (mediaList.length > 0 ||
        Object.keys(currentDraft.form_data || {}).length > 0 ||
        (currentDraft.latitude && currentDraft.latitude !== task.latitude))
    ) {
      return 'Draft Saved';
    }
    if (isClaimed) {
      return 'Claimed';
    }
    return 'Available';
  };

  const fieldStatus = getFieldStatus();

  // Step Status Metrics for FieldStepIndicator
  const requiredPhotos = schema?.minimum_photos || 2;
  const requiredFields = (schema?.fields || []).filter((f) => f.required);
  const formData = currentDraft?.form_data || {};
  const completedFieldCount = requiredFields.filter(
    (f) => formData[f.id] !== undefined && formData[f.id] !== '' && formData[f.id] !== null
  ).length;

  const stepStatus: StepStatus = {
    hasLocation: !!(currentDraft?.latitude && currentDraft?.longitude),
    photoCount: mediaList.length,
    requiredPhotos,
    hasObservations: Object.keys(formData).length > 0,
    observationsCount: completedFieldCount,
    requiredObservationsCount: requiredFields.length,
  };

  const getDifficultyLabel = (diff: number) => {
    if (diff <= 1.5) return 'Easy';
    if (diff <= 2.5) return 'Medium';
    return 'Hard';
  };

  const isOffline = syncState.networkState === 'OFFLINE';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.outerContainer, { backgroundColor: theme.background }]}
    >
      {/* Top Application Bar with SyncStatusBadge */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: theme.textPrimary }]}>←</Text>
          <Text style={[styles.backText, { color: theme.textPrimary }]}>Back</Text>
        </TouchableOpacity>

        <SyncStatusBadge
          state={syncState}
          onSyncNow={() => syncEngine.syncNow()}
          compact
        />
      </View>

      {/* Field Work Multi-Step Progress Indicator */}
      {isClaimed && (
        <FieldStepIndicator
          currentStep={currentStep}
          stepStatus={stepStatus}
          onSelectStep={(step) => setCurrentStep(step)}
        />
      )}

      {/* Main Content Area Based on Current Step */}
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 'overview' && (
          <View style={styles.overviewContainer}>
            {/* Task Overview Header */}
            <View style={styles.headerArea}>
              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor: theme.primaryMuted,
                      borderColor: theme.borderLight,
                    },
                  ]}
                >
                  <Text style={[styles.typeText, { color: theme.primaryLight }]}>
                    {task.artifact_type.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>

                {/* Status Badges */}
                <View style={styles.statusGroup}>
                  <View
                    style={[
                      styles.fieldStatusBadge,
                      {
                        backgroundColor:
                          fieldStatus === 'Draft Saved'
                            ? theme.tokenGoldMuted
                            : fieldStatus === 'Claimed'
                            ? theme.primaryMuted
                            : fieldStatus === 'Submitted'
                            ? theme.successMuted
                            : theme.surfaceElevated,
                        borderColor:
                          fieldStatus === 'Draft Saved'
                            ? theme.tokenGold
                            : fieldStatus === 'Claimed'
                            ? theme.primary
                            : fieldStatus === 'Submitted'
                            ? theme.success
                            : theme.borderLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fieldStatusText,
                        {
                          color:
                            fieldStatus === 'Draft Saved'
                              ? theme.tokenGold
                              : fieldStatus === 'Claimed'
                              ? theme.primaryLight
                              : fieldStatus === 'Submitted'
                              ? theme.success
                              : theme.textSecondary,
                        },
                      ]}
                    >
                      {fieldStatus.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.title, { color: theme.textPrimary }]}>{task.title}</Text>

              {/* Distance & Geospatial Pin */}
              <View style={styles.distanceBadge}>
                <View style={[styles.distanceDot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.distanceText, { color: theme.textSecondary }]}>
                  {task.distance_meters !== null && task.distance_meters !== undefined
                    ? `${(task.distance_meters / 1000).toFixed(1)} km away from current GPS fix`
                    : 'Geospatial observation zone'}
                </Text>
              </View>
            </View>

            {/* Offline Readiness Notice */}
            <View
              style={[
                styles.offlineNoticeCard,
                {
                  backgroundColor: theme.primaryMuted,
                  borderColor: isDark ? 'rgba(124, 58, 237, 0.35)' : 'rgba(124, 58, 237, 0.2)',
                },
              ]}
            >
              <View style={[styles.offlineNoticeDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.offlineNoticeText, { color: theme.primaryLight }]}>
                Fully cached in local SQLite. You can complete this entire field survey offline.
              </Text>
            </View>

            {/* Location & Coordinates Snippet */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: '#000000',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                TARGET LOCATION
              </Text>
              <View style={styles.coordsGrid}>
                <View
                  style={[
                    styles.coordsBox,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.coordsLabel, { color: theme.textMuted }]}>LATITUDE</Text>
                  <Text style={[styles.coordsValue, { color: theme.textPrimary }]}>
                    {task.latitude !== null && task.latitude !== undefined
                      ? task.latitude.toFixed(6)
                      : '18.520400'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.coordsBox,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.coordsLabel, { color: theme.textMuted }]}>LONGITUDE</Text>
                  <Text style={[styles.coordsValue, { color: theme.textPrimary }]}>
                    {task.longitude !== null && task.longitude !== undefined
                      ? task.longitude.toFixed(6)
                      : '73.856700'}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.mapSnippet,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={[styles.mapGridLine1, { backgroundColor: theme.border }]} />
                <View style={[styles.mapGridLine2, { backgroundColor: theme.border }]} />
                <View style={styles.mapPin}>
                  <View style={[styles.mapPinPulse, { backgroundColor: theme.primaryMuted }]} />
                  <View style={[styles.mapPinCenter, { backgroundColor: theme.primary }]} />
                </View>
                <Text style={[styles.mapSnippetLabel, { color: theme.textSecondary }]}>
                  Target Coordinates
                </Text>
              </View>
            </View>

            {/* Task Objective */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: '#000000',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                TASK OBJECTIVE
              </Text>
              <Text style={[styles.objectiveText, { color: theme.textSecondary }]}>
                {task.description ||
                  'Conduct on-site ground-truth observation, inspect physical condition, record survey parameters, and provide geo-referenced verification photos.'}
              </Text>
            </View>

            {/* Collection Requirements */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: '#000000',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                COLLECTION REQUIREMENTS
              </Text>

              <Text style={[styles.reqSubheading, { color: theme.textPrimary }]}>
                Required Evidence
              </Text>
              {(task.requirements && task.requirements.length > 0
                ? task.requirements
                : ['2 geotagged high-resolution field photos', 'Physical condition inspection']
              ).map((req, idx) => (
                <View key={`ev-${idx}`} style={styles.reqRow}>
                  <Text style={[styles.reqCheck, { color: theme.primaryLight }]}>✓</Text>
                  <Text style={[styles.reqText, { color: theme.textSecondary }]}>{req}</Text>
                </View>
              ))}

              <Text style={[styles.reqSubheading, { color: theme.textPrimary }]}>
                Photos Required: {requiredPhotos} high-resolution photos
              </Text>
              <Text style={[styles.reqSubheading, { color: theme.textPrimary }]}>
                Observation Fields: {schema?.fields?.length || 3} dynamic inspection attributes
              </Text>
            </View>

            {/* Economics Section */}
            <View
              style={[
                styles.economicsCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: '#000000',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                COMMITMENT ECONOMICS
              </Text>

              <View
                style={[
                  styles.ecoComparison,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.ecoColumn}>
                  <Text style={[styles.ecoColLabel, { color: theme.textMuted }]}>POTENTIAL REWARD</Text>
                  <Text style={[styles.rewardNumber, { color: theme.primaryLight }]}>
                    +{task.base_reward}
                  </Text>
                  <Text style={[styles.ecoColSub, { color: theme.textMuted }]}>TKN TOKENS ON VERIFICATION</Text>
                </View>

                <View style={[styles.ecoColDivider, { backgroundColor: theme.border }]} />

                <View style={styles.ecoColumn}>
                  <Text style={[styles.ecoColLabel, { color: theme.textMuted }]}>COMMITMENT STAKE</Text>
                  <Text style={[styles.stakeNumber, { color: theme.tokenGold }]}>
                    {task.commitment_stake}
                  </Text>
                  <Text style={[styles.ecoColSub, { color: theme.textMuted }]}>TKN TOKENS LOCKED IN ESCROW</Text>
                </View>
              </View>

              {/* Effort & Difficulty Meta */}
              <View style={styles.metaPillsRow}>
                <View
                  style={[
                    styles.metaPill,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.metaPillLabel, { color: theme.textMuted }]}>
                    Estimated Effort:{' '}
                  </Text>
                  <Text style={[styles.metaPillValue, { color: theme.textPrimary }]}>
                    ~{task.estimated_effort_minutes || 25} min
                  </Text>
                </View>
                <View
                  style={[
                    styles.metaPill,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.metaPillLabel, { color: theme.textMuted }]}>
                    Difficulty:{' '}
                  </Text>
                  <Text style={[styles.metaPillValue, { color: theme.textPrimary }]}>
                    {getDifficultyLabel(task.difficulty)} ({task.difficulty.toFixed(1)})
                  </Text>
                </View>
              </View>

              {/* Escrow Rule Explanation Callout */}
              <View
                style={[
                  styles.escrowNoticeBox,
                  {
                    backgroundColor: theme.tokenGoldMuted,
                    borderColor: 'rgba(217, 119, 6, 0.25)',
                  },
                ]}
              >
                <Text style={[styles.escrowNoticeText, { color: theme.tokenGold }]}>
                  {task.commitment_stake} TKN locked in escrow guarantees exclusive collection rights.
                </Text>
                <Text style={[styles.escrowDetailText, { color: theme.textSecondary }]}>
                  Your stake guarantees exclusive collection rights and will be returned upon successful verification.
                </Text>
              </View>

              {/* Wallet Balance Status */}
              <View
                style={[
                  styles.balanceStatusBox,
                  { borderTopColor: theme.border },
                ]}
              >
                <View style={styles.balanceStatusRow}>
                  <Text style={[styles.balanceStatusLabel, { color: theme.textSecondary }]}>
                    Your Available Balance:
                  </Text>
                  <Text style={[styles.balanceStatusValue, { color: theme.textPrimary }]}>
                    {availableTokens} TKN
                  </Text>
                </View>

                {!canAffordStake && !isClaimed && (
                  <View
                    style={[
                      styles.insufficientWarning,
                      {
                        backgroundColor: theme.errorMuted,
                        borderColor: theme.error,
                      },
                    ]}
                  >
                    <Text style={[styles.insufficientText, { color: theme.error }]}>
                      Insufficient balance: You need {task.commitment_stake} TKN to commit, but you only have {availableTokens} TKN available (Short by {deficit} TKN).
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Error Display */}
            {errorMessage && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: theme.errorMuted,
                    borderColor: theme.error,
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
              </View>
            )}

            {/* Primary Action Button: START SURVEY / CONTINUE SURVEY / COMMIT */}
            <View style={styles.actionContainer}>
              {isClaimed ? (
                <HorizonButton
                  title={
                    fieldStatus === 'Draft Saved'
                      ? 'CONTINUE SURVEY →'
                      : fieldStatus === 'Submitted'
                      ? 'VIEW SUBMISSION REVIEW →'
                      : 'START SURVEY →'
                  }
                  onPress={() => setCurrentStep('location')}
                  size="lg"
                  variant="primary"
                />
              ) : (
                <HorizonButton
                  title={
                    canAffordStake
                      ? `Commit to Task (${task.commitment_stake} TKN)`
                      : `Insufficient Tokens (Need ${task.commitment_stake})`
                  }
                  onPress={handleCommit}
                  loading={committing}
                  disabled={!canAffordStake}
                  size="lg"
                  variant={canAffordStake ? 'primary' : 'outline'}
                />
              )}
            </View>
          </View>
        )}

        {/* Step 2: Location Screen */}
        {currentStep === 'location' && (
          <LocationCaptureStep
            initialLocation={
              currentDraft?.latitude && currentDraft?.longitude
                ? {
                    latitude: currentDraft.latitude,
                    longitude: currentDraft.longitude,
                    accuracy: currentDraft.gps_accuracy || 8.0,
                    timestamp: currentDraft.captured_at,
                  }
                : null
            }
            taskTarget={{
              latitude: task.latitude,
              longitude: task.longitude,
              title: task.title,
            }}
            onLocationSaved={handleLocationSaved}
            onNext={() => setCurrentStep('images')}
            onBack={() => setCurrentStep('overview')}
            isOffline={isOffline}
          />
        )}

        {/* Step 3: Images Collection Screen */}
        {currentStep === 'images' && (
          <ImageCollectionStep
            mediaList={mediaList}
            requiredPhotos={requiredPhotos}
            onCapturePhoto={handleCapturePhoto}
            onDeletePhoto={handleDeletePhoto}
            onNext={() => setCurrentStep('observations')}
            onBack={() => setCurrentStep('location')}
          />
        )}

        {/* Step 4: Observations Form Screen */}
        {currentStep === 'observations' && (
          <ObservationFormStep
            schema={schema}
            initialValues={currentDraft?.form_data}
            onSaveObservations={handleSaveObservations}
            onNext={() => setCurrentStep('review')}
            onBack={() => setCurrentStep('images')}
          />
        )}

        {/* Step 5: Review & Submit Screen */}
        {currentStep === 'review' && (
          <ReviewSubmitStep
            task={task}
            schema={schema}
            submission={currentDraft}
            mediaList={mediaList}
            onNavigateToStep={(step) => setCurrentStep(step)}
            onSubmitSurvey={handleSubmitSurvey}
            onBack={() => setCurrentStep('observations')}
            isOffline={isOffline}
          />
        )}
      </ScrollView>

      {/* Claim Success Modal */}
      <Modal
        visible={claimSuccessModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setClaimSuccessModalVisible(false);
          onClaimSuccess();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderLight,
                shadowColor: '#000000',
              },
            ]}
          >
            <View
              style={[
                styles.modalIconCircle,
                {
                  backgroundColor: theme.primaryMuted,
                  borderColor: theme.primary,
                },
              ]}
            >
              <Text style={[styles.modalCheck, { color: theme.primaryLight }]}>✓</Text>
            </View>

            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Commitment Established
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {claimedStake} TKN tokens have been successfully locked into escrow from your available balance.
            </Text>

            <View
              style={[
                styles.modalSummaryBox,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.borderLight,
                },
              ]}
            >
              <View style={styles.modalSummaryRow}>
                <Text style={[styles.modalSumLabel, { color: theme.textMuted }]}>Task</Text>
                <Text
                  style={[styles.modalSumValue, { color: theme.textPrimary }]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={[styles.modalSumLabel, { color: theme.textMuted }]}>Locked Stake</Text>
                <Text style={[styles.modalSumValue, { color: theme.textPrimary }]}>
                  {claimedStake} TKN
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={[styles.modalSumLabel, { color: theme.textMuted }]}>Next Step</Text>
                <Text style={[styles.modalSumValueGreen, { color: theme.primaryLight }]}>
                  Ready for field collection
                </Text>
              </View>
            </View>

            <HorizonButton
              title="START SURVEY NOW →"
              onPress={() => {
                setClaimSuccessModalVisible(false);
                setCurrentStep('location');
              }}
              size="md"
              variant="primary"
              style={styles.modalCTA}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backArrow: {
    fontSize: 16,
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  overviewContainer: {
    padding: 16,
  },
  headerArea: {
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  fieldStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 6,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  offlineNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  offlineNoticeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  offlineNoticeText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  sectionCard: {
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  coordsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  coordsBox: {
    flex: 1,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  coordsLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  coordsValue: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  mapSnippet: {
    height: 80,
    borderRadius: radius.sm,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  mapGridLine1: {
    position: 'absolute',
    width: '100%',
    height: 1,
  },
  mapGridLine2: {
    position: 'absolute',
    height: '100%',
    width: 1,
  },
  mapPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  mapPinCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  mapSnippetLabel: {
    position: 'absolute',
    bottom: 6,
    fontSize: 10,
    fontWeight: '500',
  },
  objectiveText: {
    fontSize: 13,
    lineHeight: 19,
  },
  reqSubheading: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 6,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  reqCheck: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  reqText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  economicsCard: {
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  ecoComparison: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  ecoColumn: {
    flex: 1,
    alignItems: 'center',
  },
  ecoColDivider: {
    width: 1,
    height: '100%',
    marginHorizontal: 10,
  },
  ecoColLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rewardNumber: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  stakeNumber: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  ecoColSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  metaPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metaPill: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
    borderRadius: radius.sm,
    justifyContent: 'center',
    borderWidth: 1,
  },
  metaPillLabel: {
    fontSize: 11,
  },
  metaPillValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  escrowNoticeBox: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: 12,
  },
  escrowNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  escrowDetailText: {
    fontSize: 11,
    lineHeight: 15,
  },
  balanceStatusBox: {
    borderTopWidth: 1,
    paddingTop: 10,
  },
  balanceStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceStatusLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  balanceStatusValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  insufficientWarning: {
    marginTop: 8,
    padding: 8,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  insufficientText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  errorBox: {
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionContainer: {
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 6, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalCheck: {
    fontSize: 22,
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalSummaryBox: {
    width: '100%',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    marginBottom: 18,
    gap: 6,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSumLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  modalSumValue: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 180,
  },
  modalSumValueGreen: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalCTA: {
    width: '100%',
  },
});
