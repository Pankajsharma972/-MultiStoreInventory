export type UserRole = 'admin' | 'staff' | 'accountant' | 'supervisor';

export type StockAlertLevel = 'ok' | 'low' | 'critical' | 'out_of_stock';

export type StockOperationType = 'receive' | 'adjust' | 'move' | 'damaged';

// Glaze / finish of a design product.
export type GlazeOption = 'glossy' | 'matte' | 'carving';

export type ActivityAction =
  | 'Product Created'
  | 'Product Updated'
  | 'Stock Added'
  | 'Stock Updated'
  | 'Stock Removed'
  | 'Stock Returned'
  | 'Stock Transfer'
  | 'Stock Moved'
  | 'Order Created'
  | 'Order Updated'
  | 'Delivery Completed'
  | 'Delivery Updated'
  | 'Dispatch Approved'
  | 'Order Restocked'
  | 'Store Created'
  | 'Warehouse Created'
  | 'Location Created'
  | 'User Access Updated'
  | 'User Deleted'
  | 'System Setup';

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  assignedStoreIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Store = {
  id: string;
  name: string;
  location?: string;
  active?: boolean;
};

export type Warehouse = {
  id: string;
  storeId: string;
  name: string;
  active?: boolean;
};

export type StorageLocation = {
  id: string;
  storeId: string;
  warehouseId: string;
  code: string;
  description?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  brand?: string;
  glaze?: GlazeOption | '';
  size?: string;
  sku?: string;
  photoUrl?: string;
  storeId: string;
  warehouseId: string;
  locationCode: string;
  quantity: number;
  minimumQuantity: number;
  updatedAt?: unknown;
};

export type StockTransfer = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  fromStoreId: string;
  fromWarehouseId: string;
  fromLocationCode: string;
  toStoreId: string;
  toWarehouseId: string;
  toLocationCode: string;
  createdAt?: unknown;
  createdBy?: string;
};

// A single order can contain multiple designs. The lifecycle a salesperson and
// the delivery person move an order through:
//   ordered -> billed -> out_for_delivery -> delivered  (or cancelled)
export type OrderStatus =
  | 'ordered'
  | 'billed'
  | 'out_for_delivery'
  | 'partially_delivered'
  | 'delivered'
  | 'cancelled';

// Deliveries follow the same lifecycle as their order.
export type DeliveryStatus = OrderStatus;

export type OrderLineItem = {
  productId: string;
  productName: string;
  quantity: number;
  deliveredQuantity?: number;
  pendingQuantity?: number;
  stockBeforeOrder?: number;
  stockAfterOrder?: number;
  stockBeforeReturn?: number;
  stockReturned?: number;
  stockAfterReturn?: number;
  brand?: string;
  size?: string;
  photoUrl?: string;
};

export type DeliveryLineItem = OrderLineItem & {
  dispatchQuantity?: number;
};

export type CustomerOrder = {
  id: string;
  customerName: string;
  customerPhone?: string;
  // A summary of the first line item is kept on the order for backwards
  // compatibility and simple lists; `items` holds the full multi-design order.
  productId: string;
  productName: string;
  quantity: number;
  items?: OrderLineItem[];
  storeId: string;
  status: OrderStatus;
  deliveryStatus: DeliveryStatus;
  deliveredQuantity?: number;
  pendingQuantity?: number;
  stockRestored?: boolean;
  restockedAt?: unknown;
  truckPhotoUrl?: string;
  dispatchedAt?: unknown;
  dispatchedBy?: string;
  completedAt?: unknown;
  completedBy?: string;
  expectedDeliveryDate?: string;
  createdAt?: unknown;
};

export type PendingDelivery = {
  id: string;
  orderId?: string;
  customerName: string;
  productName: string;
  quantity: number;
  deliveredQuantity?: number;
  pendingQuantity?: number;
  items?: DeliveryLineItem[];
  truckPhotoUrl?: string;
  dispatchedAt?: unknown;
  dispatchedBy?: string;
  completedAt?: unknown;
  completedBy?: string;
  storeId: string;
  status: DeliveryStatus;
  expectedDeliveryDate?: string;
  createdAt?: unknown;
};

export type ActivityLog = {
  id: string;
  action: ActivityAction | string;
  detail: string;
  storeId?: string;
  createdAt?: unknown;
  createdBy?: string;
};
