import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/colors';
import { HorizonButton } from '../ui/HorizonButton';
import type { LocalMediaRecord } from '../../database/schema';

export interface BulkFilePayload {
  uri: string;
  mime_type: string;
  metadata: {
    file_name: string;
    file_size_bytes: number;
    mime_type: string;
    width?: number;
    height?: number;
    is_link?: boolean;
    url?: string;
    requires_access_check?: boolean;
  };
}

interface BulkEvidenceStepProps {
  mediaList: LocalMediaRecord[];
  requiredCount?: number;
  maxFiles?: number;
  onAttachFiles: (files: BulkFilePayload[]) => Promise<void>;
  onDeleteMedia: (localMediaId: string) => Promise<void>;
  onRetryMedia?: (localMediaId: string) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export const BulkEvidenceStep: React.FC<BulkEvidenceStepProps> = ({
  mediaList,
  requiredCount = 1,
  maxFiles = 50,
  onAttachFiles,
  onDeleteMedia,
  onRetryMedia,
  onNext,
  onBack,
}) => {
  const { theme } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<LocalMediaRecord | null>(null);

  // Evidence Link Modal State
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [accessWarning, setAccessWarning] = useState<string | null>(null);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);

  const totalAttachments = mediaList.length;
  const canProceed = totalAttachments >= requiredCount;
  const uploadingCount = mediaList.filter((m) => m.sync_status === 'UPLOADING').length;
  const failedCount = mediaList.filter((m) => m.sync_status === 'FAILED').length;

  const formatFileSize = (bytes?: unknown): string => {
    const num = Number(bytes);
    if (!num || isNaN(num) || num <= 0) return 'File';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getMediaIcon = (mediaType: string, isLink?: boolean) => {
    if (isLink || mediaType === 'link') return '🔗';
    if (mediaType.startsWith('image/')) return '🖼️';
    if (mediaType.includes('pdf')) return '📕';
    if (mediaType.includes('csv') || mediaType.includes('sheet') || mediaType.includes('excel')) return '📊';
    if (mediaType.includes('word') || mediaType.includes('document')) return '📝';
    return '📄';
  };

  // Multi-select bulk picker for Documents & Files (PDF, DOCX, CSV, XLSX, TXT, images)
  const handlePickDocuments = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const remainingSlots = maxFiles - mediaList.length;
      if (remainingSlots <= 0) {
        setErrorMessage(`Batch limit reached: Maximum ${maxFiles} items allowed.`);
        setIsProcessing(false);
        return;
      }

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.jpg,.jpeg,.png,.webp,.heic,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx';

        input.onchange = async (e: any) => {
          const files: File[] = Array.from(e.target.files || []);
          if (files.length === 0) {
            setIsProcessing(false);
            return;
          }

          if (files.length > remainingSlots) {
            setErrorMessage(`Batch limit exceeded: You can only add ${remainingSlots} more items (maximum ${maxFiles} total).`);
            setIsProcessing(false);
            return;
          }

          const payloads: BulkFilePayload[] = files.map((file) => ({
            uri: URL.createObjectURL(file),
            mime_type: file.type || 'application/octet-stream',
            metadata: {
              file_name: file.name,
              file_size_bytes: file.size,
              mime_type: file.type || 'application/octet-stream',
            },
          }));

          await onAttachFiles(payloads);
          setIsProcessing(false);
        };

        input.click();
        return;
      }

