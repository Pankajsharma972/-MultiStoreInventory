import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type StoreFilterPillProps = {
  label: string;
  onPress?: () => void;
};

export function StoreFilterPill({ label, onPress }: StoreFilterPillProps) {
  const Wrapper: typeof Pressable | typeof View = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.pill} onPress={onPress}>
      <Text style={styles.emoji}>{'\uD83D\uDCDA'}</Text>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.pillBg,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emoji: {
    fontSize: 15,
  },
  text: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.pillText,
    flexShrink: 1,
  },
});
