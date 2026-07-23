import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Modal,
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
import { PhotoPickerField } from '../../../components/PhotoPickerField';
import { ScreenShell } from '../../../components/ScreenShell';
import { useAuth } from '../../auth/AuthProvider';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAppDispatch } from '../../../store/hooks';
import { resetInventoryFilters } from '../../../store/slices/filtersSlice';
import { glazeLabel, glazeOptions } from '../../../utils/inventoryHelpers';
import { collections, db } from '../../../services/firebase';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppStackParamList } from '../../../navigation/types';
import type { GlazeOption, InventoryItem } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'NewProduct'>;

type LocationRow = {
  storeId: string;
  warehouseId: string;
  locationCode: string;
  quantity: string;
  minimumQuantity: string;
};

type CustomGlaze = {
  id: string;
  value: GlazeOption;
  label: string;
};

type ActiveDropdown =
  | { type: 'glaze' }
  | { type: 'store'; index: number }
  | { type: 'warehouse'; index: number }
  | { type: 'location'; index: number }
  | null;

export function NewProductScreen({ route, navigation }: Props) {
  const dispatch = useAppDispatch();
  const { profile } = useAuth();
  const data = useInventoryData();
  const editingItem = route.params?.item as InventoryItem | undefined;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [glaze, setGlaze] = useState<GlazeOption | ''>('');
  const [size, setSize] = useState('');
  const [sku, setSku] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [editMinimum, setEditMinimum] = useState('1');
  const [saving, setSaving] = useState(false);
  const [customGlazes, setCustomGlazes] = useState<CustomGlaze[]>([]);
  const [addGlazeModalVisible, setAddGlazeModalVisible] = useState(false);
  const [newGlazeName, setNewGlazeName] = useState('');
  const [locations, setLocations] = useState<LocationRow[]>([
    { storeId: '', warehouseId: '', locationCode: '', quantity: '0', minimumQuantity: '1' },
  ]);
  const [manageGlazesModalVisible, setManageGlazesModalVisible] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);

  const defaultStoreId = useMemo(() => data.stores[0]?.id || '', [data.stores]);
  
  const defaultWarehouseId = useCallback((storeId: string) => {
    return data.warehouses.find(w => w.storeId === storeId)?.id || '';
  }, [data.warehouses]);

  const defaultLocationCode = useCallback((storeId: string, warehouseId: string) => {
    return data.locations.find(l => l.storeId === storeId && l.warehouseId === warehouseId)?.code || '';
  }, [data.locations]);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setCategory(editingItem.category);
      setBrand(editingItem.brand || '');
      setGlaze((editingItem.glaze as GlazeOption) || '');
      setSize(editingItem.size || '');
      setSku(editingItem.sku || '');
      setPhotoUrl(editingItem.photoUrl || '');
      setEditMinimum(String(editingItem.minimumQuantity ?? 1));
    }
  }, [editingItem]);

  useEffect(() => {
    const loadCustomGlazes = async () => {
      try {
        const snapshot = await db.collection('customGlazes').get();
        const glazes = snapshot.docs.map(doc => ({
          id: doc.id,
          value: doc.data().value as GlazeOption,
          label: doc.data().label || doc.data().value,
        }));
        setCustomGlazes(glazes);
      } catch (error) {
        // Silent error
      }
    };
    loadCustomGlazes();
  }, []);

  useEffect(() => {
    if (!editingItem && defaultStoreId && locations[0].storeId === '') {
      const sId = defaultStoreId;
      const wId = defaultWarehouseId(sId);
      const locCode = defaultLocationCode(sId, wId);
      setLocations([{ storeId: sId, warehouseId: wId, locationCode: locCode, quantity: '0', minimumQuantity: '1' }]);
    }
  }, [data.stores, data.warehouses, data.locations, editingItem, defaultStoreId, defaultWarehouseId, defaultLocationCode]);

  const canSave = useMemo(() => {
    if (!name.trim() || !category.trim()) return false;
    if (!photoUrl.trim()) return false;
    if (editingItem) return true;

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
  }, [name, category, photoUrl, locations, editingItem]);

  const glazeOptionsWithAdd = useMemo(() => {
    const defaultOptions = glazeOptions.map(option => ({ 
      label: glazeLabel(option), 
      value: option 
    }));
    
    const customOptions = customGlazes.map(glaze => ({
      label: glaze.label,
      value: glaze.value,
    }));

    const separator = customOptions.length > 0 
      ? [{ label: '──────────', value: 'SEPARATOR', disabled: true }]
      : [];

    return [
      ...defaultOptions,
      ...customOptions,
      ...separator,
      { label: '➕ Add New Glaze', value: 'ADD_NEW' },
      ...(customOptions.length > 0 ? [{ label: '⚙️ Manage Glazes', value: 'MANAGE_GLAZES' }] : []),
    ];
  }, [customGlazes]);

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

  const handleUpdateLocation = useCallback((index: number, fields: Partial<LocationRow>) => {
    setLocations(current => {
      const updated = [...current];
      const prev = updated[index];
      const next = { ...prev, ...fields };

      if (fields.storeId && fields.storeId !== prev.storeId) {
        next.warehouseId = defaultWarehouseId(fields.storeId);
        next.locationCode = defaultLocationCode(fields.storeId, next.warehouseId);
      }
      else if (fields.warehouseId && fields.warehouseId !== prev.warehouseId) {
        next.locationCode = defaultLocationCode(next.storeId, fields.warehouseId);
      }

      updated[index] = next;
      return updated;
    });
  }, [defaultWarehouseId, defaultLocationCode]);

  const handleGlazeSelect = useCallback((value: string) => {
    if (value === 'ADD_NEW') {
      setAddGlazeModalVisible(true);
    } else if (value === 'MANAGE_GLAZES') {
      setManageGlazesModalVisible(true);
    } else if (value !== 'SEPARATOR') {
      setGlaze(value as GlazeOption);
    }
  }, []);

  const activeDropdownConfig = useMemo(() => {
    if (!activeDropdown) return null;

    if (activeDropdown.type === 'glaze') {
      return {
        title: 'Select Glaze / Finish',
        options: glazeOptionsWithAdd.map(opt => ({
          label: opt.label,
          value: opt.value,
          disabled: 'disabled' in opt ? Boolean(opt.disabled) : false,
        })),
        selectedValue: glaze,
        emptyText: 'No glazes available',
        onSelect: (val: string) => {
          handleGlazeSelect(val);
          setActiveDropdown(null);
        },
      };
    }

    const locIndex = activeDropdown.index;
    const targetLoc = locations[locIndex];
    if (!targetLoc) return null;

    if (activeDropdown.type === 'store') {
      const storeOptions = data.stores.map(s => ({ label: s.name, value: s.id, disabled: false }));
      return {
        title: `Select Store (Location #${locIndex + 1})`,
        options: storeOptions.length > 0 ? storeOptions : [{ label: 'No stores available', value: '', disabled: true }],
        selectedValue: targetLoc.storeId,
        emptyText: 'No stores available — create one in Stores screen',
        onSelect: (val: string) => {
          if (val) {
            handleUpdateLocation(locIndex, { storeId: val });
          }
          setActiveDropdown(null);
        },
      };
    }

    if (activeDropdown.type === 'warehouse') {
      const warehouses = data.warehouses.filter(w => w.storeId === targetLoc.storeId);
      const warehouseOptions = warehouses.map(w => ({ label: w.name, value: w.id, disabled: false }));
      return {
        title: `Select Warehouse (Location #${locIndex + 1})`,
        options: warehouseOptions.length > 0 ? warehouseOptions : [{ label: 'No warehouses available', value: '', disabled: true }],
        selectedValue: targetLoc.warehouseId,
        emptyText: 'No warehouses available for this store',
        onSelect: (val: string) => {
          if (val) {
            handleUpdateLocation(locIndex, { warehouseId: val });
          }
          setActiveDropdown(null);
        },
      };
    }

    if (activeDropdown.type === 'location') {
      const locationsList = data.locations.filter(
        l => l.storeId === targetLoc.storeId && l.warehouseId === targetLoc.warehouseId
      );
      const locationOptions = locationsList.map(l => ({ label: l.code, value: l.code, disabled: false }));
      return {
        title: `Select Location Code (Location #${locIndex + 1})`,
        options: locationOptions.length > 0 ? locationOptions : [{ label: 'No locations available', value: '', disabled: true }],
        selectedValue: targetLoc.locationCode,
        emptyText: 'No locations available in this warehouse — create in Stores screen',
        onSelect: (val: string) => {
          if (val) {
            handleUpdateLocation(locIndex, { locationCode: val });
          }
          setActiveDropdown(null);
        },
      };
    }

    return null;
  }, [
    activeDropdown,
    glaze,
    locations,
    glazeOptionsWithAdd,
    data.stores,
    data.warehouses,
    data.locations,
    handleGlazeSelect,
    handleUpdateLocation,
  ]);

  const handleDeleteCustomGlaze = async (glazeId: string, glazeValue: GlazeOption) => {
    Alert.alert(
      'Delete Glaze',
      'Are you sure you want to delete this glaze?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const productsWithGlaze = await db
                .collection(collections.inventory)
                .where('glaze', '==', glazeValue)
                .get();

              if (!productsWithGlaze.empty) {
                Alert.alert(
                  'Cannot Delete',
                  'This glaze is currently being used by some products. Please update those products first.'
                );
                return;
              }

              await db.collection('customGlazes').doc(glazeId).delete();
              setCustomGlazes(customGlazes.filter(g => g.id !== glazeId));
              
              if (glaze === glazeValue) {
                setGlaze('');
              }

              Alert.alert('Success', 'Glaze deleted successfully!');
            } catch (error) {
              Alert.alert('Error', 'Could not delete glaze.');
            }
          }
        }
      ]
    );
  };

  const handleAddNewGlaze = async () => {
    if (!newGlazeName.trim()) {
      Alert.alert('Error', 'Please enter a glaze name.');
      return;
    }

    try {
      const newGlazeValue = newGlazeName.trim().toLowerCase().replace(/\s+/g, '_') as GlazeOption;
      
      const existingGlaze = [...glazeOptions, ...customGlazes.map(g => g.value)].find(
        g => g === newGlazeValue
      );
      
      if (existingGlaze) {
        Alert.alert('Error', 'This glaze already exists.');
        return;
      }

      const docRef = await db.collection('customGlazes').add({
        value: newGlazeValue,
        label: newGlazeName.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      const newCustomGlaze: CustomGlaze = {
        id: docRef.id,
        value: newGlazeValue,
        label: newGlazeName.trim(),
      };

      setCustomGlazes([...customGlazes, newCustomGlaze]);
      setGlaze(newGlazeValue);
      setAddGlazeModalVisible(false);
      setNewGlazeName('');
      
      Alert.alert('Success', 'New glaze added successfully!');
    } catch (error) {
      Alert.alert('Error', 'Could not add new glaze.');
    }
  };

  const navigateToInventory = useCallback(() => {
    dispatch(resetInventoryFilters());
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [
                { name: 'HomeTab' },
                { name: 'Inventory' },
              ],
              index: 1,
            },
          },
        ],
      });
    }
  }, [navigation, dispatch]);

  const handleSave = async () => {
    if (!name.trim() || !category.trim()) {
      Alert.alert('Error', 'Product name and category are required.');
      return;
    }

    if (!photoUrl.trim()) {
      Alert.alert('Error', 'Please select an image.');
      return;
    }

    if (!canSave) return;
    setSaving(true);

    try {
      if (editingItem) {
        await db.collection(collections.inventory).doc(editingItem.id).update({
          name: name.trim(),
          category: category.trim(),
          brand: brand.trim(),
          glaze,
          size: size.trim(),
          sku: sku.trim(),
          photoUrl: photoUrl.trim(),
          minimumQuantity: Number(editMinimum || 0),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        await db.collection(collections.activityLogs).add({
          action: 'Product Updated',
          detail: `Product "${editingItem.name}" updated`,
          storeId: editingItem.storeId,
          createdBy: profile?.name || profile?.email || 'System',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        Alert.alert('Success', 'Product details updated successfully.', [
          {
            text: 'OK',
            onPress: () => {
              dispatch(resetInventoryFilters());
              navigation.goBack();
            },
          },
        ]);
      } else {
        const batch = db.batch();

        for (const loc of locations) {
          const docRef = db.collection(collections.inventory).doc();
          const quantity = Number(loc.quantity || 0);
          const minimumQuantity = Number(loc.minimumQuantity || 1);

          batch.set(docRef, {
            name: name.trim(),
            category: category.trim(),
            brand: brand.trim(),
            glaze,
            size: size.trim(),
            sku: sku.trim(),
            photoUrl: photoUrl.trim(),
            storeId: loc.storeId,
            warehouseId: loc.warehouseId,
            locationCode: loc.locationCode.toUpperCase(),
            quantity,
            minimumQuantity,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });

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
          { 
            text: 'OK', 
            onPress: navigateToInventory
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const ManageGlazesModal = () => (
    <Modal
      visible={manageGlazesModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setManageGlazesModalVisible(false)}
      statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setManageGlazesModalVisible(false)}
        />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Glazes</Text>
            <Pressable
              onPress={() => setManageGlazesModalVisible(false)}
              style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            {customGlazes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No custom glazes added yet.</Text>
                <Text style={styles.emptyStateSubText}>Add one from the dropdown or below.</Text>
              </View>
            ) : (
              customGlazes.map((item) => (
                <View key={item.id} style={styles.manageGlazeItem}>
                  <View style={styles.manageGlazeItemLeft}>
                    <View style={styles.manageGlazeDot} />
                    <Text style={styles.manageGlazeItemText}>{item.label}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setManageGlazesModalVisible(false);
                      handleDeleteCustomGlaze(item.id, item.value);
                    }}
                    style={styles.manageGlazeDeleteBtn}>
                    <AppIcon name="trash" size={18} tintColor={colors.danger} />
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.manageAddSection}>
              <Text style={styles.manageAddLabel}>Add New Glaze</Text>
              <View style={styles.manageAddRow}>
                <AppTextInput
                  label=""
                  onChangeText={setNewGlazeName}
                  placeholder="Enter glaze name"
                  value={newGlazeName}
                  style={styles.manageAddInput}
                />
                <AppButton
                  onPress={handleAddNewGlaze}
                  title="Add"
                  disabled={!newGlazeName.trim()}
                  style={styles.manageAddBtn}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

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
            label="Brand / Company"
            onChangeText={setBrand}
            placeholder="e.g. Kajaria, Somany"
            value={brand}
          />

          <View style={styles.glazeContainer}>
            <Text style={styles.glazeLabel}>Glaze / Finish</Text>
            <Pressable
              style={({ pressed }) => [styles.inlineFieldButton, pressed && styles.inlineFieldPressed]}
              onPress={() => setActiveDropdown({ type: 'glaze' })}>
              <Text style={[styles.inlineFieldValueText, !glaze && styles.inlineFieldPlaceholder]}>
                {glaze ? glazeLabel(glaze) : 'Select a glaze'}
              </Text>
              <AppIcon name="chevronDown" size={18} tintColor={colors.muted} />
            </Pressable>
            {customGlazes.length > 0 && (
              <Text style={styles.customGlazeHint}>
                {customGlazes.length} custom glaze{customGlazes.length > 1 ? 's' : ''} available
              </Text>
            )}
          </View>

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

          {editingItem ? (
            <AppTextInput
              keyboardType="number-pad"
              label="Min Threshold"
              onChangeText={val => setEditMinimum(val.replace(/[^0-9]/g, ''))}
              placeholder="1"
              value={editMinimum}
            />
          ) : null}

          <PhotoPickerField 
            value={photoUrl} 
            onChange={setPhotoUrl} 
            required 
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
              const selectedStore = data.stores.find(s => s.id === loc.storeId);
              const warehouses = data.warehouses.filter(w => w.storeId === loc.storeId);
              const selectedWarehouse = warehouses.find(w => w.id === loc.warehouseId);

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

                  <View style={styles.inlineFieldWrapper}>
                    <Text style={styles.inlineFieldLabel}>Store *</Text>
                    <Pressable
                      style={({ pressed }) => [styles.inlineFieldButton, pressed && styles.inlineFieldPressed]}
                      onPress={() => setActiveDropdown({ type: 'store', index })}>
                      <Text style={[styles.inlineFieldValueText, !loc.storeId && styles.inlineFieldPlaceholder]}>
                        {selectedStore?.name || 'Select a store'}
                      </Text>
                      <AppIcon name="chevronDown" size={18} tintColor={colors.muted} />
                    </Pressable>
                  </View>

                  <View style={styles.inlineFieldWrapper}>
                    <Text style={styles.inlineFieldLabel}>Warehouse *</Text>
                    <Pressable
                      style={({ pressed }) => [styles.inlineFieldButton, pressed && styles.inlineFieldPressed]}
                      onPress={() => setActiveDropdown({ type: 'warehouse', index })}>
                      <Text style={[styles.inlineFieldValueText, !loc.warehouseId && styles.inlineFieldPlaceholder]}>
                        {selectedWarehouse?.name || 'Select a warehouse'}
                      </Text>
                      <AppIcon name="chevronDown" size={18} tintColor={colors.muted} />
                    </Pressable>
                  </View>

                  <View style={styles.inlineFieldWrapper}>
                    <Text style={styles.inlineFieldLabel}>Rack / Bin / Location *</Text>
                    <Pressable
                      style={({ pressed }) => [styles.inlineFieldButton, pressed && styles.inlineFieldPressed]}
                      onPress={() => setActiveDropdown({ type: 'location', index })}>
                      <Text style={[styles.inlineFieldValueText, !loc.locationCode && styles.inlineFieldPlaceholder]}>
                        {loc.locationCode || 'Select a location'}
                      </Text>
                      <AppIcon name="chevronDown" size={18} tintColor={colors.muted} />
                    </Pressable>
                  </View>

                  <View style={styles.qtyContainer}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <AppTextInput
                        keyboardType="number-pad"
                        label="Qty *"
                        onChangeText={val => handleUpdateLocation(index, { quantity: val.replace(/[^0-9]/g, '') })}
                        placeholder="0"
                        value={loc.quantity}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppTextInput
                        keyboardType="number-pad"
                        label="Min *"
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

      <Modal
        visible={addGlazeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddGlazeModalVisible(false)}
        statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAddGlazeModalVisible(false)}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Glaze</Text>
              <Pressable
                onPress={() => setAddGlazeModalVisible(false)}
                style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <AppTextInput
                label="Glaze Name *"
                onChangeText={setNewGlazeName}
                placeholder="e.g. Matte Black, Glossy White"
                value={newGlazeName}
              />

              <View style={styles.modalActions}>
                <AppButton
                  onPress={() => setAddGlazeModalVisible(false)}
                  title="Cancel"
                  style={styles.modalCancelBtn}
                  textStyle={styles.modalCancelText}
                />
                <AppButton
                  onPress={handleAddNewGlaze}
                  title="Add Glaze"
                  disabled={!newGlazeName.trim()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <ManageGlazesModal />

      <Modal
        visible={activeDropdown !== null && activeDropdownConfig !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveDropdown(null)}
        statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActiveDropdown(null)}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeDropdownConfig?.title || 'Select Option'}</Text>
              <Pressable
                onPress={() => setActiveDropdown(null)}
                style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {!activeDropdownConfig || activeDropdownConfig.options.length === 0 || 
               (activeDropdownConfig.options.length === 1 && activeDropdownConfig.options[0].disabled) ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    {activeDropdownConfig?.emptyText || 'No options available'}
                  </Text>
                </View>
              ) : (
                activeDropdownConfig.options.map(option => {
                  const isSelected = option.value === activeDropdownConfig.selectedValue;
                  const isDisabled = option.disabled;
                  return (
                    <Pressable
                      key={option.value || 'empty'}
                      disabled={isDisabled}
                      onPress={() => activeDropdownConfig.onSelect(option.value)}
                      style={({ pressed }) => [
                        styles.dropdownOptionRow,
                        isSelected && styles.dropdownOptionActive,
                        pressed && !isDisabled && styles.dropdownOptionPressed,
                        isDisabled && styles.dropdownOptionDisabled,
                      ]}>
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextActive,
                          isDisabled && styles.dropdownOptionTextDisabled,
                        ]}>
                        {option.label}
                      </Text>
                      {isSelected && !isDisabled ? (
                        <AppIcon name="check" size={18} tintColor={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  glazeContainer: {
    marginBottom: spacing.md,
  },
  glazeLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  customGlazeHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  manageGlazeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  manageGlazeItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  manageGlazeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  manageGlazeItemText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    flex: 1,
  },
  manageGlazeDeleteBtn: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageAddSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  manageAddLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  manageAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manageAddInput: {
    flex: 1,
  },
  manageAddBtn: {
    paddingHorizontal: spacing.md,
    height: 44,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '80%',
    ...shadows.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.ink,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.muted,
  },
  modalBody: {
    paddingBottom: spacing.md,
    maxHeight: 500,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },
  modalCancelText: {
    color: colors.inkSoft,
  },
  inlineFieldWrapper: {
    marginBottom: spacing.md,
  },
  inlineFieldLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.inkSoft,
    marginBottom: 8,
  },
  inlineFieldButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  inlineFieldPressed: {
    opacity: 0.85,
  },
  inlineFieldValueText: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginRight: spacing.sm,
  },
  inlineFieldPlaceholder: {
    color: colors.muted,
  },
  dropdownOptionRow: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: 4,
  },
  dropdownOptionActive: {
    backgroundColor: colors.cardTintGreen,
  },
  dropdownOptionPressed: {
    opacity: 0.7,
  },
  dropdownOptionDisabled: {
    opacity: 0.5,
  },
  dropdownOptionText: {
    color: colors.inkSoft,
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginRight: spacing.sm,
  },
  dropdownOptionTextActive: {
    color: colors.primary,
    fontFamily: typography.fontFamily.semiBold,
  },
  dropdownOptionTextDisabled: {
    color: colors.muted,
  },
});