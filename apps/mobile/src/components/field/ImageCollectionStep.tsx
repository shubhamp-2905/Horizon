import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/colors';
import { HorizonButton } from '../ui/HorizonButton';
import type { LocalMediaRecord } from '../../database/schema';

interface ImageCollectionStepProps {
  mediaList: LocalMediaRecord[];
  requiredPhotos: number;
  maxPhotos?: number;
  onCapturePhoto: (uri: string, metadata?: Record<string, unknown>) => Promise<void>;
  onDeletePhoto: (localMediaId: string) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export const ImageCollectionStep: React.FC<ImageCollectionStepProps> = ({
  mediaList,
  requiredPhotos = 2,
  maxPhotos = 4,
  onCapturePhoto,
  onDeletePhoto,
  onNext,
  onBack,
}) => {
  const { theme } = useTheme();
  const [selectedMedia, setSelectedMedia] = useState<LocalMediaRecord | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [retakeTargetId, setRetakeTargetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canProceed = mediaList.length >= requiredPhotos;
  const missingCount = Math.max(0, requiredPhotos - mediaList.length);

  // Real device camera capture
  const handleTriggerCamera = async (retakeId?: string) => {
    setCapturing(true);
    setErrorMessage(null);

    try {
      // 1. Request camera permissions
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          setErrorMessage(
            'Camera permission permanently denied. Please allow Camera access in your Android device Settings > Apps > Horizon.'
          );
        } else {
          setErrorMessage('Camera access is required to capture ground-truth field evidence.');
        }
        setCapturing(false);
        return;
      }

      // 2. Launch native Android camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
        exif: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setCapturing(false);
        return;
      }

      const asset = result.assets[0];

      if (retakeId) {
        await onDeletePhoto(retakeId);
      }

      const now = new Date().toISOString();
      await onCapturePhoto(asset.uri, {
        file_size: asset.fileSize || 2450000,
        file_name: asset.fileName || `field_photo_${Date.now()}.jpg`,
        mime_type: asset.mimeType || 'image/jpeg',
        width: asset.width,
        height: asset.height,
        captured_at: now,
        exif: asset.exif || {},
      });

      setCapturing(false);
      setRetakeTargetId(null);
      setSelectedMedia(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to capture field photo with camera.');
      setCapturing(false);
    }
  };

