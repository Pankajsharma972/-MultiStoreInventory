import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { Dropdown } from '../../../components/Dropdown';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenShell } from '../../../components/ScreenShell';
import { addActivity, saveLocation } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateLocation'>;

export function CreateLocationScreen({ navigation, route }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();

  const [storeId, setStoreId] = useState(route.params?.storeId ?? '');
  const [warehouseId, setWarehouseId] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const warehouses = useMemo(
    () => data.warehouses.filter(warehouse => warehouse.storeId === storeId),
    [data.warehouses, storeId],
  );

  useEffect(() => {
    if (!storeId && data.stores.length > 0) {
      setStoreId(data.stores[0].id);
    }
  }, [data.stores, storeId]);

  useEffect(() => {
    if (warehouseId && !warehouses.some(warehouse => warehouse.id === warehouseId)) {
      setWarehouseId('');
    }
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  const submit = async () => {
    if (!storeId || !warehouseId || !code.trim()) {
      return;
    }
    setError('');
    setSaving(true);
    try {
      await saveLocation({ storeId, warehouseId, code, description });
      await addActivity({
        action: 'Location Created',
        detail: `${code.trim().toUpperCase()} created`,
        storeId,
        user: profile,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create location.');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="This section is available to administrators only."
        title="Create Location">
        <EmptyState
          icon="tag"
          title="Access restricted"
          subtitle="Only administrators can create storage locations."
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Add a rack / bin / storage location inside a warehouse."
      title="Create Location">
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.cardTintAmber }]}>
            <AppIcon name="tag" size={18} tintColor={colors.warning} />
          </View>
          <Text style={styles.cardTitle}>Location Details</Text>
        </View>

        <Dropdown
          label="Store"
          placeholder="Select a store"
          value={storeId}
          onChange={setStoreId}
          options={data.stores.map(store => ({ label: store.name, value: store.id }))}
          emptyText="No stores — create a store first"
        />
        <Dropdown
          label="Warehouse"
          placeholder="Select a warehouse"
          value={warehouseId}
          onChange={setWarehouseId}
          options={warehouses.map(warehouse => ({ label: warehouse.name, value: warehouse.id }))}
          emptyText="No warehouses in this store"
        />
        <AppTextInput
          autoCapitalize="characters"
          label="Location Code"
          onChangeText={setCode}
          placeholder="e.g. A1, B2, C3"
          value={code}
        />
        <AppTextInput
          label="Description"
          onChangeText={setDescription}
          placeholder="Top rack, left side"
          value={description}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          disabled={!storeId || !warehouseId || !code.trim() || saving}
          loading={saving}
          onPress={submit}
          title="Create Location"
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  error: {
    fontFamily: typography.fontFamily.regular,
    color: colors.danger,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
});
