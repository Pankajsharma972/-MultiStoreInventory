/**
 * Real-time Synchronization Service
 * 
 * This module provides real-time data synchronization across all authorized users.
 * It ensures that any data changes (Products, Orders, Inventory, Users, Stores, etc.)
 * are immediately reflected on all connected devices without manual refresh.
 * 
 * Key Features:
 * - Automatic Firestore listener setup for all collections
 * - Real-time Redux state updates
 * - Connection state monitoring
 * - Graceful error handling with permission checks
 * - Role-based data filtering
 */

import firestore from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { collections, db } from './firebase';
import { AppDispatch } from '../store';
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
import { sortByNewest } from '../utils/inventoryHelpers';
import { mapSnapshot } from './inventoryRepository';
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

export interface RealtimeSyncConfig {
  includeUsers?: boolean;
  onConnectionChange?: (isConnected: boolean) => void;
  onError?: (error: Error) => void;
}

/**
 * Manages all real-time listeners and synchronization
 */
export class RealtimeSyncManager {
  private unsubscribers: Array<() => void> = [];
  private isConnected = true;
  private config: RealtimeSyncConfig;
  private dispatch: AppDispatch;

  constructor(dispatch: AppDispatch, config: RealtimeSyncConfig = {}) {
    this.dispatch = dispatch;
    this.config = config;
  }

  /**
   * Initialize all real-time listeners
   * This should be called once on app startup
   */
  start(): void {
    if (this.unsubscribers.length > 0) {
      console.warn('RealtimeSync already started. Call stop() first.');
      return;
    }

    this.setupConnectionListener();
    this.setupStoresListener();
    this.setupWarehousesListener();
    this.setupLocationsListener();
    this.setupInventoryListener();
    this.setupOrdersListener();
    this.setupDeliveriesListener();
    this.setupTransfersListener();
    this.setupActivityListener();

    if (this.config.includeUsers) {
      this.setupUsersListener();
    }

    console.log('✅ Real-time sync started');
  }

