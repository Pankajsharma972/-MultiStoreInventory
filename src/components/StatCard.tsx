import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type CaptionTone = 'positive' | 'neutral' | 'negative';

type StatCardProps = {
  label: string;
  value: string | number;
  caption?: string;
  captionTone?: CaptionTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const captionColor: Record<CaptionTone, string> = {
  positive: colors.primary,
  neutral: colors.muted,
  negative: colors.danger,
};

const captionPrefix: Record<CaptionTone, string> = {
  positive: '\u25B2 ',
  neutral: '',
  negative: '\u25B2 ',
};

export function StatCard({
  label,
  value,
  caption,
  captionTone = 'neutral',
  onPress,
  style,
}: StatCardProps) {
  const content = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {caption ? (
        <Text style={[styles.caption, { color: captionColor[captionTone] }]}>
          {captionPrefix[captionTone]}
          {caption}
        </Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxxl,
    color: colors.ink,
    marginTop: spacing.sm,
    letterSpacing: -0.5,
  },
  caption: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.sm,
  },
});
