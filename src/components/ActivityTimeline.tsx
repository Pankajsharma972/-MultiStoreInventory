import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { ActivityLog } from '../types/models';

function formatActivityTime(value?: unknown) {
  const maybeTimestamp = value as { toDate?: () => Date } | undefined;
  const date = maybeTimestamp?.toDate?.();
  if (!date) return 'Recently';
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString()}, ${time}`;
}

type ActivityTimelineProps = {
  activity: ActivityLog[];
  onSeeAll?: () => void;
  limit?: number;
};

export function ActivityTimeline({ activity, onSeeAll, limit = 4 }: ActivityTimelineProps) {
  const rows = activity.slice(0, limit);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.divider} />
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <AppIcon name="history" size={22} tintColor={colors.muted} />
          <Text style={styles.emptyText}>No recent activity yet.</Text>
        </View>
      ) : (
        rows.map((log, index) => (
          <View key={log.id} style={styles.row}>
            <View style={styles.timeline}>
              <View style={styles.dot} />
              {index < rows.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.body}>
              <Text style={styles.action}>{log.action}</Text>
              <Text style={styles.time}>{formatActivityTime(log.createdAt)}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  seeAll: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.pillText,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeline: {
    alignItems: 'center',
    width: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.navy,
    marginTop: 2,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  action: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  time: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
  },
});
