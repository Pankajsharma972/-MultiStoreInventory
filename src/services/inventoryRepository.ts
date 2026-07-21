import firestore from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { collections, db, firebaseFunctions, firebaseStorage } from './firebase';
import { findMatchingInventory, inventoryMatchKey } from '../utils/inventoryHelpers';
import type {
  ActivityAction,
  CustomerOrder,
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

// Upload a local image (from camera/gallery) to Firebase Storage and return its
// public download URL. Used for design/product photos.
export async function uploadProductPhoto(localUri: string): Promise<string> {
  if (!localUri) {
    throw new Error('No image selected.');
  }
  const extension = localUri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `product-photos/${Date.now()}-${Math.round(Math.random() * 1e6)}.${extension}`;
  const ref = firebaseStorage.ref(path);
  await ref.putFile(localUri);
  return ref.getDownloadURL();
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

// Statuses whose stock has been deducted from inventory and can still be
// returned to stock if the order is cancelled.
const DEDUCTED_STATUSES: OrderStatus[] = ['ordered', 'billed', 'out_for_delivery'];

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

    snaps.forEach((snap, index) => {
      transaction.update(snap.ref, {
        quantity: firestore.FieldValue.increment(-(requiredByProduct.get(productIds[index]) || 0)),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    const summary = items[0];
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);

    transaction.set(orderRef, {
      customerName,
      customerPhone: payload.customerPhone?.trim() || '',
      productId: summary.productId,
      productName: summary.productName,
      quantity: totalQuantity,
      items,
      storeId: payload.storeId,
      status: 'ordered' as OrderStatus,
      deliveryStatus: 'ordered' as DeliveryStatus,
      expectedDeliveryDate: payload.expectedDeliveryDate?.trim() || '',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(deliveryRef, {
      orderId: orderRef.id,
      customerName,
      productName: summary.productName,
      quantity: totalQuantity,
      items,
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
async function transitionOrder(orderId: string, nextStatus: OrderStatus) {
  const restored = await db.runTransaction(async transaction => {
    const orderRef = db.collection(collections.orders).doc(orderId);
    const orderSnap = await transaction.get(orderRef);
    const order = orderSnap.data() as CustomerOrder | undefined;
    if (!order) {
      throw new Error('Order not found.');
    }

    const previousStatus = order.status;
    const shouldRestore =
      nextStatus === 'cancelled' && DEDUCTED_STATUSES.includes(previousStatus);

    if (shouldRestore) {
      const items = orderLineItemsOf(order);
      const restoreByProduct = new Map<string, number>();
      items.forEach(item => {
        restoreByProduct.set(
          item.productId,
          (restoreByProduct.get(item.productId) || 0) + Number(item.quantity),
        );
      });
      restoreByProduct.forEach((qty, productId) => {
        transaction.update(db.collection(collections.inventory).doc(productId), {
          quantity: firestore.FieldValue.increment(qty),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });
    }

    transaction.update(orderRef, {
      status: nextStatus,
      deliveryStatus: nextStatus,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return shouldRestore;
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
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return restored;
}

export async function updateOrderStatus(
  order: CustomerOrder,
  status: OrderStatus,
  user: UserProfile | null,
) {
  if (status === order.status) {
    return;
  }
  const restored = await transitionOrder(order.id, status);
  await addActivity({
    action: 'Order Updated',
    detail: `${order.customerName} order → ${status.replace(/_/g, ' ')}${
      restored ? ' (stock returned)' : ''
    }`,
    storeId: order.storeId,
    user,
  });
}

export async function updateDeliveryStatus(
  delivery: PendingDelivery,
  status: DeliveryStatus,
  user: UserProfile | null,
) {
  if (status === delivery.status) {
    return;
  }

  let restored = false;
  if (delivery.orderId) {
    restored = await transitionOrder(delivery.orderId, status);
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
// only belong to one staff user at a time.
export async function setUserStoreAssignment(
  targetUser: UserProfile,
  storeId: string,
  assign: boolean,
  allUsers: UserProfile[],
  user: UserProfile | null,
) {
  const assigned = new Set(targetUser.assignedStoreIds || []);

  if (assign) {
    const owner = allUsers.find(
      candidate =>
        candidate.uid !== targetUser.uid &&
        candidate.role === 'staff' &&
        (candidate.assignedStoreIds || []).includes(storeId),
    );
    if (owner) {
      throw new Error(`Already assigned to: ${owner.name}`);
    }
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

export { inventoryMatchKey };
