const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

/**
 * Permanently delete a user from Firebase Authentication and Firestore.
 *
 * Only admins may call this. The user's Auth account, their Firestore
 * `users/{uid}` document (which holds their store assignments), and any
 * lingering references are removed.
 */
exports.deleteUser = onCall(async request => {
  const callerUid = request.auth && request.auth.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const targetUid = request.data && request.data.uid;
  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'A target user uid is required.');
  }
  if (targetUid === callerUid) {
    throw new HttpsError('failed-precondition', 'You cannot delete your own account.');
  }

  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || callerSnap.get('role') !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can delete users.');
  }

  // 1. Delete from Firebase Authentication (ignore if already gone).
  try {
    await admin.auth().deleteUser(targetUid);
  const callerUid = request.auth && request.auth.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const targetUid = request.data && request.data.uid;
  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'A target user uid is required.');
  }
  if (targetUid === callerUid) {
    throw new HttpsError('failed-precondition', 'You cannot delete your own account.');
  }

  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || callerSnap.get('role') !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can delete users.');
  }

  // 1. Delete from Firebase Authentication (ignore if already gone).
  try {
    await admin.auth().deleteUser(targetUid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', `Auth deletion failed: ${err.message}`);
    }
  }

  // 2. Delete the Firestore user document (store assignments live here).
  await db.collection('users').doc(targetUid).delete();

  return { success: true, uid: targetUid };
});

exports.cleanupOpdStockMovementHistory = onSchedule('every 24 hours', async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const removableActions = ['Stock Moved', 'Stock Transfer'];
  const snapshot = await db
    .collection('activityLogs')
    .where('action', 'in', removableActions)
    .where('createdAt', '<', cutoff)
    .limit(400)
    .get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
});

