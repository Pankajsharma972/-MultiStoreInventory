import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '../theme/typography';

type BadgeTone = 'pending' | 'processing' | 'completed' | 'cancelled' | 'warning' | 'danger' | 'success' | 'info';

const toneStyles: Record<BadgeTone, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#B45309' },
  processing: { bg: '#DBEAFE', text: '#1D4ED8' },
  completed: { bg: '#DCFCE7', text: '#15803D' },
  cancelled: { bg: '#FEE2E2', text: '#DC2626' },
  warning: { bg: '#FEF3C7', text: '#B45309' },
  danger: { bg: '#FEE2E2', text: '#DC2626' },
  success: { bg: '#DCFCE7', text: '#15803D' },
  info: { bg: '#E0E7FF', text: '#4338CA' },
};

export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const palette = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
