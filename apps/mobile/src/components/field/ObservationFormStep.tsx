import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, radius } from '../../theme/colors';
import { HorizonButton } from '../ui/HorizonButton';
import type { TaskFormFieldDefinitionDTO, TaskFormSchemaResponseDTO } from '@horizon/types';

interface ObservationFormStepProps {
  schema: TaskFormSchemaResponseDTO | null;
  initialValues?: Record<string, unknown>;
  onSaveObservations: (data: Record<string, unknown>) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export const ObservationFormStep: React.FC<ObservationFormStepProps> = ({
  schema,
  initialValues = {},
  onSaveObservations,
  onNext,
  onBack,
}) => {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues || {});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync initialValues if changed externally
  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      setFormData((prev) => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  // Run validation on fields
  const validateField = (
    field: TaskFormFieldDefinitionDTO,
    val: unknown
  ): string | null => {
    if (field.required) {
      if (val === undefined || val === null || val === '') {
        return `⚠ ${field.label} is required`;
      }
      if (field.type === 'number' && isNaN(Number(val))) {
        return `⚠ ${field.label} must be a valid number`;
      }
    }
    return null;
  };

  const handleFieldChange = (field: TaskFormFieldDefinitionDTO, value: unknown) => {
    const updated = { ...formData, [field.id]: value };
    setFormData(updated);

    // Validate inline
    const err = validateField(field, value);
    setValidationErrors((prev) => {
      const copy = { ...prev };
      if (err) {
        copy[field.id] = err;
      } else {
        delete copy[field.id];
      }
      return copy;
    });

    // Auto-save debounced locally
    onSaveObservations(updated).catch(() => {});
  };

  const handleBlur = (field: TaskFormFieldDefinitionDTO) => {
    setTouchedFields((prev) => ({ ...prev, [field.id]: true }));
    const err = validateField(field, formData[field.id]);
    if (err) {
      setValidationErrors((prev) => ({ ...prev, [field.id]: err }));
    }
  };

  const handleValidateAndProceed = async () => {
    if (!schema?.fields) {
      onNext();
      return;
    }

    const errors: Record<string, string> = {};
    const touched: Record<string, boolean> = {};

    for (const f of schema.fields) {
      touched[f.id] = true;
      const err = validateField(f, formData[f.id]);
      if (err) {
        errors[f.id] = err;
      }
    }

    setTouchedFields(touched);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSaveObservations(formData);
      onNext();
    } catch (err: any) {
      // Still proceed if local save succeeds
      onNext();
    } finally {
      setIsSaving(false);
    }
  };

