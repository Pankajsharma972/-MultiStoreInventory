import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { Dropdown } from '../../../components/Dropdown';
import { ScreenShell } from '../../../components/ScreenShell';
import { useAuth } from '../../auth/AuthProvider';
import { useInventoryData } from '../../../services/useInventoryData';
import { collections, db } from '../../../services/firebase';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { InventoryItem } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'NewProduct'>;

type LocationRow = {
  storeId: string;
  warehouseId: string;
  locationCode: string;
  quantity: string;
  minimumQuantity: string;
};

export function NewProductScreen({ route, navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const editingItem = route.params?.item as InventoryItem | undefined;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [sku, setSku] = useState('');
  const [saving, setSaving] = useState(false);

  // Dynamic location rows (only for creation mode)
  const [locations, setLocations] = useState<LocationRow[]>([
    { storeId: '', warehouseId: '', locationCode: '', quantity: '0', minimumQuantity: '1' },
  ]);

  // Load editing product metadata
  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setCategory(editingItem.category);
      setSize(editingItem.size || '');
      setSku(editingItem.sku || '');
    }
  }, [editingItem]);

  // Default dropdown selections helper
  const defaultStoreId = data.stores[0]?.id || '';
  const defaultWarehouseId = (storeId: string) => {
    return data.warehouses.find(w => w.storeId === storeId)?.id || '';
  };
  const defaultLocationCode = (storeId: string, warehouseId: string) => {
    return data.locations.find(l => l.storeId === storeId && l.warehouseId === warehouseId)?.code || '';
  };

  const handleAddLocation = () => {
    const sId = defaultStoreId;
    const wId = defaultWarehouseId(sId);
    const locCode = defaultLocationCode(sId, wId);

    setLocations([
      ...locations,
      {
        storeId: sId,
        warehouseId: wId,
        locationCode: locCode,
        quantity: '0',
        minimumQuantity: '1',
      },
    ]);
  };

  const handleRemoveLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleUpdateLocation = (index: number, fields: Partial<LocationRow>) => {
    const updated = [...locations];
    const prev = updated[index];
    const next = { ...prev, ...fields };

    // If store changed, automatically select the first warehouse in that store
    if (fields.storeId && fields.storeId !== prev.storeId) {
      next.warehouseId = defaultWarehouseId(fields.storeId);
      next.locationCode = defaultLocationCode(fields.storeId, next.warehouseId);
    }
    // If warehouse changed, automatically select the first location in that warehouse
    else if (fields.warehouseId && fields.warehouseId !== prev.warehouseId) {
      next.locationCode = defaultLocationCode(next.storeId, fields.warehouseId);
    }

    updated[index] = next;
    setLocations(updated);
  };

  // Pre-fill default locations for row 0 once data loads
  useEffect(() => {
    if (!editingItem && defaultStoreId && locations[0].storeId === '') {
      const sId = defaultStoreId;
      const wId = defaultWarehouseId(sId);
      const locCode = defaultLocationCode(sId, wId);
      setLocations([{ storeId: sId, warehouseId: wId, locationCode: locCode, quantity: '0', minimumQuantity: '1' }]);
    }
  }, [data.stores, data.warehouses, data.locations, editingItem]);

  const canSave = useMemo(() => {
    if (!name.trim() || !category.trim()) return false;
    if (editingItem) return true; // Only metadata is updated for single item edit

    // For new product, validate all location rows
    return locations.every(
      loc =>
        loc.storeId &&
        loc.warehouseId &&
        loc.locationCode &&
        loc.quantity.trim() !== '' &&
        Number(loc.quantity) >= 0 &&
        loc.minimumQuantity.trim() !== '' &&
        Number(loc.minimumQuantity) >= 0
    );
  }, [name, category, locations, editingItem]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    try {
      if (editingItem) {
        // Edit mode: Update metadata of the selected item document
        await db.collection(collections.inventory).doc(editingItem.id).update({
          name: name.trim(),
          category: category.trim(),
          size: size.trim(),
          sku: sku.trim(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        // Add activity log
        await db.collection(collections.activityLogs).add({
          action: 'Product Updated',
          detail: `Product "${editingItem.name}" updated (name, category, size, SKU)`,
          storeId: editingItem.storeId,
          createdBy: profile?.name || profile?.email || 'System',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        Alert.alert('Success', 'Product details updated successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Create mode: Create Firestore documents for each storage location specified
        const batch = db.batch();

        for (const loc of locations) {
          const docRef = db.collection(collections.inventory).doc();
          const quantity = Number(loc.quantity || 0);
          const minimumQuantity = Number(loc.minimumQuantity || 1);

          batch.set(docRef, {
            name: name.trim(),
            category: category.trim(),
            size: size.trim(),
            sku: sku.trim(),
            storeId: loc.storeId,
            warehouseId: loc.warehouseId,
            locationCode: loc.locationCode.toUpperCase(),
            quantity,
            minimumQuantity,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });

          // Add activity log document in the batch
          const logRef = db.collection(collections.activityLogs).doc();
          batch.set(logRef, {
            action: 'Product Created',
            detail: `${name.trim()} added with ${quantity} units at location ${loc.locationCode.toUpperCase()}`,
            storeId: loc.storeId,
            createdBy: profile?.name || profile?.email || 'System',
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();
        Alert.alert('Success', 'Product saved with specified locations.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell
      title={editingItem ? 'Edit Product' : 'New Product'}
      subtitle={editingItem ? 'Update product description or categories' : 'Create a product and assign stock to one or more warehouse storage locations.'}
      onBack={navigation.goBack}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <AppIcon name="box" size={18} tintColor={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Product Details</Text>
          </View>

          <AppTextInput
            label="Product Name *"
            onChangeText={setName}
            placeholder="e.g. Leather Belt"
            value={name}
          />

          <AppTextInput
            label="Category *"
            onChangeText={setCategory}
            placeholder="e.g. Accessory, Shirts"
            value={category}
          />

          <AppTextInput
            label="Size"
            onChangeText={setSize}
            placeholder="e.g. 34, XL, L"
            value={size}
          />

          <AppTextInput
            label="SKU (Optional)"
            onChangeText={setSku}
            placeholder="e.g. SKU-12345"
            value={sku}
          />
        </View>

        {!editingItem ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.cardTintPurple }]}>
                <AppIcon name="transfer" size={18} tintColor="#7C3AED" />
              </View>
              <Text style={styles.cardTitle}>Storage Locations</Text>
            </View>

            {locations.map((loc, index) => {
              const warehouses = data.warehouses.filter(w => w.storeId === loc.storeId);
              const locationsList = data.locations.filter(
                l => l.storeId === loc.storeId && l.warehouseId === loc.warehouseId
              );

              return (
                <View key={index} style={styles.locationRowContainer}>
                  <View style={styles.locationRowHeader}>
                    <Text style={styles.locationRowTitle}>Location #{index + 1}</Text>
                    {locations.length > 1 && (
                      <Pressable
                        onPress={() => handleRemoveLocation(index)}
                        style={styles.deleteRowBtn}
                      >
                        <AppIcon name="trash" size={14} tintColor={colors.danger} />
                      </Pressable>
                    )}
                  </View>

                  <Dropdown
                    label="Store *"
                    placeholder="Select a store"
                    value={loc.storeId}
                    onChange={val => handleUpdateLocation(index, { storeId: val })}
                    options={data.stores.map(s => ({ label: s.name, value: s.id }))}
                    emptyText="No stores — create one in Stores"
                  />

                  <Dropdown
                    label="Warehouse *"
                    placeholder="Select a warehouse"
                    value={loc.warehouseId}
                    onChange={val => handleUpdateLocation(index, { warehouseId: val })}
                    options={warehouses.map(w => ({ label: w.name, value: w.id }))}
                    emptyText="No warehouses in this store"
                  />

                  <Dropdown
                    label="Rack / Bin / Location *"
                    placeholder="Select a location"
                    value={loc.locationCode}
                    onChange={val => handleUpdateLocation(index, { locationCode: val })}
                    options={locationsList.map(l => ({ label: l.code, value: l.code }))}
                    emptyText="No locations — create in Stores"
                  />

                  <View style={styles.qtyContainer}>
                    <View style={{ flex: 1 }}>
                      <AppTextInput
                        keyboardType="number-pad"
                        label="Quantity *"
                        onChangeText={val => handleUpdateLocation(index, { quantity: val.replace(/[^0-9]/g, '') })}
                        placeholder="0"
                        value={loc.quantity}
                      />
                    </View>
                    <View style={{ width: spacing.md }} />
                    <View style={{ flex: 1 }}>
                      <AppTextInput
                        keyboardType="number-pad"
                        label="Min Stock Threshold *"
                        onChangeText={val => handleUpdateLocation(index, { minimumQuantity: val.replace(/[^0-9]/g, '') })}
                        placeholder="1"
                        value={loc.minimumQuantity}
                      />
                    </View>
                  </View>
                </View>
              );
            })}

            <Pressable onPress={handleAddLocation} style={styles.addLocationBtn}>
              <AppIcon name="plus" size={16} tintColor={colors.primary} />
              <Text style={styles.addLocationBtnText}>Add Storage Location</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actionContainer}>
          <AppButton
            disabled={!canSave || saving}
            onPress={handleSave}
            title={editingItem ? 'Update Product Details' : 'Save Product'}
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
  locationRowContainer: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  locationRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  locationRowTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.inkSoft,
  },
  deleteRowBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: spacing.xs,
  },
  addLocationBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
  },
  actionContainer: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
});
