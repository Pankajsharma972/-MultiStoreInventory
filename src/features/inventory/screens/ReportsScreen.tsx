import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarListCard } from '../../../components/BarListCard';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionHeader } from '../../../components/SectionHeader';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useInventoryData } from '../../../services/useInventoryData';
import type { AppStackParamList } from '../../../navigation/types';
import type { CustomerOrder } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'Reports'>;

function orderDate(order: CustomerOrder): Date | null {
  const maybe = order.createdAt as { toDate?: () => Date } | undefined;
  return maybe?.toDate?.() ?? null;
}

export function ReportsScreen({ navigation }: Props) {
  const data = useInventoryData();

  const totalUnits = useMemo(
    () => data.inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [data.inventory],
  );

  const storeRows = useMemo(() => {
    return data.stores
      .map(store => {
        const units = data.inventory
          .filter(item => item.storeId === store.id)
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return {
          id: store.id,
          label: store.name,
          percent: totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0,
        };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [data.stores, data.inventory, totalUnits]);

  const monthlyOrders = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString('en-US', { month: 'short' }),
        count: 0,
      });
    }
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    data.orders.forEach(order => {
      const d = orderDate(order);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const i = index.get(key);
      if (i !== undefined) buckets[i].count += 1;
    });
    return buckets;
  }, [data.orders]);

  const maxCount = Math.max(...monthlyOrders.map(b => b.count), 1);

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Store-wise inventory value and monthly order trends."
      title="Reports">
      <SectionHeader title="Inventory Value by Store" />
      <BarListCard
        title="Share of total units"
        rows={storeRows}
        emptyText="No inventory data yet."
      />

      <SectionHeader title="Orders This Month" />
      <View style={styles.chartCard}>
        <View style={styles.chartRow}>
          {monthlyOrders.map(bucket => (
            <View key={bucket.key} style={styles.chartCol}>
              <Text style={styles.chartValue}>{bucket.count}</Text>
              <View style={styles.chartTrack}>
                <View
                  style={[
                    styles.chartFill,
                    { height: `${Math.max((bucket.count / maxCount) * 100, 4)}%` },
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{bucket.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  chartValue: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
  },
  chartTrack: {
    width: 22,
    height: 120,
    backgroundColor: colors.background,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartFill: {
    width: '100%',
    backgroundColor: colors.navyBar,
    borderRadius: 6,
  },
  chartLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.inkSoft,
  },
});