  /**
   * Stop all listeners and clean up
   */
  stop(): void {
    this.unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        console.error('Error unsubscribing:', error);
      }
    });
    this.unsubscribers = [];
    console.log('✅ Real-time sync stopped');
  }

  /**
   * Monitor Firebase connection state
   * Fires whenever device goes online/offline
   */
  private setupConnectionListener(): void {
    const unsubscribe = db.collection('.info').doc('connectivity').onSnapshot(snapshot => {
      const isConnected = snapshot.get('state') === 'online';
      this.isConnected = isConnected;
      this.config.onConnectionChange?.(isConnected);
      
      if (isConnected) {
        console.log('🟢 Connected to Firestore');
      } else {
        console.log('🔴 Disconnected from Firestore');
      }
    });
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Stores collection
   * Updates whenever a store is created, updated, or deleted
   */
  private setupStoresListener(): void {
    const unsubscribe = db.collection(collections.stores).onSnapshot(
      snapshot => {
        try {
          const stores = mapSnapshot<Store>(snapshot);
          this.dispatch(setStores(stores));
          console.log(`📊 Stores updated: ${stores.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'stores');
        }
      },
      error => this.handleError(error, 'stores'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Warehouses collection
   * Updates whenever warehouse is created, updated, or deleted
   */
  private setupWarehousesListener(): void {
    const unsubscribe = db.collection(collections.warehouses).onSnapshot(
      snapshot => {
        try {
          const warehouses = mapSnapshot<Warehouse>(snapshot);
          this.dispatch(setWarehouses(warehouses));
          console.log(`🏭 Warehouses updated: ${warehouses.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'warehouses');
        }
      },
      error => this.handleError(error, 'warehouses'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Storage Locations collection
   * Updates whenever location is created, updated, or deleted
   */
  private setupLocationsListener(): void {
    const unsubscribe = db.collection(collections.locations).onSnapshot(
      snapshot => {
        try {
          const locations = mapSnapshot<StorageLocation>(snapshot);
          this.dispatch(setLocations(locations));
          console.log(`📍 Locations updated: ${locations.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'locations');
        }
      },
      error => this.handleError(error, 'locations'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Inventory collection
   * Updates immediately when stock is:
   * - Added or removed
   * - Transferred between locations
   * - Deducted from orders
   * - Returned from cancelled orders
   */
  private setupInventoryListener(): void {
    const unsubscribe = db.collection(collections.inventory).onSnapshot(
      snapshot => {
        try {
          const inventory = mapSnapshot<InventoryItem>(snapshot);
          this.dispatch(setInventory(inventory));
          console.log(`📦 Inventory updated: ${inventory.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'inventory');
        }
      },
      error => this.handleError(error, 'inventory'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Orders collection
   * Updates when order status changes:
   * - Created → Billed → Out for Delivery → Partially Delivered → Delivered → Completed
   * 
   * All authorized users see order updates in real-time on dashboards
   */
  private setupOrdersListener(): void {
    const unsubscribe = db.collection(collections.orders).onSnapshot(
      snapshot => {
        try {
          const orders = sortByNewest(mapSnapshot<CustomerOrder>(snapshot));
          this.dispatch(setOrders(orders));
          console.log(`📋 Orders updated: ${orders.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'orders');
        }
      },
      error => this.handleError(error, 'orders'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Deliveries collection
   * Updates when deliveries are:
   * - Created
   * - Partially delivered
   * - Fully delivered
   * - Cancelled
   */
  private setupDeliveriesListener(): void {
    const unsubscribe = db.collection(collections.deliveries).onSnapshot(
      snapshot => {
        try {
          const deliveries = sortByNewest(mapSnapshot<PendingDelivery>(snapshot));
          this.dispatch(setDeliveries(deliveries));
          console.log(`🚚 Deliveries updated: ${deliveries.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'deliveries');
        }
      },
      error => this.handleError(error, 'deliveries'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Stock Transfers collection
   * Updates when inventory is moved between locations/warehouses
   */
  private setupTransfersListener(): void {
    const unsubscribe = db.collection(collections.transfers).onSnapshot(
      snapshot => {
        try {
          const transfers = sortByNewest(mapSnapshot<StockTransfer>(snapshot));
          this.dispatch(setTransfers(transfers));
          console.log(`🔄 Transfers updated: ${transfers.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'transfers');
        }
      },
      error => this.handleError(error, 'transfers'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Activity Logs collection
   * Updates whenever any action is performed:
   * - Products created/updated/deleted
   * - Orders status changes
   * - Deliveries updated
   * - Stock movements
   * - User access changes
   */
  private setupActivityListener(): void {
    const unsubscribe = db.collection(collections.activityLogs).onSnapshot(
      snapshot => {
        try {
          const activity = sortByNewest(mapSnapshot<ActivityLog>(snapshot));
          this.dispatch(setActivity(activity));
          this.dispatch(setLoading(false));
          console.log(`📝 Activity logs updated: ${activity.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'activity logs');
        }
      },
      error => this.handleError(error, 'activity logs'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Listen to Users collection (admin only)
   * Updates whenever:
   * - User role changes
   * - Store assignments change
   * - User permissions are updated
   * - User is deleted
   */
  private setupUsersListener(): void {
    const unsubscribe = db.collection(collections.users).onSnapshot(
      snapshot => {
        try {
          const users = mapSnapshot<UserProfile>(snapshot);
          this.dispatch(setUsers(users));
          console.log(`👥 Users updated: ${users.length} items`);
        } catch (error) {
          this.handleError(error as Error, 'users');
        }
      },
      error => this.handleError(error, 'users'),
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Handle errors from listeners
   * Ignores permission-denied errors to prevent breaking UI
   */
  private handleError(error: Error, collection: string): void {
    // Ignore permission-denied errors (normal for non-admin users)
    if (error.message.includes('permission-denied')) {
      console.log(`⚠️  Permission denied for ${collection} (expected for non-admin users)`);
      return;
    }

    // Log other errors
    console.error(`❌ Error in ${collection} listener:`, error.message);
    this.dispatch(setError(error.message));
    this.config.onError?.(error);
  }

  /**
   * Get current connection state
   */
  isOnline(): boolean {
    return this.isConnected;
  }

  /**
   * Get number of active listeners
   */
  getActiveListeners(): number {
    return this.unsubscribers.length;
  }
}

/**
 * Hook helper to start/stop sync
 * This is called from InventoryDataProvider
 */
export function createRealtimeSyncManager(dispatch: AppDispatch, config: RealtimeSyncConfig = {}) {
  return new RealtimeSyncManager(dispatch, config);
}
