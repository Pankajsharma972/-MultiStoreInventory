import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { IconName } from '../theme/icons';

type AppBarProps = {
  title: string;
  leftIcon?: IconName;
  onLeftPress?: () => void;
  rolePill?: string;
  rightSlot?: React.ReactNode;
};

export function AppBar({ title, leftIcon, onLeftPress, rolePill, rightSlot }: AppBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {leftIcon ? (
          <Pressable onPress={onLeftPress} style={styles.iconButton} hitSlop={8}>
            <AppIcon name={leftIcon} size={20} tintColor={colors.ink} />
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {rightSlot ? (
        rightSlot
      ) : rolePill ? (
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>{rolePill}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.ink,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  rolePill: {
    backgroundColor: colors.pillBg,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  rolePillText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.pillText,
  },
});
