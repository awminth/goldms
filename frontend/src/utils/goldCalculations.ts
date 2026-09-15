import { GoldPurity, WeightKPY } from '../types/gold';

/**
 * Standard Myanmar Gold Measurements:
 * 1 Kyat (ကျပ်) = 16 Pae (ပဲ)
 * 1 Pae (ပဲ) = 8 Yway (ရွေး)
 * 1 Kyat = 128 Yway (ရွေး)
 * Standard Metric weight: 1 Kyat ≈ 16.606 grams (1 Yway ≈ 0.1297 grams)
 * 
 * Thai Gold conversion specified:
 * 1 Kyat = 17.25 Yway (Standard shop convention for Thai gold unit conversion)
 */

export const KYAT_TO_PAE = 16;
export const PAE_TO_YWAY = 8;
export const KYAT_TO_YWAY = 128;
/** Default 1 ကျပ် → grams (overridable via Settings → Unit Conversion) */
export const KYAT_TO_GRAMS = 16.6;
/** Thai gold: 1 kyat ≈ 15.2 grams (shop note) */
export const THAI_KYAT_TO_GRAMS = 15.2;
export const THAI_GRAM_PRESETS = [1.0, 1.9, 3.8, 7.6, 15.2, 30.4] as const;
export const THAI_GOLD_RATIO_YWAY = 17.25;

export const MEELIN_PRICE_FACTOR: Record<GoldPurity, number | null> = {
  MEELIN: 1,
  K24: 1,
  PE15A: 16 / 17,
  PE15B: 16 / 17.5,
  PE14A: 14 / 16,
  PE13A: 13 / 16,
  PE12A: 12 / 16,
  K18: 12 / 16,
  THAI_GOLD: null,
};

/** Fallback ratios from မီးလင်း base (same shop-note formulas) */
export const PURITY_MULTIPLIERS: Record<GoldPurity, number> = {
  MEELIN: 1,
  K24: 1,
  PE15A: 16 / 17,
  PE15B: 16 / 17.5,
  PE14A: 14 / 16,
  PE13A: 13 / 16,
  PE12A: 12 / 16,
  K18: 12 / 16,
  THAI_GOLD: 0.965,
};

export const PURITY_LABELS: Record<GoldPurity, { mm: string; en: string; code: string }> = {
  MEELIN: { mm: 'မီးလင်း', en: 'Meelin', code: 'MEELIN' },
  K24: { mm: '24K', en: '24K', code: 'K24' },
  PE15A: { mm: '15A', en: '15A', code: '15A' },
  PE15B: { mm: '15B', en: '15B', code: '15B' },
  PE14A: { mm: '14A', en: '14A', code: '14A' },
  PE13A: { mm: '13A', en: '13A', code: '13A' },
  PE12A: { mm: '12A', en: '12A', code: '12A' },
  K18: { mm: '18K', en: '18K', code: '18K' },
  THAI_GOLD: { mm: 'ထိုင်းရွှေ', en: 'Thai Gold', code: 'THAI' },
};

export function derivePriceFromMeelin(meelinPrice: number, purity: GoldPurity | string): number {
  const factor = MEELIN_PRICE_FACTOR[purity as GoldPurity];
  if (factor == null) return 0;
  return Math.round(Number(meelinPrice) * factor);
}

export function derivedPricesFromMeelin(
  meelinSell: number,
  meelinBuy?: number
): Array<{ gold_type: GoldPurity; sellPrice: number; buyPrice: number }> {
  const sell = Number(meelinSell) || 0;
  const buy = meelinBuy != null ? Number(meelinBuy) : Math.max(0, sell - 50000);
  const types: GoldPurity[] = [
    'MEELIN',
    'K24',
    'PE15A',
    'PE15B',
    'PE14A',
    'PE13A',
    'PE12A',
    'K18',
  ];
  return types.map((gold_type) => {
    const factor = MEELIN_PRICE_FACTOR[gold_type] ?? 1;
    return {
      gold_type,
      sellPrice: Math.round(sell * factor),
      buyPrice: Math.round(buy * factor),
    };
  });
}

/** Convert Kyat-Pae-Yway object to absolute Yway units */
export function kpyToYway(kyat: number = 0, pae: number = 0, yway: number = 0): number {
  const safeKyat = isNaN(Number(kyat)) ? 0 : Number(kyat);
  const safePae = isNaN(Number(pae)) ? 0 : Number(pae);
  const safeYway = isNaN(Number(yway)) ? 0 : Number(yway);
  return Number(((safeKyat * KYAT_TO_YWAY) + (safePae * PAE_TO_YWAY) + safeYway).toFixed(4));
}

