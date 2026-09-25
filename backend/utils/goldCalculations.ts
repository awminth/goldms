/**
 * Myanmar + Thai gold calculation engine (backend)
 * Mirrors frontend/src/utils/goldCalculations.ts — keep in sync.
 *
 * 1 Kyat = 16 Pae = 128 Yway ≈ 16.606 g
 * Thai shop convention: 1 Kyat unit = 17.25 Yway
 */

export type GoldPurity =
  | 'MEELIN'
  | 'K24'
  | 'PE15A'
  | 'PE15B'
  | 'PE14A'
  | 'PE13A'
  | 'PE12A'
  | 'K18'
  | 'THAI_GOLD';

export interface WeightKPY {
  kyat: number;
  pae: number;
  yway: number;
}

export const KYAT_TO_PAE = 16;
export const PAE_TO_YWAY = 8;
export const KYAT_TO_YWAY = 128;
export const KYAT_TO_GRAMS = 16.6;
/** Thai gold: 1 kyat ≈ 15.2 grams */
export const THAI_KYAT_TO_GRAMS = 15.2;
export const THAI_GRAM_PRESETS = [1.0, 1.9, 3.8, 7.6, 15.2, 30.4] as const;
export const THAI_GOLD_RATIO_YWAY = 17.25;

/**
 * Shop formula from မီးလင်း base (K24 same factor; K18 same as PE12A):
 * မီးလင်း = base; 24K = base (same formula, separate category)
 * 15A = (base×16)/17
 * 15B = (base×16)/17.5
 * 14A = (base×14)/16
 * 13A = (base×13)/16
 * 12A = (base×12)/16; 18K = same formula (separate category)
 * THAI_GOLD = independent
 */
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

export function kpyToYway(kyat = 0, pae = 0, yway = 0): number {
  const safeKyat = Number.isFinite(Number(kyat)) ? Number(kyat) : 0;
  const safePae = Number.isFinite(Number(pae)) ? Number(pae) : 0;
  const safeYway = Number.isFinite(Number(yway)) ? Number(yway) : 0;
  return Number((safeKyat * KYAT_TO_YWAY + safePae * PAE_TO_YWAY + safeYway).toFixed(4));
}

export function ywayToKpy(totalYway: number): WeightKPY {
  if (!totalYway || totalYway <= 0) return { kyat: 0, pae: 0, yway: 0 };
  const safeTotal = Number(totalYway.toFixed(4));
  const kyat = Math.floor(safeTotal / KYAT_TO_YWAY);
  const rem1 = safeTotal - kyat * KYAT_TO_YWAY;
  const pae = Math.floor(rem1 / PAE_TO_YWAY);
  const yway = Number((rem1 - pae * PAE_TO_YWAY).toFixed(2));
  return { kyat, pae, yway };
}

export function kpyToGrams(kpy: WeightKPY, kyatToGrams: number = KYAT_TO_GRAMS): number {
  const factor = Number(kyatToGrams) > 0 ? Number(kyatToGrams) : KYAT_TO_GRAMS;
  const kyats = kpyToYway(kpy.kyat, kpy.pae, kpy.yway) / KYAT_TO_YWAY;
  return Number((kyats * factor).toFixed(3));
}

export function gramsToKpy(grams: number, kyatToGrams: number = KYAT_TO_GRAMS): WeightKPY {
  if (!grams || grams <= 0) return { kyat: 0, pae: 0, yway: 0 };
  const factor = Number(kyatToGrams) > 0 ? Number(kyatToGrams) : KYAT_TO_GRAMS;
  return ywayToKpy((grams / factor) * KYAT_TO_YWAY);
}

/** Net weight after ပန်းထိန်း / အလျော့တွက် / အမွှတ် deductions */
export function calculateNetWeight(
  grossKpy: WeightKPY,
  deductionPae = 0,
  deductionYway = 0
): WeightKPY {
  return calculateNetFromParts(grossKpy, { kyat: 0, pae: 0, yway: 0 }, deductionPae, deductionYway);
}

export function calculateNetFromParts(
  gross: WeightKPY,
  gemstone: WeightKPY = { kyat: 0, pae: 0, yway: 0 },
  wastagePae = 0,
  wastageYway = 0
): WeightKPY {
  const grossY = kpyToYway(gross.kyat, gross.pae, gross.yway);
  const gemY = kpyToYway(gemstone.kyat, gemstone.pae, gemstone.yway);
  const wasteY = Number(wastagePae || 0) * PAE_TO_YWAY + Number(wastageYway || 0);
  return ywayToKpy(Math.max(0, grossY - gemY + wasteY));
}

export function calculateGoldValuation(
  weight: WeightKPY,
  purity: GoldPurity | string,
  pricePerKyat16Pe: number,
  specificPrice?: number
): { goldAmount: number; totalYway: number; effectivePricePerKyat: number; weightInKyat: number } {
  const totalYway = kpyToYway(weight.kyat, weight.pae, weight.yway);
  const weightInKyat = totalYway / KYAT_TO_YWAY;
  const ratio = PURITY_MULTIPLIERS[purity as GoldPurity] || 1;
  const effectivePricePerKyat =
    specificPrice && specificPrice > 0 ? specificPrice : pricePerKyat16Pe * ratio;
  return {
    goldAmount: Math.round(weightInKyat * effectivePricePerKyat),
    totalYway,
    effectivePricePerKyat: Math.round(effectivePricePerKyat),
    weightInKyat,
  };
}

/** Thai price from grams (thai_weight_unit stores grams; 1 kyat = 15.2 g) */
export function calculateThaiGoldPrice(
  grams: number,
  thaiGoldRatePerKyat: number,
  craftsmanship = 0
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
  return {
    equivalentYway: Number(equivalentYway.toFixed(2)),
    weightKpy,
    baseGoldPrice,
    totalPrice: baseGoldPrice + (craftsmanship || 0),
    kyatEquivalent: Number(kyatEquivalent.toFixed(4)),
  };
}

export function calculateSaleLineBreakdown(params: {
  purity: string;
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
    params.purity,
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

export function estimateSellingPrice(params: {
  purity: string;
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

export function generateBarcode(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `STG-${random}`;
}

export function generateInvoiceNo(type = 'INV'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${type}-${dateStr}-${rand}`;
}
