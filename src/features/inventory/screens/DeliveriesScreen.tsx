import React, { useMemo, useState, useEffect } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppIcon } from '../../../components/AppIcon';
import { EmptyState } from '../../../components/EmptyState';
import { FilterChips } from '../../../components/FilterChips';
import { ProductThumbnail } from '../../../components/ProductThumbnail';
import { PhotoPickerField } from '../../../components/PhotoPickerField';
import { ScreenShell } from '../../../components/ScreenShell';
import { SelectPill } from '../../../components/SelectPill';
import { StatusBadge } from '../../../components/StatusBadge';
import { approveDispatch, readableDate, updateDeliveryStatus } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import {
  orderStatusFlow,
  orderStatusLabel,
  orderStatusTone,
  resolveOrderItems,
} from '../../../utils/inventoryHelpers';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { DeliveryStatus } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'Deliveries'>;

const statuses: DeliveryStatus[] = orderStatusFlow;
const ALL = '__all__';

export function DeliveriesScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | typeof ALL | 'pending_only'>(
    'pending_only',
  );
  const [storeFilter, setStoreFilter] = useState('');
  const [truckPhotos, setTruckPhotos] = useState<Record<string, string>>({});
  const [dispatchQty, setDispatchQty] = useState<Record<string, Record<string, string>>>({});
  const canSupervise = profile?.role === 'supervisor';
  const canApproveAccounts = profile?.role === 'accountant';

  // ✅ Real-time data update ke liye useEffect
  useEffect(() => {
    // Data automatically updates via useInventoryData
    // No need to do anything, just log for debugging
    console.log('🔄 Deliveries updated:', data.deliveries.length);
  }, [data.deliveries]);

  const submitDispatch = async (delivery: typeof data.deliveries[0]) => {
    try {
      const quantityMap = dispatchQty[delivery.id] || {};
      await approveDispatch(
        delivery,
        {
          truckPhotoUrl: truckPhotos[delivery.id] || delivery.truckPhotoUrl || '',
          items: resolveOrderItems(delivery).map(item => ({
            ...item,
            dispatchQuantity: Number(quantityMap[item.productId] || 0),
          })),
        },
        profile,
      );
      setDispatchQty(current => ({ ...current, [delivery.id]: {} }));
      // ✅ Clear truck photo after successful dispatch
      setTruckPhotos(current => ({ ...current, [delivery.id]: '' }));
      Alert.alert('Dispatch approved', 'Delivery quantities and truck photo have been saved.');
    } catch (error) {
      Alert.alert('Dispatch failed', (error as Error).message || 'Could not approve dispatch.');
    }
  };

  const handleDeliveryStatusChange = async (
    delivery: typeof data.deliveries[0],
    status: DeliveryStatus,
  ) => {
    try {
      await updateDeliveryStatus(delivery, status, profile);
      Alert.alert('Success', `Delivery status updated to ${orderStatusLabel(status)}`);
    } catch (error) {
      Alert.alert('Status not allowed', (error as Error).message || 'Could not update delivery status.');
    }
  };

  const filteredDeliveries = useMemo(() => {
    return data.deliveries.filter(delivery => {
      const matchesStore = !storeFilter || delivery.storeId === storeFilter;
      const matchesStatus =
        statusFilter === ALL
          ? true
          : statusFilter === 'pending_only'
            ? delivery.status !== 'delivered' && delivery.status !== 'cancelled'
            : delivery.status === statusFilter;
      return matchesStore && matchesStatus;
    });
  }, [data.deliveries, statusFilter, storeFilter]);

  const pendingCount = data.deliveries.filter(
    d => d.status !== 'delivered' && d.status !== 'cancelled',
  ).length;

  // ✅ Accounts ke liye sirf delivered aur cancelled options
  const getStatusOptionsForRole = (delivery: typeof data.deliveries[0]) => {
    let availableStatuses = [...statuses];
    
    // Remove out_for_delivery (handled by supervisor)
    availableStatuses = availableStatuses.filter(status => status !== 'out_for_delivery');
    
    if (canApproveAccounts) {
      // ✅ Accounts: Sirf delivered aur cancelled
      availableStatuses = availableStatuses.filter(
        status => status === 'delivered' || status === 'cancelled'
      );
      
      // ✅ Delivered only if pending quantity is 0
      if (Number(delivery.pendingQuantity || 0) > 0) {
        availableStatuses = availableStatuses.filter(status => status !== 'delivered');
      }
    } else {
      // Non-accounts: Sirf ordered, billed, partially_delivered
      availableStatuses = availableStatuses.filter(
        status => status === 'ordered' || status === 'billed' || status === 'partially_delivered'
      );
    }
    
    // Current status ko remove karo
    availableStatuses = availableStatuses.filter(status => status !== delivery.status);
    
    return availableStatuses.map(status => ({
      label: orderStatusLabel(status),
      value: status,
    }));
  };

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
        label="Delivery Status"
        onChange={value =>
          setStatusFilter(value as DeliveryStatus | typeof ALL | 'pending_only')
        }
        options={[
          { label: 'Active Only', value: 'pending_only' },
          { label: 'All Statuses', value: ALL },
          ...statuses.map(status => ({ label: orderStatusLabel(status), value: status })),
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
          
          // ✅ Check if truck photo exists (from Firestore or local upload)
          const truckPhotoUrl = truckPhotos[delivery.id] || delivery.truckPhotoUrl || '';
          
          return (
            <View key={delivery.id} style={styles.deliveryCard}>
              <View style={styles.deliveryHeader}>
                <View style={styles.customerWrap}>
                  <AppIcon name="user" size={16} tintColor={colors.accent} />
                  <Text style={styles.customerName}>{delivery.customerName}</Text>
                </View>
                <StatusBadge
                  label={orderStatusLabel(delivery.status)}
                  tone={orderStatusTone(delivery.status)}
                />
              </View>

              {resolveOrderItems(delivery).map((line, index) => (
                <View key={`${line.productId}-${index}`} style={styles.productRow}>
                  <ProductThumbnail uri={line.photoUrl} size={32} radius={8} />
                  <Text style={styles.productText} numberOfLines={1}>
                    {line.productName}
                    {line.brand ? ` · ${line.brand}` : ''} × {line.quantity}
                  </Text>
                </View>
              ))}

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

              {/* ✅ Truck Photo Display - Shows if exists */}
              {truckPhotoUrl ? (
                <View style={styles.truckPhotoWrap}>
                  <Text style={styles.truckPhotoLabel}>📸 Truck Loading Photo</Text>
                  <Image 
                    source={{ uri: truckPhotoUrl }} 
                    style={styles.truckPhoto}
                    resizeMode="cover"
                    onError={() => console.log('❌ Failed to load truck photo')}
                  />
                </View>
              ) : null}

              {canSupervise && (delivery.status === 'billed' || delivery.status === 'partially_delivered') ? (
                <View style={styles.dispatchBox}>
                  <PhotoPickerField
                    label="Truck Loading Photo"
                    required
                    value={truckPhotos[delivery.id] || delivery.truckPhotoUrl || ''}
                    onChange={url => setTruckPhotos(current => ({ ...current, [delivery.id]: url }))}
                  />
                  {resolveOrderItems(delivery).map(line => {
                    const pending = Number(line.pendingQuantity ?? line.quantity ?? 0);
                    return (
                      <View key={`dispatch-${line.productId}`} style={styles.dispatchRow}>
                        <View style={styles.dispatchTextWrap}>
                          <Text style={styles.dispatchName} numberOfLines={1}>{line.productName}</Text>
                          <Text style={styles.dispatchHint}>Pending {pending}</Text>
                        </View>
                        <TextInput
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colors.muted}
                          style={styles.quantityInput}
                          value={dispatchQty[delivery.id]?.[line.productId] || ''}
                          onChangeText={text =>
                            setDispatchQty(current => ({
                              ...current,
                              [delivery.id]: {
                                ...(current[delivery.id] || {}),
                                [line.productId]: text.replace(/[^0-9]/g, ''),
                              },
                            }))
                          }
                        />
                      </View>
                    );
                  })}
                  <Pressable style={styles.dispatchButton} onPress={() => submitDispatch(delivery)}>
                    <AppIcon name="delivery" size={16} tintColor="#FFFFFF" />
                    <Text style={styles.dispatchButtonText}>Approve Dispatch</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.statusPickerWrap}>
                <SelectPill
                  label="Update Status"
                  onChange={value => handleDeliveryStatusChange(delivery, value as DeliveryStatus)}
                  options={getStatusOptionsForRole(delivery)}
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
    flex: 1,
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
  dispatchBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  dispatchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dispatchTextWrap: {
    flex: 1,
  },
  dispatchName: {
    color: colors.ink,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
  },
  dispatchHint: {
    color: colors.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  quantityInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.fontFamily.semiBold,
    minWidth: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    textAlign: 'center',
  },
  truckPhotoWrap: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  truckPhotoLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  truckPhoto: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  dispatchButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  dispatchButtonText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
  },
  statusPickerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});