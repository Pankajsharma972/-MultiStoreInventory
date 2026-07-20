import { useCallback, useEffect, useRef, useState } from 'react';
import { collections, db } from './firebase';
import { useAuth } from '../features/auth/AuthProvider';
import { getStockAlertLevel } from '../utils/inventoryHelpers';
import type { InventoryItem, UserProfile } from '../types/models';

export type AlertType = 'low_stock' | 'new_store_assigned';

export type AppAlert = {
  id: string;
  type: AlertType;
  title: string;
  subtitle: string;
  storeName?: string;
  timestamp: number;
  read: boolean;
};

type UseAlertsReturn = {
  alerts: AppAlert[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
};

function buildLowStockAlert(item: InventoryItem, storeName: string): AppAlert {
  const level = getStockAlertLevel(item);
  const levelLabel =
    level === 'out_of_stock'
      ? 'Out of Stock'
      : level === 'critical'
        ? 'Critical Stock'
        : 'Low Stock';
  return {
    id: `low_stock_${item.id}`,
    type: 'low_stock',
    title: `${levelLabel}: ${item.name}`,
    subtitle: `${item.quantity} / ${item.minimumQuantity} units · ${storeName} · ${item.locationCode}`,
    storeName,
    timestamp: Date.now(),
    read: false,
  };
}

export function useAlerts(): UseAlertsReturn {
  const { user, profile } = useAuth();
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const readIdsRef = useRef<Set<string>>(new Set());
  const prevAssignedRef = useRef<string[] | null>(null);

  // ── Low-Stock real-time listener ────────────────────────────────────────────
  useEffect(() => {
    if (!user || !profile) return;

    const storeIds =
      profile.role === 'admin' ? null : (profile.assignedStoreIds ?? []);

    let storeMap = new Map<string, string>();

    const storeUnsub = db.collection(collections.stores).onSnapshot(
      snap => {
        storeMap = new Map(
          snap.docs.map(d => [d.id, (d.data() as { name: string }).name]),
        );
      },
      () => {},
    );

    // Build inventory query
    // If staff with no stores yet, skip
    if (storeIds !== null && storeIds.length === 0) {
      storeUnsub();
      return;
    }

    let inventoryQuery = db.collection(collections.inventory) as ReturnType<
      typeof db.collection
    >;

    if (storeIds !== null) {
      inventoryQuery = inventoryQuery.where(
        'storeId',
        'in',
        storeIds,
      ) as unknown as ReturnType<typeof db.collection>;
    }

    const inventoryUnsub = inventoryQuery.onSnapshot(
      snapshot => {
        const newAlerts: AppAlert[] = [];
        snapshot.docs.forEach(doc => {
          const item = { id: doc.id, ...doc.data() } as InventoryItem;
          const level = getStockAlertLevel(item);
          if (level === 'ok') return;
          const storeName = storeMap.get(item.storeId) || 'Store';
          const alert = buildLowStockAlert(item, storeName);
          if (readIdsRef.current.has(alert.id)) {
            alert.read = true;
          }
          newAlerts.push(alert);
        });
        setAlerts(prev => {
          const storeAlerts = prev.filter(a => a.type === 'new_store_assigned');
          return [...storeAlerts, ...newAlerts];
        });
      },
      err => {
        if (!err.message.includes('permission-denied')) {
          console.log('[useAlerts] inventory listener error', err.message);
        }
      },
    );

    return () => {
      inventoryUnsub();
      storeUnsub();
    };
  }, [user, profile]);

  // ── New-Store-Assigned real-time listener ───────────────────────────────────
  useEffect(() => {
    if (!user || profile?.role !== 'staff') return;

    const unsub = db
      .collection(collections.users)
      .doc(user.uid)
      .onSnapshot(
        snapshot => {
          const data = snapshot.data() as UserProfile | undefined;
          if (!data) return;

          const currentIds = data.assignedStoreIds ?? [];
          const prev = prevAssignedRef.current;

          if (prev !== null) {
            const newIds = currentIds.filter(id => !prev.includes(id));
            if (newIds.length > 0) {
              Promise.all(
                newIds.map(id =>
                  db
                    .collection(collections.stores)
                    .doc(id)
                    .get()
                    .then(d => ({
                      id,
                      name: ((d.data() as { name?: string }) || {}).name || 'New Store',
                    }))
                    .catch(() => ({ id, name: 'New Store' })),
                ),
              ).then(resolvedStores => {
                const newStoreAlerts: AppAlert[] = resolvedStores.map(store => ({
                  id: `new_store_${store.id}_${Date.now()}`,
                  type: 'new_store_assigned' as AlertType,
                  title: 'New Store Assigned',
                  subtitle: `You have been assigned to ${store.name}`,
                  storeName: store.name,
                  timestamp: Date.now(),
                  read: false,
                }));
                setAlerts(prev2 => [...newStoreAlerts, ...prev2]);
              });
            }
          }

          prevAssignedRef.current = currentIds;
        },
        err => {
          if (!err.message.includes('permission-denied')) {
            console.log('[useAlerts] profile listener error', err.message);
          }
        },
      );

    return () => unsub();
  }, [user, profile?.role]);

  const markRead = useCallback((id: string) => {
    readIdsRef.current.add(id);
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, read: true } : a)));
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts(prev => {
      prev.forEach(a => readIdsRef.current.add(a.id));
      return prev.map(a => ({ ...a, read: true }));
    });
  }, []);

  const clearAll = useCallback(() => {
    readIdsRef.current.clear();
    setAlerts([]);
  }, []);

  const unreadCount = alerts.filter(a => !a.read).length;

  return { alerts, unreadCount, markRead, markAllRead, clearAll };
}
