import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppIcon } from '../../../components/AppIcon';
import { EmptyState } from '../../../components/EmptyState';
import { FilterChips } from '../../../components/FilterChips';
import { ScreenShell } from '../../../components/ScreenShell';
import { StatusBadge } from '../../../components/StatusBadge';
import { useInventoryData } from '../../../services/useInventoryData';
import { getStockAlertLevel, stockAlertLabel } from '../../../utils/inventoryHelpers';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { StockAlertLevel } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'LowStock'>;

const ALL = '__all__';
const alertFilters: Array<{ label: string; value: StockAlertLevel | typeof ALL }> = [
  { label: 'All Alerts', value: ALL },
  { label: 'Low Stock', value: 'low' },
  { label: 'Critical Stock', value: 'critical' },
  { label: 'Out of Stock', value: 'out_of_stock' },
];

function alertTone(level: StockAlertLevel): 'warning' | 'danger' {
  return level === 'out_of_stock' || level === 'critical' ? 'danger' : 'warning';
}

export function LowStockAlertsScreen({ navigation }: Props) {
  const data = useInventoryData();
  const [storeFilter, setStoreFilter] = useState('');
  const [alertFilter, setAlertFilter] = useState<StockAlertLevel | typeof ALL>(ALL);

  const filteredItems = useMemo(() => {
    return data.lowStockItems.filter(item => {
      const level = getStockAlertLevel(item);
      const matchesStore = !storeFilter || item.storeId === storeFilter;
      const matchesAlert = alertFilter === ALL || level === alertFilter;
      return matchesStore && matchesAlert;
    });
  }, [alertFilter, data.lowStockItems, storeFilter]);

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Monitor low stock, critical stock, and out-of-stock items across all stores."
      title="Stock Alerts">
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryLow]}>
          <AppIcon name="alertCircle" size={18} tintColor={colors.warning} />
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{data.stats.lowStock}</Text>
          <Text style={styles.summaryLabel}>Low Stock</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCritical]}>
          <AppIcon name="alertCircle" size={18} tintColor={colors.danger} />
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{data.stats.criticalStock}</Text>
          <Text style={styles.summaryLabel}>Critical</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCritical]}>
          <AppIcon name="box" size={18} tintColor={colors.danger} />
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{data.stats.outOfStock}</Text>
          <Text style={styles.summaryLabel}>Out of Stock</Text>
        </View>
      </View>

      <FilterChips
        label="Store Filter"
        onChange={value => setStoreFilter(value === ALL ? '' : value)}
        options={[
          { label: 'All Stores', value: ALL },
          ...data.stores.map(store => ({ label: store.name, value: store.id })),
        ]}
        value={storeFilter || ALL}
      />
      <FilterChips
        label="Alert Level"
        onChange={value => setAlertFilter(value as StockAlertLevel | typeof ALL)}
        options={alertFilters.map(filter => ({ label: filter.label, value: filter.value }))}
        value={alertFilter}
      />

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="check"
          title="No alerts"
          subtitle="All filtered inventory is above minimum stock levels."
        />
      ) : (
        filteredItems.map(item => {
          const store = data.stores.find(row => row.id === item.storeId)?.name || 'Store';
          const warehouse = data.warehouses.find(row => row.id === item.warehouseId)?.name || 'Warehouse';
          const level = getStockAlertLevel(item);
          return (
            <View key={item.id} style={[styles.alertCard, level !== 'low' && styles.alertCardCritical]}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertName}>{item.name}</Text>
                <StatusBadge label={stockAlertLabel(level)} tone={alertTone(level)} />
              </View>
              <View style={styles.metaRow}>
                <AppIcon name="store" size={14} tintColor={colors.muted} />
                <Text style={styles.metaText}>
                  {store} · {warehouse} · {item.locationCode}
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <View style={styles.qtyBlock}>
                  <Text style={styles.qtyLabel}>Current</Text>
                  <Text style={[styles.qtyValue, level !== 'low' && styles.qtyDanger]}>{item.quantity}</Text>
                </View>
                <View style={styles.qtyDivider} />
                <View style={styles.qtyBlock}>
                  <Text style={styles.qtyLabel}>Minimum</Text>
                  <Text style={styles.qtyValue}>{item.minimumQuantity}</Text>
                </View>
                <View style={styles.qtyDivider} />
                <View style={styles.qtyBlock}>
                  <Text style={styles.qtyLabel}>Size</Text>
                  <Text style={styles.qtyValue}>{item.size || '—'}</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    ...shadows.sm,
  },
  summaryLow: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  summaryCritical: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  summaryValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
  },
  summaryLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  alertCardCritical: {
    borderColor: '#FECACA',
    borderLeftColor: colors.danger,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  alertName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metaText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    flex: 1,
  },
  qtyRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm,
  },
  qtyBlock: {
    flex: 1,
    alignItems: 'center',
  },
  qtyDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  qtyLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.muted,
    marginBottom: 2,
  },
  qtyValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  qtyDanger: {
    color: colors.danger,
  },
});
