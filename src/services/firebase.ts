import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

export const firebaseAuth = auth();
export const db = firestore();
export const firebaseStorage = storage();

export const collections = {
  users: 'users',
  stores: 'stores',
  warehouses: 'warehouses',
  locations: 'locations',
  products: 'products',
  inventory: 'inventory',
  transfers: 'transfers',
  orders: 'orders',
  deliveries: 'deliveries',
  activityLogs: 'activityLogs',
} as const;
