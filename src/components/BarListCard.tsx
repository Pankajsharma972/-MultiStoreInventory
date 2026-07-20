import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type BarRow = {
  id: string;
  label: string;
  percent: number;
};

type BarListCardProps = {
  title: string;
  rows: BarRow[];
  emptyText?: string;
};

export function BarListCard({ title, rows, emptyText = 'No data yet.' }: BarListCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.divider} />
      {rows.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        rows.map(row => (
          <View key={row.id} style={styles.row}>
            <View style={styles.rowLabel}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.percent}>{row.percent}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(Math.min(row.percent, 100), 2)}%` }]} />
            </View>
          </View>
        ))
      )}
    </View>
  );
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
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  row: {
    marginBottom: spacing.md,
  },
  rowLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  percent: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  track: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.navyBar,
    borderRadius: 4,
  },
  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    paddingVertical: spacing.sm,
  },
});
