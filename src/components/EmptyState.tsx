import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { IconName } from '../theme/icons';

export function EmptyState({
  icon = 'box',
  title,
  subtitle,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <AppIcon name={icon} size={28} tintColor={colors.muted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
