import { useMemo, useState } from 'react';
import { GoldPurity, InventoryItem, ItemType } from '../types/gold';
import {
  calculateNetFromParts,
  generateBarcode,
  calculateGoldValuation,
  estimateSellingPrice,
  gramsToKpy,
  kpyToGrams,
  ywayToKpy,
  KYAT_TO_GRAMS,
  KYAT_TO_PAE,
  PAE_TO_YWAY,
  THAI_GRAM_PRESETS,
  calculateThaiGoldPrice,
  bahtToMmk,
  mmkToBaht,
} from '../utils/goldCalculations';

export type InventoryFormCategory = {
  id: string;
  mm: string;
  en: string;
  group: string;
};

export type InventoryItemPayload = {
  barcode: string;
  category: string;
  name: string;
  name_mm: string;
  weight_kyat: number;
  weight_pae: number;
  weight_yway: number;
  gemstone_weight_kyat: number;
  gemstone_weight_pae: number;
  gemstone_weight_yway: number;
  craft_deduction_pae: number;
  craft_deduction_yway: number;
  profit_deduction_pae: number;
  profit_deduction_yway: number;
  deduction_pae: number;
  deduction_yway: number;
  net_weight_kyat: number;
  net_weight_pae: number;
  net_weight_yway: number;
  purity: GoldPurity | string;
  item_type: ItemType;
  thai_weight_unit?: number;
  craftsmanship_fee: number;
  craftsmanship_profit_fee: number;
  stone_price: number;
  stone_profit_price: number;
  selling_price_estimated: number;
  status: InventoryItem['status'];
};

type MasterCategory = {
  code: string;
  name_mm: string;
  name_en: string;
  category_group?: string;
  is_active?: boolean;
};

type GoldPrice = { gold_type: string; price_per_kyat: number };

type ShopSettingsLike = {
  kyat_to_grams?: number;
  baht_to_mmk_buy?: number;
  baht_to_mmk_sell?: number;
  thai_gold_baht?: number;
} | null | undefined;

type UseInventoryItemFormOpts = {
  language: 'MM' | 'EN' | string;
  masterCategories: MasterCategory[];
  goldPrices: GoldPrice[];
  shopSettings: ShopSettingsLike;
};

