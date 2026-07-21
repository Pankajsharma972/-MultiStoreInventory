import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
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
} from '../../types/models';

// Raw server collections synced from Firestore. This is the single source of
// truth for all server data; screens read derived views via useInventoryData.
export type DataState = {
  stores: Store[];
  warehouses: Warehouse[];
  locations: StorageLocation[];
  inventory: InventoryItem[];
  orders: CustomerOrder[];
  deliveries: PendingDelivery[];
  transfers: StockTransfer[];
  activity: ActivityLog[];
  users: UserProfile[];
  loading: boolean;
  error: string;
};

const initialState: DataState = {
  stores: [],
  warehouses: [],
  locations: [],
  inventory: [],
  orders: [],
  deliveries: [],
  transfers: [],
  activity: [],
  users: [],
  loading: true,
  error: '',
};

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setStores(state, action: PayloadAction<Store[]>) {
      state.stores = action.payload;
    },
    setWarehouses(state, action: PayloadAction<Warehouse[]>) {
      state.warehouses = action.payload;
    },
    setLocations(state, action: PayloadAction<StorageLocation[]>) {
      state.locations = action.payload;
    },
    setInventory(state, action: PayloadAction<InventoryItem[]>) {
      state.inventory = action.payload;
    },
    setOrders(state, action: PayloadAction<CustomerOrder[]>) {
      state.orders = action.payload;
    },
    setDeliveries(state, action: PayloadAction<PendingDelivery[]>) {
      state.deliveries = action.payload;
    },
    setTransfers(state, action: PayloadAction<StockTransfer[]>) {
      state.transfers = action.payload;
    },
    setActivity(state, action: PayloadAction<ActivityLog[]>) {
      state.activity = action.payload;
    },
    setUsers(state, action: PayloadAction<UserProfile[]>) {
      state.users = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
  },
});

export const {
  setStores,
  setWarehouses,
  setLocations,
  setInventory,
  setOrders,
  setDeliveries,
  setTransfers,
  setActivity,
  setUsers,
  setLoading,
  setError,
} = dataSlice.actions;

export default dataSlice.reducer;
