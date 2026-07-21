import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './slices/cartSlice';
import dataReducer from './slices/dataSlice';
import filtersReducer from './slices/filtersSlice';

export const store = configureStore({
  reducer: {
    data: dataReducer,
    cart: cartReducer,
    filters: filtersReducer,
  },
  middleware: getDefaultMiddleware =>
    // Firestore timestamps and other non-serialisable values live on the data
    // slice; disable the serialisability check rather than mangle them.
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
