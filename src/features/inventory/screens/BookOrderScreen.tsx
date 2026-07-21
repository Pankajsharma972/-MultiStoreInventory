import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { ProductThumbnail } from '../../../components/ProductThumbnail';
import { ScreenShell } from '../../../components/ScreenShell';
import { SelectPill } from '../../../components/SelectPill';
import { createOrder } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { clearCart, setCartQuantity } from '../../../store/slices/cartSlice';
import {
  glazeLabel,
  inventorySearchText,
  matchesSearch,
} from '../../../utils/inventoryHelpers';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { InventoryItem, OrderLineItem } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'BookOrder'>;

export function BookOrderScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();

  const dispatch = useAppDispatch();
  const cart = useAppSelector(state => state.cart.items);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [storeId, setStoreId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [query, setQuery] = useState('');
  const [booking, setBooking] = useState(false);

  const activeStoreId = storeId || data.stores[0]?.id || '';

  const storeInventory = useMemo(
    () => data.inventory.filter(item => item.storeId === activeStoreId),
    [data.inventory, activeStoreId],
  );

  const searchResults = useMemo(() => {
    return storeInventory.filter(item => {
      const warehouse = data.warehouses.find(row => row.id === item.warehouseId);
      return matchesSearch(inventorySearchText(item, [warehouse?.name || '']), query);
    });
  }, [storeInventory, data.warehouses, query]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const item = data.inventory.find(row => row.id === productId);
        return item ? { item, qty } : null;
      })
      .filter((entry): entry is { item: InventoryItem; qty: number } => entry !== null);
  }, [cart, data.inventory]);

  const totalUnits = cartLines.reduce((sum, line) => sum + line.qty, 0);

  const setQty = (productId: string, qty: number, available: number) => {
    const clamped = Math.max(0, Math.min(qty, available));
    dispatch(setCartQuantity({ productId, quantity: clamped }));
  };

  const canBook = customerName.trim().length > 0 && cartLines.length > 0;

  const handleBookOrder = async () => {
    if (!canBook) {
      return;
    }
    const items: OrderLineItem[] = cartLines.map(({ item, qty }) => ({
      productId: item.id,
      productName: item.name,
      quantity: qty,
      brand: item.brand || '',
      size: item.size || '',
      photoUrl: item.photoUrl || '',
    }));

    setBooking(true);
    try {
      await createOrder(
        {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          storeId: activeStoreId,
          expectedDeliveryDate: expectedDeliveryDate.trim(),
          items,
        },
        profile,
      );
      dispatch(clearCart());
      Alert.alert('Order placed', 'Stock has been deducted and the order is now in the orders list.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Could not place order.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <ScreenShell
      title="Book Order"
      subtitle="Search designs, add multiple to the order, then place it."
      onBack={navigation.goBack}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Customer details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <AppIcon name="shoppingBag" size={18} tintColor={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Customer</Text>
          </View>

          <AppTextInput
            label="Customer Name *"
            onChangeText={setCustomerName}
            placeholder="e.g. John Doe"
            value={customerName}
          />
          <AppTextInput
            keyboardType="phone-pad"
            label="Phone"
            onChangeText={setCustomerPhone}
            placeholder="e.g. +91 98765 43210"
            value={customerPhone}
          />
          <SelectPill
            label="Store *"
            onChange={value => {
              setStoreId(value);
              dispatch(clearCart());
            }}
            options={data.stores.map(store => ({ label: store.name, value: store.id }))}
            value={activeStoreId}
          />
          <AppTextInput
            label="Expected Delivery Date"
            onChangeText={setExpectedDeliveryDate}
            placeholder="YYYY-MM-DD"
            value={expectedDeliveryDate}
          />
        </View>

        {/* Design search + add */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <AppIcon name="search" size={18} tintColor={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Add Designs</Text>
          </View>

          <View style={styles.searchRow}>
            <AppIcon name="search" size={16} tintColor={colors.muted} />
            <AppTextInput
              label=""
              onChangeText={setQuery}
              placeholder="Type initials e.g. LB · name, SKU…"
              value={query}
              style={styles.searchInput}
            />
          </View>

          {searchResults.length === 0 ? (
            <Text style={styles.emptyText}>No matching designs in this store.</Text>
          ) : (
            searchResults.map(item => {
              const warehouse = data.warehouses.find(row => row.id === item.warehouseId);
              const inCart = cart[item.id] || 0;
              const outOfStock = item.quantity <= 0;
              return (
                <View key={item.id} style={styles.resultRow}>
                  <ProductThumbnail uri={item.photoUrl} size={48} />
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {item.brand ? `${item.brand} · ` : ''}
                      {item.size ? `Size ${item.size} · ` : ''}
                      {item.glaze ? `${glazeLabel(item.glaze)} · ` : ''}
                      {warehouse?.name || 'Godown'} · {item.locationCode}
                    </Text>
                    <Text style={[styles.resultQty, outOfStock && styles.resultQtyOut]}>
                      {outOfStock ? 'Out of stock' : `${item.quantity} available`}
                    </Text>
                  </View>
                  {inCart > 0 ? (
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => setQty(item.id, inCart - 1, item.quantity)}
                        style={styles.stepBtn}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepValue}>{inCart}</Text>
                      <Pressable
                        onPress={() => setQty(item.id, inCart + 1, item.quantity)}
                        style={styles.stepBtn}>
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      disabled={outOfStock}
                      onPress={() => setQty(item.id, 1, item.quantity)}
                      style={[styles.addBtn, outOfStock && styles.addBtnDisabled]}>
                      <AppIcon name="plus" size={14} tintColor={colors.surface} />
                      <Text style={styles.addBtnText}>Add</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Cart */}
        {cartLines.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <AppIcon name="box" size={18} tintColor={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>
                Order Items ({cartLines.length}) · {totalUnits} units
              </Text>
            </View>
            {cartLines.map(({ item, qty }) => (
              <View key={item.id} style={styles.cartLine}>
                <ProductThumbnail uri={item.photoUrl} size={40} radius={10} />
                <View style={styles.cartLineInfo}>
                  <Text style={styles.cartLineName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cartLineMeta}>× {qty}</Text>
                </View>
                <Pressable onPress={() => setQty(item.id, 0, item.quantity)} hitSlop={8}>
                  <AppIcon name="trash" size={16} tintColor={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actionContainer}>
          <AppButton
            disabled={!canBook || booking}
            onPress={handleBookOrder}
            title={booking ? 'Placing…' : `Place Order (${totalUnits})`}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl + spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
  },
  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  resultMeta: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  resultQty: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    marginTop: 2,
  },
  resultQtyOut: {
    color: colors.danger,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  addBtnDisabled: {
    backgroundColor: colors.muted,
    opacity: 0.6,
  },
  addBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.surface,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  stepBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.primary,
  },
  stepValue: {
    minWidth: 22,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cartLineInfo: {
    flex: 1,
  },
  cartLineName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  cartLineMeta: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  actionContainer: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
});
