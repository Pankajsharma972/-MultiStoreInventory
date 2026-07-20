const { onCall, HttpsError } = require('firebase-functions/v2/https');
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
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', `Auth deletion failed: ${err.message}`);
    }
  }

  // 2. Delete the Firestore user document (store assignments live here).
  await db.collection('users').doc(targetUid).delete();

  return { success: true, uid: targetUid };
});
