import firestore from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { collections, db, firebaseFunctions, firebaseStorage } from './firebase';
import RNFS from 'react-native-fs';
import { findMatchingInventory, inventoryMatchKey } from '../utils/inventoryHelpers';
import type {
  ActivityAction,
  CustomerOrder,
  DeliveryLineItem,
  DeliveryStatus,
  InventoryItem,
  OrderLineItem,
  OrderStatus,
  PendingDelivery,
  StockTransfer,
  Store,
  StorageLocation,
  UserProfile,
  UserRole,
  Warehouse,
} from '../types/models';


export async function uploadProductPhoto(localUri: string): Promise<string> {
  if (!localUri) {
    throw new Error('No image selected.');
  }

  try {
    // Strip file:// prefix if present
    const path = localUri.startsWith('file://') ? localUri.replace('file://', '') : localUri;

    // Check file size before upload
    let sizeKb = 0;
    try {
      const stat = await RNFS.stat(path);
      sizeKb = Number(stat.size) / 1024;
    } catch (statErr) {
      // If stat fails, continue — upload will still be attempted
      console.warn('Could not stat file, proceeding to upload:', statErr);
    }

    if (sizeKb > 700) {
      throw new Error('Image is too large. Please choose a smaller photo (reduce camera quality).');
    }

    // Upload to Firebase Storage and return a downloadable URL
    const ext = path.split('.').pop() || 'jpg';
    const filename = `images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const ref = firebaseStorage.ref(filename);

    await ref.putFile(path);
    const downloadUrl = await ref.getDownloadURL();

    return downloadUrl;
  } catch (e: any) {
    console.error('Photo upload failed:', e);
    throw new Error(e.message || 'Failed to upload image.');
  }
}



type Doc<T> = T & { id: string };

export function readableDate(value?: unknown) {
  const maybeTimestamp = value as { toDate?: () => Date } | undefined;
  const date = maybeTimestamp?.toDate?.();
  return date ? date.toLocaleString() : '';
}

export function mapDoc<T>(doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) {
  return { id: doc.id, ...doc.data() } as Doc<T>;
}

export function mapSnapshot<T>(
  snapshot: FirebaseFirestoreTypes.QuerySnapshot | null,
) {
  return (snapshot?.docs ?? []).map(doc => mapDoc<T>(doc));
}

export function visibleStoreIds(profile: UserProfile | null, stores: Store[]) {
  if (!profile || profile.role === 'admin') {
    return stores.map(store => store.id);
  }

  return profile.assignedStoreIds;
}

export function filterByAccess<T extends { storeId?: string; id?: string }>(
  rows: T[],
  profile: UserProfile | null,
  collectionIsStores = false,
) {
  if (!profile || profile.role === 'admin') {
    return rows;
  }

  return rows.filter(row => {
    const storeId = collectionIsStores ? row.id : row.storeId;
    return Boolean(storeId && profile.assignedStoreIds.includes(storeId));
  });
}

export async function addActivity(payload: {
  action: ActivityAction | string;
  detail: string;
  storeId?: string;
  user?: UserProfile | null;
}) {
  await db.collection(collections.activityLogs).add({
    action: payload.action,
    detail: payload.detail,
    storeId: payload.storeId || null,
    createdBy: payload.user?.name || payload.user?.email || 'System',
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
}

async function findInventoryDocAtLocation(
  target: Pick<
    InventoryItem,
    'name' | 'sku' | 'storeId' | 'warehouseId' | 'locationCode'
  >,
) {
  const snapshot = await db
    .collection(collections.inventory)
    .where('storeId', '==', target.storeId)
    .where('warehouseId', '==', target.warehouseId)
    .where('locationCode', '==', target.locationCode.trim().toUpperCase())
    .get();

  const normalizedName = target.name.trim().toLowerCase();
  const normalizedSku = (target.sku || '').trim().toLowerCase();

  return (
    snapshot.docs.find(doc => {
      const data = doc.data() as InventoryItem;
      return (
        data.name.trim().toLowerCase() === normalizedName &&
        (data.sku || '').trim().toLowerCase() === normalizedSku
      );
    }) || null
  );
}

export async function ensureDefaultStoreStructure(user?: UserProfile | null) {
  const existingStores = await db.collection(collections.stores).limit(1).get();
  if (!existingStores.empty) {
    return;
  }

  const batch = db.batch();
  const structure = [
    { name: 'Store 1', warehouses: 3, prefix: 'A' },
    { name: 'Store 2', warehouses: 5, prefix: 'B' },
    { name: 'Store 3', warehouses: 7, prefix: 'C' },
  ];

  structure.forEach(storeConfig => {
    const storeRef = db.collection(collections.stores).doc();
    batch.set(storeRef, {
      name: storeConfig.name,
      location: '',
      active: true,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    Array.from({ length: storeConfig.warehouses }).forEach((_, warehouseIndex) => {
      const warehouseRef = db.collection(collections.warehouses).doc();
      batch.set(warehouseRef, {
        storeId: storeRef.id,
        name: `Warehouse ${warehouseIndex + 1}`,
        active: true,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      ['1', '2', '3'].forEach(locationNumber => {
        batch.set(db.collection(collections.locations).doc(), {
          storeId: storeRef.id,
          warehouseId: warehouseRef.id,
          code: `${storeConfig.prefix}${locationNumber}`,
          description: '',
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });
    });
  });

  await batch.commit();
  await addActivity({
    action: 'System Setup',
    detail: 'Default multi-store warehouse structure created',
    user,
  });
}

export async function saveStore(payload: Pick<Store, 'name' | 'location'>) {
  await db.collection(collections.stores).add({
    name: payload.name.trim(),
    location: payload.location?.trim() || '',
    active: true,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function updateStore(
  storeId: string,
  payload: Pick<Store, 'name' | 'location'>,
  user: UserProfile | null,
) {
  await db.collection(collections.stores).doc(storeId).update({
    name: payload.name.trim(),
    location: payload.location?.trim() || '',
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  await addActivity({
    action: 'Store Created',
    detail: `${payload.name.trim()} updated`,
    storeId,
    user,
  });
}

export async function deleteStore(storeId: string, user: UserProfile | null) {
  const storeName = await db
    .collection(collections.stores)
    .doc(storeId)
    .get()
    .then(d => (d.data() as { name?: string })?.name || 'Store');

  await db.collection(collections.stores).doc(storeId).delete();
  await addActivity({
    action: 'Store Created',
    detail: `${storeName} deleted`,
    user,
  });
}

export async function saveWarehouse(payload: Pick<Warehouse, 'storeId' | 'name'>) {
  await db.collection(collections.warehouses).add({
    storeId: payload.storeId,
    name: payload.name.trim(),
    active: true,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function saveLocation(payload: Omit<StorageLocation, 'id'>) {
  await db.collection(collections.locations).add({
    ...payload,
    code: payload.code.trim().toUpperCase(),
    description: payload.description?.trim() || '',
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function saveProduct(
  payload: Omit<InventoryItem, 'id' | 'quantity' | 'minimumQuantity'> & {
    quantity: string;
    minimumQuantity: string;
  },
  user: UserProfile | null,
  existingInventory: InventoryItem[] = [],
) {
  const quantity = Number(payload.quantity || 0);
  const minimumQuantity = Number(payload.minimumQuantity || 0);
  if (!payload.name.trim() || !payload.category.trim()) {
    throw new Error('Product name and category are required.');
  }
  if (!payload.storeId || !payload.warehouseId || !payload.locationCode.trim()) {
    throw new Error('Store, warehouse, and location are required.');
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Quantity must be zero or more.');
  }
  if (!Number.isFinite(minimumQuantity) || minimumQuantity < 0) {
    throw new Error('Minimum quantity must be zero or more.');
  }

  const normalizedLocation = payload.locationCode.trim().toUpperCase();
  const duplicate = findMatchingInventory(existingInventory, {
    name: payload.name,
    sku: payload.sku,
    storeId: payload.storeId,
    warehouseId: payload.warehouseId,
    locationCode: normalizedLocation,
  });

  if (duplicate) {
    throw new Error(
      'This product already exists at the selected warehouse and location. Use Receive Stock to add more units.',
    );
  }

  await db.collection(collections.inventory).add({
    name: payload.name.trim(),
    category: payload.category.trim(),
    brand: payload.brand?.trim() || '',
    glaze: payload.glaze || '',
    size: payload.size?.trim() || '',
    sku: payload.sku?.trim() || '',
    photoUrl: payload.photoUrl?.trim() || '',
    storeId: payload.storeId,
    warehouseId: payload.warehouseId,
    locationCode: normalizedLocation,
    quantity,
    minimumQuantity,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await addActivity({
    action: 'Product Created',
    detail: `${payload.name.trim()} added with ${quantity} units at ${normalizedLocation}`,
    storeId: payload.storeId,
    user,
  });
}

export async function receiveStock(
  item: InventoryItem,
  amountText: string,
  user: UserProfile | null,
) {
  const amount = Number(amountText || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Receive quantity must be greater than zero.');
  }

  await db.collection(collections.inventory).doc(item.id).update({
    quantity: firestore.FieldValue.increment(amount),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await addActivity({
    action: 'Stock Added',
    detail: `${item.name}: received ${amount} units (${item.quantity} → ${item.quantity + amount})`,
    storeId: item.storeId,
    user,
  });
}

export async function adjustStock(
  item: InventoryItem,
  quantityText: string,
  reason: string,
  user: UserProfile | null,
) {
  const nextQuantity = Number(quantityText || 0);
  if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
    throw new Error('Quantity must be zero or more.');
  }

  await db.collection(collections.inventory).doc(item.id).update({
    quantity: nextQuantity,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await addActivity({
    action: 'Stock Updated',
    detail: `${item.name}: adjusted ${item.quantity} → ${nextQuantity}. ${reason.trim()}`,
    storeId: item.storeId,
    user,
  });
}

export async function updateMinimumThreshold(
  item: InventoryItem,
  minimumText: string,
  user: UserProfile | null,
) {
  const nextMinimum = Number(minimumText || 0);
  if (!Number.isFinite(nextMinimum) || nextMinimum < 0) {
    throw new Error('Minimum threshold must be zero or more.');
  }

  await db.collection(collections.inventory).doc(item.id).update({
    minimumQuantity: nextMinimum,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await addActivity({
    action: 'Product Updated',
    detail: `${item.name}: minimum threshold ${item.minimumQuantity} → ${nextMinimum}`,
    storeId: item.storeId,
    user,
  });
}

export async function removeDamagedStock(
  item: InventoryItem,
  amountText: string,
  note: string,
  user: UserProfile | null,
) {
  const amount = Number(amountText || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Remove quantity must be greater than zero.');
  }
  if (amount > item.quantity) {
    throw new Error('Cannot remove more than available stock.');
  }

  await db.collection(collections.inventory).doc(item.id).update({
    quantity: firestore.FieldValue.increment(-amount),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await addActivity({
    action: 'Stock Removed',
    detail: `${item.name}: removed ${amount} damaged units. ${note.trim() || 'Damaged stock'}`,
    storeId: item.storeId,
    user,
  });
}

export async function moveStockWithinStore(
  item: InventoryItem,
  payload: {
    toWarehouseId: string;
    toLocationCode: string;
    quantity: number;
  },
  user: UserProfile | null,
) {
  return createTransfer(
    item,
    {
      quantity: payload.quantity,
      toStoreId: item.storeId,
      toWarehouseId: payload.toWarehouseId,
      toLocationCode: payload.toLocationCode,
    },
    user,
    'Stock Moved',
  );
}

export async function createTransfer(
  item: InventoryItem,
  payload: Pick<
    StockTransfer,
    'quantity' | 'toStoreId' | 'toWarehouseId' | 'toLocationCode'
  >,
  user: UserProfile | null,
  activityAction: ActivityAction = 'Stock Transfer',
) {
  const quantity = Number(payload.quantity || 0);
  if (quantity <= 0 || quantity > item.quantity) {
    throw new Error('Transfer quantity must be available in current stock.');
  }

  const toLocationCode = payload.toLocationCode.trim().toUpperCase();
  const destinationMatch = await findInventoryDocAtLocation({
    name: item.name,
    sku: item.sku,
    storeId: payload.toStoreId,
    warehouseId: payload.toWarehouseId,
    locationCode: toLocationCode,
  });

  await db.runTransaction(async transaction => {
    const sourceRef = db.collection(collections.inventory).doc(item.id);
    const sourceSnap = await transaction.get(sourceRef);
    const sourceData = sourceSnap.data() as InventoryItem | undefined;

    if (!sourceData || Number(sourceData.quantity || 0) < quantity) {
      throw new Error('Transfer quantity must be available in current stock.');
    }

    transaction.update(sourceRef, {
      quantity: firestore.FieldValue.increment(-quantity),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    if (destinationMatch) {
      transaction.update(destinationMatch.ref, {
        quantity: firestore.FieldValue.increment(quantity),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } else {
      transaction.set(db.collection(collections.inventory).doc(), {
        name: item.name,
        category: item.category,
        size: item.size || '',
        sku: item.sku || '',
        storeId: payload.toStoreId,
        warehouseId: payload.toWarehouseId,
        locationCode: toLocationCode,
        quantity,
        minimumQuantity: item.minimumQuantity,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    transaction.set(db.collection(collections.transfers).doc(), {
      productId: item.id,
      productName: item.name,
      quantity,
      fromStoreId: item.storeId,
      fromWarehouseId: item.warehouseId,
      fromLocationCode: item.locationCode,
      toStoreId: payload.toStoreId,
      toWarehouseId: payload.toWarehouseId,
      toLocationCode,
      createdBy: user?.name || user?.email || '',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  });

  await addActivity({
    action: activityAction,
    detail: `${quantity} ${item.name} moved from ${item.locationCode} to ${toLocationCode}`,
    storeId: item.storeId,
    user,
  });
}

// Statuses whose remaining stock can still be returned if the order is
// cancelled or not delivered within the restock window.
const RESTOCKABLE_STATUSES: OrderStatus[] = [
  'ordered',
  'billed',
  'out_for_delivery',
  'partially_delivered',
];

function isAccountsUser(user: UserProfile | null) {
  return user?.role === 'accounts';
}

function isSupervisorUser(user: UserProfile | null) {
  return user?.role === 'supervisor';
}

// Create a multi-design customer order. Placing the order deducts every line
// item from live inventory in a single atomic transaction (stock-after-order),
// then records the order and a matching pending delivery.
export async function createOrder(
  payload: {
    customerName: string;
    customerPhone?: string;
    storeId: string;
    expectedDeliveryDate?: string;
    items: OrderLineItem[];
  },
  user: UserProfile | null,
) {
  const customerName = payload.customerName.trim();
  if (!customerName) {
    throw new Error('Customer name is required.');
  }
  const items = (payload.items || []).filter(item => Number(item.quantity) > 0);
  if (items.length === 0) {
    throw new Error('Add at least one design with a quantity to the order.');
  }

  // Aggregate quantities per product so the same design added twice is deducted
  // once (Firestore transactions forbid reading a doc after writing it).
  const requiredByProduct = new Map<string, number>();
  items.forEach(item => {
    requiredByProduct.set(
      item.productId,
      (requiredByProduct.get(item.productId) || 0) + Number(item.quantity),
    );
  });

  const orderRef = db.collection(collections.orders).doc();
  const deliveryRef = db.collection(collections.deliveries).doc();

  await db.runTransaction(async transaction => {
    const productIds = Array.from(requiredByProduct.keys());
    const snaps = await Promise.all(
      productIds.map(id =>
        transaction.get(db.collection(collections.inventory).doc(id)),
      ),
    );

    snaps.forEach((snap, index) => {
      const productId = productIds[index];
      const inventoryItem = snap.data() as InventoryItem | undefined;
      const required = requiredByProduct.get(productId) || 0;
      if (!inventoryItem) {
        throw new Error('One of the selected designs is no longer available.');
      }
      if (Number(inventoryItem.quantity || 0) < required) {
        throw new Error(
          `Only ${inventoryItem.quantity} units of ${inventoryItem.name} available.`,
        );
      }
    });

    const stockByProduct = new Map<string, { before: number; after: number }>();
    snaps.forEach((snap, index) => {
      const productId = productIds[index];
      const inventoryItem = snap.data() as InventoryItem;
      const required = requiredByProduct.get(productId) || 0;
      const before = Number(inventoryItem.quantity || 0);
      stockByProduct.set(productId, { before, after: before - required });
      transaction.update(snap.ref, {
        quantity: firestore.FieldValue.increment(-required),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    const ledgerItems = items.map(item => ({
      ...item,
      deliveredQuantity: 0,
      pendingQuantity: Number(item.quantity),
      stockBeforeOrder: stockByProduct.get(item.productId)?.before ?? 0,
      stockAfterOrder: stockByProduct.get(item.productId)?.after ?? 0,
    }));
    const summary = ledgerItems[0];
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);

    transaction.set(orderRef, {
      customerName,
      customerPhone: payload.customerPhone?.trim() || '',
      productId: summary.productId,
      productName: summary.productName,
      quantity: totalQuantity,
      items: ledgerItems,
      storeId: payload.storeId,
      status: 'ordered' as OrderStatus,
      deliveryStatus: 'ordered' as DeliveryStatus,
      deliveredQuantity: 0,
      pendingQuantity: totalQuantity,
      stockRestored: false,
      expectedDeliveryDate: payload.expectedDeliveryDate?.trim() || '',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(deliveryRef, {
      orderId: orderRef.id,
      customerName,
      productName: summary.productName,
      quantity: totalQuantity,
      deliveredQuantity: 0,
      pendingQuantity: totalQuantity,
      items: ledgerItems,
      storeId: payload.storeId,
      status: 'ordered' as DeliveryStatus,
      expectedDeliveryDate: payload.expectedDeliveryDate?.trim() || '',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  });

  const summaryLabel =
    items.length === 1
      ? `${items[0].quantity} ${items[0].productName}`
      : `${items.length} designs (${items.reduce((sum, item) => sum + Number(item.quantity), 0)} units)`;

  await addActivity({
    action: 'Order Created',
    detail: `${customerName} ordered ${summaryLabel} — stock deducted`,
    storeId: payload.storeId,
    user,
  });
}

function orderLineItemsOf(order: {
  items?: OrderLineItem[];
  productId: string;
  productName: string;
  quantity: number;
}): OrderLineItem[] {
  if (order.items && order.items.length > 0) {
    return order.items;
  }
  return [
    { productId: order.productId, productName: order.productName, quantity: order.quantity },
  ];
}

// Move an order (and its mirrored delivery) to a new lifecycle status. When an
// order that still holds deducted stock is cancelled, the units are returned to
// inventory.
async function transitionOrder(
  orderId: string,
  nextStatus: OrderStatus,
  user?: UserProfile | null,
): Promise<{
  restored: boolean;
  movements: Array<{
    productId: string;
    productName: string;
    returned: number;
    before: number;
    after: number;
    storeId: string;
    customerName: string;
  }>;
}> {
  const result = await db.runTransaction(async transaction => {
    const orderRef = db.collection(collections.orders).doc(orderId);
    const orderSnap = await transaction.get(orderRef);
    const order = orderSnap.data() as CustomerOrder | undefined;
    if (!order) {
      throw new Error('Order not found.');
    }

    const previousStatus = order.status;
    const shouldRestore =
      nextStatus === 'cancelled' &&
      !order.stockRestored &&
      RESTOCKABLE_STATUSES.includes(previousStatus);

    const items = orderLineItemsOf(order);
    const restoreByProduct = new Map<string, number>();
    if (shouldRestore) {
      items.forEach(item => {
        const pending = Number(item.pendingQuantity ?? item.quantity ?? 0);
        if (pending > 0) {
          restoreByProduct.set(
            item.productId,
            (restoreByProduct.get(item.productId) || 0) + pending,
          );
        }
      });
    }

    const restoredProducts = new Map<string, { before: number; returned: number; after: number }>();
    if (shouldRestore) {
      const productIds = Array.from(restoreByProduct.keys());
      const inventorySnaps = await Promise.all(
        productIds.map(productId =>
          transaction.get(db.collection(collections.inventory).doc(productId)),
        ),
      );
      inventorySnaps.forEach((snap, index) => {
        const productId = productIds[index];
        const returned = restoreByProduct.get(productId) || 0;
        const inventory = snap.data() as InventoryItem | undefined;
        const before = Number(inventory?.quantity || 0);
        const after = before + returned;
        restoredProducts.set(productId, { before, returned, after });
        transaction.update(snap.ref, {
          quantity: after,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });
    }

    const nextItems = items.map(item => {
      const restoredProduct = restoredProducts.get(item.productId);
      return {
        ...item,
        ...(restoredProduct
          ? {
              stockBeforeReturn: restoredProduct.before,
              stockReturned: restoredProduct.returned,
              stockAfterReturn: restoredProduct.after,
            }
          : {}),
        ...(shouldRestore ? { pendingQuantity: 0 } : {}),
      };
    });

    transaction.update(orderRef, {
      status: nextStatus,
      deliveryStatus: nextStatus,
      ...(shouldRestore
        ? {
            stockRestored: true,
            restockedAt: firestore.FieldValue.serverTimestamp(),
            pendingQuantity: 0,
            cancelledBy: user?.name || user?.email || 'Accounts',
            cancelledAt: firestore.FieldValue.serverTimestamp(),
            cancellationReason: 'Order cancelled',
            items: nextItems,
          }
        : {}),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return {
      restored: shouldRestore,
      movements: nextItems
        .filter(item => Number(item.stockReturned || 0) > 0)
        .map(item => ({
          productId: item.productId,
          productName: item.productName,
          returned: Number(item.stockReturned || 0),
          before: Number(item.stockBeforeReturn || 0),
          after: Number(item.stockAfterReturn || 0),
          storeId: order.storeId,
          customerName: order.customerName,
        })),
    };
  });

  // Keep mirrored delivery docs in sync (queries aren't allowed in transactions).
  const deliveriesSnap = await db
    .collection(collections.deliveries)
    .where('orderId', '==', orderId)
    .get();
  if (!deliveriesSnap.empty) {
    const batch = db.batch();
    deliveriesSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: nextStatus,
        ...(nextStatus === 'delivered'
          ? {
              completedAt: firestore.FieldValue.serverTimestamp(),
              completedBy: 'Accounts',
            }
          : {}),
        ...(result.restored
          ? {
              pendingQuantity: 0,
              items: orderLineItemsOf({ ...(doc.data() as PendingDelivery), productId: '', productName: '', quantity: 0 }).map(item => ({
                ...item,
                pendingQuantity: 0,
              })),
            }
          : {}),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return result;
}

export async function updateOrderStatus(
  order: CustomerOrder,
  status: OrderStatus,
  user: UserProfile | null,
) {
  if (status === order.status) {
    return;
  }
  if (
    (status === 'billed' || status === 'delivered' || status === 'cancelled') &&
    !isAccountsUser(user)
  ) {
    throw new Error('Only accounts can approve billing, final delivery, or cancellation.');
  }
  if (status === 'out_for_delivery') {
    throw new Error('Use dispatch approval with a truck loading photo before marking out for delivery.');
  }
  if (status === 'delivered' && Number(order.pendingQuantity || 0) > 0) {
    throw new Error('Remaining items are still pending. Complete all dispatches before final delivery approval.');
  }
  const result = await transitionOrder(order.id, status, user);
  await addActivity({
    action: 'Order Updated',
    detail: `${order.customerName} order → ${status.replace(/_/g, ' ')}${
      result.restored ? ' (stock returned)' : ''
    }`,
    storeId: order.storeId,
    user,
  });
  await Promise.all(
    result.movements.map(movement =>
      addActivity({
        action: 'Stock Returned',
        detail: `${movement.productName}: returned ${movement.returned} units on cancellation (${movement.before} -> ${movement.after})`,
        storeId: movement.storeId,
        user,
      }),
    ),
  );
}

export async function updateDeliveryStatus(
  delivery: PendingDelivery,
  status: DeliveryStatus,
  user: UserProfile | null,
) {
  if (status === delivery.status) {
    return;
  }
  if (status === 'out_for_delivery') {
    throw new Error('Use dispatch approval with a truck loading photo.');
  }
  if ((status === 'billed' || status === 'delivered' || status === 'cancelled') && !isAccountsUser(user)) {
    throw new Error('Only accounts can approve billing, final delivery, or cancellation.');
  }
  if (status === 'delivered' && Number(delivery.pendingQuantity || 0) > 0) {
    throw new Error('Remaining items are still pending. Complete all dispatches before final delivery approval.');
  }

  let restored = false;
  if (delivery.orderId) {
    const result = await transitionOrder(delivery.orderId, status, user);
    restored = result.restored;
    await Promise.all(
      result.movements.map(movement =>
        addActivity({
          action: 'Stock Returned',
          detail: `${movement.productName}: returned ${movement.returned} units on cancellation (${movement.before} -> ${movement.after})`,
          storeId: movement.storeId,
          user,
        }),
      ),
    );
  } else {
    await db.collection(collections.deliveries).doc(delivery.id).update({
      status,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }

  await addActivity({
    action: status === 'delivered' ? 'Delivery Completed' : 'Delivery Updated',
    detail: `${delivery.customerName} delivery → ${status.replace(/_/g, ' ')}${
      restored ? ' (stock returned)' : ''
    }`,
    storeId: delivery.storeId,
    user,
  });
}

export async function approveDispatch(
  delivery: PendingDelivery,
  payload: { truckPhotoUrl: string; items: DeliveryLineItem[] },
  user: UserProfile | null,
) {
  if (!isSupervisorUser(user)) {
    throw new Error('Only supervisor can approve dispatch.');
  }
  if (delivery.status !== 'billed' && delivery.status !== 'partially_delivered') {
    throw new Error('Order must be billed before dispatch.');
  }
  if (!payload.truckPhotoUrl) {
    throw new Error('Truck loading photo is required before dispatch.');
  }

  const dispatchItems = payload.items
    .map(item => ({
      ...item,
      dispatchQuantity: Math.max(0, Number(item.dispatchQuantity || 0)),
    }))
    .filter(item => Number(item.dispatchQuantity || 0) > 0);

  if (dispatchItems.length === 0) {
    throw new Error('Enter at least one quantity for dispatch.');
  }

  dispatchItems.forEach(item => {
    const pending = Number(item.pendingQuantity ?? item.quantity ?? 0);
    if (Number(item.dispatchQuantity || 0) > pending) {
      throw new Error(`${item.productName} has only ${pending} units pending.`);
    }
  });

  if (!delivery.orderId) {
    throw new Error('Delivery is not linked to an order.');
  }

  await db.runTransaction(async transaction => {
    const orderRef = db.collection(collections.orders).doc(delivery.orderId);
    const orderSnap = await transaction.get(orderRef);
    const order = orderSnap.data() as CustomerOrder | undefined;
    if (!order) {
      throw new Error('Order not found.');
    }

    const dispatchByProduct = new Map(
      dispatchItems.map(item => [item.productId, Number(item.dispatchQuantity || 0)]),
    );
    const nextItems = orderLineItemsOf(order).map(item => {
      const shippedNow = dispatchByProduct.get(item.productId) || 0;
      const deliveredQuantity = Number(item.deliveredQuantity || 0) + shippedNow;
      const orderedQuantity = Number(item.quantity || 0);
      return {
        ...item,
        deliveredQuantity,
        pendingQuantity: Math.max(0, orderedQuantity - deliveredQuantity),
      };
    });
    const deliveredQuantity = nextItems.reduce(
      (sum, item) => sum + Number(item.deliveredQuantity || 0),
      0,
    );
    const pendingQuantity = nextItems.reduce(
      (sum, item) => sum + Number(item.pendingQuantity || 0),
      0,
    );
    const nextStatus: OrderStatus = pendingQuantity > 0 ? 'partially_delivered' : 'out_for_delivery';

    transaction.update(orderRef, {
      status: nextStatus,
      deliveryStatus: nextStatus,
      deliveredQuantity,
      pendingQuantity,
      items: nextItems,
      truckPhotoUrl: payload.truckPhotoUrl,
      dispatchedAt: firestore.FieldValue.serverTimestamp(),
      dispatchedBy: user?.name || user?.email || '',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  });

  const orderSnap = await db.collection(collections.orders).doc(delivery.orderId).get();
  const updatedOrder = orderSnap.data() as CustomerOrder | undefined;
  const deliveriesSnap = await db
    .collection(collections.deliveries)
    .where('orderId', '==', delivery.orderId)
    .get();

  if (updatedOrder && !deliveriesSnap.empty) {
    const batch = db.batch();
    deliveriesSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: updatedOrder.status,
        deliveredQuantity: updatedOrder.deliveredQuantity || 0,
        pendingQuantity: updatedOrder.pendingQuantity || 0,
        items: updatedOrder.items || [],
        truckPhotoUrl: payload.truckPhotoUrl,
        dispatchedAt: firestore.FieldValue.serverTimestamp(),
        dispatchedBy: user?.name || user?.email || '',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  await addActivity({
    action: 'Dispatch Approved',
    detail: `${delivery.customerName} dispatch approved with truck loading photo`,
    storeId: delivery.storeId,
    user,
  });
}

export async function updateUserAccess(
  targetUser: UserProfile,
  payload: Pick<UserProfile, 'role' | 'assignedStoreIds'>,
  user: UserProfile | null,
) {
  await db.collection(collections.users).doc(targetUser.uid).update({
    role: payload.role,
    assignedStoreIds: payload.assignedStoreIds,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  await addActivity({
    action: 'User Access Updated',
    detail: `${targetUser.name} changed to ${payload.role}`,
    user,
  });
}

// Permanently delete a user. The `deleteUser` Cloud Function (Admin SDK) removes
// the account from Firebase Authentication AND the Firestore users document. If
// that function is not reachable (e.g. not deployed yet) we still remove the
// Firestore user document — which clears their store assignments — so the user
// is deleted from the app, and report that Auth removal is still pending.
export async function deleteUserAccount(
  targetUser: UserProfile,
  currentUser: UserProfile | null,
): Promise<{ authRemoved: boolean }> {
  const targetUid = targetUser.uid;
  if (!targetUid) {
    throw new Error('This user record has no id and cannot be deleted.');
  }
  if (currentUser?.uid && currentUser.uid === targetUid) {
    throw new Error('You cannot delete your own account.');
  }

  let authRemoved = false;
  try {
    await firebaseFunctions.httpsCallable('deleteUser')({ uid: targetUid });
    authRemoved = true;
  } catch {
    // Cloud Function unavailable — fall back to Firestore-only deletion so the
    // user (and their store assignments) is still removed from the app.
    await db.collection(collections.users).doc(targetUid).delete();
  }

  await addActivity({
    action: 'User Deleted',
    detail: authRemoved
      ? `${targetUser.name} permanently deleted (auth + profile)`
      : `${targetUser.name} profile deleted (deploy the deleteUser function to remove Auth login)`,
    user: currentUser,
  });

  return { authRemoved };
}

export async function updateUserDetails(
  targetUser: UserProfile,
  payload: { name: string; role: UserRole },
  user: UserProfile | null,
) {
  const trimmedName = payload.name.trim();
  if (!trimmedName) {
    throw new Error('Name is required.');
  }
  const nextAssignedStoreIds =
    payload.role === 'admin' ? [] : targetUser.assignedStoreIds || [];
  await db.collection(collections.users).doc(targetUser.uid).update({
    name: trimmedName,
    role: payload.role,
    assignedStoreIds: nextAssignedStoreIds,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  await addActivity({
    action: 'User Access Updated',
    detail: `${trimmedName} details updated (${payload.role})`,
    user,
  });
}

// Assign or unassign a single store to a staff user. Enforces that a store can
export async function setUserStoreAssignment(
  targetUser: UserProfile,
  storeId: string,
  assign: boolean,
  allUsers: UserProfile[],
  user: UserProfile | null,
) {
  const assigned = new Set(targetUser.assignedStoreIds || []);

  // ✅ Staff, accounts, supervisor sabko allow - MULTIPLE USERS ALLOWED
  if (assign && (targetUser.role === 'staff' || targetUser.role === 'accounts' || targetUser.role === 'supervisor')) {
    // 🚫 COMMENT OUT OR REMOVE THIS CHECK - Multiple users ko allow karo
    // const owner = allUsers.find(
    //   candidate =>
    //     candidate.uid !== targetUser.uid &&
    //     (candidate.role === 'staff' || candidate.role === 'accounts' || candidate.role === 'supervisor') &&
    //     (candidate.assignedStoreIds || []).includes(storeId),
    // );
    // if (owner) {
    //   throw new Error(`Already assigned to: ${owner.name}`);
    // }
    
    // ✅ Directly assign karo, check mat karo
    assigned.add(storeId);
  } else {
    assigned.delete(storeId);
  }

  await db.collection(collections.users).doc(targetUser.uid).update({
    assignedStoreIds: Array.from(assigned),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await addActivity({
    action: 'User Access Updated',
    detail: `${targetUser.name} ${assign ? 'assigned to' : 'unassigned from'} a store`,
    storeId,
    user,
  });
}

export async function deleteProduct(
  product: InventoryItem,
  user: UserProfile | null,
) {
  try {
    // Delete the product document
    await db.collection(collections.inventory).doc(product.id).delete();

    // Log the activity
    await addActivity({
      action: 'Product Deleted',
      detail: `${product.name} deleted from ${product.locationCode}`,
      storeId: product.storeId,
      user,
    });
  } catch (error) {
    throw new Error('Could not delete product. Please try again.');
  }
}

export async function deleteOrder(
  order: CustomerOrder,
  user: UserProfile | null,
) {
  try {
    // Delete the order document
    await db.collection(collections.orders).doc(order.id).delete();

    // Log the activity
    await addActivity({
      action: 'Order Deleted',
      detail: `Order from ${order.customerName} deleted`,
      storeId: order.storeId,
      user,
    });
  } catch (error) {
    throw new Error('Could not delete order. Please try again.');
  }
}

export { inventoryMatchKey };
