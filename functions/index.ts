import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Delete a user completely: Auth user and Firestore profile.
 * Expects data: { uid: string }
 * Caller must be authenticated and have admin role.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Request not authenticated');
  }

  const callerUid = context.auth.uid;
  // OPTIONAL: Check caller's role in Firestore (admin only)
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  const callerData = callerDoc.data();
  if (!callerData || callerData.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admin users can delete accounts');
  }

  const uid = data?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing uid');
  }

  try {
    // Delete auth user, ignore if already deleted (user-not-found)
    await admin.auth().deleteUser(uid).catch(err => {
      // err.code may be a string like 'auth/user-not-found' or contain that phrase
      if (err.code && err.code !== 'auth/user-not-found' && !(err.message && err.message.includes('user-not-found')) ) {
        throw err;
      }
      // else ignore
    });

    // Delete user profile document
    await admin.firestore().collection('users').doc(uid).delete();

    // Optional: Remove user from any store assignments
    const storesSnap = await admin.firestore().collection('stores').where('assignedStoreIds', 'array-contains', uid).get();
    const batch = admin.firestore().batch();
    storesSnap.forEach(storeDoc => {
      const storeRef = storeDoc.ref;
      batch.update(storeRef, {
        assignedStoreIds: admin.firestore.FieldValue.arrayRemove(uid),
      });
    });
    await batch.commit();

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Unknown error');
  }
});
