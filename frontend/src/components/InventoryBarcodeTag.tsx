import React, { forwardRef } from 'react';
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

export type TagPrinterModel = 'aimo' | 'xprinter';
export type TagHeadOrder = 'barcode_first' | 'text_first';

export type InventoryBarcodeTagProps = {
  item: InventoryItem;
  kyatToGrams?: number;
  /** Baht↔MMK buy rate — Thai လက်ခ (฿) conversion */
  bahtBuyRate?: number;
  /** Vertical fine-tune shift in mm */
  offsetY?: number;
  /** Horizontal fine-tune shift in mm */
  offsetX?: number;
  /** Printer model / paper layout: 'aimo' (Head-Left, Tail-Right) or 'xprinter' (Tail-Left, Head-Right) */
  printerModel?: TagPrinterModel;
  /** Head column order: 'barcode_first' or 'text_first' */
  headOrder?: TagHeadOrder;
  /** Rotate entire tag 180 degrees (for printers that feed upside down) */
  rotate180?: boolean;
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
 * Physical Jewelry Dumbbell Tag: 75mm × 15mm (2.95" × 0.59").
 * Head: 48mm wide (Barcode: 24mm, Details: 24mm).
 * Tail: 27mm wide (blank wrap strap).
 *
 * Supports both:
 * - AIMO QF368B (Head on Left 48mm, Tail on Right 27mm)
 * - Xprinter XP-410B (Tail on Left 27mm, Head on Right 48mm)
 */
export const InventoryBarcodeTag = forwardRef<HTMLDivElement, InventoryBarcodeTagProps>(
  function InventoryBarcodeTag(
    {
      item,
      kyatToGrams = KYAT_TO_GRAMS,
      bahtBuyRate = 755,
      offsetY = 0,
      offsetX = 0,
      printerModel = 'aimo',
      headOrder = 'barcode_first',
      rotate180 = false,
      className = '',
    },
    ref
  ) {
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
    const gemG = gemYway > 0 ? kpyToGrams(gem, kyatToGrams) : 0;
    const goldG =
      gemYway > 0
        ? Number(Math.max(0, grossG - gemG).toFixed(3))
        : kpyToGrams(goldPure, kyatToGrams);
    const hasStone =
      gemYway > 0 ||
      Number(item.stone_price || 0) > 0 ||
      Number(item.stone_profit_price || 0) > 0;

    const craftMmk =
      Number(item.craftsmanship_fee || 0) + Number(item.craftsmanship_profit_fee || 0);
    const stoneMmk = Number(item.stone_price || 0) + Number(item.stone_profit_price || 0);
    const craftBahtStored =
      Number(item.craftsmanship_fee_baht || 0) +
      Number(item.craftsmanship_profit_fee_baht || 0);
    const itemRate =
      Number(item.baht_mmk_rate) > 0 ? Number(item.baht_mmk_rate) : bahtBuyRate;
    const craftBaht = Math.round(
      craftBahtStored > 0 ? craftBahtStored : mmkToBaht(craftMmk, itemRate) || 0
    );

    const thaiG =
      Number(item.thai_weight_unit || 0) > 0
        ? Number(item.thai_weight_unit)
        : goldG || grossG;

    // Details values (4 lines with purity for plain gold)
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

    const isDense = rightValues.length > 3;

    const barcodeCol = (
      <div key="col-barcode" className="barcode-tag-head-col barcode-tag-head-left barcode-tag-col-barcode">
        <div className="barcode-tag-barcode">
          <BarcodeLabel
            value={item.barcode}
            height={15}
            barWidth={0.82}
            margin={0}
            displayValue={false}
            fontSize={6}
            className="barcode-tag-svg"
          />
        </div>
        <div className="barcode-tag-code">{item.barcode}</div>
      </div>
    );

    const detailsCol = (
      <div key="col-details" className={`barcode-tag-head-col barcode-tag-head-right barcode-tag-col-details ${isDense ? 'is-dense' : ''}`}>
        <div className="barcode-tag-purity">{isThai ? 'ထိုင်း' : purityLabel}</div>
        {rightValues.map((v, i) => (
          <div key={`${i}-${v}`} className="barcode-tag-row-value">
            {v}
          </div>
        ))}
      </div>
    );

    const headCols =
      headOrder === 'text_first' ? [detailsCol, barcodeCol] : [barcodeCol, detailsCol];

    const tailEl = (
      <div
        key="tail"
        className={`barcode-tag-tail ${printerModel === 'xprinter' ? 'barcode-tag-tail-left' : 'barcode-tag-tail-right'}`}
        title="Dumbbell tail (blank wrap area)"
      >
        <div className="barcode-tag-tail-inner" />
      </div>
    );

    const transformParts: string[] = [];
    if (offsetX !== 0 || offsetY !== 0) {
      transformParts.push(`translate(${offsetX}mm, ${offsetY}mm)`);
    }
    if (rotate180) {
      transformParts.push('rotate(180deg)');
    }
    const containerTransform = transformParts.length > 0 ? transformParts.join(' ') : undefined;

    return (
      <div
        ref={ref}
        className={`barcode-tag-container tag-dumbbell ${rotate180 ? 'rotate-180' : ''} ${className}`.trim()}
        style={{
          transform: containerTransform,
          transformOrigin: 'center center',
        }}
      >
        {printerModel === 'xprinter' ? (
          <>
            {tailEl}
            <div className="barcode-tag-head barcode-tag-head-rightside">
              {headCols}
            </div>
          </>
        ) : (
          <>
            <div className="barcode-tag-head barcode-tag-head-leftside">
              {headCols}
            </div>
            {tailEl}
          </>
        )}
      </div>
    );
  }
);

/**
 * Print CSS for react-to-print — jewelry dumbbell tags.
 *
 * Physical sticker size: 75mm × 15mm (2.95" × 0.59").
 * Single-page lock guarantees 1 label per print without skipping.
 */
export function getBarcodeTagPageStyle(
  offsetY: number = 0,
  offsetX: number = 0,
  rotate180: boolean = false
): string {
  const transformParts: string[] = [];
  if (offsetX !== 0 || offsetY !== 0) {
    transformParts.push(`translate(${offsetX}mm, ${offsetY}mm)`);
  }
  if (rotate180) {
    transformParts.push('rotate(180deg)');
  }
  const transform = transformParts.length > 0 ? transformParts.join(' ') : 'none';

  return `
@page {
  size: 75mm 15mm;
  margin: 0 !important;
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 75mm !important;
  height: 14mm !important;
  max-height: 14mm !important;
  overflow: hidden !important;
  background: #ffffff !important;
  color: #000000 !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  page-break-after: avoid !important;
  break-after: avoid !important;
}
body {
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  width: 75mm !important;
  height: 14mm !important;
  max-height: 14mm !important;
  overflow: hidden !important;
}

.barcode-tag-container {
  width: 75mm !important;
  height: 14mm !important;
  max-width: 75mm !important;
  max-height: 14mm !important;
  min-width: 75mm !important;
  min-height: 14mm !important;
  box-sizing: border-box !important;
  position: relative !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
  color: #000000 !important;
  overflow: hidden !important;
  font-family: "Noto Sans Myanmar", "Myanmar Text", system-ui, sans-serif !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
  page-break-before: avoid !important;
  break-before: avoid !important;
  page-break-after: avoid !important;
  break-after: avoid !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  transform: ${transform} !important;
  transform-origin: center center !important;
}

.barcode-tag-head {
  flex: 0 0 47.2mm !important;
  width: 47.2mm !important;
  max-width: 47.2mm !important;
  min-width: 47.2mm !important;
  height: 14mm !important;
  min-height: 14mm !important;
  max-height: 14mm !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  margin: 0 !important;
}

.barcode-tag-head-leftside {
  border-right: none !important;
}

.barcode-tag-head-rightside {
  border-left: none !important;
}

.barcode-tag-head-col {
  flex: 0 0 23.6mm !important;
  width: 23.6mm !important;
  max-width: 23.6mm !important;
  min-width: 23.6mm !important;
  height: 14mm !important;
  min-height: 14mm !important;
  max-height: 14mm !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0.1mm 0.25mm !important;
  overflow: hidden !important;
}

.barcode-tag-head .barcode-tag-head-col:first-child {
  border-right: 0.25mm solid #000000 !important;
}

.barcode-tag-head .barcode-tag-head-col:last-child {
  border-right: none !important;
}

.barcode-tag-tail {
  flex: 0 0 27.8mm !important;
  width: 27.8mm !important;
  min-width: 27.8mm !important;
  max-width: 27.8mm !important;
  height: 14mm !important;
  box-sizing: border-box !important;
  visibility: hidden !important;
}

.barcode-tag-tail-left {
  flex: 0 0 27.8mm !important;
  width: 27.8mm !important;
  min-width: 27.8mm !important;
  max-width: 27.8mm !important;
}

.barcode-tag-barcode {
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  line-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

.barcode-tag-svg {
  width: 100% !important;
  max-width: 18mm !important;
  height: auto !important;
  max-height: 6.2mm !important;
  display: block !important;
  margin: 0 auto !important;
}

.barcode-tag-code {
  font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace !important;
  font-size: 6.8pt !important;
  font-weight: 700 !important;
  letter-spacing: 0.03em !important;
  line-height: 1.1 !important;
  text-align: center !important;
  color: #000000 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

.barcode-tag-purity {
  font-family: 'SF Mono', "Noto Sans Myanmar", "Myanmar Text", system-ui, sans-serif !important;
  font-size: 7.8pt !important;
  font-weight: 800 !important;
  line-height: 1.1 !important;
  color: #000000 !important;
  letter-spacing: 0.02em !important;
  width: 100% !important;
  text-align: center !important;
  margin: 0 !important;
  padding: 0 !important;
}

.barcode-tag-row-value {
  font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace !important;
  font-size: 6.4pt !important;
  font-weight: 700 !important;
  color: #000000 !important;
  text-align: center !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  width: 100% !important;
  line-height: 1.15 !important;
  margin: 0 !important;
  padding: 0 !important;
}

.barcode-tag-head-col.is-dense .barcode-tag-purity {
  font-size: 6.6pt !important;
}

.barcode-tag-head-col.is-dense .barcode-tag-row-value {
  font-size: 5.3pt !important;
  line-height: 1.05 !important;
}
`;
}

export const BARCODE_TAG_PAGE_STYLE = getBarcodeTagPageStyle(0, 0, false);
