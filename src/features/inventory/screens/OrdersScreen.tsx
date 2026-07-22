import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppIcon } from '../../../components/AppIcon';
import { EmptyState } from '../../../components/EmptyState';
import { FilterChips } from '../../../components/FilterChips';
import { ProductThumbnail } from '../../../components/ProductThumbnail';
import { ScreenShell } from '../../../components/ScreenShell';
import { SelectPill } from '../../../components/SelectPill';
import { StatusBadge } from '../../../components/StatusBadge';
import { readableDate, updateOrderStatus, deleteOrder } from '../../../services/inventoryRepository';
import { useInventoryData } from '../../../services/useInventoryData';
import { useAuth } from '../../auth/AuthProvider';
import {
  orderStatusFlow,
  orderStatusLabel,
  orderStatusTone,
  resolveOrderItems,
} from '../../../utils/inventoryHelpers';
import type { AppStackParamList } from '../../../navigation/types';
import type { OrderStatus } from '../../../types/models';
import { colors } from '../../../theme/colors';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';

type Props = NativeStackScreenProps<AppStackParamList, 'Orders'>;
const statuses: OrderStatus[] = orderStatusFlow;
const ALL = '__all__';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function OrdersScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const data = useInventoryData();
  const [storeId, setStoreId] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | typeof ALL>(ALL);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPopupVisible, setFilterPopupVisible] = useState(false);
  const [filterPopupPosition, setFilterPopupPosition] = useState({ top: 0, right: 0 });
  const filterButtonRef = useRef<View>(null);

  // Loading state
  if (!data || !data.orders) {
    return (
      <ScreenShell
        onBack={navigation.canGoBack() ? navigation.goBack : undefined}
        subtitle="Track orders through ordered → billed → out for delivery → delivered."
        title="Orders"
        scrollable={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </ScreenShell>
    );
  }

  // Filter orders based on search query
  const filteredOrders = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return data.orders.filter(order => {
      // First apply status and store filters
      const matchesStatus = statusFilter === ALL || order.status === statusFilter;
      const matchesStore = storeId === '' || storeId === ALL || order.storeId === storeId;

      if (!matchesStatus || !matchesStore) return false;

      // If no search query, return all matched orders
      if (!searchLower) return true;

      // Search in customer name
      const customerMatch = order.customerName?.toLowerCase().includes(searchLower) || false;

      // Search in order items (products)
      const orderItems = resolveOrderItems(order);
      const productMatch = orderItems.some(item =>
        item.productName?.toLowerCase().includes(searchLower) ||
        item.brand?.toLowerCase().includes(searchLower) ||
        item.size?.toLowerCase().includes(searchLower)
      );

      // Search in store name
      const store = data.stores.find(row => row.id === order.storeId);
      const storeMatch = store?.name?.toLowerCase().includes(searchLower) || false;

      // Search in order ID
      const idMatch = order.id?.toLowerCase().includes(searchLower) || false;

      return customerMatch || productMatch || storeMatch || idMatch;
    });
  }, [data.orders, statusFilter, storeId, searchQuery, data.stores]);

  // Get unique products from filtered orders for search suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const productSet = new Set<string>();
    const suggestions: string[] = [];

    filteredOrders.forEach(order => {
      const items = resolveOrderItems(order);
      items.forEach(item => {
        const productName = item.productName?.toLowerCase() || '';
        const brand = item.brand?.toLowerCase() || '';
        const size = item.size?.toLowerCase() || '';

        // Add product name if it matches search
        if (productName.includes(searchQuery.toLowerCase()) && !productSet.has(productName)) {
          productSet.add(productName);
          suggestions.push(item.productName);
        }

        // Add brand if it matches search
        if (brand.includes(searchQuery.toLowerCase()) && !productSet.has(brand)) {
          productSet.add(brand);
          suggestions.push(item.brand);
        }
      });
    });

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }, [filteredOrders, searchQuery]);

  const handleLongPress = (orderId: string) => {
    setSelectedOrderId(orderId);
    setModalVisible(true);
  };

  const handleDeleteOrder = async () => {
    const order = data.orders.find(o => o.id === selectedOrderId);
    if (!order) return;

    Alert.alert(
      'Delete Order',
      `Are you sure you want to delete the order from ${order.customerName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrder(order, profile);
              setModalVisible(false);
              setSelectedOrderId(null);
              Alert.alert('Success', 'Order deleted successfully.');
            } catch (error) {
              Alert.alert('Error', (error as Error).message || 'Could not delete order.');
            }
          },
        },
      ],
    );
  };

  // Get selected order for modal
  const selectedOrder = data.orders.find(o => o.id === selectedOrderId);

  // Toggle filter popup
  const toggleFilterPopup = useCallback(() => {
    if (filterPopupVisible) {
      setFilterPopupVisible(false);
      return;
    }

    // Use setTimeout to ensure the ref is available
    setTimeout(() => {
      if (filterButtonRef.current) {
        // measureInWindow gives coordinates relative to the screen/window,
        // which fixes the popup jumping to the left side of the screen.
        filterButtonRef.current.measureInWindow((x, y, width, height) => {
          setFilterPopupPosition({
            top: y + height + 8,
            right: SCREEN_WIDTH - x - width,
          });
          setFilterPopupVisible(true);
        });
      }
    }, 100);
  }, [filterPopupVisible]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setStoreId('');
    setStatusFilter(ALL);
    setSearchQuery('');
    setFilterPopupVisible(false);
  }, []);

  // Handle store filter selection - closes popup automatically
  const handleStoreSelect = useCallback((id: string) => {
    setStoreId(id);
    setFilterPopupVisible(false);
  }, []);

  // Handle status filter selection - closes popup automatically
  const handleStatusSelect = useCallback((status: OrderStatus | typeof ALL) => {
    setStatusFilter(status);
    setFilterPopupVisible(false);
  }, []);

  // Render order item
  const renderOrder = ({ item: order }: { item: typeof data.orders[0] }) => {
    const store = data.stores.find(row => row.id === order.storeId)?.name || 'Store';
    return (
      <Pressable
        key={order.id}
        onLongPress={() => handleLongPress(order.id)}
        delayLongPress={500}
        style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderTitleWrap}>
            <AppIcon name="shoppingBag" size={16} tintColor={colors.accent} />
            <Text style={styles.customerName}>{order.customerName}</Text>
          </View>
          <StatusBadge
            label={orderStatusLabel(order.status)}
            tone={orderStatusTone(order.status)}
          />
        </View>
        {resolveOrderItems(order).map((line, index) => (
          <View key={`${line.productId}-${index}`} style={styles.lineRow}>
            <ProductThumbnail uri={line.photoUrl} size={36} radius={8} />
            <Text style={styles.itemDetail} numberOfLines={1}>
              {line.productName}
              {line.brand ? ` · ${line.brand}` : ''} × {line.quantity}
            </Text>
          </View>
        ))}
        <View style={styles.metaRow}>
          <AppIcon name="store" size={14} tintColor={colors.muted} />
          <Text style={styles.metaText}>{store}</Text>
        </View>
        <View style={styles.metaRow}>
          <AppIcon name="delivery" size={14} tintColor={colors.muted} />
          <Text style={styles.metaText}>
            {order.deliveryStatus.replaceAll('_', ' ')} · Due {order.expectedDeliveryDate || 'Not set'}
          </Text>
        </View>
        <Text style={styles.metaTextMuted}>{readableDate(order.createdAt)}</Text>
        <View style={styles.statusPickerWrap}>
          <SelectPill
            label="Change Status"
            onChange={value => updateOrderStatus(order, value as OrderStatus, profile)}
            options={statuses.map(status => ({ label: orderStatusLabel(status), value: status }))}
            value={order.status}
          />
        </View>
      </Pressable>
    );
  };

  // Header component containing only the search bar + suggestions.
  // The filter popup is rendered separately as a Modal (see filterPopupModal
  // below) so it always renders above the FlatList content, instead of
  // living inside ListHeaderComponent where Android's elevation/zIndex
  // stacking could push it behind later list items.
  const renderHeader = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchWrapper}>
        <AppIcon name="search" size={20} tintColor={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product, customer, store..."
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}>
            <AppIcon name="close" size={16} tintColor={colors.muted} />
          </Pressable>
        )}

        {/* Filter Button with Badge */}
        <View ref={filterButtonRef} collapsable={false}>
          <Pressable
            style={styles.filterButton}
            onPress={toggleFilterPopup}>
            <AppIcon name="filter" size={20} tintColor={colors.primary} />
            {(storeId || statusFilter !== ALL) && (
              <View style={styles.filterBadge} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Search Suggestions */}
      {searchQuery.length > 0 && searchSuggestions.length > 0 && !filterPopupVisible && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Product Suggestions</Text>
          {searchSuggestions.map((suggestion, index) => (
            <Pressable
              key={index}
              style={styles.suggestionItem}
              onPress={() => setSearchQuery(suggestion)}>
              <AppIcon name="tag" size={14} tintColor={colors.primary} />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  // Filter popup rendered as a transparent Modal. Modals render in a
  // separate native layer above everything else (including FlatList
  // content), so this guarantees the popup is never hidden behind the
  // order cards, regardless of zIndex/elevation stacking quirks.
  const filterPopupModal = (
    <Modal
      animationType="fade"
      transparent
      visible={filterPopupVisible}
      onRequestClose={() => setFilterPopupVisible(false)}>
      <TouchableWithoutFeedback onPress={() => setFilterPopupVisible(false)}>
        <View style={styles.popupOverlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.filterPopup,
              {
                top: filterPopupPosition.top,
                right: filterPopupPosition.right,
              }
            ]}>
              <View style={styles.popupArrow} />
              <View style={styles.popupContent}>
                <View style={styles.popupHeader}>
                  <Text style={styles.popupTitle}>Filters</Text>
                  <Pressable onPress={resetFilters}>
                    <Text style={styles.resetText}>Reset All</Text>
                  </Pressable>
                </View>

                <View style={styles.popupDivider} />

                {/* Store Filter */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Store</Text>
                  <View style={styles.filterOptions}>
                    <Pressable
                      style={[
                        styles.filterOption,
                        storeId === '' && styles.filterOptionActive,
                      ]}
                      onPress={() => handleStoreSelect('')}>
                      <Text style={[
                        styles.filterOptionText,
                        storeId === '' && styles.filterOptionTextActive,
                      ]}>All Stores</Text>
                    </Pressable>
                    {data.stores.map(store => (
                      <Pressable
                        key={store.id}
                        style={[
                          styles.filterOption,
                          storeId === store.id && styles.filterOptionActive,
                        ]}
                        onPress={() => handleStoreSelect(store.id)}>
                        <Text style={[
                          styles.filterOptionText,
                          storeId === store.id && styles.filterOptionTextActive,
                        ]}>{store.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.popupDivider} />

                {/* Status Filter */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Status</Text>
                  <View style={styles.filterOptions}>
                    <Pressable
                      style={[
                        styles.filterOption,
                        statusFilter === ALL && styles.filterOptionActive,
                      ]}
                      onPress={() => handleStatusSelect(ALL)}>
                      <Text style={[
                        styles.filterOptionText,
                        statusFilter === ALL && styles.filterOptionTextActive,
                      ]}>All Statuses</Text>
                    </Pressable>
                    {statuses.map(status => (
                      <Pressable
                        key={status}
                        style={[
                          styles.filterOption,
                          statusFilter === status && styles.filterOptionActive,
                        ]}
                        onPress={() => handleStatusSelect(status)}>
                        <Text style={[
                          styles.filterOptionText,
                          statusFilter === status && styles.filterOptionTextActive,
                        ]}>{orderStatusLabel(status)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderEmpty = () => {
    if (searchQuery.length > 0 && filteredOrders.length === 0) {
      return (
        <EmptyState
          icon="search"
          title="No results found"
          subtitle={`No orders match "${searchQuery}". Try a different search term.`}
        />
      );
    }
    if (filteredOrders.length === 0) {
      return (
        <EmptyState icon="shoppingBag" title="No orders found" subtitle="Adjust filters or book a new customer order." />
      );
    }
    return null;
  };

  return (
    <ScreenShell
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      subtitle="Track orders through ordered → billed → out for delivery → delivered."
      title="Orders"
      scrollable={false}>

      {/* Single VirtualizedList: search bar + filter popup are rendered as the
          list header, and the empty state as ListEmptyComponent. ScreenShell
          is given scrollable={false} above so this FlatList is not nested
          inside ScreenShell's internal ScrollView. */}
      <FlatList
        style={styles.flatList}
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
      />

      {filterPopupModal}

      {/* Delete Order Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalIconWrap}>
                    <AppIcon name="shoppingBag" size={24} tintColor={colors.danger} />
                  </View>
                  <Text style={styles.modalTitle}>Delete Order</Text>
                </View>

                {selectedOrder && (
                  <View style={styles.modalOrderInfo}>
                    <Text style={styles.modalOrderLabel}>Order Details</Text>
                    <View style={styles.modalOrderRow}>
                      <Text style={styles.modalOrderLabelText}>Customer:</Text>
                      <Text style={styles.modalOrderValue}>{selectedOrder.customerName}</Text>
                    </View>
                    <View style={styles.modalOrderRow}>
                      <Text style={styles.modalOrderLabelText}>Status:</Text>
                      <Text style={styles.modalOrderValue}>
                        {orderStatusLabel(selectedOrder.status)}
                      </Text>
                    </View>
                    <View style={styles.modalOrderRow}>
                      <Text style={styles.modalOrderLabelText}>Items:</Text>
                      <Text style={styles.modalOrderValue}>
                        {resolveOrderItems(selectedOrder).length} items
                      </Text>
                    </View>
                    <View style={styles.modalOrderRow}>
                      <Text style={styles.modalOrderLabelText}>Created:</Text>
                      <Text style={styles.modalOrderValue}>
                        {readableDate(selectedOrder.createdAt)}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.modalDivider} />

                <Text style={styles.modalWarningText}>
                  Are you sure you want to delete this order? This action cannot be undone.
                </Text>

                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalButtonCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonDelete]}
                    onPress={handleDeleteOrder}>
                    <AppIcon name="trash" size={16} tintColor="#FFFFFF" />
                    <Text style={styles.modalButtonDeleteText}>Delete Order</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Pressable
        onPress={() => navigation.navigate('BookOrder')}
        style={styles.fab}>
        <AppIcon name="plus" size={24} tintColor="#FFFFFF" />
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.muted,
    marginTop: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardTintGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  orderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  customerName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    flex: 1,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  itemDetail: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.inkSoft,
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
    flex: 1,
  },
  metaTextMuted: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  statusPickerWrap: {
    marginTop: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
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
  // Search Styles
  searchContainer: {
    marginBottom: spacing.md,
    zIndex: 10,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 48,
    position: 'relative',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.ink,
    paddingVertical: spacing.sm,
    height: '100%',
  },
  clearButton: {
    padding: spacing.xs,
  },
  filterButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  suggestionsContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderTopWidth: 0,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: spacing.sm,
    marginTop: -1,
    zIndex: 10,
  },
  suggestionsTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  suggestionText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  // Filter Popup Styles
  popupOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  filterPopup: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 280,
    maxWidth: 320,
    zIndex: 15,
    ...shadows.lg,
  },
  popupArrow: {
    position: 'absolute',
    top: -8,
    right: 24,
    width: 16,
    height: 16,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },
  popupContent: {
    padding: spacing.md,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  popupTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.ink,
  },
  resetText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
  },
  popupDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  filterSection: {
    marginBottom: spacing.xs,
  },
  filterSectionTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterOptionText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.ink,
  },
  filterOptionTextActive: {
    color: colors.surface,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardTintRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.ink,
    flex: 1,
  },
  modalOrderInfo: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  modalOrderLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  modalOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalOrderLabelText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
  },
  modalOrderValue: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  modalWarningText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: spacing.xs,
  },
  modalButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonCancelText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  modalButtonDelete: {
    backgroundColor: colors.danger,
    ...shadows.sm,
  },
  modalButtonDeleteText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: '#FFFFFF',
  },
});