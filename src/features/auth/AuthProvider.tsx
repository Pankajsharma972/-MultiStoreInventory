import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { collections, db, firebaseAuth } from '../../services/firebase';
import { ensureDefaultStoreStructure } from '../../services/inventoryRepository';
import type { UserProfile, UserRole } from '../../types/models';

type AuthContextValue = {
  initializing: boolean;
  user: FirebaseAuthTypes.User | null;
  profile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: { name: string; email: string; password: string }) => Promise<void>;
  createUser: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    assignedStoreIds: string[];
  }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // Profile listener
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return undefined;
    }

    let retryCount = 0;
    const maxRetries = 3;

    const fetchProfile = async () => {
      try {
        const documentSnapshot = await db
          .collection(collections.users)
          .doc(user.uid)
          .get();
        
        // ✅ CORRECT: Check using _exists property or data()
        if (documentSnapshot.data() !== null && documentSnapshot.data() !== undefined) {
          const userData = documentSnapshot.data() as UserProfile;
          setProfile(userData);
          console.log('✅ Profile loaded successfully');
        } else {
          console.log('⚠️ Profile not found, retrying...');
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(fetchProfile, 2000);
          } else {
            console.error('❌ Profile not found after retries');
            setProfile(null);
          }
        }
      } catch (error) {
        console.log('[Firebase] user profile fetch failed', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(fetchProfile, 2000);
        } else {
          setProfile(null);
        }
      }
    };

    fetchProfile();

    // Setup realtime listener
    const unsubscribe = db
      .collection(collections.users)
      .doc(user.uid)
      .onSnapshot(
        snapshot => {
          // ✅ CORRECT: Check using data() method
          if (snapshot && snapshot.data() !== null && snapshot.data() !== undefined) {
            const userData = snapshot.data() as UserProfile;
            setProfile(userData);
            console.log('✅ Profile updated via listener');
          } else {
            console.log('⚠️ Profile document deleted or not found');
            setProfile(null);
          }
        },
        error => {
          console.log('[Firebase] user profile listener failed', error);
        },
      );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      return;
    }

    ensureDefaultStoreStructure(profile).catch(error => {
      console.log('[Firebase] default store setup failed', error);
    });
  }, [profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      user,
      profile,
      
      signIn: async (email, password) => {
        try {
          console.log('[Firebase] signing in user', email.trim().toLowerCase());
          await firebaseAuth.signInWithEmailAndPassword(
            email.trim().toLowerCase(),
            password,
          );
          console.log('✅ User signed in successfully');
        } catch (error) {
          console.error('❌ Sign in failed:', error);
          throw error;
        }
      },
      
      signUp: async ({ name, email, password }) => {
        const normalizedEmail = email.trim().toLowerCase();
        console.log('[Firebase] creating staff auth user', normalizedEmail);
        
        try {
          const credential = await firebaseAuth.createUserWithEmailAndPassword(
            normalizedEmail,
            password,
          );
          console.log('✅ Auth user created:', credential.user.uid);

          await credential.user.updateProfile({ displayName: name.trim() });
          console.log('✅ Display name updated');

          const newProfile: UserProfile = {
            uid: credential.user.uid,
            name: name.trim(),
            email: normalizedEmail,
            role: 'staff',
            assignedStoreIds: [],
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          };

          console.log('[Firebase] creating Firestore user document', credential.user.uid);
          
          let retries = 3;
          let success = false;
          let lastError: any = null;

          while (retries > 0 && !success) {
            try {
              await db
                .collection(collections.users)
                .doc(credential.user.uid)
                .set(newProfile);
              
              const doc = await db
                .collection(collections.users)
                .doc(credential.user.uid)
                .get();
              
              // ✅ CORRECT: Check using data() method
              if (doc.data() !== null && doc.data() !== undefined) {
                console.log('✅ User document created and verified');
                success = true;
              } else {
                throw new Error('Document not found after creation');
              }
            } catch (error) {
              lastError = error;
              console.log(`❌ Firestore write attempt ${4 - retries} failed:`, error);
              retries--;
              if (retries > 0) {
                console.log('🔄 Retrying in 1 second...');
                await new Promise<void>(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (!success) {
            throw new Error(`Failed to create user profile: ${lastError?.message || 'Unknown error'}`);
          }

          console.log('✅ User signup complete');
          
        } catch (error) {
          console.error('❌ Signup failed:', error);
          throw error;
        }
      },
      
      createUser: async ({ name, email, password, role, assignedStoreIds }) => {
        if (profile?.role !== 'admin') {
          throw new Error('Only admins can create users.');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const secondaryAppName = `admin-user-create-${Date.now()}`;
        let secondaryApp: any = null;

        try {
          const secondaryAppOptions = {
            ...firebase.app().options,
            databaseURL: `https://${firebase.app().options.projectId}.firebaseio.com`,
          };
          secondaryApp = await firebase.initializeApp(
            secondaryAppOptions,
            secondaryAppName,
          );
          console.log('✅ Secondary app initialized');

          console.log('[Firebase] admin creating auth user', normalizedEmail, role);
          const credential = await auth(secondaryApp).createUserWithEmailAndPassword(
            normalizedEmail,
            password,
          );
          console.log('✅ Admin created auth user:', credential.user.uid);

          await credential.user.updateProfile({ displayName: name.trim() });
          console.log('✅ Display name updated');

          const newProfile: UserProfile = {
            uid: credential.user.uid,
            name: name.trim(),
            email: normalizedEmail,
            role,
            assignedStoreIds,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          };

          let retries = 3;
          let success = false;

          while (retries > 0 && !success) {
            try {
              await db
                .collection(collections.users)
                .doc(credential.user.uid)
                .set(newProfile);
              
              const doc = await db
                .collection(collections.users)
                .doc(credential.user.uid)
                .get();
              
              // ✅ CORRECT: Check using data() method
              if (doc.data() !== null && doc.data() !== undefined) {
                success = true;
                console.log('✅ User document created');
              } else {
                throw new Error('Document not found');
              }
            } catch (error) {
              console.log(`❌ Retry ${4 - retries} failed:`, error);
              retries--;
              if (retries > 0) await new Promise<void>(resolve => setTimeout(resolve, 1000));
            }
          }

          if (!success) {
            throw new Error('Failed to create user document');
          }

          if (profile) {
            await ensureDefaultStoreStructure(profile);
          }
          
        } catch (error) {
          console.error('❌ Admin create user failed:', error);
          throw error;
        } finally {
          if (secondaryApp) {
            try {
              await auth(secondaryApp).signOut();
            } catch (e) {}
            try {
              await secondaryApp.delete();
            } catch (e) {}
          }
        }
      },
      
      resetPassword: async email => {
        console.log('[Firebase] sending password reset', email.trim().toLowerCase());
        try {
          await firebaseAuth.sendPasswordResetEmail(email.trim().toLowerCase());
          console.log('✅ Password reset email sent');
        } catch (error) {
          console.error('❌ Password reset failed:', error);
          throw error;
        }
      },
      
      signOut: async () => {
        console.log('[Firebase] sign out');
        try {
          await firebaseAuth.signOut();
          console.log('✅ Signed out');
        } catch (error) {
          console.error('❌ Sign out failed:', error);
          throw error;
        }
      },
    }),
    [initializing, profile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
