import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// The order cart / selected items a salesperson is building before placing an
// order. Keyed by productId -> quantity.
export type CartState = {
  items: Record<string, number>;
};

const initialState: CartState = {
  items: {},
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCartQuantity(
      state,
      action: PayloadAction<{ productId: string; quantity: number }>,
    ) {
      const { productId, quantity } = action.payload;
      if (quantity <= 0) {
        delete state.items[productId];
      } else {
        state.items[productId] = quantity;
      }
    },
    removeCartItem(state, action: PayloadAction<string>) {
      delete state.items[action.payload];
    },
    clearCart(state) {
      state.items = {};
    },
  },
});

export const { setCartQuantity, removeCartItem, clearCart } = cartSlice.actions;

export default cartSlice.reducer;
