import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionHeader } from '../../../components/SectionHeader';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../auth/AuthProvider';
import { useInventoryData } from '../../../services/useInventoryData';
import {
  adjustStock,
  moveStockWithinStore,
  receiveStock,
  removeDamagedStock,
  saveProduct,
} from '../../../services/inventoryRepository';
import { getStockAlertLevel, stockAlertLabel } from '../../../utils/inventoryHelpers';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { InventoryItem, StockAlertLevel, StockOperationType } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'Inventory'>;

const ALL = '__all__';
const operations: Array<{ label: string; value: StockOperationType }> = [
  { label: 'Receive', value: 'receive' },
  { label: 'Adjust', value: 'adjust' },
  { label: 'Move', value: 'move' },
  { label: 'Damaged', value: 'damaged' },
];

function alertTone(level: StockAlertLevel): 'success' | 'warning' | 'danger' {
  if (level === 'ok') return 'success';
  if (level === 'low') return 'warning';
  return 'danger';
}

export function InventoryScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const [query, setQuery] = useState('');
  const [storeId, setStoreId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [sku, setSku] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('1');
  const [operationType, setOperationType] = useState<StockOperationType>('receive');
  const [operationAmount, setOperationAmount] = useState('');
  const [operationReason, setOperationReason] = useState('');
  const [moveWarehouseId, setMoveWarehouseId] = useState('');
  const [moveLocationCode, setMoveLocationCode] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const selectedStoreId = storeId || data.stores[0]?.id || '';
  const warehouses = data.warehouses.filter(warehouse => warehouse.storeId === selectedStoreId);
  const selectedWarehouseId = warehouseId || warehouses[0]?.id || '';

  const locationOptions = useMemo(() => {
    const filtered = data.locations.filter(
      location => location.storeId === selectedStoreId && location.warehouseId === selectedWarehouseId,
    );
    const uniqueMap = new Map<string, (typeof filtered)[0]>();
    filtered.forEach(loc => {
      if (!uniqueMap.has(loc.code)) {
        uniqueMap.set(loc.code, loc);
      }
    });
    return Array.from(uniqueMap.values());
  }, [data.locations, selectedStoreId, selectedWarehouseId]);

  const categories = useMemo(
    () => Array.from(new Set(data.inventory.map(item => item.category).filter(Boolean))),
    [data.inventory],
  );
  const sizes = useMemo(
    () =>
      Array.from(
        new Set(data.inventory.map(item => item.size).filter((val): val is string => Boolean(val))),
      ),
    [data.inventory],
  );
  const locationCodes = useMemo(
    () => Array.from(new Set(data.inventory.map(item => item.locationCode).filter(Boolean))),
    [data.inventory],
  );

  const filteredInventory = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.inventory.filter(item => {
      const warehouse = data.warehouses.find(row => row.id === item.warehouseId);
      const matchesText =
        !text ||
        [
          item.name,
          item.category,
          item.size,
          item.sku,
          item.locationCode,
          warehouse?.name,
          data.stores.find(store => store.id === item.storeId)?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(text);
      const matchesStore = !selectedStoreId || item.storeId === selectedStoreId;
      const matchesWarehouse = warehouseId === '' || item.warehouseId === warehouseId;
      const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
      const matchesSize = sizeFilter === '' || item.size === sizeFilter;
      const matchesLocation = locationFilter === '' || item.locationCode === locationFilter;
      const matchesLowStock = !lowStockOnly || getStockAlertLevel(item) !== 'ok';
      return (
        matchesText &&
        matchesStore &&
        matchesWarehouse &&
        matchesCategory &&
        matchesSize &&
        matchesLocation &&
        matchesLowStock
      );
    });
  }, [
    categoryFilter,
    data.inventory,
    data.stores,
    data.warehouses,
    locationFilter,
    lowStockOnly,
    query,
    selectedStoreId,
    sizeFilter,
    warehouseId,
  ]);

  const selectedItem = data.inventory.find(item => item.id === selectedItemId) || null;
  const moveWarehouses = data.warehouses.filter(
    warehouse => warehouse.storeId === selectedItem?.storeId,
  );
  const moveLocations = data.locations.filter(
    location =>
      location.storeId === selectedItem?.storeId &&
      location.warehouseId === (moveWarehouseId || moveWarehouses[0]?.id || ''),
  );

  const canAddProduct =
    name.trim().length > 0 &&
    category.trim().length > 0 &&
    selectedStoreId.length > 0 &&
    selectedWarehouseId.length > 0 &&
    locationCode.trim().length > 0 &&
    quantity.trim().length > 0 &&
    Number(quantity) > 0;

  const submitProduct = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter product name.');
      return;
    }
    if (!category.trim()) {
      Alert.alert('Error', 'Please enter category.');
      return;
    }
    if (!selectedStoreId) {
      Alert.alert('Error', 'Please select a store.');
      return;
    }
    if (!selectedWarehouseId) {
      Alert.alert('Error', 'Please select a warehouse.');
      return;
    }
    if (!locationCode.trim()) {
      Alert.alert('Error', 'Please select a location.');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity (greater than 0).');
      return;
    }

    try {
      await saveProduct(
        {
          name: name.trim(),
          category: category.trim(),
          size: size.trim() || '',
          sku: sku.trim() || '',
          storeId: selectedStoreId,
          warehouseId: selectedWarehouseId,
          locationCode: locationCode.trim(),
          quantity: quantity,
          minimumQuantity: minimumQuantity || '1',
        },
        profile,
        data.inventory,
      );

      setName('');
      setCategory('');
      setSize('');
      setSku('');
      setLocationCode('');
      setQuantity('');
      Alert.alert('Success', 'Product added successfully!');
    } catch {
      Alert.alert('Error', 'Could not save product. Please try again.');
    }
  };

  const submitOperation = async (item: InventoryItem) => {
    try {
      if (operationType === 'receive') {
        await receiveStock(item, operationAmount, profile);
      } else if (operationType === 'adjust') {
        await adjustStock(item, operationAmount, operationReason || 'Manual adjustment', profile);
      } else if (operationType === 'damaged') {
        await removeDamagedStock(
          item,
          operationAmount,
          operationReason || 'Damaged stock removed',
          profile,
        );
      } else if (operationType === 'move') {
        const qty = Number(operationAmount || 0);
        const targetWarehouse = moveWarehouseId || moveWarehouses[0]?.id || '';
        const targetLocation = moveLocationCode || moveLocations[0]?.code || '';
        if (!targetWarehouse || !targetLocation) {
          throw new Error('Select destination warehouse and location.');
        }
        await moveStockWithinStore(
          item,
          {
            quantity: qty,
            toWarehouseId: targetWarehouse,
            toLocationCode: targetLocation,
          },
          profile,
        );
      }
      setOperationAmount('');
      setOperationReason('');
      setUpdateModalVisible(false);
      Alert.alert('Updated', 'Inventory has been updated.');
    } catch {
      Alert.alert('Error', 'Could not update stock.');
    }
  };

  // Compute active filter count
  const activeFilterCount = [
    storeId !== '',
    warehouseId !== '',
    categoryFilter !== '',
    sizeFilter !== '',
    locationFilter !== '',
    lowStockOnly,
  ].filter(Boolean).length;

  const openUpdateModal = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setOperationType('receive');
    setOperationAmount('');
    setOperationReason('');
    setMoveWarehouseId('');
    setMoveLocationCode('');
    setUpdateModalVisible(true);
  };

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Search, filter and manage your live inventory."
      title="Products"
      rightAction={
        selectedItem ? (
          <Pressable
            onPress={() => openUpdateModal(selectedItem)}
            style={styles.updateActionBtn}>
            <AppIcon name="edit" size={14} tintColor={colors.surface} />
            <Text style={styles.updateActionBtnText}>Update</Text>
          </Pressable>
        ) : undefined
      }>

      {/* ── Search Bar ─────────────────────────────────────────── */}
      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchIconWrap}>
            <AppIcon name="search" size={16} tintColor={colors.primary} />
          </View>
          <AppTextInput
            label=""
            onChangeText={setQuery}
            placeholder="Name, size, SKU, location, store…"
            value={query}
            style={styles.searchInput}
          />
        </View>

        {/* Filter toggle bar */}
        <View style={styles.filterBar}>
          <Pressable
            style={[styles.filterToggleBtn, filtersOpen && styles.filterToggleBtnActive]}
            onPress={() => setFiltersOpen(prev => !prev)}>
            <AppIcon
              name="filter"
              size={14}
              tintColor={filtersOpen ? colors.surface : colors.inkSoft}
            />
            <Text style={[styles.filterToggleText, filtersOpen && styles.filterToggleTextActive]}>
              Filters
            </Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Quick filter chips in a horizontal row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            {/* Store chips */}
            {data.stores.map(store => (
              <Pressable
                key={store.id}
                onPress={() => {
                  const next = storeId === store.id ? '' : store.id;
                  setStoreId(next);
                  if (!next) setWarehouseId('');
                }}
                style={[styles.chip, storeId === store.id && styles.chipActive]}>
                <Text style={[styles.chipText, storeId === store.id && styles.chipTextActive]}>
                  {store.name}
                </Text>
              </Pressable>
            ))}
            {/* Low stock chip */}
            <Pressable
              onPress={() => setLowStockOnly(prev => !prev)}
              style={[styles.chip, styles.chipDanger, lowStockOnly && styles.chipDangerActive]}>
              <AppIcon
                name="alertCircle"
                size={12}
                tintColor={lowStockOnly ? colors.surface : colors.danger}
              />
              <Text
                style={[
                  styles.chipText,
                  styles.chipDangerText,
                  lowStockOnly && styles.chipTextActive,
                ]}>
                Low Stock
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Expanded filter panel */}
        {filtersOpen && (
          <View style={styles.expandedFilters}>
            {/* Warehouse row */}
            {warehouses.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Warehouse</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}>
                  <Pressable
                    onPress={() => setWarehouseId('')}
                    style={[styles.chip, warehouseId === '' && styles.chipActive]}>
                    <Text style={[styles.chipText, warehouseId === '' && styles.chipTextActive]}>
                      All
                    </Text>
                  </Pressable>
                  {warehouses.map(wh => (
                    <Pressable
                      key={wh.id}
                      onPress={() => setWarehouseId(wh.id === warehouseId ? '' : wh.id)}
                      style={[styles.chip, warehouseId === wh.id && styles.chipActive]}>
                      <Text
                        style={[styles.chipText, warehouseId === wh.id && styles.chipTextActive]}>
                        {wh.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Category row */}
            {categories.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}>
                  <Pressable
                    onPress={() => setCategoryFilter('')}
                    style={[styles.chip, categoryFilter === '' && styles.chipActive]}>
                    <Text
                      style={[styles.chipText, categoryFilter === '' && styles.chipTextActive]}>
                      All
                    </Text>
                  </Pressable>
                  {categories.map(cat => (
                    <Pressable
                      key={cat}
                      onPress={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                      style={[styles.chip, categoryFilter === cat && styles.chipActive]}>
                      <Text
                        style={[styles.chipText, categoryFilter === cat && styles.chipTextActive]}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Size row */}
            {sizes.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Size</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}>
                  <Pressable
                    onPress={() => setSizeFilter('')}
                    style={[styles.chip, sizeFilter === '' && styles.chipActive]}>
                    <Text style={[styles.chipText, sizeFilter === '' && styles.chipTextActive]}>
                      All
                    </Text>
                  </Pressable>
                  {sizes.map(s => (
                    <Pressable
                      key={s}
                      onPress={() => setSizeFilter(s === sizeFilter ? '' : s)}
                      style={[styles.chip, sizeFilter === s && styles.chipActive]}>
                      <Text
                        style={[styles.chipText, sizeFilter === s && styles.chipTextActive]}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Location row */}
            {locationCodes.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Location</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}>
                  <Pressable
                    onPress={() => setLocationFilter('')}
                    style={[styles.chip, locationFilter === '' && styles.chipActive]}>
                    <Text
                      style={[styles.chipText, locationFilter === '' && styles.chipTextActive]}>
                      All
                    </Text>
                  </Pressable>
                  {locationCodes.map(code => (
                    <Pressable
                      key={code}
                      onPress={() => setLocationFilter(code === locationFilter ? '' : code)}
                      style={[styles.chip, locationFilter === code && styles.chipActive]}>
                      <Text
                        style={[
                          styles.chipText,
                          locationFilter === code && styles.chipTextActive,
                        ]}>
                        {code}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Reset all */}
            {activeFilterCount > 0 && (
              <Pressable
                style={styles.resetBtn}
                onPress={() => {
                  setStoreId('');
                  setWarehouseId('');
                  setCategoryFilter('');
                  setSizeFilter('');
                  setLocationFilter('');
                  setLowStockOnly(false);
                }}>
                <Text style={styles.resetBtnText}>✕ Reset all filters</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>



      <SectionHeader title="Live Inventory" meta={`${filteredInventory.length} items`} />

      {filteredInventory.length === 0 ? (
        <EmptyState
          icon="box"
          title="No products found"
          subtitle={profile?.role === 'admin' ? 'Add your first product above or adjust filters.' : 'Try adjusting your search filters.'}
        />
      ) : (
        filteredInventory.map(item => {
          const warehouse = data.warehouses.find(row => row.id === item.warehouseId);
          const store = data.stores.find(row => row.id === item.storeId);
          const alertLevel = getStockAlertLevel(item);
          const isSelected = selectedItem?.id === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSelectedItemId(item.id)}
              style={[styles.itemCard, alertLevel !== 'ok' && styles.itemCardAlert, isSelected && styles.itemCardSelected]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleWrap}>
                  <AppIcon name="box" size={16} tintColor={colors.primary} />
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
                <Text style={[styles.itemQty, alertLevel !== 'ok' && styles.itemQtyAlert]}>{item.quantity}</Text>
              </View>
              <View style={styles.metaRow}>
                <AppIcon name="store" size={12} tintColor={colors.muted} />
                <Text style={styles.metaText}>
                  {store?.name} · {warehouse?.name || 'Warehouse'} · {item.locationCode}
                </Text>
              </View>
              <Text style={styles.metaText}>
                {item.category} · Size {item.size || '—'} · SKU {item.sku || 'Not set'} · Min {item.minimumQuantity}
              </Text>
              <StatusBadge label={stockAlertLabel(alertLevel)} tone={alertTone(alertLevel)} />
              {isSelected ? (
                <View style={styles.selectedBadge}>
                  <AppIcon name="check" size={12} tintColor={colors.primary} />
                  <Text style={styles.selectedText}>Selected · tap Update</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })
      )}

      {profile?.role === 'admin' && (
        <Pressable
          onPress={() => navigation.navigate('NewProduct')}
          style={styles.fab}>
          <AppIcon name="plus" size={24} tintColor="#FFFFFF" />
        </Pressable>
      )}

      <Modal
        visible={updateModalVisible && !!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={() => setUpdateModalVisible(false)}
        statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setUpdateModalVisible(false)}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHandle} />
            {selectedItem ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <View style={styles.updateHeader}>
                  <View style={styles.updateIconWrap}>
                    <AppIcon name="edit" size={16} tintColor={colors.accent} />
                  </View>
                  <View style={styles.updateHeaderText}>
                    <Text style={styles.updateTitle}>Update Stock</Text>
                    <Text style={styles.updateItemName} numberOfLines={1}>
                      {selectedItem.name}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setUpdateModalVisible(false)}
                    hitSlop={8}
                    style={styles.modalCloseBtn}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </Pressable>
                </View>

                {profile?.role === 'admin' && (
                  <Pressable
                    onPress={() => {
                      setUpdateModalVisible(false);
                      navigation.navigate('NewProduct', { item: selectedItem });
                    }}
                    style={[styles.editDetailsBtn, styles.editDetailsBtnFull]}>
                    <Text style={styles.editDetailsBtnText}>Edit Product Details</Text>
                  </Pressable>
                )}

                {/* Operation chips */}
                <Text style={styles.filterGroupLabel}>Operation</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.chipRow, { marginBottom: spacing.md }]}>
                  {operations.map(op => (
                    <Pressable
                      key={op.value}
                      onPress={() => setOperationType(op.value)}
                      style={[styles.chip, operationType === op.value && styles.chipActive]}>
                      <Text
                        style={[
                          styles.chipText,
                          operationType === op.value && styles.chipTextActive,
                        ]}>
                        {op.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <AppTextInput
                  keyboardType="number-pad"
                  label={operationType === 'adjust' ? 'New Quantity' : 'Quantity'}
                  onChangeText={text => setOperationAmount(text.replace(/[^0-9]/g, ''))}
                  placeholder={operationType === 'adjust' ? String(selectedItem.quantity) : '0'}
                  value={operationAmount}
                />

                {operationType === 'move' ? (
                  <>
                    <Text style={styles.filterGroupLabel}>To Warehouse</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={[styles.chipRow, { marginBottom: spacing.md }]}>
                      {moveWarehouses.map(wh => (
                        <Pressable
                          key={wh.id}
                          onPress={() => setMoveWarehouseId(wh.id)}
                          style={[
                            styles.chip,
                            (moveWarehouseId || moveWarehouses[0]?.id) === wh.id &&
                              styles.chipActive,
                          ]}>
                          <Text
                            style={[
                              styles.chipText,
                              (moveWarehouseId || moveWarehouses[0]?.id) === wh.id &&
                                styles.chipTextActive,
                            ]}>
                            {wh.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Text style={styles.filterGroupLabel}>To Location</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={[styles.chipRow, { marginBottom: spacing.md }]}>
                      {moveLocations.map(loc => (
                        <Pressable
                          key={loc.code}
                          onPress={() => setMoveLocationCode(loc.code)}
                          style={[
                            styles.chip,
                            (moveLocationCode || moveLocations[0]?.code) === loc.code &&
                              styles.chipActive,
                          ]}>
                          <Text
                            style={[
                              styles.chipText,
                              (moveLocationCode || moveLocations[0]?.code) === loc.code &&
                                styles.chipTextActive,
                            ]}>
                            {loc.code}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}

                {operationType === 'adjust' || operationType === 'damaged' ? (
                  <AppTextInput
                    label="Reason / Notes"
                    onChangeText={setOperationReason}
                    placeholder="Adjustment reason"
                    value={operationReason}
                  />
                ) : null}
                <AppButton
                  disabled={!operationAmount}
                  onPress={() => submitOperation(selectedItem)}
                  title="Apply Update"
                />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  // ── Search Card ──────────────────────────────────────────────────────────────
  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
  },
  // ── Filter Bar ───────────────────────────────────────────────────────────────
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterToggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterToggleText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.inkSoft,
  },
  filterToggleTextActive: {
    color: colors.surface,
  },
  filterBadge: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.surface,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
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
  chipDanger: {
    borderColor: '#FECACA',
    backgroundColor: colors.cardTintRed,
  },
  chipDangerActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  chipDangerText: {
    color: colors.danger,
  },
  // ── Expanded filters ─────────────────────────────────────────────────────────
  expandedFilters: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filterGroup: {
    marginBottom: spacing.md,
  },
  filterGroupLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resetBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.cardTintRed,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: spacing.xs,
  },
  resetBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.danger,
  },
  // ── Create Card ──────────────────────────────────────────────────────────────
  createCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  createIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  // ── Inventory Item Card ───────────────────────────────────────────────────────
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  itemCardAlert: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  itemCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  itemName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    flex: 1,
  },
  itemQty: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.primary,
  },
  itemQtyAlert: {
    color: colors.danger,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  metaText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  selectedText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.primary,
  },
  // ── Update button (header) ───────────────────────────────────────────────────
  updateActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  updateActionBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.surface,
  },
  // ── Update Modal ─────────────────────────────────────────────────────────────
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
    maxHeight: '85%',
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
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  updateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  updateHeaderText: {
    flex: 1,
  },
  updateItemName: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    elevation: 8,
  },
  editDetailsBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.cardTintBlue,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  editDetailsBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    color: colors.accent,
  },
  editDetailsBtnFull: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
});
