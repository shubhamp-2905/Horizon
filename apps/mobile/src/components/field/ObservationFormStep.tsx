import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
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

interface CategoryDefinition {
  id: string;
  title: string;
  icon: string;
  shortTitle: string;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'tenure_governance',
    title: 'Tenure & Governance',
    shortTitle: 'Tenure',
    icon: '🏛️',
  },
  {
    id: 'environmental_climatic',
    title: 'Environmental & Climatic',
    shortTitle: 'Climatic',
    icon: '🌿',
  },
  {
    id: 'development_suitability',
    title: 'Development Suitability',
    shortTitle: 'Suitability',
    icon: '🏗️',
  },
];

const UNKNOWN_OPTION = 'Unknown / Unable to verify';

export const ObservationFormStep: React.FC<ObservationFormStepProps> = ({
  schema,
  initialValues = {},
  onSaveObservations,
  onNext,
  onBack,
}) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues || {});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Hierarchical state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('tenure_governance');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');

  // Dropdown modal state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [subcategoryModalVisible, setSubcategoryModalVisible] = useState(false);

  // Sync initialValues if changed externally
  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      setFormData((prev) => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  const fields = useMemo(() => schema?.fields || [], [schema?.fields]);

  // Helper to map fields to the 3 main Loupe categories
  const getFieldCategoryId = (field: TaskFormFieldDefinitionDTO): string => {
    if (field.section_id) {
      if (field.section_id.includes('tenure') || field.section_id.includes('govern')) return 'tenure_governance';
      if (field.section_id.includes('environ') || field.section_id.includes('climat') || field.section_id.includes('water')) return 'environmental_climatic';
      if (field.section_id.includes('develop') || field.section_id.includes('suit')) return 'development_suitability';
    }
    const title = (field.section_title || field.section || '').toLowerCase();
    if (title.includes('tenure') || title.includes('govern')) return 'tenure_governance';
    if (title.includes('environ') || title.includes('climat') || title.includes('water')) return 'environmental_climatic';
    return 'development_suitability';
  };

  // Group fields by category
  const categorizedFields = useMemo(() => {
    const map: Record<string, TaskFormFieldDefinitionDTO[]> = {
      tenure_governance: [],
      environmental_climatic: [],
      development_suitability: [],
    };

    for (const f of fields) {
      const catId = getFieldCategoryId(f);
      if (map[catId]) {
        map[catId].push(f);
      } else {
        map['development_suitability'].push(f);
      }
    }
    return map;
  }, [fields]);

  // Current category's fields
  const currentCategoryFields = useMemo(() => {
    return categorizedFields[selectedCategoryId] || [];
  }, [categorizedFields, selectedCategoryId]);

  // Ensure selectedFieldId is set to a valid field in current category
  useEffect(() => {
    if (currentCategoryFields.length > 0) {
      const fieldExists = currentCategoryFields.some((f) => f.id === selectedFieldId);
      if (!fieldExists) {
        setSelectedFieldId(currentCategoryFields[0].id);
      }
    } else {
      setSelectedFieldId('');
    }
  }, [currentCategoryFields, selectedFieldId]);

  // Current active field
  const currentField = useMemo(() => {
    return currentCategoryFields.find((f) => f.id === selectedFieldId) || currentCategoryFields[0] || null;
  }, [currentCategoryFields, selectedFieldId]);

  // Validation
  const validateField = (field: TaskFormFieldDefinitionDTO, val: unknown): string | null => {
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

    onSaveObservations(updated).catch(() => {});
  };

  const handleBlur = (field: TaskFormFieldDefinitionDTO) => {
    setTouchedFields((prev) => ({ ...prev, [field.id]: true }));
    const err = validateField(field, formData[field.id]);
    if (err) {
      setValidationErrors((prev) => ({ ...prev, [field.id]: err }));
    }
  };

  // Switch category
  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setCategoryModalVisible(false);
    const targetFields = categorizedFields[catId] || [];
    if (targetFields.length > 0) {
      setSelectedFieldId(targetFields[0].id);
    }
  };

  // Switch subcategory
  const handleSelectSubcategory = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setSubcategoryModalVisible(false);
  };

  // Next / Previous factor navigation
  const currentIndex = currentCategoryFields.findIndex((f) => f.id === currentField?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < currentCategoryFields.length - 1;

  const currentCatIndex = CATEGORIES.findIndex((c) => c.id === selectedCategoryId);
  const nextCategory = currentCatIndex < CATEGORIES.length - 1 ? CATEGORIES[currentCatIndex + 1] : null;

  const handlePrevFactor = () => {
    if (hasPrev) {
      setSelectedFieldId(currentCategoryFields[currentIndex - 1].id);
    }
  };

  const handleNextFactor = () => {
    if (hasNext) {
      setSelectedFieldId(currentCategoryFields[currentIndex + 1].id);
    } else if (nextCategory) {
      handleSelectCategory(nextCategory.id);
    }
  };

  const handleValidateAndProceed = async () => {
    if (!schema?.fields) {
      onNext();
      return;
    }

    const errors: Record<string, string> = {};
    const touched: Record<string, boolean> = {};
    let firstErrorField: TaskFormFieldDefinitionDTO | null = null;

    for (const f of schema.fields) {
      touched[f.id] = true;
      const err = validateField(f, formData[f.id]);
      if (err) {
        errors[f.id] = err;
        if (!firstErrorField) firstErrorField = f;
      }
    }

    setTouchedFields(touched);
    setValidationErrors(errors);

    if (firstErrorField) {
      // Jump to the required field that has an error
      const catId = getFieldCategoryId(firstErrorField);
      setSelectedCategoryId(catId);
      setSelectedFieldId(firstErrorField.id);
      return;
    }

    setIsSaving(true);
    try {
      await onSaveObservations(formData);
      onNext();
    } catch {
      onNext();
    } finally {
      setIsSaving(false);
    }
  };

  // Count completions
  const requiredFields = fields.filter((f) => f.required);
  const answeredFieldsCount = fields.filter(
    (f) => formData[f.id] !== undefined && formData[f.id] !== '' && formData[f.id] !== null
  ).length;
  const completedRequiredCount = requiredFields.filter(
    (f) => formData[f.id] !== undefined && formData[f.id] !== '' && formData[f.id] !== null
  ).length;

  const currentCatObj = CATEGORIES.find((c) => c.id === selectedCategoryId) || CATEGORIES[0];

  // Helper for subcategory label
  const getSubcategoryLabel = (f: TaskFormFieldDefinitionDTO): string => {
    if (f.subcategory) return f.subcategory;
    return f.label;
  };

  if (fields.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Dynamic Survey Fields</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            This geospatial artifact type does not mandate structured field observations. You may proceed directly to the final survey review.
          </Text>
          <HorizonButton title="Proceed to Review →" onPress={onNext} size="md" variant="primary" />
        </View>
      </View>
    );
  }

  // Ensure answer options always include "Unknown / Unable to verify"
  const getFieldOptions = (field: TaskFormFieldDefinitionDTO): string[] => {
    const rawOptions = field.options || [];
    if (rawOptions.some((o) => o.toLowerCase().includes('unknown') || o.toLowerCase().includes('unable to verify'))) {
      return rawOptions;
    }
    return [...rawOptions, UNKNOWN_OPTION];
  };

  const fieldValue = currentField ? formData[currentField.id] : undefined;
  const hasError = currentField ? touchedFields[currentField.id] && !!validationErrors[currentField.id] : false;
  const errorMsg = currentField ? validationErrors[currentField.id] : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Card with Matrix Info & Progress */}
      <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerSubTitle, { color: theme.textMuted }]}>
              LOUPE RISK & OPPORTUNITY MATRIX
            </Text>
            <Text style={[styles.headerMainTitle, { color: theme.textPrimary }]}>
              Dynamic Field Survey
            </Text>
          </View>
          <View style={[styles.progressBadge, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
            <Text style={[styles.progressBadgeText, { color: theme.primaryLight }]}>
              {answeredFieldsCount} OF {fields.length} EVALUATED
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressBarTrack, { backgroundColor: theme.borderSubtle }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: theme.primary,
                width: `${Math.min(100, Math.round((answeredFieldsCount / Math.max(1, fields.length)) * 100))}%`,
              },
            ]}
          />
        </View>

        <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
          {schema?.instructions || 'Evaluate observable site factors. Yellow-highlighted factors and GIS metrics are automated backend measurements.'}
        </Text>
      </View>

      {/* 2. Hierarchical Category Selector Dropdown & Quick-Switch Tabs */}
      <View style={styles.hierarchySection}>
        <Text style={[styles.hierarchySectionLabel, { color: theme.textMuted }]}>
          STEP 1: MAIN CATEGORY
        </Text>

        {/* Category Native Dropdown Trigger */}
        <TouchableOpacity
          style={[
            styles.dropdownTrigger,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
            },
          ]}
          onPress={() => setCategoryModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.dropdownLeft}>
            <Text style={styles.categoryIcon}>{currentCatObj.icon}</Text>
            <View>
              <Text style={[styles.dropdownValue, { color: theme.textPrimary }]}>
                {currentCatObj.title}
              </Text>
              <Text style={[styles.dropdownSubtext, { color: theme.textSecondary }]}>
                {categorizedFields[selectedCategoryId]?.filter(
                  (f) => formData[f.id] !== undefined && formData[f.id] !== ''
                ).length || 0} of {categorizedFields[selectedCategoryId]?.length || 0} evaluated
              </Text>
            </View>
          </View>
          <View style={styles.dropdownRight}>
            <Text style={[styles.dropdownCaret, { color: theme.textMuted }]}>▼</Text>
          </View>
        </TouchableOpacity>

        {/* Category Quick Tabs */}
        <View style={styles.categoryPillsRow}>
          {CATEGORIES.map((cat) => {
            const isSelected = cat.id === selectedCategoryId;
            const catFields = categorizedFields[cat.id] || [];
            const catAnswered = catFields.filter(
              (f) => formData[f.id] !== undefined && formData[f.id] !== ''
            ).length;
            const isAllAnswered = catFields.length > 0 && catAnswered >= catFields.length;

            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => handleSelectCategory(cat.id)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected ? theme.primaryMuted : theme.card,
                    borderColor: isSelected ? theme.primary : isAllAnswered ? theme.success : theme.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryPillIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryPillText,
                    {
                      color: isSelected ? theme.primaryLight : theme.textPrimary,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {cat.shortTitle}
                </Text>
                <View
                  style={[
                    styles.catBadgeCircle,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        : isAllAnswered
                        ? theme.success
                        : theme.borderLight,
                    },
                  ]}
                >
                  <Text style={styles.catBadgeCircleText}>
                    {isAllAnswered ? '✓' : `${catAnswered}/${catFields.length}`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Subcategory Selector Dropdown */}
      <View style={styles.hierarchySection}>
        <View style={styles.subcategoryHeaderRow}>
          <Text style={[styles.hierarchySectionLabel, { color: theme.textMuted }]}>
            STEP 2: SUBCATEGORY & FACTOR
          </Text>
          <Text style={[styles.subcategoryCountText, { color: theme.textMuted }]}>
            {currentIndex + 1} of {currentCategoryFields.length} in this category
          </Text>
        </View>

        {/* Subcategory Native Dropdown Trigger */}
        <TouchableOpacity
          style={[
            styles.dropdownTrigger,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: hasError ? theme.error : theme.border,
            },
          ]}
          onPress={() => setSubcategoryModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.dropdownLeft}>
            <View
              style={[
                styles.subcatStatusDot,
                {
                  backgroundColor:
                    fieldValue !== undefined && fieldValue !== ''
                      ? theme.success
                      : currentField?.required
                      ? theme.tokenGold
                      : theme.textMuted,
                },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.dropdownValue, { color: theme.textPrimary }]} numberOfLines={1}>
                {currentField ? getSubcategoryLabel(currentField) : 'Select a factor'}
              </Text>
              <Text style={[styles.dropdownSubtext, { color: theme.textSecondary }]} numberOfLines={1}>
                {fieldValue !== undefined && fieldValue !== ''
                  ? `Answer: ${String(fieldValue)}`
                  : currentField?.required
                  ? 'Mandatory question'
                  : 'Optional observation'}
              </Text>
            </View>
          </View>
          <View style={styles.dropdownRight}>
            <Text style={[styles.dropdownCaret, { color: theme.textMuted }]}>▼</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 4. Active Question & Answer Selection Card */}
      {currentField && (
        <View
          style={[
            styles.questionCard,
            {
              backgroundColor: theme.card,
              borderColor: hasError ? theme.error : theme.border,
            },
          ]}
        >
          {/* Header Row: Label, Risk/Opportunity Badge, Required Tag */}
          <View style={styles.questionHeaderRow}>
            <View style={styles.questionLabelCol}>
              <View style={styles.factorTypeRow}>
                {currentField.factor_type && (
                  <View
                    style={[
                      styles.factorTypeBadge,
                      {
                        backgroundColor:
                          currentField.factor_type === 'Risk' ? '#FEF2F2' : '#F0FDF4',
                        borderColor:
                          currentField.factor_type === 'Risk' ? '#FCA5A5' : '#86EFAC',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.factorTypeBadgeText,
                        {
                          color:
                            currentField.factor_type === 'Risk' ? '#B91C1C' : '#15803D',
                        },
                      ]}
                    >
                      {currentField.factor_type.toUpperCase()}
                    </Text>
                  </View>
                )}

                {currentField.required ? (
                  <View style={[styles.requiredBadge, { backgroundColor: '#FEF3F2', borderColor: '#FECDCA' }]}>
                    <Text style={styles.requiredBadgeText}>* REQUIRED</Text>
                  </View>
                ) : (
                  <View style={[styles.optionalBadge, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                    <Text style={[styles.optionalBadgeText, { color: theme.textMuted }]}>OPTIONAL</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.questionLabel, { color: theme.textPrimary }]}>
                {currentField.label}
              </Text>
            </View>
          </View>

          {/* Metric & Help Guidance */}
          {(currentField.help_text || currentField.metric) && (
            <View style={[styles.guidanceBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
              {currentField.metric ? (
                <Text style={[styles.guidanceMetric, { color: theme.textMuted }]}>
                  📊 <Text style={{ fontWeight: '700' }}>Inspection Metric:</Text> {currentField.metric}
                </Text>
              ) : null}
              {currentField.help_text ? (
                <Text style={[styles.guidanceText, { color: theme.textSecondary }]}>
                  💡 {currentField.help_text}
                </Text>
              ) : null}
            </View>
          )}

          {/* Answer Options */}
          <View style={styles.answerOptionsSection}>
            <Text style={[styles.answerPromptTitle, { color: theme.textMuted }]}>
              SELECT OBSERVED CONDITION:
            </Text>

            {currentField.type === 'select' || !currentField.type ? (
              <View style={styles.optionsList}>
                {getFieldOptions(currentField).map((opt) => {
                  const isSelected = fieldValue === opt;
                  const isUnknown = opt.toLowerCase().includes('unknown') || opt.toLowerCase().includes('unable to verify');

                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => handleFieldChange(currentField, opt)}
                      style={[
                        styles.optionCard,
                        {
                          backgroundColor: isSelected
                            ? (isUnknown ? theme.surfaceElevated : theme.primaryMuted)
                            : theme.surfaceElevated,
                          borderColor: isSelected
                            ? (isUnknown ? theme.textMuted : theme.primary)
                            : theme.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionRadioCol}>
                        <View
                          style={[
                            styles.radioCircle,
                            {
                              borderColor: isSelected ? theme.primary : theme.border,
                              backgroundColor: isSelected ? theme.primary : 'transparent',
                            },
                          ]}
                        >
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                      </View>
                      <View style={styles.optionTextCol}>
                        <Text
                          style={[
                            styles.optionLabel,
                            {
                              color: isSelected ? theme.textPrimary : theme.textSecondary,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {opt}
                        </Text>
                        {isUnknown && (
                          <Text style={[styles.unknownSubtext, { color: theme.textMuted }]}>
                            Use if physical verification is inaccessible or unobservable.
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : currentField.type === 'boolean' ? (
              <View style={styles.booleanRow}>
                <TouchableOpacity
                  onPress={() => handleFieldChange(currentField, true)}
                  style={[
                    styles.boolCard,
                    {
                      backgroundColor: fieldValue === true ? theme.primaryMuted : theme.surfaceElevated,
                      borderColor: fieldValue === true ? theme.primary : theme.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.boolCardText,
                      {
                        color: fieldValue === true ? theme.primaryLight : theme.textSecondary,
                        fontWeight: fieldValue === true ? '800' : '600',
                      },
                    ]}
                  >
                    ✓ Yes / Confirmed
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleFieldChange(currentField, false)}
                  style={[
                    styles.boolCard,
                    {
                      backgroundColor: fieldValue === false ? theme.errorMuted : theme.surfaceElevated,
                      borderColor: fieldValue === false ? theme.error : theme.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.boolCardText,
                      {
                        color: fieldValue === false ? theme.error : theme.textSecondary,
                        fontWeight: fieldValue === false ? '800' : '600',
                      },
                    ]}
                  >
                    ✕ No / Absent
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleFieldChange(currentField, UNKNOWN_OPTION)}
                  style={[
                    styles.boolCard,
                    {
                      backgroundColor: fieldValue === UNKNOWN_OPTION ? theme.card : theme.surfaceElevated,
                      borderColor: fieldValue === UNKNOWN_OPTION ? theme.textMuted : theme.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.boolCardText,
                      {
                        color: fieldValue === UNKNOWN_OPTION ? theme.textPrimary : theme.textMuted,
                        fontWeight: fieldValue === UNKNOWN_OPTION ? '800' : '500',
                      },
                    ]}
                  >
                    ? Unknown
                  </Text>
                </TouchableOpacity>
              </View>
            ) : currentField.type === 'textarea' || currentField.type === 'multiline' ? (
              <TextInput
                style={[
                  styles.textarea,
                  {
                    backgroundColor: theme.input,
                    borderColor: hasError ? theme.error : theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                value={(fieldValue as string) || ''}
                onChangeText={(text) => handleFieldChange(currentField, text)}
                onBlur={() => handleBlur(currentField)}
                placeholder={currentField.placeholder || 'Enter detailed site observations...'}
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.input,
                    borderColor: hasError ? theme.error : theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                value={fieldValue !== undefined && fieldValue !== null ? String(fieldValue) : ''}
                onChangeText={(text) =>
                  handleFieldChange(
                    currentField,
                    currentField.type === 'number' ? (text === '' ? '' : Number(text)) : text
                  )
                }
                onBlur={() => handleBlur(currentField)}
                placeholder={currentField.placeholder || `Enter ${currentField.label.toLowerCase()}...`}
                placeholderTextColor={theme.textMuted}
                keyboardType={currentField.type === 'number' ? 'numeric' : 'default'}
              />
            )}

            {/* Inline Error */}
            {hasError && (
              <View style={styles.errorBanner}>
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
              </View>
            )}
          </View>

          {/* Stepping controls between questions */}
          <View style={styles.factorSteppingRow}>
            <TouchableOpacity
              onPress={handlePrevFactor}
              disabled={!hasPrev}
              style={[
                styles.stepNavBtn,
                {
                  opacity: hasPrev ? 1 : 0.4,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceElevated,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.stepNavBtnText, { color: theme.textSecondary }]}>
                ← Prev Factor
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNextFactor}
              style={[
                styles.stepNavBtn,
                {
                  borderColor: hasNext || nextCategory ? theme.primary : theme.border,
                  backgroundColor: hasNext || nextCategory ? theme.primaryMuted : theme.surfaceElevated,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.stepNavBtnText,
                  {
                    color: hasNext || nextCategory ? theme.primaryLight : theme.textSecondary,
                    fontWeight: '700',
                  },
                ]}
              >
                {hasNext ? 'Next Factor →' : nextCategory ? `Next: ${nextCategory.shortTitle} →` : 'All Factors Reviewed ✓'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. Navigation Footer */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>← Back to Images</Text>
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

      {/* MODAL 1: Main Category Selection Dropdown Picker */}
      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCategoryModalVisible(false)}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Select Main Category
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Hierarchical domain defined by Loupe Risk & Opportunity Matrix:
            </Text>

            <View style={styles.modalItemsList}>
              {CATEGORIES.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                const catFields = categorizedFields[cat.id] || [];
                const catAnswered = catFields.filter(
                  (f) => formData[f.id] !== undefined && formData[f.id] !== ''
                ).length;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => handleSelectCategory(cat.id)}
                    style={[
                      styles.modalItemRow,
                      {
                        backgroundColor: isSelected ? theme.primaryMuted : theme.surfaceElevated,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalItemIcon}>{cat.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modalItemTitle,
                          {
                            color: isSelected ? theme.primaryLight : theme.textPrimary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {cat.title}
                      </Text>
                      <Text style={[styles.modalItemSub, { color: theme.textSecondary }]}>
                        {catAnswered} of {catFields.length} questions evaluated
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={[styles.modalCheckMark, { color: theme.primary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setCategoryModalVisible(false)}
              style={[styles.modalCloseBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.modalCloseBtnText, { color: theme.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL 2: Subcategory Factor Selection Dropdown Picker */}
      <Modal visible={subcategoryModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSubcategoryModalVisible(false)}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Select Factor in {currentCatObj.shortTitle}
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Choose a specific factor to inspect and record observed answer:
            </Text>

            <ScrollView style={styles.modalScrollableList} showsVerticalScrollIndicator={false}>
              {currentCategoryFields.map((f, idx) => {
                const isSelected = f.id === currentField?.id;
                const answered = formData[f.id] !== undefined && formData[f.id] !== '';

                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => handleSelectSubcategory(f.id)}
                    style={[
                      styles.modalItemRow,
                      {
                        backgroundColor: isSelected ? theme.primaryMuted : theme.surfaceElevated,
                        borderColor: isSelected ? theme.primary : theme.border,
                        marginBottom: 8,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.subcatIndexBadge,
                        {
                          backgroundColor: answered ? theme.success : theme.borderLight,
                        },
                      ]}
                    >
                      <Text style={styles.subcatIndexBadgeText}>
                        {answered ? '✓' : idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[
                            styles.modalItemTitle,
                            {
                              color: isSelected ? theme.primaryLight : theme.textPrimary,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {getSubcategoryLabel(f)}
                        </Text>
                        {f.required && (
                          <Text style={{ fontSize: 9, fontWeight: '800', color: theme.tokenGold }}>
                            REQUIRED
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.modalItemSub, { color: theme.textSecondary }]} numberOfLines={1}>
                        {answered ? `Selected: ${String(formData[f.id])}` : f.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={[styles.modalCheckMark, { color: theme.primary }]}>●</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setSubcategoryModalVisible(false)}
              style={[styles.modalCloseBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.modalCloseBtnText, { color: theme.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  headerCard: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleCol: {
    gap: 2,
  },
  headerSubTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerMainTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  progressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  progressBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  instructionsText: {
    fontSize: 11,
    lineHeight: 16,
  },
  hierarchySection: {
    gap: 6,
  },
  hierarchySectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 22,
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  dropdownRight: {
    paddingLeft: 8,
  },
  dropdownCaret: {
    fontSize: 12,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  categoryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  categoryPillIcon: {
    fontSize: 13,
  },
  categoryPillText: {
    fontSize: 11,
  },
  catBadgeCircle: {
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  catBadgeCircleText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subcategoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subcategoryCountText: {
    fontSize: 10,
    fontWeight: '600',
  },
  subcatStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  questionCard: {
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  questionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  questionLabelCol: {
    flex: 1,
    gap: 6,
  },
  factorTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  factorTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  factorTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  requiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  requiredBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B42318',
    letterSpacing: 0.5,
  },
  optionalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  optionalBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  guidanceBox: {
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 4,
  },
  guidanceMetric: {
    fontSize: 11,
    lineHeight: 16,
  },
  guidanceText: {
    fontSize: 11,
    lineHeight: 16,
  },
  answerOptionsSection: {
    gap: 8,
  },
  answerPromptTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    gap: 12,
  },
  optionRadioCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  optionTextCol: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 13,
  },
  unknownSubtext: {
    fontSize: 10,
    lineHeight: 14,
  },
  booleanRow: {
    flexDirection: 'row',
    gap: 8,
  },
  boolCard: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  boolCardText: {
    fontSize: 12,
  },
  textarea: {
    minHeight: 90,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
  },
  textInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  errorBanner: {
    marginTop: 4,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  factorSteppingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  stepNavBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNavBtnText: {
    fontSize: 12,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.md,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  modalItemsList: {
    gap: 8,
  },
  modalScrollableList: {
    maxHeight: 320,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    gap: 10,
  },
  modalItemIcon: {
    fontSize: 20,
  },
  modalItemTitle: {
    fontSize: 13,
  },
  modalItemSub: {
    fontSize: 10,
    marginTop: 2,
  },
  modalCheckMark: {
    fontSize: 16,
    fontWeight: '900',
  },
  subcatIndexBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcatIndexBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCloseBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
