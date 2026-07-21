import { filterByAccess } from './inventoryRepository';
import { getStockAlertLevel } from '../utils/inventoryHelpers';
import type { DataState } from '../store/slices/dataSlice';
import type {
  ActivityLog,
  CustomerOrder,
  InventoryItem,
  PendingDelivery,
  StockTransfer,
  Store,
  StorageLocation,
  UserProfile,
  Warehouse,
} from '../types/models';

export type InventoryDataView = {
  loading: boolean;
  error: string;
  stores: Store[];
  users: UserProfile[];
  warehouses: Warehouse[];
  locations: StorageLocation[];
  inventory: InventoryItem[];
  orders: CustomerOrder[];
  deliveries: PendingDelivery[];
  transfers: StockTransfer[];
  activity: ActivityLog[];
  lowStockItems: InventoryItem[];
  stats: {
    totalInventory: number;
    productCount: number;
    lowStock: number;
    criticalStock: number;
    outOfStock: number;
    pendingOrders: number;
    pendingDeliveries: number;
  };
};

// Derive the role-scoped, filtered view + stats from the raw Firestore
// collections held in the Redux data slice. Kept pure so it can be memoised in
// the hook and unit-tested independently.
export function deriveInventoryData(
  raw: DataState,
  profile: UserProfile | null,
): InventoryDataView {
  const visibleStores = filterByAccess(raw.stores, profile, true);
  const visibleInventory = filterByAccess(raw.inventory, profile);
  const visibleOrders = filterByAccess(raw.orders, profile);
  const visibleDeliveries = filterByAccess(raw.deliveries, profile);
  const visibleActivity = filterByAccess(raw.activity, profile);
  const storeIds = new Set(visibleStores.map(store => store.id));
  const lowStockItems = visibleInventory.filter(
    item => getStockAlertLevel(item) !== 'ok',
  );

  return {
    loading: raw.loading,
    error: raw.error,
    stores: visibleStores,
    users: profile?.role === 'admin' ? raw.users : [],
    warehouses: raw.warehouses.filter(warehouse => storeIds.has(warehouse.storeId)),
    locations: raw.locations.filter(location => storeIds.has(location.storeId)),
    inventory: visibleInventory,
    orders: visibleOrders,
    deliveries: visibleDeliveries,
    transfers: raw.transfers.filter(transfer =>
      profile?.role === 'staff'
        ? storeIds.has(transfer.fromStoreId) || storeIds.has(transfer.toStoreId)
        : true,
    ),
    activity: visibleActivity,
    lowStockItems,
    stats: {
      totalInventory: visibleInventory.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      ),
      productCount: visibleInventory.length,
      lowStock: lowStockItems.filter(item => getStockAlertLevel(item) === 'low').length,
      criticalStock: lowStockItems.filter(
        item => getStockAlertLevel(item) === 'critical',
      ).length,
      outOfStock: lowStockItems.filter(
        item => getStockAlertLevel(item) === 'out_of_stock',
      ).length,
      pendingOrders: visibleOrders.filter(
        order => order.status !== 'delivered' && order.status !== 'cancelled',
      ).length,
      pendingDeliveries: visibleDeliveries.filter(
        delivery => delivery.status !== 'delivered' && delivery.status !== 'cancelled',
      ).length,
    },
  };
}
