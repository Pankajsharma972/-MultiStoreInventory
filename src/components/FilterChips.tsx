import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type FilterOption = {
  label: string;
  value: string;
};

export function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {options.map(option => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.chipPressed,
              ]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.muted,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: 2,
    textTransform: 'uppercase',
  },
  row: {
    gap: spacing.sm,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  chip: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    color: colors.inkSoft,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: colors.surface,
    fontFamily: typography.fontFamily.semiBold,
  },
});