  if (!schema) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>NO SCHEMA DEFINED</Text>
        <Text style={styles.emptySub}>
          This task has no dynamic observation schema fields. You may proceed directly to Review.
        </Text>
        <HorizonButton title="Proceed to Review →" onPress={onNext} size="md" variant="primary" />
      </View>
    );
  }

  const fields = schema.fields || [];
  const requiredCount = fields.filter((f) => f.required).length;
  const completedRequiredCount = fields.filter(
    (f) => f.required && formData[f.id] !== undefined && formData[f.id] !== '' && formData[f.id] !== null
  ).length;

  return (
    <View style={styles.container}>
      {/* Schema Instructions Banner */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>GROUND-TRUTH OBSERVATIONS</Text>
          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>
              {completedRequiredCount} / {requiredCount} REQUIRED
            </Text>
          </View>
        </View>

        {schema.instructions ? (
          <Text style={styles.instructionsText}>{schema.instructions}</Text>
        ) : (
          <Text style={styles.instructionsText}>
            Inspect the physical site condition and record all mandatory fields. Progress is saved locally in SQLite automatically.
          </Text>
        )}
      </View>

      {/* Dynamic Form Fields */}
      <View style={styles.formContainer}>
        {fields.map((field) => {
          const val = formData[field.id];
          const hasError = touchedFields[field.id] && !!validationErrors[field.id];
          const errorMsg = validationErrors[field.id];

          return (
            <View key={field.id} style={styles.fieldGroup}>
              {/* Field Label & Required Indicator */}
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  {field.label}
                  {field.required && <Text style={styles.requiredAsterisk}> *</Text>}
                </Text>
                {field.required && (
                  <Text style={styles.requiredTag}>REQUIRED</Text>
                )}
              </View>

              {/* Render Field By Type */}
              {field.type === 'select' ? (
                <View style={styles.selectContainer}>
                  <View style={styles.chipsRow}>
                    {(field.options || []).map((opt) => {
                      const isSelected = val === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => handleFieldChange(field, opt)}
                          style={[
                            styles.selectChip,
                            isSelected && styles.selectChipActive,
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {opt.replace(/_/g, ' ')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : field.type === 'boolean' ? (
                <View style={styles.booleanRow}>
                  <TouchableOpacity
                    onPress={() => handleFieldChange(field, true)}
                    style={[
                      styles.boolOption,
                      val === true && styles.boolOptionActiveTrue,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.boolOptionText,
                        val === true && styles.boolOptionTextActive,
                      ]}
                    >
                      Yes / Confirmed
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleFieldChange(field, false)}
                    style={[
                      styles.boolOption,
                      val === false && styles.boolOptionActiveFalse,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.boolOptionText,
                        val === false && styles.boolOptionTextActive,
                      ]}
                    >
                      No / Absent
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : field.type === 'textarea' || field.type === 'multiline' ? (
                <TextInput
                  style={[styles.input, styles.textarea, hasError && styles.inputError]}
                  value={(val as string) || ''}
                  onChangeText={(text) => handleFieldChange(field, text)}
                  onBlur={() => handleBlur(field)}
                  placeholder={field.placeholder || `Enter detailed ${field.label.toLowerCase()}...`}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : (
                <TextInput
                  style={[styles.input, hasError && styles.inputError]}
                  value={val !== undefined && val !== null ? String(val) : ''}
                  onChangeText={(text) =>
                    handleFieldChange(
                      field,
                      field.type === 'number' ? (text === '' ? '' : Number(text)) : text
                    )
                  }
                  onBlur={() => handleBlur(field)}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                  placeholderTextColor={colors.textMuted}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                />
              )}

              {/* Inline Validation Warning */}
              {hasError && (
                <View style={styles.inlineErrorBox}>
                  <Text style={styles.inlineErrorText}>{errorMsg}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Navigation Footer */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Images</Text>
        </TouchableOpacity>

        <HorizonButton
          title={isSaving ? 'Saving Form...' : 'Proceed to Review →'}
          onPress={handleValidateAndProceed}
          loading={isSaving}
          size="md"
          variant="primary"
          style={styles.nextBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  headerCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  progressBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentGreen,
    letterSpacing: 0.5,
  },
  instructionsText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  formContainer: {
    gap: 16,
  },
  fieldGroup: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  requiredAsterisk: {
    color: colors.statusError,
    fontWeight: '900',
  },
  requiredTag: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.tokenGold,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  inputError: {
    borderColor: colors.statusError,
  },
  textarea: {
    minHeight: 88,
  },
  selectContainer: {
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectChipActive: {
    backgroundColor: colors.accentGreenMuted,
    borderColor: colors.accentGreen,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: colors.accentGreen,
    fontWeight: '800',
  },
  booleanRow: {
    flexDirection: 'row',
    gap: 10,
  },
  boolOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boolOptionActiveTrue: {
    backgroundColor: colors.accentGreenMuted,
    borderColor: colors.accentGreen,
  },
  boolOptionActiveFalse: {
    backgroundColor: colors.statusErrorMuted,
    borderColor: colors.statusError,
  },
  boolOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  boolOptionTextActive: {
    color: colors.textPrimary,
  },
  inlineErrorBox: {
    marginTop: 8,
  },
  inlineErrorText: {
    fontSize: 11,
    color: colors.statusError,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
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
    color: colors.textSecondary,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
  },
});
