import type { InventoryItem, StockAlertLevel } from '../types/models';

export function getStockAlertLevel(item: InventoryItem): StockAlertLevel {
  const quantity = Number(item.quantity || 0);
  const minimum = Number(item.minimumQuantity || 0);

  if (quantity <= 0) {
    return 'out_of_stock';
  }
  if (minimum > 0 && quantity <= minimum * 0.5) {
    return 'critical';
  }
  if (minimum > 0 && quantity <= minimum) {
    return 'low';
  }
  return 'ok';
}

export function stockAlertLabel(level: StockAlertLevel) {
  switch (level) {
    case 'out_of_stock':
      return 'Out of Stock';
    case 'critical':
      return 'Critical Stock';
    case 'low':
      return 'Low Stock';
    default:
      return 'In Stock';
  }
}

export function inventoryMatchKey(item: Pick<
  InventoryItem,
  'name' | 'sku' | 'storeId' | 'warehouseId' | 'locationCode'
>) {
  return [
    item.name.trim().toLowerCase(),
    (item.sku || '').trim().toLowerCase(),
    item.storeId,
    item.warehouseId,
    item.locationCode.trim().toUpperCase(),
  ].join('|');
}

export function findMatchingInventory(
  inventory: InventoryItem[],
  target: Pick<
    InventoryItem,
    'name' | 'sku' | 'storeId' | 'warehouseId' | 'locationCode'
  >,
  excludeId?: string,
) {
  const key = inventoryMatchKey(target);
  return inventory.find(item => item.id !== excludeId && inventoryMatchKey(item) === key) || null;
}

export function sortByNewest<T extends { createdAt?: unknown; updatedAt?: unknown }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftTime = timestampValue(left.createdAt ?? left.updatedAt);
    const rightTime = timestampValue(right.createdAt ?? right.updatedAt);
    return rightTime - leftTime;
  });
}

function timestampValue(value?: unknown) {
  const maybeTimestamp = value as { toDate?: () => Date } | undefined;
  return maybeTimestamp?.toDate?.()?.getTime?.() || 0;
}
