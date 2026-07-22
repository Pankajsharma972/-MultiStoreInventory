import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { ProductThumbnail } from '../../../components/ProductThumbnail';
import { ScreenShell } from '../../../components/ScreenShell';
import { Dropdown } from '../../../components/Dropdown';
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

// Calendar icon from assets
const calendarIcon = require('../../../assets/calendar.png');

// Formats a Date object to YYYY-MM-DD for storage/display
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Get today's date as string
function getTodayDate(): string {
  return formatDate(new Date());
}

// Get date 7 days from now as string (default preset)
function getDefaultDeliveryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return formatDate(date);
}

export function BookOrderScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();

  const dispatch = useAppDispatch();
  const cart = useAppSelector(state => state.cart.items);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [storeId, setStoreId] = useState('');
  // Default delivery date = 7 days from today
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(getDefaultDeliveryDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const handleDateChange = (event: any, selected?: Date) => {
    // On Android the picker closes itself after a pick/dismiss
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed') {
      return;
    }
    if (selected) {
      setExpectedDeliveryDate(formatDate(selected));
    }
  };

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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
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
            <Dropdown
              label="Store *"
              placeholder="Select a store"
              value={activeStoreId}
              onChange={value => {
                setStoreId(value);
                dispatch(clearCart());
              }}
              options={data.stores.map(store => ({ label: store.name, value: store.id }))}
              emptyText="No stores available"
            />

            {/* Expected Delivery Date — with calendar icon on right side - CENTERED */}
            <View style={styles.dateInputWrapper}>
              <AppTextInput
                label="Expected Delivery Date"
                onChangeText={setExpectedDeliveryDate}
                placeholder="YYYY-MM-DD"
                value={expectedDeliveryDate}
                style={styles.dateInputField}
                editable={false}
                pointerEvents="none"
              />
              <Pressable
                style={styles.calendarTapArea}
                onPress={() => setShowDatePicker(true)}
                hitSlop={8}>
                <Image source={calendarIcon} style={styles.calendarIcon} />
              </Pressable>
            </View>

            {showDatePicker ? (
              <DateTimePicker
                value={expectedDeliveryDate ? new Date(expectedDeliveryDate) : new Date()}
                mode="date"
                minimumDate={new Date()} // Past dates disabled
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
              />
            ) : null}

            {Platform.OS === 'ios' && showDatePicker ? (
              <View style={styles.iosDatePickerActions}>
                <Pressable onPress={() => setShowDatePicker(false)} style={styles.iosDateDoneBtn}>
                  <Text style={styles.iosDateDoneText}>Done</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Design search + add */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <AppIcon name="search" size={18} tintColor={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Add Designs</Text>
            </View>

            {/* Search with icon on RIGHT side */}
            <View style={styles.searchWrapper}>
              <TextInput
                style={styles.searchInputField}
                placeholder="Type initials e.g. LB · name, SKU…"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                blurOnSubmit={false}
              />
              <AppIcon 
                name="search" 
                size={18} 
                tintColor={colors.muted} 
                style={styles.searchIconRight} 
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
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  // Search bar: icon on RIGHT side
  searchWrapper: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  searchIconRight: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: [{ translateY: -9 }],
    zIndex: 1,
  },
  searchInputField: {
    height: 48,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingRight: 44,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.ink,
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
  // Date Input Styles - Calendar icon CENTERED
  dateInputWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  dateInputField: {
    paddingRight: 50,
  },
  calendarTapArea: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calendarIcon: {
    width: 24,
    height: 24,
    tintColor: colors.primary,
    resizeMode: 'contain',
  },
  iosDatePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  iosDateDoneBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  iosDateDoneText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
  },
});