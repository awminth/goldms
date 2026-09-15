import type { InventoryItem } from '../types/gold';

/** Stable product-SKU key so identical stock units group together (Thai qty, etc.). */
export function inventoryProductKey(item: InventoryItem): string {
  const isThai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
  if (isThai) {
    return [
      'THAI',
      (item.name_mm || '').trim(),
      (item.name || '').trim(),
      Number(item.thai_weight_unit || 0).toFixed(2),
      Number(item.craftsmanship_fee || 0).toFixed(0),
      Number(item.selling_price_estimated || 0).toFixed(0),
    ].join('|');
  }
  return [
    'MM',
    item.category || '',
    (item.name_mm || '').trim(),
    (item.name || '').trim(),
    item.purity || '',
    Number(item.net_weight_kyat || 0).toFixed(2),
    Number(item.net_weight_pae || 0).toFixed(2),
    Number(item.net_weight_yway || 0).toFixed(3),
    Number(item.craftsmanship_fee || 0).toFixed(0),
    Number(item.selling_price_estimated || 0).toFixed(0),
  ].join('|');
}

export type StockProductGroup = {
  key: string;
  sample: InventoryItem;
  units: InventoryItem[];
  inStockUnits: InventoryItem[];
  remainingQty: number;
};

export function groupInventoryProducts(items: InventoryItem[]): StockProductGroup[] {
  const map = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const key = inventoryProductKey(item);
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, units]) => {
    const sorted = [...units].sort((a, b) => a.barcode.localeCompare(b.barcode));
    const inStockUnits = sorted.filter((u) => u.status === 'IN_STOCK');
    const sample = inStockUnits[0] || sorted[0];
    return {
      key,
      sample,
      units: sorted,
      inStockUnits,
      remainingQty: inStockUnits.length,
    };
  });
}

/** Strip trailing -01 / -02 style qty suffix from barcode base. */
export function barcodeBase(barcode: string): string {
  return String(barcode || '').replace(/-\d{2}$/, '');
}

/** Next barcodes for restock: base-01, base-02… skipping existing. */
export function nextStockBarcodes(
  existingBarcodes: string[],
  preferredBase: string,
  qty: number
): string[] {
  const base = barcodeBase(preferredBase) || preferredBase;
  const used = new Set(existingBarcodes.map((b) => b.toLowerCase()));
  const out: string[] = [];
  let n = 1;
  while (out.length < qty && n < 1000) {
    const code = `${base}-${String(n).padStart(2, '0')}`;
    if (!used.has(code.toLowerCase())) {
      out.push(code);
      used.add(code.toLowerCase());
    }
    n += 1;
  }
  return out;
}
