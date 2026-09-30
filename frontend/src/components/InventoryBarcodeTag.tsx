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
 * Printed via react-to-print (see InventoryView).
 */
export const InventoryBarcodeTag = forwardRef<HTMLDivElement, InventoryBarcodeTagProps>(
  function InventoryBarcodeTag(
    { item, kyatToGrams = KYAT_TO_GRAMS, bahtBuyRate = 755, className = '' },
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
    const goldG = kpyToGrams(goldPure, kyatToGrams);
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
      <div ref={ref} className={`barcode-tag ${className}`.trim()}>
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
  }
);

/**
 * Print CSS for react-to-print.
 * Do NOT set @page to 75×15 (landscape) — that rotates against POS80 paper (80×210 portrait).
 * Keep page = printer paper (portrait); sticker content is fixed 75×15mm, centered on the page.
 */
export const BARCODE_TAG_PAGE_STYLE = `
@page {
  size: auto portrait;
  margin: 0;
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  min-height: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  background: #ffffff !important;
  color: #000000 !important;
}
html {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
body {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  min-height: 100vh !important;
  min-height: 100% !important;
}
body > * {
  margin: 0 !important;
}
.barcode-tag {
  width: 75mm !important;
  height: 15mm !important;
  max-width: 75mm !important;
  max-height: 15mm !important;
  min-width: 75mm !important;
  min-height: 15mm !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: stretch !important;
  gap: 0.8mm !important;
  padding: 0.5mm 0.7mm !important;
  margin: 0 auto !important;
  background: #ffffff !important;
  color: #111111 !important;
  border: none !important;
  overflow: hidden !important;
  font-family: "Noto Sans Myanmar", "Myanmar Text", system-ui, sans-serif !important;
  position: relative !important;
  left: auto !important;
  top: auto !important;
  transform: none !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.barcode-tag-left {
  flex: 0 0 28mm !important;
  width: 28mm !important;
  max-width: 28mm !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.3mm !important;
  min-width: 0 !important;
  border-right: 0.3mm solid #c5a059 !important;
  padding-right: 0.6mm !important;
}
.barcode-tag-barcode {
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  line-height: 0 !important;
}
.barcode-tag-svg {
  width: 100% !important;
  max-width: 27mm !important;
  height: auto !important;
  max-height: 9.5mm !important;
}
.barcode-tag-code {
  font-family: ui-monospace, Consolas, monospace !important;
  font-size: 5.5pt !important;
  font-weight: 700 !important;
  letter-spacing: 0.02em !important;
  line-height: 1 !important;
  text-align: center !important;
  color: #111 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  max-width: 100% !important;
}
.barcode-tag-right {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 0.15mm !important;
  padding-left: 0.4mm !important;
  text-align: center !important;
}
.barcode-tag-purity {
  font-size: 6.5pt !important;
  font-weight: 800 !important;
  line-height: 1.05 !important;
  color: #7a5210 !important;
  letter-spacing: 0.02em !important;
  width: 100% !important;
  text-align: center !important;
}
.barcode-tag-row-value {
  font-family: ui-monospace, Consolas, monospace !important;
  font-size: 5.4pt !important;
  font-weight: 700 !important;
  color: #111 !important;
  text-align: center !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  width: 100% !important;
  line-height: 1.08 !important;
}
`;
