import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Option = {
  label: string;
  value: string;
};

export function SelectPill({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  // ✅ If no options, don't render
  if (!options || options.length === 0) {
    return (
      <View style={styles.wrapper}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No options available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {options.map(option => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.pill,
                active && styles.active,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.text, active && styles.activeText]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  activeText: {
    color: colors.surface,
  },
  label: {
    color: colors.muted,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 8,
    marginLeft: 2,
  },
  pill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pressed: {
    opacity: 0.85,
  },
  scrollContent: {
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  text: {
    color: colors.inkSoft,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  wrapper: {
    marginBottom: 16,
  },
  emptyContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
});