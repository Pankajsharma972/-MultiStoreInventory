import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionHeader } from '../../../components/SectionHeader';
import { SelectPill } from '../../../components/SelectPill';
import { createTransfer, readableDate } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Transfer'>;

export function TransferScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const [productId, setProductId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locationCode, setLocationCode] = useState('');

  const item = data.inventory.find(row => row.id === productId) || data.inventory[0];
  const activeToStoreId = toStoreId || data.stores[0]?.id || '';
  const toWarehouses = data.warehouses.filter(warehouse => warehouse.storeId === activeToStoreId);
  const activeToWarehouseId = toWarehouseId || toWarehouses[0]?.id || '';
  const toLocationOptions = data.locations.filter(
    location =>
      location.storeId === activeToStoreId && location.warehouseId === activeToWarehouseId,
  );

  const submit = async () => {
    if (!item) {
      return;
    }
    try {
      await createTransfer(
        item,
        {
          quantity: Number(quantity || 0),
          toStoreId: activeToStoreId,
          toWarehouseId: activeToWarehouseId,
          toLocationCode: locationCode || toLocationOptions[0]?.code || '',
        },
        profile,
      );
      setQuantity('');
      setLocationCode('');
      Alert.alert('Transferred', 'Stock transfer has been recorded.');
    } catch (error) {
      Alert.alert('Transfer failed', error instanceof Error ? error.message : 'Could not transfer stock.');
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="This section is available to administrators only."
        title="Stock Transfer">
        <EmptyState
          icon="transfer"
          title="Access restricted"
          subtitle="Only administrators can transfer stock between stores."
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      onBack={navigation.goBack}
      subtitle="Move inventory between warehouses or stores with complete transfer history."
      title="Stock Transfer">
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <View style={styles.formIconWrap}>
            <AppIcon name="transfer" size={20} tintColor="#7C3AED" />
          </View>
          <Text style={styles.formTitle}>New Transfer</Text>
        </View>

        <SelectPill
          label="Product"
          onChange={setProductId}
          options={data.inventory.map(row => ({
            label: `${row.name} (${row.quantity}) @ ${row.locationCode}`,
            value: row.id,
          }))}
          value={item?.id || ''}
        />

        {item ? (
          <View style={styles.sourceCard}>
            <Text style={styles.sourceLabel}>Source Location</Text>
            <Text style={styles.sourceName}>{item.name}</Text>
            <View style={styles.sourceMeta}>
              <AppIcon name="store" size={14} tintColor={colors.muted} />
              <Text style={styles.sourceMetaText}>
                {data.stores.find(store => store.id === item.storeId)?.name || 'Store'} /{' '}
                {data.warehouses.find(warehouse => warehouse.id === item.warehouseId)?.name || 'Warehouse'} /{' '}
                {item.locationCode}
              </Text>
            </View>
            <Text style={styles.availableQty}>{item.quantity} units available</Text>
          </View>
        ) : null}

        <SelectPill
          label="To Store"
          onChange={value => {
            setToStoreId(value);
            setToWarehouseId('');
            setLocationCode('');
          }}
          options={data.stores.map(store => ({ label: store.name, value: store.id }))}
          value={activeToStoreId}
        />
        <SelectPill
          label="To Warehouse"
          onChange={value => {
            setToWarehouseId(value);
            setLocationCode('');
          }}
          options={toWarehouses.map(warehouse => ({ label: warehouse.name, value: warehouse.id }))}
          value={activeToWarehouseId}
        />
        <SelectPill
          label="To Location"
          onChange={setLocationCode}
          options={Array.from(new Set(toLocationOptions.map(l => l.code))).map(code => ({
            label: code,
            value: code,
          }))}
          value={locationCode || toLocationOptions[0]?.code || ''}
        />
        <AppTextInput
          keyboardType="number-pad"
          label="Quantity"
          onChangeText={text => setQuantity(text.replace(/[^0-9]/g, ''))}
          placeholder="0"
          value={quantity}
        />
        <AppButton
          disabled={
            !item ||
            !activeToStoreId ||
            !activeToWarehouseId ||
            !(locationCode || toLocationOptions[0]?.code) ||
            !quantity
          }
          onPress={submit}
          title="Transfer Stock"
        />
      </View>

      <SectionHeader title="Transfer History" meta={`${data.transfers.length} records`} />

      {data.transfers.length === 0 ? (
        <EmptyState icon="transfer" title="No transfers yet" subtitle="Completed transfers will appear here." />
      ) : (
        data.transfers.map(transfer => {
          const fromStore = data.stores.find(store => store.id === transfer.fromStoreId)?.name;
          const toStore = data.stores.find(store => store.id === transfer.toStoreId)?.name;
          return (
            <View key={transfer.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <AppIcon name="transfer" size={16} tintColor="#7C3AED" />
                <Text style={styles.historyProduct}>{transfer.productName}</Text>
                <Text style={styles.historyQty}>×{transfer.quantity}</Text>
              </View>
              <Text style={styles.historyRoute}>
                {fromStore} {transfer.fromLocationCode} → {toStore} {transfer.toLocationCode}
              </Text>
              <Text style={styles.historyMeta}>
                {transfer.createdBy || 'System'} · {readableDate(transfer.createdAt)}
              </Text>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardTintPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.lg,
    color: colors.ink,
  },
  sourceCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sourceLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sourceName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  sourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sourceMetaText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    flex: 1,
  },
  availableQty: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  historyProduct: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    flex: 1,
  },
  historyQty: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: '#7C3AED',
  },
  historyRoute: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  historyMeta: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.muted,
  },
});
