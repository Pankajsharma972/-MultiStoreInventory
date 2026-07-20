export type UserRole = 'admin' | 'staff';

export type StockAlertLevel = 'ok' | 'low' | 'critical' | 'out_of_stock';

export type StockOperationType = 'receive' | 'adjust' | 'move' | 'damaged';

export type ActivityAction =
  | 'Product Created'
  | 'Product Updated'
  | 'Stock Added'
  | 'Stock Updated'
  | 'Stock Removed'
  | 'Stock Transfer'
  | 'Stock Moved'
  | 'Order Created'
  | 'Order Updated'
  | 'Delivery Completed'
  | 'Delivery Updated'
  | 'Store Created'
  | 'Warehouse Created'
  | 'Location Created'
  | 'User Access Updated'
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
  size?: string;
  sku?: string;
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

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
export type DeliveryStatus = 'pending' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type CustomerOrder = {
  id: string;
  customerName: string;
  customerPhone?: string;
  productId: string;
  productName: string;
  quantity: number;
  storeId: string;
  status: OrderStatus;
  deliveryStatus: DeliveryStatus;
  expectedDeliveryDate?: string;
  createdAt?: unknown;
};

export type PendingDelivery = {
  id: string;
  orderId?: string;
  customerName: string;
  productName: string;
  quantity: number;
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