/** Convert total Yway units to Kyat-Pae-Yway object */
export function ywayToKpy(totalYway: number): WeightKPY {
  if (!totalYway || totalYway <= 0) {
    return { kyat: 0, pae: 0, yway: 0 };
  }
  const safeTotal = Number(totalYway.toFixed(4));
  const kyat = Math.floor(safeTotal / KYAT_TO_YWAY);
  const rem1 = safeTotal - (kyat * KYAT_TO_YWAY);
  const pae = Math.floor(rem1 / PAE_TO_YWAY);
  const yway = Number((rem1 - (pae * PAE_TO_YWAY)).toFixed(2));

  return { kyat, pae, yway };
}

/** Convert Kyat-Pae-Yway to Grams (uses Settings factor when provided) */
export function kpyToGrams(kpy: WeightKPY, kyatToGrams: number = KYAT_TO_GRAMS): number {
  const factor = Number(kyatToGrams) > 0 ? Number(kyatToGrams) : KYAT_TO_GRAMS;
  const kyats = kpyToYway(kpy.kyat, kpy.pae, kpy.yway) / KYAT_TO_YWAY;
  return Number((kyats * factor).toFixed(3));
}

/** Convert Grams to Kyat-Pae-Yway (uses Settings factor when provided) */
export function gramsToKpy(grams: number, kyatToGrams: number = KYAT_TO_GRAMS): WeightKPY {
  if (!grams || grams <= 0) return { kyat: 0, pae: 0, yway: 0 };
  const factor = Number(kyatToGrams) > 0 ? Number(kyatToGrams) : KYAT_TO_GRAMS;
  return ywayToKpy((Number(grams) / factor) * KYAT_TO_YWAY);
}

/** Compute Net Weight after deducting craft loss / stones / wastage (ပန်းထိန်း / အလျော့တွက် / အမွှတ်) */
export function calculateNetWeight(
  grossKpy: WeightKPY,
  deductionPae: number = 0,
  deductionYway: number = 0
): WeightKPY {
  return calculateNetFromParts(grossKpy, { kyat: 0, pae: 0, yway: 0 }, deductionPae, deductionYway);
}

/** Gross − Gemstone − Wastage (အလျော့တွက်) → Net gold */
export function calculateNetFromParts(
  gross: WeightKPY,
  gemstone: WeightKPY = { kyat: 0, pae: 0, yway: 0 },
  wastagePae: number = 0,
  wastageYway: number = 0
): WeightKPY {
  const grossTotalYway = kpyToYway(gross.kyat, gross.pae, gross.yway);
  const gemTotalYway = kpyToYway(gemstone.kyat, gemstone.pae, gemstone.yway);
  const wasteTotalYway =
    Number(wastagePae || 0) * PAE_TO_YWAY + Number(wastageYway || 0);
  const netYway = Math.max(0, grossTotalYway - gemTotalYway - wasteTotalYway);
  return ywayToKpy(netYway);
}

/**
 * Sale line breakdown (voucher style):
 * ရွှေချိန်တန်ဖိုး + လက်ခ + ကျောက်ဖိုး = လိုင်းစုစုပေါင်း
 */
export function calculateSaleLineBreakdown(params: {
  purity: GoldPurity | string;
  itemType?: string;
  netWeight: WeightKPY;
  thaiWeightUnit?: number | null;
  craftsmanshipFee?: number;
  stonePrice?: number;
  pricePerKyat16Pe: number;
  specificSellPrice?: number;
  thaiRatePerKyat?: number;
}): {
  goldAmount: number;
  craftsmanshipFee: number;
  stonePrice: number;
  lineSubtotal: number;
  effectivePricePerKyat: number;
} {
  const craft = Number(params.craftsmanshipFee || 0);
  const stone = Math.max(0, Number(params.stonePrice || 0));
  if (params.itemType === 'THAI_GOLD' || params.purity === 'THAI_GOLD') {
    const unit = Number(params.thaiWeightUnit || 0);
    if (unit > 0) {
      const thai = calculateThaiGoldPrice(
        unit,
        params.thaiRatePerKyat || params.specificSellPrice || 0,
        craft
      );
      return {
        goldAmount: thai.baseGoldPrice,
        craftsmanshipFee: craft,
        stonePrice: stone,
        lineSubtotal: thai.baseGoldPrice + craft + stone,
        effectivePricePerKyat: params.thaiRatePerKyat || params.specificSellPrice || 0,
      };
    }
  }
  const val = calculateGoldValuation(
    params.netWeight,
    params.purity as GoldPurity,
    params.pricePerKyat16Pe,
    params.specificSellPrice
  );
  return {
    goldAmount: val.goldAmount,
    craftsmanshipFee: craft,
    stonePrice: stone,
    lineSubtotal: val.goldAmount + craft + stone,
    effectivePricePerKyat: val.effectivePricePerKyat,
  };
}