      // Native Document Picker
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'text/csv',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsProcessing(false);
        return;
      }

      const selected = result.assets.slice(0, remainingSlots);
      if (result.assets.length > remainingSlots) {
        setErrorMessage(`Selected ${result.assets.length} items, but only ${remainingSlots} slots remained (maximum ${maxFiles}). Added first ${remainingSlots} files.`);
      }

      const payloads: BulkFilePayload[] = selected.map((asset, idx) => {
        const ext = asset.name ? asset.name.split('.').pop() || 'dat' : 'dat';
        const fallbackName = `evidence_${Date.now()}_${idx + 1}.${ext}`;
        return {
          uri: asset.uri,
          mime_type: asset.mimeType || 'application/octet-stream',
          metadata: {
            file_name: asset.name || fallbackName,
            file_size_bytes: asset.size || 0,
            mime_type: asset.mimeType || 'application/octet-stream',
          },
        };
      });

      await onAttachFiles(payloads);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to select files from device storage.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Multi-select bulk picker from Photo Gallery
  const handlePickPhotos = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const remainingSlots = maxFiles - mediaList.length;
      if (remainingSlots <= 0) {
        setErrorMessage(`Batch limit reached: Maximum ${maxFiles} items allowed.`);
        setIsProcessing(false);
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Device photo library permission required to select evidence photos.');
        setIsProcessing(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: Math.min(50, remainingSlots),
        quality: 0.85,
        exif: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsProcessing(false);
        return;
      }

      const payloads: BulkFilePayload[] = result.assets.map((asset, idx) => {
        const fallbackName = `photo_${Date.now()}_${idx + 1}.${asset.uri.split('.').pop() || 'jpg'}`;
        return {
          uri: asset.uri,
          mime_type: asset.mimeType || 'image/jpeg',
          metadata: {
            file_name: asset.fileName || fallbackName,
            file_size_bytes: asset.fileSize || 1024 * 512,
            mime_type: asset.mimeType || 'image/jpeg',
            width: asset.width,
            height: asset.height,
          },
        };
      });

      await onAttachFiles(payloads);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to select photos from library.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Real-time URL validator & cloud drive sharing permission checker
  const handleUrlChange = (text: string) => {
    setLinkUrl(text);
    setLinkError(null);
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) {
      setAccessWarning(null);
      return;
    }
    if (
      trimmed.includes('drive.google.com') ||
      trimmed.includes('docs.google.com') ||
      trimmed.includes('dropbox.com') ||
      trimmed.includes('onedrive') ||
      trimmed.includes('1drv.ms') ||
      trimmed.includes('sharepoint.com') ||
      trimmed.includes('box.com')
    ) {
      setAccessWarning('Cloud storage link detected: Ensure sharing permissions are set to "Anyone with the link can view" so reviewers can verify your evidence.');
    } else {
      setAccessWarning(null);
    }
  };

  // Add or Edit Evidence Link Handler with robust URL validation
  const handleSaveEvidenceLink = async () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setLinkError('Please enter a valid URL.');
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      setLinkError('Please enter a valid, well-formed URL (e.g. https://drive.google.com/...)');
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      setLinkError('Only http:// and https:// links are supported (unsafe schemes like javascript: are prohibited).');
      return;
    }

    if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.')) {
      setLinkError('URL must contain a valid domain name.');
      return;
    }

    const hostname = parsedUrl.hostname;
    const lower = trimmed.toLowerCase();
    const isCloudHost =
      lower.includes('drive.google.com') ||
      lower.includes('docs.google.com') ||
      lower.includes('dropbox.com') ||
      lower.includes('onedrive') ||
      lower.includes('1drv.ms') ||
      lower.includes('sharepoint.com') ||
      lower.includes('box.com');

    if (editingMediaId) {
      await onDeleteMedia(editingMediaId);
    }

    const linkPayload: BulkFilePayload = {
      uri: trimmed,
      mime_type: 'link',
      metadata: {
        file_name: linkTitle.trim() || hostname,
        file_size_bytes: 0,
        mime_type: 'link',
        is_link: true,
        url: trimmed,
        requires_access_check: isCloudHost,
      },
    };

    try {
      await onAttachFiles([linkPayload]);
      setLinkModalVisible(false);
      setLinkUrl('');
      setLinkTitle('');
      setLinkError(null);
      setAccessWarning(null);
      setEditingMediaId(null);
    } catch (err: any) {
      setLinkError(err.message || 'Failed to register link.');
    }
  };

  const handleOpenEditLink = (med: LocalMediaRecord) => {
    setEditingMediaId(med.local_media_id);
    const existingUrl = (med.metadata?.url as string) || med.local_uri || '';
    setLinkUrl(existingUrl);
    setLinkTitle((med.metadata?.file_name as string) || '');
    setLinkError(null);
    handleUrlChange(existingUrl);
    setLinkModalVisible(true);
  };

  const handleOpenExternal = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (err: any) {
      setErrorMessage(`Unable to open external link: ${err.message}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Requirements Banner */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            shadowColor: '#000000',
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: theme.textMuted }]}>
            EVIDENCE UPLOADS &amp; VERIFICATION LINKS
          </Text>
          <View
            style={[
              styles.progressBadge,
              {
                backgroundColor: canProceed ? theme.primaryMuted : theme.surfaceElevated,
                borderColor: canProceed ? theme.primary : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.progressBadgeText,
                { color: canProceed ? theme.primaryLight : theme.textSecondary },
              ]}
            >
              {totalAttachments} OF {requiredCount} MINIMUM REQUIRED
            </Text>
          </View>
        </View>

        <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
          Upload ground-truth evidence files directly from device storage (images: JPG, PNG; documents: PDF, DOCX, CSV, XLSX up to 50 files) and register official public registry / shared cloud evidence links.
        </Text>
      </View>

      {/* Action Controls: Documents, Photos & Evidence Link */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handlePickDocuments}
          disabled={isProcessing || totalAttachments >= maxFiles}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.primary,
              opacity: isProcessing || totalAttachments >= maxFiles ? 0.6 : 1.0,
            },
          ]}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.actionIcon}>📁</Text>
              <Text style={styles.actionBtnText}>Files / Docs</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePickPhotos}
          disabled={isProcessing || totalAttachments >= maxFiles}
          style={[
            styles.actionButtonSecondary,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              opacity: isProcessing || totalAttachments >= maxFiles ? 0.6 : 1.0,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>🖼️</Text>
          <Text style={[styles.actionBtnTextSecondary, { color: theme.textPrimary }]}>
            Photos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setEditingMediaId(null);
            setLinkUrl('');
            setLinkTitle('');
            setLinkError(null);
            setAccessWarning(null);
            setLinkModalVisible(true);
          }}
          disabled={isProcessing || totalAttachments >= maxFiles}
          style={[
            styles.actionButtonSecondary,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              opacity: isProcessing || totalAttachments >= maxFiles ? 0.6 : 1.0,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>🔗</Text>
          <Text style={[styles.actionBtnTextSecondary, { color: theme.textPrimary }]}>
            Add Link
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error / Alert Notice */}
      {errorMessage && (
        <View style={[styles.errorBox, { backgroundColor: theme.errorMuted, borderColor: theme.error }]}>
          <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
        </View>
      )}

      {/* Upload Progress & Batch Summary Banner */}
      {totalAttachments > 0 && (
        <View style={[styles.summaryBanner, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
            Attached: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{totalAttachments} items</Text> •{' '}
            Images: {mediaList.filter((m) => m.media_type.startsWith('image/')).length} •{' '}
            Documents: {mediaList.filter((m) => !m.media_type.startsWith('image/') && m.media_type !== 'link' && !m.metadata?.is_link).length} •{' '}
            Links: {mediaList.filter((m) => m.media_type === 'link' || m.metadata?.is_link).length}
          </Text>
          {uploadingCount > 0 ? (
            <Text style={{ fontSize: 11, color: theme.tokenGold, fontWeight: '700' }}>
              ⏳ {uploadingCount} uploading...
            </Text>
          ) : (
            <Text style={{ fontSize: 11, color: theme.success, fontWeight: '700' }}>
              ✓ {totalAttachments} attached (ready for submission)
            </Text>
          )}
          {failedCount > 0 && (
            <Text style={{ fontSize: 11, color: theme.error, fontWeight: '700' }}>
              ⚠️ {failedCount} upload failed
            </Text>
          )}
        </View>
      )}

      {/* Attachments List */}
      <View style={styles.listContainer}>
        {mediaList.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              No Evidence Items Attached
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Select multiple photos/documents from your device or attach a registry URL to verify ground conditions.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollList}>
            {mediaList.map((item, idx) => {
              const isLink = item.media_type === 'link' || Boolean(item.metadata?.is_link);
              const isImage = item.media_type.startsWith('image/');
              const fileName = (item.metadata?.file_name as string) || (isLink ? (item.metadata?.url as string) : `Attachment ${idx + 1}`);
              const fileSize = formatFileSize(item.metadata?.file_size_bytes);
              const isFailed = item.sync_status === 'FAILED';
              const isUploading = item.sync_status === 'UPLOADING' || item.sync_status === 'PENDING_UPLOAD';

              return (
                <View
                  key={item.local_media_id}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: isFailed ? theme.error : theme.border,
                    },
                  ]}
                >
                  {/* Left: Thumbnail or Type Icon */}
                  <TouchableOpacity
                    style={[styles.thumbnailBox, { backgroundColor: theme.surfaceElevated }]}
                    onPress={() => {
                      if (isImage) {
                        setPreviewMedia(item);
                      } else if (isLink) {
                        handleOpenExternal((item.metadata?.url as string) || item.local_uri);
                      }
                    }}
                    activeOpacity={isImage || isLink ? 0.7 : 1.0}
                  >
                    {isImage && item.local_uri ? (
                      <Image source={{ uri: item.local_uri }} style={styles.thumbnailImg} resizeMode="cover" />
                    ) : (
                      <Text style={styles.typeIcon}>{getMediaIcon(item.media_type, isLink)}</Text>
                    )}
                  </TouchableOpacity>

                  {/* Center: File metadata & Status */}
                  <View style={styles.itemMeta}>
                    <Text
                      style={[styles.itemFileName, { color: theme.textPrimary }]}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {fileName}
                    </Text>

                    <View style={styles.itemMetaSub}>
                      <Text style={[styles.itemSizeText, { color: theme.textMuted }]}>
                        {isLink ? 'External Link' : `${item.media_type.split('/').pop()?.toUpperCase()} • ${fileSize}`}
                      </Text>

                      {/* Status Tag */}
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              item.sync_status === 'SYNCED'
                                ? theme.successMuted
                                : isFailed
                                ? theme.errorMuted
                                : item.sync_status === 'UPLOADING'
                                ? theme.tokenGoldMuted
                                : theme.primaryMuted,
                            borderColor:
                              item.sync_status === 'SYNCED'
                                ? theme.success
                                : isFailed
                                ? theme.error
                                : item.sync_status === 'UPLOADING'
                                ? theme.tokenGold
                                : theme.primary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color:
                                item.sync_status === 'SYNCED'
                                    ? theme.success
                                    : isFailed
                                    ? theme.error
                                    : item.sync_status === 'UPLOADING'
                                    ? theme.tokenGold
                                    : theme.primaryLight,
                            },
                          ]}
                        >
                          {item.sync_status === 'SYNCED'
                            ? 'PERSISTED'
                            : isFailed
                            ? 'FAILED'
                            : item.sync_status === 'UPLOADING'
                            ? 'UPLOADING...'
                            : 'ATTACHED'}
                        </Text>
                      </View>

                      {Boolean(item.metadata?.requires_access_check) && (
                        <View
                          style={[
                            styles.cloudWarningBadge,
                            {
                              backgroundColor: 'rgba(245, 158, 11, 0.12)',
                              borderColor: 'rgba(245, 158, 11, 0.35)',
                            },
                          ]}
                        >
                          <Text style={[styles.cloudWarningBadgeText, { color: '#F59E0B' }]}>
                            Verify Sharing
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Right: Actions (Open Link, Edit Link, Retry, Remove) */}
                  <View style={styles.itemActions}>
                    {isLink && (
                      <>
                        <TouchableOpacity
                          onPress={() => handleOpenExternal((item.metadata?.url as string) || item.local_uri)}
                          style={[styles.openBtn, { backgroundColor: theme.surfaceElevated }]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.openBtnText, { color: theme.primaryLight }]}>Open ↗</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleOpenEditLink(item)}
                          style={styles.editBtn}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.editBtnText, { color: theme.textSecondary }]}>Edit</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {isFailed && onRetryMedia && (
                      <TouchableOpacity
                        onPress={() => onRetryMedia(item.local_media_id)}
                        style={[styles.retryBtn, { backgroundColor: theme.errorMuted }]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.retryBtnText, { color: theme.error }]}>Retry</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => onDeleteMedia(item.local_media_id)}
                      style={styles.deleteBtn}
                      activeOpacity={0.7}
                      disabled={isUploading}
                    >
                      <Text style={[styles.deleteBtnText, { color: theme.textMuted }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Navigation Footer */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>← Location</Text>
        </TouchableOpacity>

        <HorizonButton
          title={
            !canProceed
              ? `Attach at least ${requiredCount} item`
              : 'Proceed to Attributes →'
          }
          onPress={onNext}
          disabled={!canProceed}
          size="md"
          variant="primary"
          style={styles.nextBtn}
        />
      </View>

      {/* Add / Edit Evidence Link Modal */}
      <Modal visible={linkModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {editingMediaId ? 'Edit Evidence Link' : 'Add External Evidence Link'}
              </Text>
              <TouchableOpacity onPress={() => setLinkModalVisible(false)}>
                <Text style={[styles.modalClose, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Enter a valid HTTP/HTTPS link to an official cadastre registry, spatial portal, Google Drive document, Dropbox folder, or public report.
            </Text>

            <View style={styles.modalForm}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Link URL (HTTP/HTTPS) *</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { backgroundColor: theme.input, borderColor: theme.border, color: theme.textPrimary },
                ]}
                placeholder="https://drive.google.com/... or https://registry.gov/..."
                placeholderTextColor={theme.textMuted}
                value={linkUrl}
                onChangeText={handleUrlChange}
                autoCapitalize="none"
                keyboardType="default"
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Optional Citation / Title</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { backgroundColor: theme.input, borderColor: theme.border, color: theme.textPrimary },
                ]}
                placeholder="e.g. National Land Commission Gazette Notice"
                placeholderTextColor={theme.textMuted}
                value={linkTitle}
                onChangeText={setLinkTitle}
              />

              {accessWarning && (
                <View
                  style={[
                    styles.accessWarningBox,
                    {
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      borderColor: 'rgba(245, 158, 11, 0.35)',
                    },
                  ]}
                >
                  <Text style={[styles.accessWarningText, { color: '#F59E0B' }]}>
                    ℹ {accessWarning}
                  </Text>
                </View>
              )}

              {linkError && (
                <Text style={[styles.modalError, { color: theme.error }]}>⚠ {linkError}</Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setLinkModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <HorizonButton
                title={editingMediaId ? 'Save Changes' : 'Attach Link'}
                onPress={handleSaveEvidenceLink}
                size="sm"
                variant="primary"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      {previewMedia && previewMedia.local_uri && (
        <Modal visible={Boolean(previewMedia)} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.previewContainer}>
              <Image source={{ uri: previewMedia.local_uri }} style={styles.fullPreviewImg} resizeMode="contain" />
              <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setPreviewMedia(null)}>
                <Text style={styles.closePreviewText}>✕ Close Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  headerCard: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    flex: 1,
    minWidth: 160,
  },
  progressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  progressBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  instructionsText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  actionButtonSecondary: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  actionIcon: {
    fontSize: 15,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnTextSecondary: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.xs,
    borderWidth: 1,
    gap: 6,
  },
  summaryText: {
    fontSize: 11,
    flex: 1,
    minWidth: 180,
  },
  listContainer: {
    minHeight: 140,
  },
  scrollList: {},
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  thumbnailBox: {
    width: 44,
    height: 44,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  typeIcon: {
    fontSize: 22,
  },
  itemMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemFileName: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemMetaSub: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  itemSizeText: {
    fontSize: 10,
  },
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cloudWarningBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  cloudWarningBadgeText: {
    fontSize: 8,
    fontWeight: '700',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  openBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  openBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backBtnText: {
    fontSize: 12,
  },
  nextBtn: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radius.md,
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalClose: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalForm: {
    gap: 8,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  accessWarningBox: {
    padding: 8,
    borderRadius: radius.xs,
    borderWidth: 1,
    marginTop: 2,
  },
  accessWarningText: {
    fontSize: 11,
    lineHeight: 15,
  },
  modalError: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewContainer: {
    width: '90%',
    height: '75%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPreviewImg: {
    width: '100%',
    height: '90%',
    borderRadius: radius.md,
  },
  closePreviewBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.sm,
  },
  closePreviewText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 12,
  },
});

