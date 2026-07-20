import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { BottomSheet } from '../../../components/BottomSheet';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionHeader } from '../../../components/SectionHeader';
import {
  addActivity,
  deleteStore,
  saveLocation,
  saveStore,
  saveWarehouse,
  updateStore,
} from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { Store } from '../../../types/models';

// Rename Props to StoresScreenProps to avoid conflicts
type StoresScreenProps = NativeStackScreenProps<AppStackParamList, 'Stores'>;

function FormSection({
  title,
  icon,
  iconBg,
  iconTint,
  children,
}: {
  title: string;
  icon: 'store' | 'layout' | 'tag';
  iconBg: string;
  iconTint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formSection}>
      <View style={styles.formHeader}>
        <View style={[styles.formIconWrap, { backgroundColor: iconBg }]}>
          <AppIcon name={icon} size={18} tintColor={iconTint} />
        </View>
        <Text style={styles.formTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function StoresScreen({ navigation }: StoresScreenProps) {
  const { profile } = useAuth();

  if (profile?.role !== 'admin') {
    return null;
  }

  const data = useInventoryData();
  const insets = useSafeAreaInsets();

  // Create store form
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');

  // Create warehouse form
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');

  // Create location form
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [locationDescription, setLocationDescription] = useState('');

  // Bottom sheet state
  const [sheetStore, setSheetStore] = useState<Store | null>(null);

  // Edit store modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreLocation, setEditStoreLocation] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const activeStoreId = selectedStoreId || data.stores[0]?.id || '';
  const warehouses = data.warehouses.filter(w => w.storeId === activeStoreId);
  const activeWarehouseId = selectedWarehouseId || warehouses[0]?.id || '';

  const createStore = async () => {
    try {
      await saveStore({ name: storeName, location: storeLocation });
      await addActivity({ action: 'Store Created', detail: `${storeName} created`, user: profile });
      setStoreName('');
      setStoreLocation('');
      Alert.alert('Saved', 'Store created.');
    } catch (err) {
      Alert.alert('Error', `Could not create store: ${(err as Error).message}`);
    }
  };

  const createWarehouse = async () => {
    try {
      await saveWarehouse({ storeId: activeStoreId, name: warehouseName });
      await addActivity({
        action: 'Warehouse Created',
        detail: `${warehouseName} created`,
        storeId: activeStoreId,
        user: profile,
      });
      setWarehouseName('');
      Alert.alert('Saved', 'Warehouse created.');
    } catch (err) {
      Alert.alert('Error', `Could not create warehouse: ${(err as Error).message}`);
    }
  };

  const createLocation = async () => {
    try {
      await saveLocation({
        storeId: activeStoreId,
        warehouseId: activeWarehouseId,
        code: locationCode,
        description: locationDescription,
      });
      await addActivity({
        action: 'Location Created',
        detail: `${locationCode} created`,
        storeId: activeStoreId,
        user: profile,
      });
      setLocationCode('');
      setLocationDescription('');
      Alert.alert('Saved', 'Storage location created.');
    } catch (err) {
      Alert.alert('Error', `Could not create location: ${(err as Error).message}`);
    }
  };

  const openEditModal = (store: Store) => {
    setEditStoreName(store.name);
    setEditStoreLocation(store.location || '');
    setEditModalVisible(true);
  };

  const saveEditStore = async () => {
    if (!sheetStore) return;
    setEditSaving(true);
    try {
      await updateStore(sheetStore.id, { name: editStoreName, location: editStoreLocation }, profile);
      setEditModalVisible(false);
      setSheetStore(null);
      Alert.alert('Saved', 'Store updated.');
    } catch (err) {
      Alert.alert('Error', `Could not update store: ${(err as Error).message}`);
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDeleteStore = (store: Store) => {
    Alert.alert(
      'Delete Store',
      `Are you sure you want to delete "${store.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStore(store.id, profile);
            } catch (err) {
              Alert.alert('Error', `Could not delete store: ${(err as Error).message}`);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <ScreenShell
        onBack={navigation.goBack}
        subtitle="Manage stores, warehouses, and exact rack/bin locations."
        title="Stores & Warehouses">

        <FormSection title="Create Store" icon="store" iconBg={colors.cardTintGreen} iconTint={colors.primary}>
          <AppTextInput label="Store Name" onChangeText={setStoreName} placeholder="Store 1" value={storeName} />
          <AppTextInput
            label="Address / Area"
            onChangeText={setStoreLocation}
            placeholder="Market, city"
            value={storeLocation}
          />
          <AppButton disabled={!storeName.trim()} onPress={createStore} title="Add Store" />
        </FormSection>

        {/* Active store selector chips */}
        {data.stores.length > 0 && (
          <View style={styles.chipSection}>
            <Text style={styles.chipLabel}>Active Store</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {data.stores.map(store => (
                <Pressable
                  key={store.id}
                  onPress={() => {
                    setSelectedStoreId(store.id);
                    setSelectedWarehouseId('');
                  }}
                  style={[styles.chip, activeStoreId === store.id && styles.chipActive]}>
                  <Text style={[styles.chipText, activeStoreId === store.id && styles.chipTextActive]}>
                    {store.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <FormSection title="Create Warehouse" icon="layout" iconBg={colors.cardTintBlue} iconTint={colors.accent}>
          <AppTextInput
            label="Warehouse Name"
            onChangeText={setWarehouseName}
            placeholder="Warehouse 1"
            value={warehouseName}
          />
          <AppButton
            disabled={!activeStoreId || !warehouseName.trim()}
            onPress={createWarehouse}
            title="Add Warehouse"
          />
        </FormSection>

        <FormSection title="Create Location" icon="tag" iconBg={colors.cardTintAmber} iconTint={colors.warning}>
          {/* Warehouse selector chips */}
          {warehouses.length > 0 && (
            <View style={styles.chipSection}>
              <Text style={styles.chipLabel}>Warehouse</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {warehouses.map(wh => (
                  <Pressable
                    key={wh.id}
                    onPress={() => setSelectedWarehouseId(wh.id)}
                    style={[styles.chip, activeWarehouseId === wh.id && styles.chipActive]}>
                    <Text style={[styles.chipText, activeWarehouseId === wh.id && styles.chipTextActive]}>
                      {wh.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <AppTextInput label="Location Code" onChangeText={setLocationCode} placeholder="A1, B2, C3" value={locationCode} />
          <AppTextInput
            label="Description"
            onChangeText={setLocationDescription}
            placeholder="Top rack, left side"
            value={locationDescription}
          />
          <AppButton
            disabled={!activeStoreId || !activeWarehouseId || !locationCode.trim()}
            onPress={createLocation}
            title="Add Location"
          />
        </FormSection>

        <SectionHeader title="Current Structure" meta={`${data.stores.length} stores`} />
        <Text style={styles.longPressHint}>Long press a store to edit or delete</Text>

        {data.stores.map(store => {
          const storeWarehouses = data.warehouses.filter(w => w.storeId === store.id);
          return (
            <Pressable
              key={store.id}
              onLongPress={() => setSheetStore(store)}
              delayLongPress={400}
              style={({ pressed }) => [styles.structureCard, pressed && styles.structureCardPressed]}>
              <View style={styles.structureHeader}>
                <View style={styles.structureIconWrap}>
                  <AppIcon name="store" size={18} tintColor={colors.primary} />
                </View>
                <View style={styles.structureTitleWrap}>
                  <Text style={styles.structureName}>{store.name}</Text>
                  <Text style={styles.structureAddress}>{store.location || 'No address set'}</Text>
                </View>
                <View style={styles.moreHint}>
                  <AppIcon name="menu" size={16} tintColor={colors.muted} />
                </View>
              </View>
              {storeWarehouses.map(warehouse => {
                const locations = data.locations
                  .filter(l => l.warehouseId === warehouse.id)
                  .map(l => l.code);
                return (
                  <View key={warehouse.id} style={styles.warehouseRow}>
                    <AppIcon name="layout" size={14} tintColor={colors.muted} />
                    <Text style={styles.warehouseText}>
                      <Text style={styles.warehouseName}>{warehouse.name}: </Text>
                      {locations.length > 0 ? locations.join(', ') : 'No locations'}
                    </Text>
                  </View>
                );
              })}
            </Pressable>
          );
        })}
      </ScreenShell>

      {/* Store action bottom sheet */}
      <BottomSheet
        visible={sheetStore !== null}
        title={sheetStore?.name ?? ''}
        subtitle="Store options"
        onClose={() => setSheetStore(null)}
        actions={[
          {
            id: 'edit',
            label: 'Edit Store',
            icon: 'edit',
            tint: colors.accent,
            bg: colors.cardTintBlue,
            onPress: () => sheetStore && openEditModal(sheetStore),
          },
          {
            id: 'delete',
            label: 'Delete Store',
            icon: 'trash',
            destructive: true,
            onPress: () => sheetStore && confirmDeleteStore(sheetStore),
          },
        ]}
      />

      {/* Edit store modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
        statusBarTranslucent>
        <View style={styles.editBackdrop}>
          <View style={[styles.editModal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.editTitle}>Edit Store</Text>
            <AppTextInput
              label="Store Name"
              onChangeText={setEditStoreName}
              placeholder="Store name"
              value={editStoreName}
            />
            <AppTextInput
              label="Address / Area"
              onChangeText={setEditStoreLocation}
              placeholder="Market, city"
              value={editStoreLocation}
            />
            <View style={styles.editActions}>
              <AppButton
                onPress={() => setEditModalVisible(false)}
                title="Cancel"
                variant="ghost"
                style={styles.editCancelBtn}
              />
              <AppButton
                disabled={!editStoreName.trim() || editSaving}
                loading={editSaving}
                onPress={saveEditStore}
                title="Save"
                style={styles.editSaveBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ── Forms ──
  formSection: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  // ── Chips ──
  chipSection: {
    marginBottom: spacing.md,
  },
  chipLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.inkSoft,
  },
  chipTextActive: {
    color: colors.surface,
  },
  // ── Structure cards ──
  longPressHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  structureCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  structureCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
  structureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  structureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureTitleWrap: {
    flex: 1,
  },
  structureName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  structureAddress: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  moreHint: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warehouseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  warehouseText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    flex: 1,
    lineHeight: 18,
  },
  warehouseName: {
    fontFamily: typography.fontFamily.semiBold,
    color: colors.inkSoft,
  },
  // ── Edit modal ──
  editBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    ...shadows.lg,
  },
  editTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editCancelBtn: {
    flex: 1,
  },
  editSaveBtn: {
    flex: 1,
  },
});