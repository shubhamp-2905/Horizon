import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/colors';

interface HorizonButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const HorizonButton: React.FC<HorizonButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const { theme } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: theme.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.border,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.borderHighlight,
        };
      case 'danger':
        return {
          backgroundColor: theme.statusErrorMuted,
          borderWidth: 1,
          borderColor: theme.statusError,
        };
      case 'primary':
      default:
        return {
          backgroundColor: theme.primaryPurple,
          borderWidth: 1,
          borderColor: theme.deepViolet,
          shadowColor: theme.secondaryPurple,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 3,
        };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'secondary':
        return theme.textPrimary;
      case 'outline':
        return theme.electricPurple;
      case 'danger':
        return theme.statusError;
      case 'primary':
      default:
        return '#FFFFFF';
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 6, paddingHorizontal: 12 };
      case 'lg':
        return { paddingVertical: 15, paddingHorizontal: 22 };
      case 'md':
      default:
        return { paddingVertical: 12, paddingHorizontal: 16 };
    }
  };

  const getTextSizeStyle = (): TextStyle => {
    switch (size) {
      case 'sm':
        return { fontSize: 12 };
      case 'lg':
        return { fontSize: 15 };
      case 'md':
      default:
        return { fontSize: 14 };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.baseContainer,
        getContainerStyle(),
        getSizeStyle(),
        (disabled || loading) && styles.disabledContainer,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : theme.primaryPurple}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.baseText,
              { color: getTextColor() },
              getTextSizeStyle(),
              disabled && { color: theme.textMuted },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: 8,
  },
  disabledContainer: {
    opacity: 0.5,
  },
  baseText: {
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
