import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { BottomSheet } from '../../../components/BottomSheet';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionHeader } from '../../../components/SectionHeader';
import { deleteStore, updateStore } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { Store } from '../../../types/models';

type StoresScreenProps = NativeStackScreenProps<AppStackParamList, 'Stores'>;

export function StoresScreen({ navigation }: StoresScreenProps) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const insets = useSafeAreaInsets();

  // Store action bottom sheet
  const [sheetStore, setSheetStore] = useState<Store | null>(null);

  // "Add" bottom sheet (store / warehouse / location)
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  // Edit store modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreLocation, setEditStoreLocation] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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

  if (profile?.role !== 'admin') {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="This section is available to administrators only."
        title="Stores & Warehouses">
        <EmptyState
          icon="store"
          title="Access restricted"
          subtitle="Only administrators can manage stores and warehouses."
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        onBack={navigation.goBack}
        subtitle="Manage stores, warehouses, and exact rack/bin locations."
        title="Stores & Warehouses">

        <SectionHeader title="Current Structure" meta={`${data.stores.length} stores`} />

        {data.stores.length === 0 ? (
          <EmptyState
            icon="store"
            title="No stores yet"
            subtitle="Tap the + button to create your first store."
          />
        ) : (
          <>
            <Text style={styles.longPressHint}>Long press a store to edit or delete</Text>
            {data.stores.map(store => {
              const storeWarehouses = data.warehouses.filter(w => w.storeId === store.id);
              const assignedUsers = data.users.filter(user =>
                (user.assignedStoreIds || []).includes(store.id),
              );
              const staff = assignedUsers.filter(user => user.role === 'staff');
              const accounts = assignedUsers.filter(user => user.role === 'accounts');
              const supervisors = assignedUsers.filter(user => user.role === 'supervisor');
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
                  {storeWarehouses.length === 0 ? (
                    <Text style={styles.warehouseText}>No warehouses yet</Text>
                  ) : (
                    storeWarehouses.map(warehouse => {
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
                    })
                  )}
                  <View style={styles.teamSection}>
                    <Text style={styles.teamTitle}>Store Team</Text>
                    <TeamLine label="Staff" users={staff.map(user => user.name)} />
                    <TeamLine label="Accounts" users={accounts.map(user => user.name)} />
                    <TeamLine label="Supervisor" users={supervisors.map(user => user.name)} />
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScreenShell>

      {/* Add (store / warehouse / location) FAB */}
      <Pressable
        onPress={() => setAddSheetVisible(true)}
        style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}>
        <AppIcon name="plus" size={24} tintColor="#FFFFFF" />
      </Pressable>

      {/* Add options bottom sheet */}
      <BottomSheet
        visible={addSheetVisible}
        title="Add to structure"
        subtitle="Create a store, warehouse, or storage location"
        onClose={() => setAddSheetVisible(false)}
        actions={[
          {
            id: 'store',
            label: 'Create Store',
            icon: 'store',
            tint: colors.primary,
            bg: colors.cardTintGreen,
            onPress: () => navigation.navigate('CreateStore'),
          },
          {
            id: 'warehouse',
            label: 'Create Warehouse',
            icon: 'layout',
            tint: colors.accent,
            bg: colors.cardTintBlue,
            onPress: () => navigation.navigate('CreateWarehouse'),
          },
          {
            id: 'location',
            label: 'Create Location',
            icon: 'tag',
            tint: colors.warning,
            bg: colors.cardTintAmber,
            onPress: () => navigation.navigate('CreateLocation'),
          },
        ]}
      />

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

function TeamLine({ label, users }: { label: string; users: string[] }) {
  return (
    <View style={styles.teamLine}>
      <Text style={styles.teamLabel}>{label} ({users.length})</Text>
      <Text style={styles.teamNames}>{users.length > 0 ? users.join(', ') : 'Not assigned'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  teamSection: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  teamTitle: {
    color: colors.ink,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  teamLine: {
    gap: 2,
  },
  teamLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
  },
  teamNames: {
    color: colors.inkSoft,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    elevation: 8,
  },
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
