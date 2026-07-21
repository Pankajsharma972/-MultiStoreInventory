import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collections, db } from './firebase';
import { filterByAccess, mapSnapshot } from './inventoryRepository';
import { getStockAlertLevel, sortByNewest } from '../utils/inventoryHelpers';
import { useAuth } from '../features/auth/AuthProvider';
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

type InventoryDataContextValue = {
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
  stats: {
    totalInventory: number;
    productCount: number;
    lowStock: number;
    criticalStock: number;
    outOfStock: number;
    pendingOrders: number;
    pendingDeliveries: number;
  };
  lowStockItems: InventoryItem[];
};

const InventoryDataContext = createContext<InventoryDataContextValue | undefined>(
  undefined,
);

export function InventoryDataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const includeUsers = profile?.role === 'admin';
  const [stores, setStores] = useState<Store[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [deliveries, setDeliveries] = useState<PendingDelivery[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleError = (label: string) => (snapshotError: Error) => {
      // Ignore permission-denied errors to prevent breaking the UI sync state
      if (!snapshotError.message.includes('permission-denied')) {
        setError(snapshotError.message);
      }
      setLoading(false);
    };

    const unsubscribers = [
      db.collection(collections.stores).onSnapshot(snapshot => {
        setStores(mapSnapshot<Store>(snapshot));
      }, handleError(collections.stores)),
      db.collection(collections.warehouses).onSnapshot(snapshot => {
        setWarehouses(mapSnapshot<Warehouse>(snapshot));
      }, handleError(collections.warehouses)),
      db.collection(collections.locations).onSnapshot(snapshot => {
        setLocations(mapSnapshot<StorageLocation>(snapshot));
      }, handleError(collections.locations)),
      db.collection(collections.inventory).onSnapshot(snapshot => {
        setInventory(mapSnapshot<InventoryItem>(snapshot));
      }, handleError(collections.inventory)),
      db.collection(collections.orders).onSnapshot(snapshot => {
        setOrders(sortByNewest(mapSnapshot<CustomerOrder>(snapshot)));
      }, handleError(collections.orders)),
      db.collection(collections.deliveries).onSnapshot(snapshot => {
        setDeliveries(sortByNewest(mapSnapshot<PendingDelivery>(snapshot)));
      }, handleError(collections.deliveries)),
      db.collection(collections.transfers).onSnapshot(snapshot => {
        setTransfers(sortByNewest(mapSnapshot<StockTransfer>(snapshot)));
      }, handleError(collections.transfers)),
      db.collection(collections.activityLogs).onSnapshot(snapshot => {
        setActivity(sortByNewest(mapSnapshot<ActivityLog>(snapshot)));
        setLoading(false);
      }, handleError(collections.activityLogs)),
    ];

    if (includeUsers) {
      unsubscribers.push(
        db.collection(collections.users).onSnapshot(snapshot => {
          setUsers(mapSnapshot<UserProfile>(snapshot));
        }, handleError(collections.users)),
      );
    } else {
      setUsers([]);
    }

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [includeUsers]);

  const value = useMemo(() => {
    const visibleStores = filterByAccess(stores, profile, true);
    const visibleInventory = filterByAccess(inventory, profile);
    const visibleOrders = filterByAccess(orders, profile);
    const visibleDeliveries = filterByAccess(deliveries, profile);
    const visibleActivity = filterByAccess(activity, profile);
    const storeIds = new Set(visibleStores.map(store => store.id));
    const lowStockItems = visibleInventory.filter(item => {
      const level = getStockAlertLevel(item);
      return level !== 'ok';
    });

    return {
      loading,
      error,
      stores: visibleStores,
      users: profile?.role === 'admin' ? users : [],
      warehouses: warehouses.filter(warehouse => storeIds.has(warehouse.storeId)),
      locations: locations.filter(location => storeIds.has(location.storeId)),
      inventory: visibleInventory,
      orders: visibleOrders,
      deliveries: visibleDeliveries,
      transfers: transfers.filter(transfer =>
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
        criticalStock: lowStockItems.filter(item => getStockAlertLevel(item) === 'critical')
          .length,
        outOfStock: lowStockItems.filter(item => getStockAlertLevel(item) === 'out_of_stock')
          .length,
        pendingOrders: visibleOrders.filter(
          order => order.status !== 'delivered' && order.status !== 'cancelled',
        ).length,
        pendingDeliveries: visibleDeliveries.filter(
          delivery => delivery.status !== 'delivered' && delivery.status !== 'cancelled',
        ).length,
      },
    };
  }, [
    activity,
    deliveries,
    error,
    inventory,
    loading,
    locations,
    orders,
    profile,
    stores,
    transfers,
    users,
    warehouses,
  ]);

  return (
    <InventoryDataContext.Provider value={value}>
      {children}
    </InventoryDataContext.Provider>
  );
}

export function useInventoryData() {
  const context = useContext(InventoryDataContext);

  if (!context) {
    throw new Error('useInventoryData must be used inside InventoryDataProvider');
  }

  return context;
}