  // Real device photo library fallback
  const handleTriggerLibrary = async (retakeId?: string) => {
    setCapturing(true);
    setErrorMessage(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Photo library permission is required to select field evidence.');
        setCapturing(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setCapturing(false);
        return;
      }

      const asset = result.assets[0];

      if (retakeId) {
        await onDeletePhoto(retakeId);
      }

      const now = new Date().toISOString();
      await onCapturePhoto(asset.uri, {
        file_size: asset.fileSize || 2048000,
        file_name: asset.fileName || `field_library_${Date.now()}.jpg`,
        mime_type: asset.mimeType || 'image/jpeg',
        width: asset.width,
        height: asset.height,
        captured_at: now,
      });

      setCapturing(false);
      setRetakeTargetId(null);
      setSelectedMedia(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to select image from library.');
      setCapturing(false);
    }
  };

  const handleDelete = async (mediaId: string) => {
    try {
      await onDeletePhoto(mediaId);
      if (selectedMedia?.local_media_id === mediaId) {
        setSelectedMedia(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete photo.');
    }
  };

  const renderPhotoSlots = () => {
    const slots = [];
    const totalSlots = Math.max(requiredPhotos, Math.min(mediaList.length + 1, maxPhotos));

    for (let i = 0; i < totalSlots; i++) {
      const media = mediaList[i];
      const isRequiredSlot = i < requiredPhotos;

      if (media) {
        slots.push(
          <View
            key={media.local_media_id}
            style={[
              styles.photoCard,
              { backgroundColor: theme.surfaceCard, borderColor: theme.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => setSelectedMedia(media)}
              activeOpacity={0.8}
              style={styles.imageWrapper}
            >
              <Image source={{ uri: media.local_uri }} style={styles.thumbnail} resizeMode="cover" />

              {/* Status Badge Over Image */}
              <View style={[styles.photoOverlayBadge, { backgroundColor: 'rgba(7, 6, 11, 0.75)' }]}>
                <View style={[styles.photoSavedDot, { backgroundColor: theme.statusSuccess }]} />
                <Text style={styles.photoOverlayText}>LOCAL CACHE</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.photoInfoRow}>
              <View>
                <Text style={[styles.photoLabel, { color: theme.textPrimary }]}>
                  Evidence #{i + 1}
                </Text>
                <Text style={[styles.photoTimestamp, { color: theme.textMuted }]}>
                  {new Date(media.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              <View style={styles.photoCardActions}>
                <TouchableOpacity
                  onPress={() => {
                    setRetakeTargetId(media.local_media_id);
                    handleTriggerCamera(media.local_media_id);
                  }}
                  style={[styles.smallBtn, { backgroundColor: theme.purpleMuted }]}
                  disabled={capturing}
                >
                  <Text style={[styles.smallBtnText, { color: theme.electricPurple }]}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(media.local_media_id)}
                  style={[styles.smallBtn, { backgroundColor: theme.statusErrorMuted }]}
                  disabled={capturing}
                >
                  <Text style={[styles.smallBtnText, { color: theme.statusError }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      } else {
        slots.push(
          <View
            key={`empty_${i}`}
            style={[
              styles.emptySlot,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: isRequiredSlot ? theme.borderHighlight : theme.border,
              },
            ]}
          >
            <View style={styles.emptySlotContent}>
              <View
                style={[
                  styles.cameraIconCircle,
                  { backgroundColor: theme.purpleMuted, borderColor: theme.borderHighlight },
                ]}
              >
                <Text style={[styles.cameraIconSymbol, { color: theme.electricPurple }]}>📷</Text>
              </View>

              <Text style={[styles.emptySlotTitle, { color: theme.textPrimary }]}>
                {isRequiredSlot ? `Photo #${i + 1} (Required)` : `Photo #${i + 1} (Optional)`}
              </Text>
              <Text style={[styles.emptySlotSub, { color: theme.textMuted }]}>
                Ground-truth geotagged field capture
              </Text>

              {/* Action Buttons: Camera + Gallery */}
              <View style={styles.captureButtonRow}>
                <TouchableOpacity
                  style={[styles.slotActionBtn, { backgroundColor: theme.primaryPurple }]}
                  onPress={() => handleTriggerCamera()}
                  disabled={capturing}
                  activeOpacity={0.8}
                >
                  {capturing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.slotActionText}>Open Camera</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.slotSecondaryBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={() => handleTriggerLibrary()}
                  disabled={capturing}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.slotSecondaryText, { color: theme.textSecondary }]}>Library</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      }
    }

    return slots;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Step Header */}
      <View style={styles.headerArea}>
        <View style={styles.titleRow}>
          <Text style={[styles.stepTitle, { color: theme.textPrimary }]}>Field Evidence Photos</Text>
          <View
            style={[
              styles.counterPill,
              {
                backgroundColor: canProceed ? theme.statusSuccessMuted : theme.purpleMuted,
                borderColor: canProceed ? theme.statusSuccess : theme.borderHighlight,
              },
            ]}
          >
            <Text
              style={[
                styles.counterText,
                { color: canProceed ? theme.statusSuccess : theme.electricPurple },
              ]}
            >
              {mediaList.length} / {requiredPhotos} REQUIRED
            </Text>
          </View>
        </View>
        <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          High-resolution photos with preserved geospatial metadata are audited by the AI quality engine.
        </Text>
      </View>

      {/* Error Alert */}
      {errorMessage && (
        <View style={[styles.errorAlert, { backgroundColor: theme.statusErrorMuted, borderColor: theme.statusError }]}>
          <Text style={[styles.errorAlertText, { color: theme.statusError }]}>⚠ {errorMessage}</Text>
        </View>
      )}

      {/* Primary Capture Action Card */}
      <View
        style={[
          styles.actionCard,
          { backgroundColor: theme.surfaceCard, borderColor: theme.borderHighlight },
        ]}
      >
        <View style={styles.actionLeft}>
          <View
            style={[
              styles.actionIconBox,
              { backgroundColor: theme.purpleMuted, borderColor: theme.borderHighlight },
            ]}
          >
            <Text style={[styles.actionIcon, { color: theme.electricPurple }]}>📸</Text>
          </View>
          <View>
            <Text style={[styles.actionHeading, { color: theme.textPrimary }]}>Device Camera Capture</Text>
            <Text style={[styles.actionSub, { color: theme.textMuted }]}>
              {missingCount > 0
                ? `${missingCount} more evidence photo(s) required`
                : 'All required evidence photos acquired'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.primaryCaptureBtn,
            { backgroundColor: theme.primaryPurple },
            mediaList.length >= maxPhotos && styles.btnDisabled,
          ]}
          onPress={() => handleTriggerCamera()}
          disabled={capturing || mediaList.length >= maxPhotos}
          activeOpacity={0.8}
        >
          {capturing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryCaptureBtnText}>
              {mediaList.length >= maxPhotos ? 'Limit Reached' : 'Take Photo'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Slots List */}
      <View style={styles.slotsContainer}>{renderPhotoSlots()}</View>

      {/* Navigation Buttons */}
      <View style={styles.footerNav}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>← Location</Text>
        </TouchableOpacity>

        <View style={styles.nextBtn}>
          <HorizonButton
            title={canProceed ? 'Proceed to Observations →' : `Need ${missingCount} More Photo(s)`}
            onPress={onNext}
            disabled={!canProceed}
            variant={canProceed ? 'primary' : 'secondary'}
          />
        </View>
      </View>

      {/* Inspection Modal */}
      <Modal
        visible={!!selectedMedia}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
              <Text style={[styles.modalTitle, { color: theme.textMuted }]}>EVIDENCE AUDIT</Text>
              <TouchableOpacity
                onPress={() => setSelectedMedia(null)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedMedia && (
              <View style={styles.modalBody}>
                <Image
                  source={{ uri: selectedMedia.local_uri }}
                  style={[styles.previewImage, { backgroundColor: theme.surfaceElevated }]}
                  resizeMode="contain"
                />

                <View style={[styles.metadataBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: theme.textMuted }]}>STORAGE KEY</Text>
                    <Text style={[styles.metaVal, { color: theme.textSecondary }]} numberOfLines={1}>
                      {selectedMedia.storage_key}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: theme.textMuted }]}>STATUS</Text>
                    <Text style={[styles.metaValGreen, { color: theme.statusSuccess }]}>
                      {selectedMedia.sync_status}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: theme.textMuted }]}>FILE SIZE</Text>
                    <Text style={[styles.metaVal, { color: theme.textSecondary }]}>
                      {((selectedMedia.metadata.file_size as number) / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalRetakeBtn, { backgroundColor: theme.purpleMuted }]}
                    onPress={() => {
                      const id = selectedMedia.local_media_id;
                      setSelectedMedia(null);
                      handleTriggerCamera(id);
                    }}
                  >
                    <Text style={[styles.modalRetakeText, { color: theme.electricPurple }]}>Retake Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalDeleteBtn, { backgroundColor: theme.statusErrorMuted }]}
                    onPress={() => handleDelete(selectedMedia.local_media_id)}
                  >
                    <Text style={[styles.modalDeleteText, { color: theme.statusError }]}>Delete Evidence</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  headerArea: {
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  counterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  counterText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorAlert: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorAlertText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionHeading: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  primaryCaptureBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  primaryCaptureBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  slotsContainer: {
    gap: 12,
  },
  photoCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  photoOverlayBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  photoSavedDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  photoOverlayText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F8F7FC',
    letterSpacing: 0.5,
  },
  photoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  photoTimestamp: {
    fontSize: 10,
    marginTop: 2,
  },
  photoCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  smallBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptySlot: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotContent: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  cameraIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconSymbol: {
    fontSize: 20,
  },
  emptySlotTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptySlotSub: {
    fontSize: 11,
  },
  captureButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  slotActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  slotActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  slotSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  slotSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 6, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
  },
  modalBody: {
    padding: 14,
    gap: 14,
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: radius.sm,
  },
  metadataBox: {
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 11,
    fontFamily: 'monospace',
    maxWidth: 200,
  },
  metaValGreen: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalRetakeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalRetakeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
