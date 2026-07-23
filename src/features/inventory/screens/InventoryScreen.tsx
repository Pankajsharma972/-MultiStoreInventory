import React, { useMemo, useState, useRef } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppIcon } from '../../../components/AppIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { EmptyState } from '../../../components/EmptyState';
import { ProductThumbnail } from '../../../components/ProductThumbnail';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionHeader } from '../../../components/SectionHeader';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../auth/AuthProvider';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  resetInventoryFilters,
  setInventoryFilter,
} from '../../../store/slices/filtersSlice';
import {
  adjustStock,
  moveStockWithinStore,
  receiveStock,
  removeDamagedStock,
  deleteProduct,
} from '../../../services/inventoryRepository';
import {
  getStockAlertLevel,
  glazeLabel,
  inventorySearchText,
  matchesSearch,
  stockAlertLabel,
} from '../../../utils/inventoryHelpers';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { AppStackParamList } from '../../../navigation/types';
import type { InventoryItem, StockAlertLevel, StockOperationType } from '../../../types/models';

type Props = NativeStackScreenProps<AppStackParamList, 'Inventory'>;

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
   console.log('🖥️ InventoryScreen rendered');
  console.log('📦 Total inventory in data:', data.inventory.length);
  console.log('📦 First 3 items:', data.inventory.slice(0, 3).map(i => i.name));
  const dispatch = useAppDispatch();
  const filters = useAppSelector(state => state.filters.inventory);
  const query = filters.query;
  const storeId = filters.storeId;
  const warehouseId = filters.warehouseId;
  const categoryFilter = filters.category;
  const brandFilter = filters.brand;
  const sizeFilter = filters.size;
  const locationFilter = filters.location;
  const lowStockOnly = filters.lowStockOnly;
  const setQuery = (value: string) => dispatch(setInventoryFilter({ key: 'query', value }));
  const setStoreId = (value: string) => dispatch(setInventoryFilter({ key: 'storeId', value }));
  const setWarehouseId = (value: string) =>
    dispatch(setInventoryFilter({ key: 'warehouseId', value }));
  const setCategoryFilter = (value: string) =>
    dispatch(setInventoryFilter({ key: 'category', value }));
  const setBrandFilter = (value: string) => dispatch(setInventoryFilter({ key: 'brand', value }));
  const setSizeFilter = (value: string) => dispatch(setInventoryFilter({ key: 'size', value }));
  const setLocationFilter = (value: string) =>
    dispatch(setInventoryFilter({ key: 'location', value }));
  const setLowStockOnly = (value: boolean) =>
    dispatch(setInventoryFilter({ key: 'lowStockOnly', value }));
  
  const [filterPopupVisible, setFilterPopupVisible] = useState(false);
  const filterButtonRef = useRef<View>(null);
  const [filterButtonLayout, setFilterButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const [operationType, setOperationType] = useState<StockOperationType>('receive');
  const [operationAmount, setOperationAmount] = useState('');
  const [moveWarehouseId, setMoveWarehouseId] = useState('');
  const [moveLocationCode, setMoveLocationCode] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuItemId, setContextMenuItemId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Godowns (warehouses) belonging to the store selected in the filter bar.
  const filterWarehouses = data.warehouses.filter(
    warehouse => warehouse.storeId === storeId,
  );

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
  const brands = useMemo(
    () =>
      Array.from(
        new Set(data.inventory.map(item => item.brand).filter((val): val is string => Boolean(val))),
      ),
    [data.inventory],
  );

  const filteredInventory = useMemo(() => {
    return data.inventory.filter(item => {
      const warehouse = data.warehouses.find(row => row.id === item.warehouseId);
      const storeName = data.stores.find(store => store.id === item.storeId)?.name;
      const matchesText = matchesSearch(
        inventorySearchText(item, [warehouse?.name || '', storeName || '']),
        query,
      );
      const matchesStore = storeId === '' || item.storeId === storeId;
      const matchesWarehouse = warehouseId === '' || item.warehouseId === warehouseId;
      const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
      const matchesBrand = brandFilter === '' || item.brand === brandFilter;
      const matchesSize = sizeFilter === '' || item.size === sizeFilter;
      const matchesLocation = locationFilter === '' || item.locationCode === locationFilter;
      const matchesLowStock = !lowStockOnly || getStockAlertLevel(item) !== 'ok';
      return (
        matchesText &&
        matchesStore &&
        matchesWarehouse &&
        matchesCategory &&
        matchesBrand &&
        matchesSize &&
        matchesLocation &&
        matchesLowStock
      );
    });
  }, [
    brandFilter,
    categoryFilter,
    data.inventory,
    data.stores,
    data.warehouses,
    locationFilter,
    lowStockOnly,
    query,
    storeId,
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

  const submitOperation = async (item: InventoryItem) => {
    try {
      if (operationType === 'receive') {
        await receiveStock(item, operationAmount, profile);
      } else if (operationType === 'adjust') {
        await adjustStock(item, operationAmount, 'Manual adjustment', profile);
      } else if (operationType === 'damaged') {
        await removeDamagedStock(
          item,
          operationAmount,
          'Damaged stock removed',
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
    brandFilter !== '',
    sizeFilter !== '',
    locationFilter !== '',
    lowStockOnly,
  ].filter(Boolean).length;

  const openUpdateModal = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setOperationType('adjust');
    setOperationAmount(String(item.quantity));
    setMoveWarehouseId('');
    setMoveLocationCode('');
    setUpdateModalVisible(true);
  };

  const handleLongPress = (item: InventoryItem) => {
    setContextMenuItemId(item.id);
    setContextMenuVisible(true);
  };

 const handleDeleteProduct = () => {
  const item = data.inventory.find(i => i.id === contextMenuItemId);
  if (!item) return;

  // Close bottom sheet first
  setContextMenuVisible(false);

  // Wait for animation
  setTimeout(() => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${item.name}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(item, profile);
              Alert.alert('Success', 'Product deleted successfully.');
            } catch (error) {
              Alert.alert(
                'Error',
                (error as Error).message || 'Could not delete product.',
              );
            }
          },
        },
      ],
    );
  }, 250); // wait until modal closes
};

  const handleEditProduct = () => {
    const item = data.inventory.find(i => i.id === contextMenuItemId);
    if (item) {
      setContextMenuVisible(false);
      navigation.navigate('NewProduct', { item });
    }
  };

  // Filter option handler - applies filter and closes popup
  const handleFilterSelect = (action: () => void) => {
    action();
    setFilterPopupVisible(false);
  };

  // Get selected store name
  const selectedStoreName = data.stores.find(s => s.id === storeId)?.name || 'All Stores';

  // Context Menu Component
  const ContextMenu = () => (
    <Modal
      visible={contextMenuVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setContextMenuVisible(false)}
      statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setContextMenuVisible(false)}
        />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.modalHandle} />
          <Pressable onPress={handleEditProduct} style={styles.contextMenuItem}>
            <AppIcon name="edit" size={16} tintColor={colors.primary} />
            <Text style={styles.contextMenuItemText}>Edit Details</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const item = data.inventory.find(i => i.id === contextMenuItemId);
              setContextMenuVisible(false);
              if (item) {
                openUpdateModal(item);
              }
            }}
            style={styles.contextMenuItem}>
            <AppIcon name="box" size={16} tintColor={colors.accent} />
            <Text style={styles.contextMenuItemText}>Update Stock</Text>
          </Pressable>
          <Pressable
            onPress={handleDeleteProduct}
            style={[styles.contextMenuItem, styles.contextMenuItemDanger]}>
            <AppIcon name="trash" size={16} tintColor={colors.danger} />
            <Text style={[styles.contextMenuItemText, styles.contextMenuItemTextDanger]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  // Filter Popup Component
  const FilterPopup = () => (
    <View 
      style={[
        styles.filterPopup,
        {
          top: filterButtonLayout.y + filterButtonLayout.height + 8,
          right: 0,
          width: 300,
        }
      ]}
    >
      <View style={[styles.filterPopupArrow, { right: 16 }]} />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={styles.filterPopupScroll}
        contentContainerStyle={styles.filterPopupContent}>
        
        {/* Store filter - Dropdown style with list */}
        <View style={styles.filterPopupGroup}>
          <View style={styles.filterPopupLabelRow}>
            <Text style={styles.filterPopupLabel}>Store</Text>
            <Text style={styles.filterPopupSelectedValue}>{selectedStoreName}</Text>
          </View>
          
          {/* Store list with scrolling */}
          <View style={styles.storeListContainer}>
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storeListContent}>
              <Pressable
                onPress={() => handleFilterSelect(() => setStoreId(''))}
                style={[styles.storeItem, storeId === '' && styles.storeItemActive]}>
                <Text style={[styles.storeItemText, storeId === '' && styles.storeItemTextActive]}>
                  All Stores
                </Text>
              </Pressable>
              {data.stores.map(store => (
                <Pressable
                  key={store.id}
                  onPress={() => handleFilterSelect(() => setStoreId(store.id === storeId ? '' : store.id))}
                  style={[styles.storeItem, storeId === store.id && styles.storeItemActive]}>
                  <Text 
                    style={[styles.storeItemText, storeId === store.id && styles.storeItemTextActive]}
                    numberOfLines={1}>
                    {store.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Brand filter */}
        {brands.length > 0 && (
          <View style={styles.filterPopupGroup}>
            <Text style={styles.filterPopupLabel}>Brand</Text>
            <View style={styles.filterPopupOptions}>
              <Pressable
                onPress={() => handleFilterSelect(() => setBrandFilter(''))}
                style={[styles.filterPopupOptionSmall, brandFilter === '' && styles.filterPopupOptionActive]}>
                <Text style={[styles.filterPopupOptionTextSmall, brandFilter === '' && styles.filterPopupOptionTextActive]}>
                  All
                </Text>
              </Pressable>
              {brands.slice(0, 4).map(b => (
                <Pressable
                  key={b}
                  onPress={() => handleFilterSelect(() => setBrandFilter(b === brandFilter ? '' : b))}
                  style={[styles.filterPopupOptionSmall, brandFilter === b && styles.filterPopupOptionActive]}>
                  <Text 
                    style={[styles.filterPopupOptionTextSmall, brandFilter === b && styles.filterPopupOptionTextActive]}
                    numberOfLines={1}>
                    {b}
                  </Text>
                </Pressable>
              ))}
              {brands.length > 4 && (
                <Pressable
                  style={[styles.filterPopupOptionSmall, styles.filterPopupOptionMore]}>
                  <Text style={[styles.filterPopupOptionTextSmall, styles.filterPopupOptionTextMore]}>
                    +{brands.length - 4}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Category filter */}
        {categories.length > 0 && (
          <View style={styles.filterPopupGroup}>
            <Text style={styles.filterPopupLabel}>Category</Text>
            <View style={styles.filterPopupOptions}>
              <Pressable
                onPress={() => handleFilterSelect(() => setCategoryFilter(''))}
                style={[styles.filterPopupOptionSmall, categoryFilter === '' && styles.filterPopupOptionActive]}>
                <Text style={[styles.filterPopupOptionTextSmall, categoryFilter === '' && styles.filterPopupOptionTextActive]}>
                  All
                </Text>
              </Pressable>
              {categories.slice(0, 4).map(cat => (
                <Pressable
                  key={cat}
                  onPress={() => handleFilterSelect(() => setCategoryFilter(cat === categoryFilter ? '' : cat))}
                  style={[styles.filterPopupOptionSmall, categoryFilter === cat && styles.filterPopupOptionActive]}>
                  <Text 
                    style={[styles.filterPopupOptionTextSmall, categoryFilter === cat && styles.filterPopupOptionTextActive]}
                    numberOfLines={1}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
              {categories.length > 4 && (
                <Pressable
                  style={[styles.filterPopupOptionSmall, styles.filterPopupOptionMore]}>
                  <Text style={[styles.filterPopupOptionTextSmall, styles.filterPopupOptionTextMore]}>
                    +{categories.length - 4}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Size filter */}
        {sizes.length > 0 && (
          <View style={styles.filterPopupGroup}>
            <Text style={styles.filterPopupLabel}>Size</Text>
            <View style={styles.filterPopupOptions}>
              <Pressable
                onPress={() => handleFilterSelect(() => setSizeFilter(''))}
                style={[styles.filterPopupOptionSmall, sizeFilter === '' && styles.filterPopupOptionActive]}>
                <Text style={[styles.filterPopupOptionTextSmall, sizeFilter === '' && styles.filterPopupOptionTextActive]}>
                  All
                </Text>
              </Pressable>
              {sizes.slice(0, 4).map(s => (
                <Pressable
                  key={s}
                  onPress={() => handleFilterSelect(() => setSizeFilter(s === sizeFilter ? '' : s))}
                  style={[styles.filterPopupOptionSmall, sizeFilter === s && styles.filterPopupOptionActive]}>
                  <Text 
                    style={[styles.filterPopupOptionTextSmall, sizeFilter === s && styles.filterPopupOptionTextActive]}
                    numberOfLines={1}>
                    {s}
                  </Text>
                </Pressable>
              ))}
              {sizes.length > 4 && (
                <Pressable
                  style={[styles.filterPopupOptionSmall, styles.filterPopupOptionMore]}>
                  <Text style={[styles.filterPopupOptionTextSmall, styles.filterPopupOptionTextMore]}>
                    +{sizes.length - 4}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Low Stock toggle - made compact */}
        <View style={styles.filterPopupGroup}>
          <Text style={styles.filterPopupLabel}>Stock Status</Text>
          <Pressable
            onPress={() => handleFilterSelect(() => setLowStockOnly(!lowStockOnly))}
            style={[styles.filterPopupOptionCompact, lowStockOnly && styles.filterPopupOptionDanger]}>
            <AppIcon
              name="alertCircle"
              size={14}
              tintColor={lowStockOnly ? colors.surface : colors.danger}
            />
            <Text style={[
              styles.filterPopupOptionTextSmall,
              lowStockOnly && styles.filterPopupOptionTextActive
            ]}>
              Low Stock
            </Text>
          </Pressable>
        </View>

        {/* Reset all */}
        {activeFilterCount > 0 && (
          <Pressable
            style={styles.filterPopupReset}
            onPress={() => handleFilterSelect(() => dispatch(resetInventoryFilters()))}>
            <Text style={styles.filterPopupResetText}>Reset all filters</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Search, filter and manage your live inventory."
      title="Products"
      rightAction={
  <Pressable
    onPress={() => navigation.navigate('NewProduct')}
    style={styles.headerAddBtn}>
    <AppIcon name="plus" size={20} tintColor={colors.surface} />
  </Pressable>
}
>
      {/* ── Search Card ─────────────────────────────────────────── */}
      <View style={styles.searchCard}>
        {/* Search Row with integrated search icon */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <View style={styles.searchInputContainer}>
              <AppIcon name="search" size={16} tintColor={colors.muted} style={styles.searchIconInside} />
              <TextInput
                style={styles.searchInput}
                onChangeText={setQuery}
                placeholder="Search products by name, SKU, location..."
                placeholderTextColor={colors.muted}
                value={query}
              />
              {query.length > 0 && (
                <Pressable
                  onPress={() => setQuery('')}
                  style={styles.clearSearchBtn}>
                  <Text style={styles.clearSearchText}>✕</Text>
                </Pressable>
              )}
            </View>
          </View>
          
          {/* Filter Button with badge */}
          <Pressable
            ref={filterButtonRef}
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout;
              setFilterButtonLayout({ x, y, width, height });
            }}
            style={[styles.filterToggleBtn, activeFilterCount > 0 && styles.filterToggleBtnActive]}
            onPress={() => setFilterPopupVisible(!filterPopupVisible)}>
            <AppIcon
              name="filter"
              size={18}
              tintColor={activeFilterCount > 0 ? colors.surface : colors.inkSoft}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Active filters summary - show what filters are applied */}
        {activeFilterCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersSummary}>
            {storeId !== '' && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>
                  Store: {data.stores.find(s => s.id === storeId)?.name}
                </Text>
              </View>
            )}
            {warehouseId !== '' && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>
                  Godown: {data.warehouses.find(w => w.id === warehouseId)?.name}
                </Text>
              </View>
            )}
            {brandFilter !== '' && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>Brand: {brandFilter}</Text>
              </View>
            )}
            {categoryFilter !== '' && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>Category: {categoryFilter}</Text>
              </View>
            )}
            {sizeFilter !== '' && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>Size: {sizeFilter}</Text>
              </View>
            )}
            {locationFilter !== '' && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>Location: {locationFilter}</Text>
              </View>
            )}
            {lowStockOnly && (
              <View style={[styles.activeFilterChip, styles.activeFilterChipDanger]}>
                <Text style={[styles.activeFilterChipText, styles.activeFilterChipTextDanger]}>
                  Low Stock
                </Text>
              </View>
            )}
          </ScrollView>
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
              onLongPress={() => handleLongPress(item)}
              delayLongPress={500}
              style={[styles.itemCard, alertLevel !== 'ok' && styles.itemCardAlert, isSelected && styles.itemCardSelected]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleWrap}>
                  <ProductThumbnail uri={item.photoUrl} size={44} />
                  <View style={styles.itemTitleTextWrap}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.brand ? (
                      <Text style={styles.itemBrand}>{item.brand}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.itemHeaderRight}>
                  <Text style={[styles.itemQty, alertLevel !== 'ok' && styles.itemQtyAlert]}>{item.quantity}</Text>
                  <Pressable
                    onPress={() => openUpdateModal(item)}
                    hitSlop={8}
                    style={styles.cardEditBtn}>
                    <AppIcon name="edit" size={16} tintColor={colors.accent} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.metaRow}>
                <AppIcon name="store" size={12} tintColor={colors.muted} />
                <Text style={styles.metaText}>
                  {store?.name} · {warehouse?.name || 'Warehouse'} · {item.locationCode}
                </Text>
              </View>
              <Text style={styles.metaText}>
                {item.category} · Size {item.size || '—'}
                {item.glaze ? ` · ${glazeLabel(item.glaze)}` : ''} · SKU {item.sku || 'Not set'} · Min {item.minimumQuantity}
              </Text>
              <StatusBadge label={stockAlertLabel(alertLevel)} tone={alertTone(alertLevel)} />
              {isSelected ? (
                <View style={styles.selectedBadge}>
                  <AppIcon name="check" size={12} tintColor={colors.primary} />
                  <Text style={styles.selectedText}>Selected</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })
      )}

      {/* {profile?.role === 'admin' && (
        <Pressable
          onPress={() => navigation.navigate('NewProduct')}
          style={styles.fab}>
          <AppIcon name="plus" size={24} tintColor="#FFFFFF" />
        </Pressable>
      )} */}

      {/* Filter Popup - positioned near the filter button */}
      {filterPopupVisible && (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFilterPopupVisible(false)}
          />
          <FilterPopup />
        </>
      )}

      {/* Context Menu - for product long-press */}
      {contextMenuVisible && <ContextMenu />}

      {/* Update Stock Modal */}
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
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
              <View style={styles.modalHandle} />
              {selectedItem ? (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}>
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
                        onPress={() => {
                          setOperationType(op.value);
                          setOperationAmount(op.value === 'adjust' ? String(selectedItem.quantity) : '');
                        }}
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

                  <AppButton
                    disabled={!operationAmount}
                    onPress={() => submitOperation(selectedItem)}
                    title="Apply Update"
                    style={styles.applyBtn}
                  />
                </ScrollView>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: spacing.lg,
  },
  applyBtn: {
    marginTop: spacing.md,
  },
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
    width: '100%',
  },
  searchInputWrapper: {
    flex: 1,
    minWidth: 0,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIconInside: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  headerAddBtn: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: colors.primary,
  alignItems: 'center',
  justifyContent: 'center',
  ...shadows.sm,
},
  clearSearchText: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: typography.fontFamily.medium,
  },
  // ── Filter Button ────────────────────────────────────────────────────────────
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
    minWidth: 44,
    height: 44,
    position: 'relative',
  },
  filterToggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterBadge: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    position: 'absolute',
    top: -6,
    right: -6,
  },
  filterBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.surface,
  },
  // ── Active Filters Summary ──────────────────────────────────────────────────
  activeFiltersSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  activeFilterChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  activeFilterChipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.primary,
  },
  activeFilterChipDanger: {
    backgroundColor: colors.cardTintRed,
    borderColor: colors.danger,
  },
  activeFilterChipTextDanger: {
    color: colors.danger,
  },
  // ── Filter Popup ─────────────────────────────────────────────────────────────
  filterPopup: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    ...shadows.lg,
    elevation: 10,
    zIndex: 1000,
    maxHeight: 440,
  },
  filterPopupArrow: {
    position: 'absolute',
    top: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.surface,
    zIndex: 1001,
  },
  filterPopupScroll: {
    maxHeight: 420,
  },
  filterPopupContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  filterPopupGroup: {
    marginBottom: spacing.sm,
  },
  filterPopupLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  filterPopupLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterPopupSelectedValue: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    maxWidth: 150,
  },
  // Store list styles
  storeListContainer: {
    marginTop: spacing.xs,
  },
  storeListContent: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  storeItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 60,
  },
  storeItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  storeItemText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.inkSoft,
  },
  storeItemTextActive: {
    color: colors.surface,
  },
  filterPopupOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  // Small compact option for filters
  filterPopupOptionSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPopupOptionCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  filterPopupOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPopupOptionDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  filterPopupOptionMore: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  filterPopupOptionTextSmall: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.inkSoft,
  },
  filterPopupOptionTextMore: {
    color: colors.muted,
    fontSize: 10,
  },
  filterPopupOptionTextActive: {
    color: colors.surface,
  },
  filterPopupReset: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.cardTintRed,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  filterPopupResetText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.danger,
  },
  // ── Filter Modal (for reference) ────────────────────────────────────────────
  filterModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '90%',
    ...shadows.lg,
  },
  filterModalContent: {
    flex: 1,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  filterModalTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.ink,
  },
  filterModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalCloseText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.muted,
  },
  filterGroup: {
    marginBottom: spacing.lg,
  },
  filterGroupLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    alignSelf: 'flex-start',
  },
  chipDangerActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  chipDangerText: {
    color: colors.danger,
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
    marginBottom: spacing.md,
  },
  resetBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.danger,
  },
  applyFilterBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
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
  itemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.cardTintBlue,
    borderWidth: 1,
    borderColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  itemTitleTextWrap: {
    flex: 1,
  },
  itemName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  itemBrand: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
    marginTop: 2,
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
  // ── Modals ──────────────────────────────────────────────────────────────────
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
  // Context Menu Styles
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  contextMenuItemDanger: {
    backgroundColor: colors.cardTintRed,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  contextMenuItemText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  contextMenuItemTextDanger: {
    color: colors.danger,
  },
});