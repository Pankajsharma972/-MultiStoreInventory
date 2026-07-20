import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { ScreenShell } from '../../../components/ScreenShell';
import { SelectPill } from '../../../components/SelectPill';
import { createOrder } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'BookOrder'>;

export function BookOrderScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productId, setProductId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [booking, setBooking] = useState(false);

  // Filter inventory based on selected store
  const activeStoreId = storeId || data.stores[0]?.id || '';
  const storeInventory = useMemo(
    () => data.inventory.filter(item => item.storeId === activeStoreId),
    [data.inventory, activeStoreId]
  );

  const product = useMemo(
    () => storeInventory.find(row => row.id === productId) || storeInventory[0],
    [storeInventory, productId]
  );

  const canBook = useMemo(() => {
    return (
      customerName.trim().length > 0 &&
      product !== undefined &&
      quantity.trim().length > 0 &&
      Number(quantity) > 0
    );
  }, [customerName, product, quantity]);

  const handleBookOrder = async () => {
    if (!canBook || !product) return;

    const qty = Number(quantity || 0);
    if (qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity.');
      return;
    }

    if (qty > product.quantity) {
      Alert.alert('Error', `Only ${product.quantity} items available in stock.`);
      return;
    }

    setBooking(true);

    try {
      await createOrder(
        {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          productId: product.id,
          productName: product.name,
          quantity: qty,
          storeId: product.storeId,
          expectedDeliveryDate: expectedDeliveryDate.trim(),
          createdAt: undefined,
        },
        profile,
        product
      );

      Alert.alert('Success', 'Order and pending delivery have been created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not book order.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <ScreenShell
      title="Book Order"
      subtitle="Book a customer order and schedule pending delivery."
      onBack={navigation.goBack}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <AppIcon name="shoppingBag" size={18} tintColor={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>New Customer Order</Text>
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
            placeholder="e.g. +1 234 567 890"
            value={customerPhone}
          />

          <SelectPill
            label="Assigned Store *"
            onChange={value => {
              setStoreId(value);
              setProductId('');
            }}
            options={data.stores.map(store => ({ label: store.name, value: store.id }))}
            value={activeStoreId}
          />

          <SelectPill
            label="Product *"
            onChange={setProductId}
            options={
              storeInventory.length > 0
                ? storeInventory.map(row => ({
                    label: `${row.name} (${row.quantity} available)`,
                    value: row.id,
                  }))
                : [{ label: 'No stock available in store', value: '' }]
            }
            value={product?.id || ''}
          />

          <AppTextInput
            keyboardType="number-pad"
            label="Quantity *"
            onChangeText={text => setQuantity(text.replace(/[^0-9]/g, ''))}
            placeholder="0"
            value={quantity}
          />

          <AppTextInput
            label="Expected Delivery Date"
            onChangeText={setExpectedDeliveryDate}
            placeholder="YYYY-MM-DD"
            value={expectedDeliveryDate}
          />
        </View>

        <View style={styles.actionContainer}>
          <AppButton
            disabled={!canBook || booking}
            onPress={handleBookOrder}
            title="Book Order"
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
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  actionContainer: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
});
