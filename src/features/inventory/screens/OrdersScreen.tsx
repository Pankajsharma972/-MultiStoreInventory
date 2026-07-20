import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppIcon } from '../../../components/AppIcon';
import { EmptyState } from '../../../components/EmptyState';
import { FilterChips } from '../../../components/FilterChips';
import { ScreenShell } from '../../../components/ScreenShell';
import { SelectPill } from '../../../components/SelectPill';
import { StatusBadge } from '../../../components/StatusBadge';
import { readableDate, updateOrderStatus } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import type { AppStackParamList } from '../../../navigation/types';
import type { OrderStatus } from '../../../types/models';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';

type Props = NativeStackScreenProps<AppStackParamList, 'Orders'>;
const statuses: OrderStatus[] = ['pending', 'processing', 'completed', 'cancelled'];
const ALL = '__all__';

const statusTone: Record<OrderStatus, 'pending' | 'processing' | 'completed' | 'cancelled'> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  cancelled: 'cancelled',
};

export function OrdersScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const [storeId, setStoreId] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | typeof ALL>('pending');

  const filteredOrders = useMemo(() => {
    return data.orders.filter(order => {
      const matchesStatus = statusFilter === ALL || order.status === statusFilter;
      const matchesStore = storeId === '' || storeId === ALL || order.storeId === storeId;
      return matchesStatus && matchesStore;
    });
  }, [data.orders, statusFilter, storeId]);

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Filter pending, processing, completed, or cancelled customer orders."
      title="Pending Orders List">
      <FilterChips
        label="Store Filter"
        onChange={value => setStoreId(value === ALL ? '' : value)}
        options={[
          { label: 'All Stores', value: ALL },
          ...data.stores.map(store => ({ label: store.name, value: store.id })),
        ]}
        value={storeId || ALL}
      />
      <FilterChips
        label="Order Status"
        onChange={value => setStatusFilter(value as OrderStatus | typeof ALL)}
        options={[
          { label: 'All Statuses', value: ALL },
          ...statuses.map(status => ({ label: status.replaceAll('_', ' '), value: status })),
        ]}
        value={statusFilter}
      />

      {filteredOrders.length === 0 ? (
        <EmptyState icon="shoppingBag" title="No orders found" subtitle="Adjust filters or book a new customer order." />
      ) : (
        filteredOrders.map(order => {
          const store = data.stores.find(row => row.id === order.storeId)?.name || 'Store';
          return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.orderTitleWrap}>
                  <AppIcon name="shoppingBag" size={16} tintColor={colors.accent} />
                  <Text style={styles.customerName}>{order.customerName}</Text>
                </View>
                <StatusBadge label={order.status} tone={statusTone[order.status]} />
              </View>
              <Text style={styles.itemDetail}>
                {order.productName} × {order.quantity}
              </Text>
              <View style={styles.metaRow}>
                <AppIcon name="store" size={14} tintColor={colors.muted} />
                <Text style={styles.metaText}>{store}</Text>
              </View>
              <View style={styles.metaRow}>
                <AppIcon name="delivery" size={14} tintColor={colors.muted} />
                <Text style={styles.metaText}>
                  {order.deliveryStatus.replaceAll('_', ' ')} · Due {order.expectedDeliveryDate || 'Not set'}
                </Text>
              </View>
              <Text style={styles.metaTextMuted}>{readableDate(order.createdAt)}</Text>
              <View style={styles.statusPickerWrap}>
                <SelectPill
                  label="Change Status"
                  onChange={value => updateOrderStatus(order, value as OrderStatus, profile)}
                  options={statuses.map(status => ({ label: status.replaceAll('_', ' '), value: status }))}
                  value={order.status}
                />
              </View>
            </View>
          );
        })
      )}
      <Pressable
        onPress={() => navigation.navigate('BookOrder')}
        style={styles.fab}>
        <AppIcon name="plus" size={24} tintColor="#FFFFFF" />
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  orderTitleWrap: {
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
  itemDetail: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
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
  metaTextMuted: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  statusPickerWrap: {
    marginTop: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    elevation: 8,
  },
});
