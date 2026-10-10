import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { radius } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
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
  const { theme, isDark } = useTheme();
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
    } catch {
      // Proceed on error since local state is maintained
      onNext();
    } finally {
      setIsSaving(false);
    }
  };

  const fields = schema?.fields || [];
  const requiredCount = fields.filter((f) => f.required).length;
  const completedRequiredCount = fields.filter(
    (f) => f.required && formData[f.id] !== undefined && formData[f.id] !== ''
  ).length;

  if (fields.length === 0) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.emptyContainer,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Dynamic Survey Fields</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            This geospatial artifact type does not mandate structured field observations. You may proceed directly to the final survey review.
          </Text>
          <HorizonButton
            title="Proceed to Review →"
            onPress={onNext}
            size="md"
            variant="primary"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Instructions & Completion Progress Card */}
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
            STRUCTURED ATTRIBUTE SURVEY
          </Text>
          <View
            style={[
              styles.progressBadge,
              {
                backgroundColor: theme.primaryMuted,
                borderColor: theme.borderLight,
              },
            ]}
          >
            <Text style={[styles.progressBadgeText, { color: theme.primaryLight }]}>
              {completedRequiredCount} OF {requiredCount} REQUIRED
            </Text>
          </View>
        </View>

        {schema?.instructions ? (
          <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
            {schema.instructions}
          </Text>
        ) : (
          <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
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
            <View
              key={field.id}
              style={[
                styles.fieldGroup,
                {
                  backgroundColor: theme.card,
                  borderColor: hasError ? theme.error : theme.border,
                },
              ]}
            >
              {/* Field Label & Required Indicator */}
              <View style={styles.labelRow}>
                <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
                  {field.label}
                  {field.required && <Text style={[styles.requiredAsterisk, { color: theme.error }]}> *</Text>}
                </Text>
                {field.required && (
                  <Text style={[styles.requiredTag, { color: theme.tokenGold }]}>REQUIRED</Text>
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
                            {
                              backgroundColor: isSelected ? theme.primaryMuted : theme.surfaceElevated,
                              borderColor: isSelected ? theme.primary : theme.border,
                            },
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isSelected ? theme.primaryLight : theme.textSecondary,
                                fontWeight: isSelected ? '800' : '600',
                              },
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
                      {
                        backgroundColor: val === true ? theme.primaryMuted : theme.surfaceElevated,
                        borderColor: val === true ? theme.primary : theme.border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.boolOptionText,
                        {
                          color: val === true ? theme.primaryLight : theme.textSecondary,
                          fontWeight: val === true ? '800' : '600',
                        },
                      ]}
                    >
                      Yes / Confirmed
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleFieldChange(field, false)}
                    style={[
                      styles.boolOption,
                      {
                        backgroundColor: val === false ? theme.errorMuted : theme.surfaceElevated,
                        borderColor: val === false ? theme.error : theme.border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.boolOptionText,
                        {
                          color: val === false ? theme.error : theme.textSecondary,
                          fontWeight: val === false ? '800' : '600',
                        },
                      ]}
                    >
                      No / Absent
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : field.type === 'textarea' || field.type === 'multiline' ? (
                <TextInput
                  style={[
                    styles.input,
                    styles.textarea,
                    {
                      backgroundColor: theme.input,
                      borderColor: hasError ? theme.error : theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={(val as string) || ''}
                  onChangeText={(text) => handleFieldChange(field, text)}
                  onBlur={() => handleBlur(field)}
                  placeholder={field.placeholder || `Enter detailed ${field.label.toLowerCase()}...`}
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : (
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.input,
                      borderColor: hasError ? theme.error : theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={val !== undefined && val !== null ? String(val) : ''}
                  onChangeText={(text) =>
                    handleFieldChange(
                      field,
                      field.type === 'number' ? (text === '' ? '' : Number(text)) : text
                    )
                  }
                  onBlur={() => handleBlur(field)}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                  placeholderTextColor={theme.textMuted}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                />
              )}

              {/* Inline Validation Warning */}
              {hasError && (
                <View style={styles.inlineErrorBox}>
                  <Text style={[styles.inlineErrorText, { color: theme.error }]}>{errorMsg}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Navigation Footer */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>← Images</Text>
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
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
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
    letterSpacing: 1.2,
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
  formContainer: {
    gap: 16,
  },
  fieldGroup: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
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
  },
  requiredAsterisk: {
    fontWeight: '900',
  },
  requiredTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
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
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    textTransform: 'capitalize',
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
    borderWidth: 1,
  },
  boolOptionText: {
    fontSize: 12,
  },
  inlineErrorBox: {
    marginTop: 8,
  },
  inlineErrorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
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
  },
  nextBtn: {
    flex: 1,
  },
});
