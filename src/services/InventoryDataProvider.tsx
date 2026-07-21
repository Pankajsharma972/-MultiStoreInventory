import React, { useEffect, useMemo } from 'react';
import { collections, db } from './firebase';
import { mapSnapshot } from './inventoryRepository';
import { deriveInventoryData } from './inventorySelectors';
import { sortByNewest } from '../utils/inventoryHelpers';
import { useAuth } from '../features/auth/AuthProvider';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setActivity,
  setDeliveries,
  setError,
  setInventory,
  setLoading,
  setLocations,
  setOrders,
  setStores,
  setTransfers,
  setUsers,
  setWarehouses,
} from '../store/slices/dataSlice';
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

// Sets up the Firestore realtime listeners and streams every collection into
// the Redux `data` slice, which is the single source of truth for server data.
export function InventoryDataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const includeUsers = profile?.role === 'admin';
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleError = () => (snapshotError: Error) => {
      // Ignore permission-denied errors to prevent breaking the UI sync state
      if (!snapshotError.message.includes('permission-denied')) {
        dispatch(setError(snapshotError.message));
      }
      dispatch(setLoading(false));
    };

    const unsubscribers = [
      db.collection(collections.stores).onSnapshot(snapshot => {
        dispatch(setStores(mapSnapshot<Store>(snapshot)));
      }, handleError()),
      db.collection(collections.warehouses).onSnapshot(snapshot => {
        dispatch(setWarehouses(mapSnapshot<Warehouse>(snapshot)));
      }, handleError()),
      db.collection(collections.locations).onSnapshot(snapshot => {
        dispatch(setLocations(mapSnapshot<StorageLocation>(snapshot)));
      }, handleError()),
      db.collection(collections.inventory).onSnapshot(snapshot => {
        dispatch(setInventory(mapSnapshot<InventoryItem>(snapshot)));
      }, handleError()),
      db.collection(collections.orders).onSnapshot(snapshot => {
        dispatch(setOrders(sortByNewest(mapSnapshot<CustomerOrder>(snapshot))));
      }, handleError()),
      db.collection(collections.deliveries).onSnapshot(snapshot => {
        dispatch(setDeliveries(sortByNewest(mapSnapshot<PendingDelivery>(snapshot))));
      }, handleError()),
      db.collection(collections.transfers).onSnapshot(snapshot => {
        dispatch(setTransfers(sortByNewest(mapSnapshot<StockTransfer>(snapshot))));
      }, handleError()),
      db.collection(collections.activityLogs).onSnapshot(snapshot => {
        dispatch(setActivity(sortByNewest(mapSnapshot<ActivityLog>(snapshot))));
        dispatch(setLoading(false));
      }, handleError()),
    ];

    if (includeUsers) {
      unsubscribers.push(
        db.collection(collections.users).onSnapshot(snapshot => {
          dispatch(setUsers(mapSnapshot<UserProfile>(snapshot)));
        }, handleError()),
      );
    } else {
      dispatch(setUsers([]));
    }

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [dispatch, includeUsers]);

  return <>{children}</>;
}

export function useInventoryData() {
  const { profile } = useAuth();
  const raw = useAppSelector(state => state.data);
  return useMemo(() => deriveInventoryData(raw, profile), [raw, profile]);
}
