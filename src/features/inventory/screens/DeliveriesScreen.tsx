import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppIcon } from '../../../components/AppIcon';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenShell } from '../../../components/ScreenShell';
import { SelectPill } from '../../../components/SelectPill';
import { StatusBadge } from '../../../components/StatusBadge';
import { readableDate, updateDeliveryStatus } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { DeliveryStatus } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'Deliveries'>;

const statuses: DeliveryStatus[] = ['pending', 'out_for_delivery', 'delivered', 'cancelled'];
const ALL = '__all__';

const deliveryTone: Record<DeliveryStatus, 'pending' | 'processing' | 'completed' | 'cancelled'> = {
  pending: 'pending',
  out_for_delivery: 'processing',
  delivered: 'completed',
  cancelled: 'cancelled',
};

export function DeliveriesScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | typeof ALL | 'pending_only'>(
    'pending_only',
  );
  const [storeFilter, setStoreFilter] = useState('');

  const filteredDeliveries = useMemo(() => {
    return data.deliveries.filter(delivery => {
      const matchesStore = !storeFilter || delivery.storeId === storeFilter;
      const matchesStatus =
        statusFilter === ALL
          ? true
          : statusFilter === 'pending_only'
            ? delivery.status === 'pending' || delivery.status === 'out_for_delivery'
            : delivery.status === statusFilter;
      return matchesStore && matchesStatus;
    });
  }, [data.deliveries, statusFilter, storeFilter]);

  const pendingCount = data.deliveries.filter(
    d => d.status === 'pending' || d.status === 'out_for_delivery',
  ).length;

  return (
    <ScreenShell
      onBack={navigation.goBack}
      subtitle="Track customer, product, quantity, expected delivery date, and delivery status."
      title="Pending Deliveries">
      <View style={styles.summaryBanner}>
        <View style={styles.summaryIconWrap}>
          <AppIcon name="delivery" size={22} tintColor={colors.accent} />
        </View>
        <View style={styles.summaryTextWrap}>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Active deliveries awaiting completion</Text>
        </View>
      </View>

      <SelectPill
        label="Store Filter"
        onChange={value => setStoreFilter(value === ALL ? '' : value)}
        options={[
          { label: 'All Stores', value: ALL },
          ...data.stores.map(store => ({ label: store.name, value: store.id })),
        ]}
        value={storeFilter || ALL}
      />
      <SelectPill
        label="Delivery Status"
        onChange={value =>
          setStatusFilter(value as DeliveryStatus | typeof ALL | 'pending_only')
        }
        options={[
          { label: 'Pending Only', value: 'pending_only' },
          { label: 'All Statuses', value: ALL },
          ...statuses.map(status => ({ label: status.replaceAll('_', ' '), value: status })),
        ]}
        value={statusFilter}
      />

      {filteredDeliveries.length === 0 ? (
        <EmptyState
          icon="delivery"
          title="No deliveries found"
          subtitle="Adjust filters or book a new customer order."
        />
      ) : (
        filteredDeliveries.map(delivery => {
          const store = data.stores.find(row => row.id === delivery.storeId)?.name || 'Store';
          const linkedOrder = data.orders.find(order => order.id === delivery.orderId);
          return (
            <View key={delivery.id} style={styles.deliveryCard}>
              <View style={styles.deliveryHeader}>
                <View style={styles.customerWrap}>
                  <AppIcon name="user" size={16} tintColor={colors.accent} />
                  <Text style={styles.customerName}>{delivery.customerName}</Text>
                </View>
                <StatusBadge label={delivery.status.replaceAll('_', ' ')} tone={deliveryTone[delivery.status]} />
              </View>

              <View style={styles.productRow}>
                <AppIcon name="box" size={14} tintColor={colors.muted} />
                <Text style={styles.productText}>
                  {delivery.productName} × {delivery.quantity}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <AppIcon name="store" size={14} tintColor={colors.muted} />
                <Text style={styles.metaText}>{store}</Text>
              </View>

              <View style={styles.metaRow}>
                <AppIcon name="delivery" size={14} tintColor={colors.muted} />
                <Text style={styles.metaText}>
                  Due {delivery.expectedDeliveryDate || 'Not set'}
                  {linkedOrder?.customerPhone ? ` · ${linkedOrder.customerPhone}` : ''}
                </Text>
              </View>

              <Text style={styles.dateText}>{readableDate(delivery.createdAt)}</Text>

              <View style={styles.statusPickerWrap}>
                <SelectPill
                  label="Update Status"
                  onChange={value => updateDeliveryStatus(delivery, value as DeliveryStatus, profile)}
                  options={statuses.map(status => ({
                    label: status.replaceAll('_', ' '),
                    value: status,
                  }))}
                  value={delivery.status}
                />
              </View>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardTintBlue,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accentLight,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.accent,
  },
  summaryLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  deliveryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  customerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  customerName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    flex: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  productText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.inkSoft,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  metaText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    flex: 1,
  },
  dateText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  statusPickerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});
