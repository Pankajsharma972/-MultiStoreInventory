import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { IconName } from '../theme/icons';

type ModuleCardProps = {
  title: string;
  subtitle?: string;
  icon: IconName;
  iconBg: string;
  iconTint: string;
  onPress: () => void;
  compact?: boolean;
};

export function ModuleCard({
  title,
  subtitle,
  icon,
  iconBg,
  iconTint,
  onPress,
  compact,
}: ModuleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.compactCard : styles.card,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <AppIcon name={icon} size={compact ? 20 : 22} tintColor={iconTint} />
      </View>
      <View style={styles.textWrap}>
        <Text style={compact ? styles.compactTitle : styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <AppIcon name="chevronRight" size={16} tintColor={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  compactCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 140,
    marginRight: spacing.sm,
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  compactTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.ink,
    textAlign: 'center',
    flex: 1,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
});