// New Cloud Function: Supervisor verifies dispatch and uploads truck loading photo before marking order Out for Delivery
exports.verifyOutForDelivery = onCall(async (request) => {
  const { orderId, truckPhotoUrl } = request.data || {};
  const callerUid = request.auth && request.auth.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Authentication required');
  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || callerSnap.get('role') !== 'supervisor') {
    throw new HttpsError('permission-denied', 'Only supervisors can verify dispatch');
  }
  if (!orderId || !truckPhotoUrl) {
    throw new HttpsError('invalid-argument', 'orderId and truckPhotoUrl are required');
  }
  const orderRef = db.collection('orders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    const order = orderSnap.data();
    if (!order) throw new HttpsError('not-found', 'Order not found');
    if (order.status !== 'billed') {
      throw new HttpsError('failed-precondition', 'Order must be Billed before dispatch');
    }
    tx.update(orderRef, {
      status: 'out_for_delivery',
      deliveryStatus: 'out_for_delivery',
      truckPhotoUrl,
      dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
      dispatchedBy: callerUid,
    });
    // Activity log
    const logRef = db.collection('activityLogs').doc();
    tx.set(logRef, {
      action: 'Dispatch Approved',
      detail: `Supervisor ${callerUid} approved dispatch for order ${orderId}`,
      storeId: order.storeId || null,
      createdBy: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { success: true };
});

// New Cloud Function: Accounts approves order creation (moves Ordered -> Billed)
exports.approveOrderBilling = onCall(async (request) => {
  const { orderId } = request.data || {};
  const callerUid = request.auth && request.auth.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Authentication required');
  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || callerSnap.get('role') !== 'accounts') {
    throw new HttpsError('permission-denied', 'Only Accounts role can approve billing');
  }
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId required');
  const orderRef = db.collection('orders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    const order = snap.data();
    if (!order) throw new HttpsError('not-found', 'Order not found');
    if (order.status !== 'ordered') {
      throw new HttpsError('failed-precondition', 'Order must be in Ordered state');
    }
    tx.update(orderRef, {
      status: 'billed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const logRef = db.collection('activityLogs').doc();
    tx.set(logRef, {
      action: 'Order Billed',
      detail: `Accounts ${callerUid} approved billing for order ${orderId}`,
      storeId: order.storeId || null,
      createdBy: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { success: true };
});

// New Cloud Function: Record a partial delivery
exports.recordPartialDelivery = onCall(async (request) => {
  const { orderId, deliveryItems } = request.data || {};
  const callerUid = request.auth && request.auth.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Authentication required');
  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || (callerSnap.get('role') !== 'supervisor' && callerSnap.get('role') !== 'accounts')) {
    throw new HttpsError('permission-denied', 'Only Supervisor or Accounts can record deliveries');
  }
  if (!orderId || !Array.isArray(deliveryItems) || deliveryItems.length === 0) {
    throw new HttpsError('invalid-argument', 'orderId and deliveryItems are required');
  }
  const orderRef = db.collection('orders').doc(orderId);
  const deliveryRef = db.collection('deliveries').doc();
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    const order = orderSnap.data();
    if (!order) throw new HttpsError('not-found', 'Order not found');
    if (!order.items) throw new HttpsError('failed-precondition', 'Order has no line items');
    // Update quantities per line item
    const updatedItems = order.items.map(item => {
      const deliveryItem = deliveryItems.find(di => di.productId === item.productId);
      if (deliveryItem) {
        const deliveredNow = Number(deliveryItem.deliveredQuantity || 0);
        const newDelivered = (item.deliveredQuantity || 0) + deliveredNow;
        const pending = (item.pendingQuantity ?? item.quantity) - deliveredNow;
        return {
          ...item,
          deliveredQuantity: newDelivered,
          pendingQuantity: pending < 0 ? 0 : pending,
        };
      }
      return item;
    });
    // Determine new overall status
    const allDelivered = updatedItems.every(i => (i.pendingQuantity ?? 0) <= 0);
    const newStatus = allDelivered ? 'delivered' : 'partially_delivered';
    tx.update(orderRef, {
      items: updatedItems,
      status: newStatus,
      deliveryStatus: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Create delivery record
    tx.set(deliveryRef, {
      orderId,
      items: deliveryItems,
      status: newStatus,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: callerUid,
    });
    // Update inventory stock for each delivered product
    deliveryItems.forEach(di => {
      const invRef = db.collection('inventory').doc(di.productId);
      tx.update(invRef, {
        quantity: admin.firestore.FieldValue.increment(-Number(di.deliveredQuantity || 0)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    // Activity log
    const logRef = db.collection('activityLogs').doc();
    tx.set(logRef, {
      action: allDelivered ? 'Delivery Completed' : 'Partial Delivery',
      detail: `Delivery recorded for order ${orderId}`,
      storeId: order.storeId || null,
      createdBy: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { success: true };
});

// New Cloud Function: Accounts approves final delivery completion
exports.approveDeliveryCompletion = onCall(async (request) => {
  const { orderId } = request.data || {};
  const callerUid = request.auth && request.auth.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Authentication required');
  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || callerSnap.get('role') !== 'accounts') {
    throw new HttpsError('permission-denied', 'Only Accounts role can approve delivery completion');
  }
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId required');
  const orderRef = db.collection('orders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    const order = snap.data();
    if (!order) throw new HttpsError('not-found', 'Order not found');
    if (order.status !== 'delivered') {
      throw new HttpsError('failed-precondition', 'Order must be in Delivered state');
    }
    tx.update(orderRef, {
      status: 'cancelled', // using 'cancelled' as placeholder for completed? Adjust as needed
      deliveryStatus: 'cancelled',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedBy: callerUid,
    });
    const logRef = db.collection('activityLogs').doc();
    tx.set(logRef, {
      action: 'Delivery Completed',
      detail: `Accounts ${callerUid} approved delivery completion for order ${orderId}`,
      storeId: order.storeId || null,
      createdBy: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { success: true };
});

exports.restockUndeliveredOrders = onSchedule('every 24 hours', async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const snapshot = await db
    .collection('orders')
    .where('status', 'in', ['ordered', 'billed', 'out_for_delivery', 'partially_delivered'])
    .where('createdAt', '<', cutoff)
    .limit(100)
    .get();

  for (const doc of snapshot.docs) {
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(doc.ref);
      const order = snap.data();
      if (!order || order.stockRestored) {
        return;
      }

      const items = Array.isArray(order.items) && order.items.length > 0
        ? order.items
        : [{ productId: order.productId, productName: order.productName, quantity: order.quantity }];
      const restoreByProduct = new Map();
      items.forEach(item => {
        const pending = Number(item.pendingQuantity ?? item.quantity ?? 0);
        if (pending <= 0 || !item.productId) {
          return;
        }
        restoreByProduct.set(item.productId, (restoreByProduct.get(item.productId) || 0) + pending);
      });

      const productIds = Array.from(restoreByProduct.keys());
      const inventorySnaps = await Promise.all(
        productIds.map(productId => transaction.get(db.collection('inventory').doc(productId))),
      );
      const restoredProducts = new Map();
      inventorySnaps.forEach((inventorySnap, index) => {
        const productId = productIds[index];
        const returned = restoreByProduct.get(productId) || 0;
        const before = Number((inventorySnap.data() || {}).quantity || 0);
        const after = before + returned;
        restoredProducts.set(productId, { before, returned, after });
        transaction.update(inventorySnap.ref, {
          quantity: after,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      const nextItems = items.map(item => {
        const restoredProduct = restoredProducts.get(item.productId);
        return {
          ...item,
          pendingQuantity: 0,
          ...(restoredProduct
            ? {
                stockBeforeReturn: restoredProduct.before,
                stockReturned: restoredProduct.returned,
                stockAfterReturn: restoredProduct.after,
              }
            : {}),
        };
      });

      transaction.update(doc.ref, {
        status: 'cancelled',
        deliveryStatus: 'cancelled',
        stockRestored: true,
        pendingQuantity: 0,
        restockedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: 'Auto-restocked after 10 days undelivered',
        cancelledBy: 'System',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        items: nextItems,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection('activityLogs').doc(), {
        action: 'Order Restocked',
        detail: `${order.customerName || 'Order'} auto-restocked after 10 days undelivered`,
        storeId: order.storeId || null,
        createdBy: 'System',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      nextItems
        .filter(item => Number(item.stockReturned || 0) > 0)
        .forEach(item => {
          transaction.set(db.collection('activityLogs').doc(), {
            action: 'Stock Returned',
            detail: `${item.productName}: returned ${item.stockReturned} units on auto-cancellation (${item.stockBeforeReturn} -> ${item.stockAfterReturn})`,
            storeId: order.storeId || null,
            createdBy: 'System',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
    });

    const deliveries = await db.collection('deliveries').where('orderId', '==', doc.id).get();
    if (!deliveries.empty) {
      const batch = db.batch();
      deliveries.docs.forEach(deliveryDoc => {
        batch.update(deliveryDoc.ref, {
          status: 'cancelled',
          pendingQuantity: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }
});
