import React from 'react';
import type { InventoryItem } from '../types/gold';
import {
  KYAT_TO_GRAMS,
  PURITY_LABELS,
  kpyToGrams,
  kpyToYway,
  mmkToBaht,
  ywayToKpy,
} from '../utils/goldCalculations';
import { BarcodeLabel } from './BarcodeLabel';

type InventoryBarcodeTagProps = {
  item: InventoryItem;
  kyatToGrams?: number;
  /** Baht↔MMK buy rate — Thai လက်ခ (฿) conversion */
  bahtBuyRate?: number;
  className?: string;
};

/** Always show gram unit — missing → 0 g */
function fmtGram(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, n) : 0;
  if (v === 0) return '0 g';
  return `${v.toFixed(v >= 10 ? 2 : 3)} g`;
}

/** Always show MMK — missing → 0mmk */
function fmtMmk(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  return `${v.toLocaleString('en-US')}mmk`;
}

/** Always show Baht — missing → 0฿ */
function fmtBaht(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  return `${v.toLocaleString('en-US')}฿`;
}

/** အလျော့တွက် — ပဲ / Y; missing → 0 Y */
function fmtWastage(pae: number, yway: number): string {
  const p = Number(pae || 0);
  const y = Number(yway || 0);
  if (p <= 0 && y <= 0) return '0 Y';
  const parts: string[] = [];
  if (p > 0) parts.push(`${p % 1 === 0 ? String(p) : p.toFixed(1)} ပဲ`);
  if (y > 0) parts.push(`${y % 1 === 0 ? String(y) : y.toFixed(1)} Y`);
  else if (p > 0) parts.push('0 Y');
  return parts.join(' ');
}

/**
 * Jewelry barcode sticker — physical size 75mm × 15mm.
 * Left: barcode + item code. Right: centered purity + values/units (fixed format, 0 if empty).
 */
export const InventoryBarcodeTag: React.FC<InventoryBarcodeTagProps> = ({
  item,
  kyatToGrams = KYAT_TO_GRAMS,
  bahtBuyRate = 755,
  className = '',
}) => {
  const isThai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
  const purityLabel = PURITY_LABELS[item.purity]?.mm || item.purity;

  const gross = {
    kyat: Number(item.weight_kyat || 0),
    pae: Number(item.weight_pae || 0),
    yway: Number(item.weight_yway || 0),
  };
  const gem = {
    kyat: Number(item.gemstone_weight_kyat || 0),
    pae: Number(item.gemstone_weight_pae || 0),
    yway: Number(item.gemstone_weight_yway || 0),
  };
  const net = {
    kyat: Number(item.net_weight_kyat || 0),
    pae: Number(item.net_weight_pae || 0),
    yway: Number(item.net_weight_yway || 0),
  };

  const gemYway = kpyToYway(gem.kyat, gem.pae, gem.yway);
  const goldPureYway = Math.max(0, kpyToYway(gross.kyat, gross.pae, gross.yway) - gemYway);
  const goldPure = ywayToKpy(goldPureYway);
  const wasteYway = Math.max(0, kpyToYway(net.kyat, net.pae, net.yway) - goldPureYway);
  const waste = ywayToKpy(wasteYway);

  const grossG = kpyToGrams(gross, kyatToGrams);
  const goldG = kpyToGrams(goldPure, kyatToGrams);
  const hasStone =
    gemYway > 0 ||
    Number(item.stone_price || 0) > 0 ||
    Number(item.stone_profit_price || 0) > 0;

  const craftMmk =
    Number(item.craftsmanship_fee || 0) + Number(item.craftsmanship_profit_fee || 0);
  const stoneMmk = Number(item.stone_price || 0) + Number(item.stone_profit_price || 0);
  const craftBaht = Math.round(mmkToBaht(craftMmk, bahtBuyRate) || 0);

  const thaiG =
    Number(item.thai_weight_unit || 0) > 0
      ? Number(item.thai_weight_unit)
      : goldG || grossG;

  const rightValues = isThai
    ? [fmtGram(thaiG), fmtBaht(craftBaht)]
    : hasStone
      ? [
          fmtGram(grossG),
          fmtGram(goldG),
          fmtWastage(waste.pae, waste.yway),
          fmtMmk(stoneMmk),
          fmtMmk(craftMmk),
        ]
      : [fmtGram(goldG), fmtWastage(waste.pae, waste.yway), fmtMmk(craftMmk)];

  return (
    <div
      id="printable-barcode-tag"
      className={`barcode-tag printable-doc ${className}`.trim()}
    >
      <div className="barcode-tag-left">
        <div className="barcode-tag-barcode">
          <BarcodeLabel
            value={item.barcode}
            height={26}
            barWidth={1.1}
            margin={1}
            displayValue={false}
            fontSize={7}
            className="barcode-tag-svg"
          />
        </div>
        <div className="barcode-tag-code">{item.barcode}</div>
      </div>

      <div className="barcode-tag-right">
        <div className="barcode-tag-purity">{isThai ? 'ထိုင်း' : purityLabel}</div>
        {rightValues.map((v, i) => (
          <div key={`${i}-${v}`} className="barcode-tag-row-value">
            {v}
          </div>
        ))}
      </div>
    </div>
  );
};
