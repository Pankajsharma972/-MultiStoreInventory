import type {
  GlazeOption,
  InventoryItem,
  OrderLineItem,
  OrderStatus,
  StockAlertLevel,
} from '../types/models';

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

// Flexible "type the initials" search. A query matches when, for every
// whitespace-separated term the user typed, at least one of these is true:
//   • some word in the haystack starts with the term (prefix search), or
//   • the term is a run of initials that prefixes the words' first letters
//     (e.g. "lb" -> "Leather Belt", "gmt" -> "Green Marble Tile"), or
//   • the haystack simply contains the term.
export function matchesSearch(haystack: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const text = haystack.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const initials = words.map(word => word[0]).join('');

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every(term => {
      if (text.includes(term)) {
        return true;
      }
      if (words.some(word => word.startsWith(term))) {
        return true;
      }
      return initials.startsWith(term);
    });
}

// The searchable text blob for an inventory item.
export function inventorySearchText(
  item: Pick<
    InventoryItem,
    'name' | 'category' | 'brand' | 'glaze' | 'size' | 'sku' | 'locationCode'
  >,
  extra: string[] = [],
): string {
  return [
    item.name,
    item.category,
    item.brand,
    item.glaze,
    item.size,
    item.sku,
    item.locationCode,
    ...extra,
  ]
    .filter(Boolean)
    .join(' ');
}

const glazeLabels: Record<GlazeOption, string> = {
  glossy: 'Glossy',
  matte: 'Matte',
  carving: 'Carving',
};

export const glazeOptions = Object.keys(glazeLabels) as GlazeOption[];

export function glazeLabel(glaze?: string): string {
  if (!glaze) {
    return '';
  }
  return glazeLabels[glaze as GlazeOption] || glaze;
}

// How many units to order to comfortably clear a low-stock alert: enough to
// reach roughly twice the minimum threshold, never less than the minimum.
export function suggestedReorderQuantity(item: InventoryItem): number {
  const quantity = Number(item.quantity || 0);
  const minimum = Number(item.minimumQuantity || 0);
  if (minimum <= 0) {
    return Math.max(0, -quantity);
  }
  return Math.max(minimum, minimum * 2 - quantity);
}

// Sort low-stock rows so all items of a brand (company) sit together, then by
// size, so a buyer can see "for this brand, how much to order" at a glance.
export function sortByBrandThenSize<
  T extends { brand?: string; size?: string; name: string },
>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const brandCompare = (left.brand || '~').localeCompare(right.brand || '~');
    if (brandCompare !== 0) {
      return brandCompare;
    }
    const sizeCompare = (left.size || '').localeCompare(right.size || '', undefined, {
      numeric: true,
    });
    if (sizeCompare !== 0) {
      return sizeCompare;
    }
    return left.name.localeCompare(right.name);
  });
}

const orderStatusLabels: Record<OrderStatus, string> = {
  ordered: 'Order Created',
  billed: 'Billed',
  out_for_delivery: 'Out for delivery',
  partially_delivered: 'Partially delivered',
  delivered: 'Fully delivered',
  cancelled: 'Cancelled',
};

export const orderStatusFlow: OrderStatus[] = [
  'ordered',
  'billed',
  'out_for_delivery',
  'partially_delivered',
  'delivered',
  'cancelled',
];

export function orderStatusLabel(status?: string): string {
  if (!status) {
    return '';
  }
  return (
    orderStatusLabels[status as OrderStatus] ||
    status.replace(/_/g, ' ')
  );
}

// Normalise an order/delivery into its line items, falling back to the summary
// fields for legacy single-product records.
export function resolveOrderItems(source: {
  items?: OrderLineItem[];
  productId?: string;
  productName?: string;
  quantity?: number;
}): OrderLineItem[] {
  if (source.items && source.items.length > 0) {
    return source.items;
  }
  return [
    {
      productId: source.productId || '',
      productName: source.productName || 'Item',
      quantity: Number(source.quantity || 0),
    },
  ];
}

export function orderStatusTone(
  status?: string,
): 'pending' | 'processing' | 'completed' | 'cancelled' {
  switch (status) {
    case 'delivered':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'billed':
    case 'out_for_delivery':
    case 'partially_delivered':
      return 'processing';
    default:
      return 'pending';
  }
}
