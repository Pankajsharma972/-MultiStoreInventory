import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Centralised inventory search + filter state so the search query and active
// filters (and therefore the resulting search results) live in the store.
export type InventoryFilters = {
  query: string;
  storeId: string;
  warehouseId: string;
  category: string;
  brand: string;
  size: string;
  location: string;
  lowStockOnly: boolean;
};

export type FiltersState = {
  inventory: InventoryFilters;
};

const initialInventoryFilters: InventoryFilters = {
  query: '',
  storeId: '',
  warehouseId: '',
  category: '',
  brand: '',
  size: '',
  location: '',
  lowStockOnly: false,
};

const initialState: FiltersState = {
  inventory: initialInventoryFilters,
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setInventoryFilter<K extends keyof InventoryFilters>(
      state: FiltersState,
      action: PayloadAction<{ key: K; value: InventoryFilters[K] }>,
    ) {
      state.inventory[action.payload.key] = action.payload.value;
    },
    resetInventoryFilters(state) {
      state.inventory = initialInventoryFilters;
    },
  },
});

export const { setInventoryFilter, resetInventoryFilters } = filtersSlice.actions;

export default filtersSlice.reducer;
