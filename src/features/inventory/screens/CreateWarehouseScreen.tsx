import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { Dropdown } from '../../../components/Dropdown';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenShell } from '../../../components/ScreenShell';
import { addActivity, saveWarehouse } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateWarehouse'>;

export function CreateWarehouseScreen({ navigation, route }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();

  const [storeId, setStoreId] = useState(route.params?.storeId ?? '');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storeId && data.stores.length > 0) {
      setStoreId(data.stores[0].id);
    }
  }, [data.stores, storeId]);

  const submit = async () => {
    if (!storeId || !name.trim()) {
      return;
    }
    setError('');
    setSaving(true);
    try {
      await saveWarehouse({ storeId, name });
      await addActivity({
        action: 'Warehouse Created',
        detail: `${name.trim()} created`,
        storeId,
        user: profile,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create warehouse.');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="This section is available to administrators only."
        title="Create Warehouse">
        <EmptyState
          icon="layout"
          title="Access restricted"
          subtitle="Only administrators can create warehouses."
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Add a warehouse and assign it to a store."
      title="Create Warehouse">
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.cardTintBlue }]}>
            <AppIcon name="layout" size={18} tintColor={colors.accent} />
          </View>
          <Text style={styles.cardTitle}>Warehouse Details</Text>
        </View>

        <Dropdown
          label="Store"
          placeholder="Select a store"
          value={storeId}
          onChange={setStoreId}
          options={data.stores.map(store => ({ label: store.name, value: store.id }))}
          emptyText="No stores — create a store first"
        />
        <AppTextInput
          label="Warehouse Name"
          onChangeText={setName}
          placeholder="e.g. Warehouse 1"
          value={name}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          disabled={!storeId || !name.trim() || saving}
          loading={saving}
          onPress={submit}
          title="Create Warehouse"
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