/**
 * Calculate Gold Price for given weight and purity based on 16-Pe Pure Price or Specific Price
 * Price = (Net Weight in Kyat) * (Base Gold Price per Kyat * Purity Ratio)
 */
export function calculateGoldValuation(
  weight: WeightKPY,
  purity: GoldPurity,
  pricePerKyat16Pe: number,
  specificPrice?: number
): {
  goldAmount: number;
  totalYway: number;
  effectivePricePerKyat: number;
} {
  const totalYway = kpyToYway(weight.kyat, weight.pae, weight.yway);
  const weightInKyat = totalYway / KYAT_TO_YWAY;
  
  // If specific price is explicitly provided for this gold type, use it; otherwise use multiplier
  const effectivePricePerKyat = specificPrice && specificPrice > 0
    ? specificPrice
    : pricePerKyat16Pe * (PURITY_MULTIPLIERS[purity] || 1.0);

  const goldAmount = Math.round(weightInKyat * effectivePricePerKyat);
  return {
    goldAmount,
    totalYway,
    effectivePricePerKyat: Math.round(effectivePricePerKyat)
  };
}

/**
 * Thai Gold Price from grams (1 kyat = 15.2 g).
 * `unitSelector` / thai_weight_unit stores **grams**.
 */
export function calculateThaiGoldPrice(
  grams: number,
  thaiGoldRatePerKyat: number,
  craftsmanship: number = 0
): {
  equivalentYway: number;
  weightKpy: WeightKPY;
  baseGoldPrice: number;
  totalPrice: number;
  kyatEquivalent: number;
} {
  const g = Number(grams) || 0;
  const kyatEquivalent = g / THAI_KYAT_TO_GRAMS;
  const equivalentYway = kyatEquivalent * KYAT_TO_YWAY;
  const weightKpy = ywayToKpy(equivalentYway);
  const baseGoldPrice = Math.round(kyatEquivalent * thaiGoldRatePerKyat);
  const totalPrice = baseGoldPrice + (craftsmanship || 0);

  return {
    equivalentYway: Number(equivalentYway.toFixed(2)),
    weightKpy,
    baseGoldPrice,
    totalPrice,
    kyatEquivalent: Number(kyatEquivalent.toFixed(4)),
  };
}

/** Estimated selling price from live rates (Myanmar KPY or Thai unit) */
export function estimateSellingPrice(params: {
  purity: GoldPurity | string;
  itemType?: string;
  netWeight: WeightKPY;
  thaiWeightUnit?: number | null;
  craftsmanshipFee?: number;
  stonePrice?: number;
  pricePerKyat16Pe: number;
  specificSellPrice?: number;
  thaiRatePerKyat?: number;
}): number {
  return calculateSaleLineBreakdown(params).lineSubtotal;
}

/** Format currency into MMK string */
export function formatMMK(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 MMK';
  return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' MMK';
}

/** Convert numbers to Burmese digits */
export function toBurmeseNumber(num: number | string): string {
  const burmeseDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return String(num).replace(/[0-9]/g, (digit) => burmeseDigits[parseInt(digit, 10)]);
}

/** Format KPY display in Myanmar language (e.g., ၁ ကျပ် ၂ ပဲ ၃.၅ ရွေး) */
export function formatKPYMyanmar(kpy: WeightKPY): string {
  const parts: string[] = [];
  if (kpy.kyat > 0) parts.push(`${toBurmeseNumber(kpy.kyat)} ကျပ်`);
  if (kpy.pae > 0) parts.push(`${toBurmeseNumber(kpy.pae)} ပဲ`);
  if (kpy.yway > 0 || parts.length === 0) parts.push(`${toBurmeseNumber(kpy.yway)} ရွေး`);
  return parts.join(' ');
}

/** Format KPY display in English (e.g., 1 K 2 P 3.5 Y) */
export function formatKPYEnglish(kpy: WeightKPY): string {
  const parts: string[] = [];
  if (kpy.kyat > 0) parts.push(`${kpy.kyat} K`);
  if (kpy.pae > 0) parts.push(`${kpy.pae} P`);
  if (kpy.yway > 0 || parts.length === 0) parts.push(`${kpy.yway} Y`);
  return parts.join(' ');
}

/** Generate a unique Barcode for stock items (e.g., STG-839210) */
export function generateBarcode(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `STG-${random}`;
}

/** Generate a unique Invoice Number (e.g., INV-202609-1001) */
export function generateInvoiceNo(type: string = 'INV'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${type}-${dateStr}-${rand}`;
}
