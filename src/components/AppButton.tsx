import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type PressableProps,
} from 'react-native';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';

type AppButtonProps = PressableProps & {
  title: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: 'primary' | 'ghost' | 'danger';
};

export function AppButton({
  title,
  loading,
  variant = 'primary',
  disabled,
  style,
  textStyle,
  ...props
}: AppButtonProps) {
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isGhost && styles.ghost,
        isDanger && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.primary : colors.surface} />
      ) : (
        <Text style={[styles.text, isGhost && styles.ghostText, isDanger && styles.dangerText, textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...shadows.sm,
  },
  disabled: {
    opacity: 0.55,
  },
  ghost: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  ghostText: {
    color: colors.primary,
  },
  dangerText: {
    color: colors.surface,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: colors.surface,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
});
