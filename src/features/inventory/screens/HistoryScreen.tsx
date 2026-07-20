import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { EmptyState } from '../../../components/EmptyState';
import { FilterChips } from '../../../components/FilterChips';
import { ScreenShell } from '../../../components/ScreenShell';
import { readableDate } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { ActivityAction } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'History'>;

const ALL = '__all__';
const actionFilters: Array<{ label: string; value: ActivityAction | typeof ALL }> = [
  { label: 'All Actions', value: ALL },
  { label: 'Product Created', value: 'Product Created' },
  { label: 'Stock Added', value: 'Stock Added' },
  { label: 'Stock Updated', value: 'Stock Updated' },
  { label: 'Stock Removed', value: 'Stock Removed' },
  { label: 'Stock Transfer', value: 'Stock Transfer' },
  { label: 'Stock Moved', value: 'Stock Moved' },
  { label: 'Order Created', value: 'Order Created' },
  { label: 'Order Updated', value: 'Order Updated' },
  { label: 'Delivery Completed', value: 'Delivery Completed' },
  { label: 'Delivery Updated', value: 'Delivery Updated' },
];

function actionIcon(action: string): 'box' | 'transfer' | 'shoppingBag' | 'delivery' | 'activity' {
  if (action.includes('Transfer') || action.includes('Moved')) return 'transfer';
  if (action.includes('Order')) return 'shoppingBag';
  if (action.includes('Delivery')) return 'delivery';
  if (action.includes('Product') || action.includes('Stock')) return 'box';
  return 'activity';
}

export function HistoryScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<ActivityAction | typeof ALL>(ALL);
  const [storeFilter, setStoreFilter] = useState('');

  const filteredActivity = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.activity.filter(log => {
      const matchesText =
        !text ||
        [log.action, log.detail, log.createdBy]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(text);
      const matchesAction = actionFilter === ALL || log.action === actionFilter;
      const matchesStore = !storeFilter || log.storeId === storeFilter;
      return matchesText && matchesAction && matchesStore;
    });
  }, [actionFilter, data.activity, query, storeFilter]);

  if (profile?.role !== 'admin') {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="This section is available to administrators only."
        title="Activity History">
        <EmptyState
          icon="history"
          title="Access restricted"
          subtitle="Only administrators can view the full activity history."
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      onBack={navigation.goBack}
      subtitle="Every product, stock, transfer, order, and delivery action is logged for traceability."
      title="Activity History">
      <View style={styles.searchWrap}>
        <AppIcon name="search" size={18} tintColor={colors.muted} style={styles.searchIcon} />
        <AppTextInput
          label="Search History"
          onChangeText={setQuery}
          placeholder="Product, action, user..."
          value={query}
        />
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
        label="Action Filter"
        onChange={value => setActionFilter(value as ActivityAction | typeof ALL)}
        options={actionFilters.map(filter => ({ label: filter.label, value: filter.value }))}
        value={actionFilter}
      />

      <Text style={styles.resultCount}>
        {filteredActivity.length} {filteredActivity.length === 1 ? 'entry' : 'entries'}
      </Text>

      {filteredActivity.length === 0 ? (
        <EmptyState icon="history" title="No activity found" subtitle="Try adjusting your search or filters." />
      ) : (
        filteredActivity.map(log => (
          <View key={log.id} style={styles.timelineRow}>
            <View style={styles.timelineLine}>
              <View style={styles.timelineDot} />
            </View>
            <View style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={styles.logIconWrap}>
                  <AppIcon name={actionIcon(log.action)} size={16} tintColor={colors.accent} />
                </View>
                <Text style={styles.logAction}>{log.action}</Text>
              </View>
              <Text style={styles.logDetail}>{log.detail}</Text>
              <View style={styles.logMeta}>
                <AppIcon name="user" size={12} tintColor={colors.muted} />
                <Text style={styles.logMetaText}>
                  {log.createdBy || 'System'} · {readableDate(log.createdAt)}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    right: 16,
    top: 38,
    zIndex: 1,
  },
  resultCount: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timelineLine: {
    width: 24,
    alignItems: 'center',
    paddingTop: 18,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  logCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  logIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cardTintBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logAction: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    flex: 1,
  },
  logDetail: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logMetaText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.muted,
  },
});