export function useInventoryItemForm({
  language,
  masterCategories,
  goldPrices,
  shopSettings,
}: UseInventoryItemFormOpts) {
  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;
  const sellRate = shopSettings?.baht_to_mmk_sell || 765;
  const thaiBahtRate = shopSettings?.thai_gold_baht || 65000;

  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameMM, setFormNameMM] = useState('');
  const [formCategory, setFormCategory] = useState('NECKLACE');
  const [formItemType, setFormItemType] = useState<ItemType>('MYANMAR_GOLD');
  const [formPurity, setFormPurity] = useState<GoldPurity | string>('MEELIN');
  const [formGrossGrams, setFormGrossGrams] = useState<number>(KYAT_TO_GRAMS);
  const [formGrossKyat, setFormGrossKyat] = useState<number>(1);
  const [formGrossPae, setFormGrossPae] = useState<number>(0);
  const [formGrossYway, setFormGrossYway] = useState<number>(0);
  const [formGemGrams, setFormGemGrams] = useState<number>(0);
  const [formGemKyat, setFormGemKyat] = useState<number>(0);
  const [formGemPae, setFormGemPae] = useState<number>(0);
  const [formGemYway, setFormGemYway] = useState<number>(0);
  const [formCraftDedGrams, setFormCraftDedGrams] = useState<number>(0);
  const [formCraftDedPae, setFormCraftDedPae] = useState<number>(0);
  const [formCraftDedYway, setFormCraftDedYway] = useState<number>(0);
  const [formProfitDedGrams, setFormProfitDedGrams] = useState<number>(0);
  const [formProfitDedPae, setFormProfitDedPae] = useState<number>(0);
  const [formProfitDedYway, setFormProfitDedYway] = useState<number>(0);
  const [formThaiGrams, setFormThaiGrams] = useState<number>(15.2);
  const [showCustomThaiGram, setShowCustomThaiGram] = useState(false);
  const [formCraftsmanship, setFormCraftsmanship] = useState<number>(80000);
  const [formCraftProfit, setFormCraftProfit] = useState<number>(0);
  const [formStonePrice, setFormStonePrice] = useState<number>(0);
  const [formStoneProfit, setFormStoneProfit] = useState<number>(0);

  const isThaiEntry = formPurity === 'THAI_GOLD' || formItemType === 'THAI_GOLD';

  const CATEGORIES: InventoryFormCategory[] = useMemo(() => {
    const activeCats = masterCategories.filter((c) => Boolean(c.is_active));
    if (activeCats.length > 0) {
      return activeCats.map((c) => ({
        id: c.code,
        mm: c.name_mm,
        en: c.name_en,
        group: c.category_group || 'PRODUCT',
      }));
    }
    return [
      { id: 'NECKLACE', mm: 'ဆွဲကြိုး', en: 'Necklace', group: 'PRODUCT' },
      { id: 'RING', mm: 'လက်စွပ်', en: 'Ring', group: 'PRODUCT' },
      { id: 'BRACELET', mm: 'လက်ကောက်', en: 'Bracelet', group: 'PRODUCT' },
      { id: 'EARRING', mm: 'နားကပ်', en: 'Earrings', group: 'PRODUCT' },
      { id: 'PENDANT', mm: 'ဆွဲသီး', en: 'Pendant', group: 'PRODUCT' },
      { id: 'BANGLE', mm: 'ဘယက်', en: 'Bangle', group: 'PRODUCT' },
      { id: 'GOLD_BAR', mm: 'ရွှေတုံး', en: 'Gold Bar', group: 'PRODUCT' },
      { id: 'ANKLET', mm: 'ခြေချင်း', en: 'Anklet', group: 'PRODUCT' },
    ];
  }, [masterCategories]);

  const categoryGroups = ['PRODUCT', 'GOLD_CLASS', 'OTHER'] as const;

  const applyGrossFromGrams = (grams: number) => {
    setFormGrossGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setFormGrossKyat(kpy.kyat);
    setFormGrossPae(kpy.pae);
    setFormGrossYway(kpy.yway);
  };

  const applyGrossFromKpy = (next: { kyat: number; pae: number; yway: number }) => {
    setFormGrossKyat(next.kyat);
    setFormGrossPae(next.pae);
    setFormGrossYway(next.yway);
    setFormGrossGrams(kpyToGrams(next, kyatToGrams));
  };

  const applyGemFromGrams = (grams: number) => {
    setFormGemGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setFormGemKyat(kpy.kyat);
    setFormGemPae(kpy.pae);
    setFormGemYway(kpy.yway);
  };

  const applyGemFromKpy = (next: { kyat: number; pae: number; yway: number }) => {
    setFormGemKyat(next.kyat);
    setFormGemPae(next.pae);
    setFormGemYway(next.yway);
    setFormGemGrams(kpyToGrams(next, kyatToGrams));
  };

  const applyPaeYwayFromGrams = (
    grams: number,
    setGrams: (n: number) => void,
    setPae: (n: number) => void,
    setYway: (n: number) => void
  ) => {
    setGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setPae(kpy.kyat * KYAT_TO_PAE + kpy.pae);
    setYway(kpy.yway);
  };

  const applyGramsFromPaeYway = (
    pae: number,
    yway: number,
    setPae: (n: number) => void,
    setYway: (n: number) => void,
    setGrams: (n: number) => void
  ) => {
    setPae(pae);
    setYway(yway);
    setGrams(kpyToGrams({ kyat: 0, pae, yway }, kyatToGrams));
  };

  const applyThaiGrams = (grams: number) => {
    const g = Math.max(0, Number(grams) || 0);
    setFormThaiGrams(g);
    const thai = calculateThaiGoldPrice(g, 1, 0);
    setFormGrossKyat(thai.weightKpy.kyat);
    setFormGrossPae(thai.weightKpy.pae);
    setFormGrossYway(thai.weightKpy.yway);
    setFormGrossGrams(g);
    setFormGemGrams(0);
    setFormGemKyat(0);
    setFormGemPae(0);
    setFormGemYway(0);
    setFormCraftDedGrams(0);
    setFormCraftDedPae(0);
    setFormCraftDedYway(0);
    setFormProfitDedGrams(0);
    setFormProfitDedPae(0);
    setFormProfitDedYway(0);
  };

  const resetForKind = (kind: 'MYANMAR' | 'THAI', presets?: { grams?: number; nameMM?: string; nameEN?: string; category?: string }) => {
    setFormBarcode(generateBarcode());
    setFormName(presets?.nameEN || '');
    setFormNameMM(presets?.nameMM || '');
    setFormCategory(presets?.category || 'NECKLACE');
    const grams = presets?.grams;
    if (kind === 'THAI') {
      setFormItemType('THAI_GOLD');
      setFormPurity('THAI_GOLD');
      const g = grams != null && grams > 0 ? grams : 15.2;
      setFormThaiGrams(g);
      setShowCustomThaiGram(
        grams != null && grams > 0 && !(THAI_GRAM_PRESETS as readonly number[]).includes(g)
      );
      applyThaiGrams(g);
      setFormCraftsmanship(500);
      setFormCraftProfit(200);
    } else {
      setFormItemType('MYANMAR_GOLD');
      setFormPurity('MEELIN');
      setFormThaiGrams(15.2);
      setShowCustomThaiGram(false);
      if (grams != null && grams > 0) {
        applyGrossFromGrams(grams);
      } else {
        const defaultGrams = kpyToGrams({ kyat: 1, pae: 0, yway: 0 }, kyatToGrams);
        setFormGrossGrams(defaultGrams);
        setFormGrossKyat(1);
        setFormGrossPae(0);
        setFormGrossYway(0);
      }
      setFormCraftsmanship(80000);
      setFormCraftProfit(0);
    }
    setFormGemGrams(0);
    setFormGemKyat(0);
    setFormGemPae(0);
    setFormGemYway(0);
    setFormCraftDedGrams(0);
    setFormCraftDedPae(0);
    setFormCraftDedYway(0);
    setFormProfitDedGrams(0);
    setFormProfitDedPae(0);
    setFormProfitDedYway(0);
    setFormStonePrice(0);
    setFormStoneProfit(0);
  };

  const loadFromItem = (item: InventoryItem) => {
    setFormBarcode(item.barcode);
    setFormName(item.name);
    setFormNameMM(item.name_mm);
    setFormCategory(item.category);
    setFormItemType(item.item_type);
    setFormPurity(item.purity);
    setFormGrossKyat(item.weight_kyat);
    setFormGrossPae(item.weight_pae);
    setFormGrossYway(item.weight_yway);
    setFormGrossGrams(
      kpyToGrams(
        { kyat: item.weight_kyat, pae: item.weight_pae, yway: item.weight_yway },
        kyatToGrams
      )
    );
    setFormGemKyat(item.gemstone_weight_kyat || 0);
    setFormGemPae(item.gemstone_weight_pae || 0);
    setFormGemYway(item.gemstone_weight_yway || 0);
    setFormGemGrams(
      kpyToGrams(
        {
          kyat: item.gemstone_weight_kyat || 0,
          pae: item.gemstone_weight_pae || 0,
          yway: item.gemstone_weight_yway || 0,
        },
        kyatToGrams
      )
    );
    const craftP = item.craft_deduction_pae ?? item.deduction_pae ?? 0;
    const craftY = item.craft_deduction_yway ?? item.deduction_yway ?? 0;
    const profitP = item.profit_deduction_pae ?? 0;
    const profitY = item.profit_deduction_yway ?? 0;
    setFormCraftDedPae(craftP);
    setFormCraftDedYway(craftY);
    setFormCraftDedGrams(kpyToGrams({ kyat: 0, pae: craftP, yway: craftY }, kyatToGrams));
    setFormProfitDedPae(profitP);
    setFormProfitDedYway(profitY);
    setFormProfitDedGrams(kpyToGrams({ kyat: 0, pae: profitP, yway: profitY }, kyatToGrams));
    const thaiG =
      item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD'
        ? Number(item.thai_weight_unit || 15.2)
        : 15.2;
    setFormThaiGrams(thaiG);
    setShowCustomThaiGram(!THAI_GRAM_PRESETS.includes(thaiG as (typeof THAI_GRAM_PRESETS)[number]));
    const isThaiItem = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
    if (isThaiItem) {
      const buy = shopSettings?.baht_to_mmk_buy || 755;
      setFormCraftsmanship(Math.round(mmkToBaht(item.craftsmanship_fee || 0, buy)) || 0);
      setFormCraftProfit(Math.round(mmkToBaht(item.craftsmanship_profit_fee || 0, buy)) || 0);
      setFormStonePrice(0);
      setFormStoneProfit(0);
    } else {
      setFormCraftsmanship(item.craftsmanship_fee);
      setFormCraftProfit(item.craftsmanship_profit_fee || 0);
      setFormStonePrice(item.stone_price || 0);
      setFormStoneProfit(item.stone_profit_price || 0);
    }
  };

  const totalDedPae = formCraftDedPae + formProfitDedPae;
  const totalDedYway = formCraftDedYway + formProfitDedYway;
  const totalWasteKpy = ywayToKpy(totalDedPae * PAE_TO_YWAY + totalDedYway);
  const totalWasteGrams = Number(
    (Number(formCraftDedGrams || 0) + Number(formProfitDedGrams || 0)).toFixed(3)
  );

  const mmCraftTotal = Number(formCraftsmanship || 0) + Number(formCraftProfit || 0);
  const mmStoneTotal = Number(formStonePrice || 0) + Number(formStoneProfit || 0);

  const gemstoneKpy = { kyat: formGemKyat, pae: formGemPae, yway: formGemYway };
  const computedNet = isThaiEntry
    ? calculateThaiGoldPrice(formThaiGrams, 1, 0).weightKpy
    : calculateNetFromParts(
        { kyat: formGrossKyat, pae: formGrossPae, yway: formGrossYway },
        gemstoneKpy,
        totalDedPae,
        totalDedYway
      );

  const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const specificPurityPrice = goldPrices.find((p) => p.gold_type === formPurity)?.price_per_kyat;
  const thaiCraftTotalBaht = Number(formCraftsmanship || 0) + Number(formCraftProfit || 0);
  const thaiBahtBreakdown = isThaiEntry
    ? calculateThaiGoldPrice(formThaiGrams, thaiBahtRate, thaiCraftTotalBaht)
    : null;

  const estimatedTotalSelling = isThaiEntry
    ? Math.round(bahtToMmk(thaiBahtBreakdown!.totalPrice, sellRate))
    : estimateSellingPrice({
        purity: formPurity,
        itemType: formItemType,
        netWeight: computedNet,
        thaiWeightUnit: null,
        craftsmanshipFee: mmCraftTotal,
        stonePrice: mmStoneTotal,
        pricePerKyat16Pe: pure16Price,
        specificSellPrice: specificPurityPrice,
      });

  const valuation = isThaiEntry
    ? { goldAmount: thaiBahtBreakdown!.baseGoldPrice }
    : calculateGoldValuation(
        computedNet,
        formPurity as GoldPurity,
        pure16Price,
        specificPurityPrice
      );

  const fmtBaht = (n: number) =>
    `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ฿`;

  const buildPayload = (status: InventoryItem['status'] = 'IN_STOCK'): InventoryItemPayload => {
    const craftMmk = isThaiEntry
      ? Math.round(bahtToMmk(Number(formCraftsmanship || 0), sellRate))
      : Number(formCraftsmanship || 0);
    const craftProfitMmk = isThaiEntry
      ? Math.round(bahtToMmk(Number(formCraftProfit || 0), sellRate))
      : Number(formCraftProfit || 0);
    const sellMmk = isThaiEntry
      ? Math.round(bahtToMmk(thaiBahtBreakdown!.totalPrice, sellRate))
      : estimatedTotalSelling;

    return {
      barcode: formBarcode || generateBarcode(),
      category: isThaiEntry ? 'THAI_GOLD' : formCategory,
      name: formName || formNameMM,
      name_mm: formNameMM || formName,
      weight_kyat: Number(formGrossKyat || 0),
      weight_pae: Number(formGrossPae || 0),
      weight_yway: Number(formGrossYway || 0),
      gemstone_weight_kyat: isThaiEntry ? 0 : Number(formGemKyat || 0),
      gemstone_weight_pae: isThaiEntry ? 0 : Number(formGemPae || 0),
      gemstone_weight_yway: isThaiEntry ? 0 : Number(formGemYway || 0),
      craft_deduction_pae: isThaiEntry ? 0 : Number(formCraftDedPae || 0),
      craft_deduction_yway: isThaiEntry ? 0 : Number(formCraftDedYway || 0),
      profit_deduction_pae: isThaiEntry ? 0 : Number(formProfitDedPae || 0),
      profit_deduction_yway: isThaiEntry ? 0 : Number(formProfitDedYway || 0),
      deduction_pae: isThaiEntry ? 0 : totalDedPae,
      deduction_yway: isThaiEntry ? 0 : totalDedYway,
      net_weight_kyat: computedNet.kyat,
      net_weight_pae: computedNet.pae,
      net_weight_yway: computedNet.yway,
      purity: formPurity,
      item_type: isThaiEntry ? ('THAI_GOLD' as ItemType) : formItemType,
      thai_weight_unit: isThaiEntry ? formThaiGrams : undefined,
      craftsmanship_fee: craftMmk,
      craftsmanship_profit_fee: craftProfitMmk,
      stone_price: isThaiEntry ? 0 : Number(formStonePrice || 0),
      stone_profit_price: isThaiEntry ? 0 : Number(formStoneProfit || 0),
      selling_price_estimated: sellMmk,
      status,
    };
  };

  const validate = (): string | null => {
    if (!formName.trim() && !formNameMM.trim()) {
      return language === 'MM' ? 'ပစ္စည်းအမည် ထည့်ပါ' : 'Item name required';
    }
    if (isThaiEntry && formThaiGrams <= 0) {
      return language === 'MM' ? 'Gram ထည့်ပါ' : 'Enter grams';
    }
    return null;
  };

  return {
    language,
    kyatToGrams,
    thaiBahtRate,
    isThaiEntry,
    CATEGORIES,
    categoryGroups,
    formBarcode,
    setFormBarcode,
    formName,
    setFormName,
    formNameMM,
    setFormNameMM,
    formCategory,
    setFormCategory,
    formItemType,
    setFormItemType,
    formPurity,
    setFormPurity,
    formGrossGrams,
    formGrossKyat,
    formGrossPae,
    formGrossYway,
    formGemGrams,
    formGemKyat,
    formGemPae,
    formGemYway,
    formCraftDedGrams,
    formCraftDedPae,
    formCraftDedYway,
    formProfitDedGrams,
    formProfitDedPae,
    formProfitDedYway,
    formThaiGrams,
    showCustomThaiGram,
    setShowCustomThaiGram,
    formCraftsmanship,
    setFormCraftsmanship,
    formCraftProfit,
    setFormCraftProfit,
    formStonePrice,
    setFormStonePrice,
    formStoneProfit,
    setFormStoneProfit,
    applyGrossFromGrams,
    applyGrossFromKpy,
    applyGemFromGrams,
    applyGemFromKpy,
    applyPaeYwayFromGrams,
    applyGramsFromPaeYway,
    applyThaiGrams,
    resetForKind,
    loadFromItem,
    totalWasteKpy,
    totalWasteGrams,
    mmCraftTotal,
    mmStoneTotal,
    computedNet,
    thaiCraftTotalBaht,
    thaiBahtBreakdown,
    estimatedTotalSelling,
    valuation,
    fmtBaht,
    buildPayload,
    validate,
    setFormCraftDedGrams,
    setFormCraftDedPae,
    setFormCraftDedYway,
    setFormProfitDedGrams,
    setFormProfitDedPae,
    setFormProfitDedYway,
  };
}

export type InventoryItemFormApi = ReturnType<typeof useInventoryItemForm>;
