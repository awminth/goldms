import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  InventoryItem,
  GoldPurity,
  ItemType,
} from '../types/gold';
import {
  formatMMK,
  formatKPYMyanmar,
  formatKPYEnglish,
  calculateNetFromParts,
  generateBarcode,
  PURITY_LABELS,
  calculateGoldValuation,
  estimateSellingPrice,
  kpyToYway,
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
import {
  Plus,
  Filter,
  Trash2,
  Edit,
  Tag,
  Check,
  X,
  Printer,
  Sparkles,
  RefreshCw,
  Hammer,
} from 'lucide-react';
import { api } from '../services/api';
import { DataTable, type DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { ModalOverlay } from './ModalOverlay';
import { InventoryBarcodeTag } from './InventoryBarcodeTag';
import { NumberInput } from './NumberInput';
import { DateInput } from './DateInput';
import { useDialog } from '../context/DialogContext';

/** Full-row text color by inventory status (like pawn lists). */
function inventoryStatusRowClass(status: string | undefined | null): string {
  switch (String(status || '').toUpperCase()) {
    case 'IN_STOCK':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'SOLD':
      return 'text-slate-500 dark:text-slate-400';
    case 'RESERVED':
      return 'text-amber-700 dark:text-amber-300';
    case 'UNDER_PAWN':
      return 'text-sky-700 dark:text-sky-300';
    case 'SHOP_OUT':
      return 'text-violet-700 dark:text-violet-300';
    case 'WITH_GOLDSMITH':
      return 'text-rose-700 dark:text-rose-300';
    default:
      return '';
  }
}

export const InventoryView: React.FC = () => {
  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    goldPrices,
    language,
    refreshData,
    masterCategories,
    shopSettings,
    getLivePriceForPurity,
    createGoldsmithJob,
    can,
  } = useGoldShop();
  const dialog = useDialog();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  /** Myanmar: ရွှေတန်ဖိုး + စုစုပေါင်းလက်ခ + ကျောက်ဖိုးစုစုပေါင်း */
  const myanmarItemEstimatedValue = (item: InventoryItem): number => {
    const craftTotal =
      Number(item.craftsmanship_fee || 0) + Number(item.craftsmanship_profit_fee || 0);
    const stoneTotal =
      Number(item.stone_price || 0) + Number(item.stone_profit_price || 0);
    const pure16 =
      goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
    return estimateSellingPrice({
      purity: item.purity,
      itemType: item.item_type,
      netWeight: {
        kyat: item.net_weight_kyat,
        pae: item.net_weight_pae,
        yway: item.net_weight_yway,
      },
      thaiWeightUnit: null,
      craftsmanshipFee: craftTotal,
      stonePrice: stoneTotal,
      pricePerKyat16Pe: pure16,
      specificSellPrice: getLivePriceForPurity(item.purity),
    });
  };

  const displayEstimatedValue = (item: InventoryItem): number => {
    const isThai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
    if (isThai) return item.selling_price_estimated;
    return myanmarItemEstimatedValue(item);
  };

  // Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPurity, setSelectedPurity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('IN_STOCK');

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Barcode Tag Preview Modal
  const [tagItem, setTagItem] = useState<InventoryItem | null>(null);

  // Goldsmith send (inventory → goldsmith)
  const [gsItem, setGsItem] = useState<InventoryItem | null>(null);
  const [gsReturnDue, setGsReturnDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [gsNote, setGsNote] = useState('');
  const [gsSaving, setGsSaving] = useState(false);
  const [gsErr, setGsErr] = useState('');

  // Form State
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameMM, setFormNameMM] = useState('');
  const [formCategory, setFormCategory] = useState<string>('NECKLACE');
  const [formItemType, setFormItemType] = useState<ItemType>('MYANMAR_GOLD');
  const [formPurity, setFormPurity] = useState<GoldPurity>('MEELIN');


  // Weight tracking: Gross / Gemstone / Wastage (Myanmar) or Thai grams
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

  // Category list from Master Setup (grouped) with fallbacks
  const activeCats = masterCategories.filter((c) => c.is_active);
  const CATEGORIES =
    activeCats.length > 0
      ? activeCats.map((c) => ({
          id: c.code,
          mm: c.name_mm,
          en: c.name_en,
          group: c.category_group || 'PRODUCT',
        }))
      : [
          { id: 'NECKLACE', mm: 'ဆွဲကြိုး', en: 'Necklace', group: 'PRODUCT' },
          { id: 'RING', mm: 'လက်စွပ်', en: 'Ring', group: 'PRODUCT' },
          { id: 'BRACELET', mm: 'လက်ကောက်', en: 'Bracelet', group: 'PRODUCT' },
          { id: 'EARRING', mm: 'နားကပ်', en: 'Earrings', group: 'PRODUCT' },
          { id: 'PENDANT', mm: 'ဆွဲသီး', en: 'Pendant', group: 'PRODUCT' },
          { id: 'BANGLE', mm: 'ဘယက်', en: 'Bangle', group: 'PRODUCT' },
          { id: 'GOLD_BAR', mm: 'ရွှေတုံး', en: 'Gold Bar', group: 'PRODUCT' },
          { id: 'ANKLET', mm: 'ခြေချင်း', en: 'Anklet', group: 'PRODUCT' },
        ];

  const categoryGroups = ['PRODUCT', 'GOLD_CLASS', 'OTHER'] as const;
  // Open modal for new item (Myanmar or Thai)
  const openNewItemModal = (kind: 'MYANMAR' | 'THAI' = 'MYANMAR') => {
    setEditingItemId(null);
    setFormBarcode(generateBarcode());
    setFormName('');
    setFormNameMM('');
    setFormCategory('NECKLACE');
    if (kind === 'THAI') {
      setFormItemType('THAI_GOLD');
      setFormPurity('THAI_GOLD');
      setFormThaiGrams(15.2);
      setShowCustomThaiGram(false);
      const thai = calculateThaiGoldPrice(15.2, 1, 0);
      setFormGrossKyat(thai.weightKpy.kyat);
      setFormGrossPae(thai.weightKpy.pae);
      setFormGrossYway(thai.weightKpy.yway);
      setFormGrossGrams(15.2);
    } else {
      setFormItemType('MYANMAR_GOLD');
      setFormPurity('MEELIN');
      setFormThaiGrams(15.2);
      setShowCustomThaiGram(false);
      const defaultGrams = kpyToGrams({ kyat: 1, pae: 0, yway: 0 }, kyatToGrams);
      setFormGrossGrams(defaultGrams);
      setFormGrossKyat(1);
      setFormGrossPae(0);
      setFormGrossYway(0);
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
    setFormCraftsmanship(kind === 'THAI' ? 500 : 80000);
    setFormCraftProfit(kind === 'THAI' ? 200 : 0);
    setFormStonePrice(0);
    setFormStoneProfit(0);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
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
    setIsModalOpen(true);
  };

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

  // Compute estimated selling price (Myanmar MMK; Thai entry uses Baht then converts on save)
  const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const specificPurityPrice = goldPrices.find((p) => p.gold_type === formPurity)?.price_per_kyat;
  const sellRate = shopSettings?.baht_to_mmk_sell || 765;
  const thaiBahtRate = shopSettings?.thai_gold_baht || 65000;

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
    : calculateGoldValuation(computedNet, formPurity, pure16Price, specificPurityPrice);

  const fmtBaht = (n: number) =>
    `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ฿`;

  // Save item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName && !formNameMM) return;

    const craftMmk = isThaiEntry
      ? Math.round(bahtToMmk(Number(formCraftsmanship || 0), sellRate))
      : Number(formCraftsmanship || 0);
    const craftProfitMmk = isThaiEntry
      ? Math.round(bahtToMmk(Number(formCraftProfit || 0), sellRate))
      : Number(formCraftProfit || 0);
    const sellMmk = isThaiEntry
      ? Math.round(bahtToMmk(thaiBahtBreakdown!.totalPrice, sellRate))
      : estimatedTotalSelling;

    const itemPayload = {
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
      status: (editingItemId
        ? inventory.find((i) => i.id === editingItemId)?.status || 'IN_STOCK'
        : 'IN_STOCK') as InventoryItem['status'],
    };

    if (editingItemId) {
      await updateInventoryItem(editingItemId, itemPayload);
    } else {
      await addInventoryItem(itemPayload);
    }

    setIsModalOpen(false);
  };

  // Filtered inventory list (units)
  const filteredItems = inventory.filter((item) => {
    const matchesCategory =
      selectedCategory === 'ALL' ||
      item.category === selectedCategory ||
      (selectedCategory === 'THAI_GOLD' &&
        (item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD'));
    const matchesPurity = selectedPurity === 'ALL' || item.purity === selectedPurity;
    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;

    return matchesCategory && matchesPurity && matchesStatus;
  });

  const exportInventoryExcel = () => {
    exportToExcel({
      filename: 'inventory',
      sheetName: 'Inventory',
      title: language === 'MM' ? 'ရွှေထည် စာရင်း (Inventory)' : 'Gold Inventory Report',
      columns: [
        { header: 'Barcode', value: (i) => i.barcode, width: 16 },
        { header: language === 'MM' ? 'အမည် (MM)' : 'Name (MM)', value: (i) => i.name_mm, width: 22 },
        { header: 'Name (EN)', value: (i) => i.name, width: 22 },
        { header: 'Category', value: (i) => i.category, width: 14 },
        { header: 'Purity', value: (i) => PURITY_LABELS[i.purity]?.en || i.purity, width: 14 },
        { header: 'Type', value: (i) => i.item_type, width: 14 },
        {
          header: language === 'MM' ? 'အထည်ချိန်' : 'Gross Weight',
          value: (i) => formatKPYEnglish({ kyat: i.weight_kyat, pae: i.weight_pae, yway: i.weight_yway }),
          width: 16,
        },
        {
          header: language === 'MM' ? 'ရွှေချိန်စင်' : 'Net Weight',
          value: (i) =>
            formatKPYEnglish({
              kyat: i.net_weight_kyat,
              pae: i.net_weight_pae,
              yway: i.net_weight_yway,
            }),
          width: 16,
        },
        { header: language === 'MM' ? 'လက်ခ' : 'Craft Fee', value: (i) => Number(i.craftsmanship_fee || 0) + Number(i.craftsmanship_profit_fee || 0), width: 12 },
        { header: language === 'MM' ? 'ခန့်မှန်းဈေး' : 'Est. Price', value: (i) => displayEstimatedValue(i), width: 14 },
        { header: 'Status', value: (i) => i.status, width: 12 },
      ],
      rows: filteredItems,
    });
  };

  const inventoryColumns = useMemo<DataTableColumn<InventoryItem>[]>(
    () => [
      {
        id: 'barcode',
        header: language === 'MM' ? 'ဘားကုဒ်' : 'Barcode',
        slot: 'primary',
        accessor: (i) => i.barcode,
        cell: (item) => (
          <span className="font-mono text-xs font-bold">{item.barcode}</span>
        ),
      },
      {
        id: 'name',
        header: language === 'MM' ? 'ပစ္စည်းအမည်' : 'Product',
        slot: 'primary',
        accessor: (i) => (language === 'MM' ? i.name_mm : i.name),
        cell: (item) => (
          <div className="min-w-0">
            <div className="font-semibold truncate max-w-[160px]">
              {language === 'MM' ? item.name_mm : item.name}
            </div>
            <span className="text-[10px] uppercase font-bold opacity-60">
              {item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD'
                ? 'THAI GOLD'
                : `${item.category} • MYANMAR`}
            </span>
          </div>
        ),
      },
      {
        id: 'value',
        header: language === 'MM' ? 'ခန့်မှန်းတန်ဖိုး' : 'Est. Value',
        slot: 'primary',
        accessor: (i) => displayEstimatedValue(i),
        align: 'right',
        cell: (item) => (
          <span className="font-mono font-bold whitespace-nowrap">
            {formatMMK(displayEstimatedValue(item))}
          </span>
        ),
      },
      {
        id: 'status',
        header: language === 'MM' ? 'အခြေအနေ' : 'Status',
        slot: 'primary',
        accessor: (i) => i.status,
        align: 'center',
        cell: (item) => (
          <span
            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
              item.status === 'IN_STOCK'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {item.status === 'IN_STOCK'
              ? language === 'MM'
                ? 'ဆိုင်ရှိ'
                : 'In Stock'
              : item.status === 'WITH_GOLDSMITH'
                ? language === 'MM'
                  ? 'ပန်းထိမ်အပ်'
                  : 'At goldsmith'
                : item.status}
          </span>
        ),
      },
      {
        id: 'name_alt',
        header: language === 'MM' ? 'အမည် (အခြား)' : 'Alt name',
        slot: 'detail',
        accessor: (i) => (language === 'MM' ? i.name : i.name_mm),
        cell: (item) => (language === 'MM' ? item.name || '—' : item.name_mm || '—'),
      },
      {
        id: 'category',
        header: language === 'MM' ? 'အမျိုးအစား' : 'Category',
        slot: 'detail',
        accessor: (i) => i.category,
        cell: (item) => item.category || '—',
      },
      {
        id: 'item_type',
        header: language === 'MM' ? 'ရွှေအမျိုး' : 'Gold type',
        slot: 'detail',
        accessor: (i) => i.item_type,
        cell: (item) =>
          item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD'
            ? language === 'MM'
              ? 'ထိုင်းရွှေ'
              : 'Thai Gold'
            : language === 'MM'
              ? 'မြန်မာရွှေ'
              : 'Myanmar Gold',
      },
      {
        id: 'purity',
        header: language === 'MM' ? 'ရွှေရည်' : 'Purity',
        slot: 'detail',
        accessor: (i) => i.purity,
        cell: (item) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#D4AF37]/15 text-[#996515] dark:text-[#FFD700] border border-[#D4AF37]/25 whitespace-nowrap">
            {PURITY_LABELS[item.purity]?.mm || item.purity}
          </span>
        ),
      },
      {
        id: 'grams',
        header: language === 'MM' ? 'အလေးချိန် (g)' : 'Weight (g)',
        slot: 'detail',
        accessor: (i) => {
          const isThai = i.item_type === 'THAI_GOLD' || i.purity === 'THAI_GOLD';
          if (isThai && i.thai_weight_unit) return Number(i.thai_weight_unit);
          return kpyToGrams(
            { kyat: i.net_weight_kyat, pae: i.net_weight_pae, yway: i.net_weight_yway },
            kyatToGrams
          );
        },
        cell: (item) => {
          const isThai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
          const grams =
            isThai && item.thai_weight_unit
              ? Number(item.thai_weight_unit)
              : kpyToGrams(
                  {
                    kyat: item.net_weight_kyat,
                    pae: item.net_weight_pae,
                    yway: item.net_weight_yway,
                  },
                  kyatToGrams
                );
          return <span className="font-mono font-semibold">{Number(grams).toFixed(3)} g</span>;
        },
      },
      {
        id: 'gross',
        header: language === 'MM' ? 'အထည်ချိန်' : 'Gross weight',
        slot: 'detail',
        accessor: (i) => `${i.weight_kyat}-${i.weight_pae}-${i.weight_yway}`,
        cell: (item) =>
          formatKPYMyanmar({
            kyat: item.weight_kyat,
            pae: item.weight_pae,
            yway: item.weight_yway,
          }),
      },
      {
        id: 'net',
        header: language === 'MM' ? 'ရွှေချိန်စင်' : 'Net weight',
        slot: 'detail',
        accessor: (i) => `${i.net_weight_kyat}-${i.net_weight_pae}-${i.net_weight_yway}`,
        cell: (item) =>
          formatKPYMyanmar({
            kyat: item.net_weight_kyat,
            pae: item.net_weight_pae,
            yway: item.net_weight_yway,
          }),
      },
      {
        id: 'craft',
        header: language === 'MM' ? 'လက်ခ' : 'Craft fee',
        slot: 'detail',
        accessor: (i) => Number(i.craftsmanship_fee || 0),
        align: 'right',
        cell: (item) => (
          <span className="font-mono whitespace-nowrap">{formatMMK(Number(item.craftsmanship_fee || 0))}</span>
        ),
      },
      {
        id: 'craft_profit',
        header: language === 'MM' ? 'အမြတ်လက်ခ' : 'Craft profit',
        slot: 'detail',
        accessor: (i) => Number(i.craftsmanship_profit_fee || 0),
        align: 'right',
        cell: (item) => (
          <span className="font-mono whitespace-nowrap">
            {formatMMK(Number(item.craftsmanship_profit_fee || 0))}
          </span>
        ),
      },
      {
        id: 'stone',
        header: language === 'MM' ? 'ကျောက်ဖိုး' : 'Stone',
        slot: 'detail',
        accessor: (i) => Number(i.stone_price || 0),
        cell: (item) => formatMMK(Number(item.stone_price || 0)),
      },
      {
        id: 'stone_profit',
        header: language === 'MM' ? 'ကျောက်အမြတ်' : 'Stone profit',
        slot: 'detail',
        accessor: (i) => Number(i.stone_profit_price || 0),
        cell: (item) => formatMMK(Number(item.stone_profit_price || 0)),
      },
      {
        id: 'craft_total',
        header: language === 'MM' ? 'လက်ခစုစုပေါင်း' : 'Craft total',
        slot: 'detail',
        accessor: (i) =>
          Number(i.craftsmanship_fee || 0) + Number(i.craftsmanship_profit_fee || 0),
        cell: (item) =>
          formatMMK(
            Number(item.craftsmanship_fee || 0) + Number(item.craftsmanship_profit_fee || 0)
          ),
      },
      {
        id: 'created',
        header: language === 'MM' ? 'ထည့်သွင်းရက်' : 'Created',
        slot: 'detail',
        accessor: (i) => i.created_at,
        cell: (item) => (
          <span className="font-mono text-[11px]">
            {item.created_at ? String(item.created_at).slice(0, 10) : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
        slot: 'action',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (item) => (
          <div className="flex items-center justify-center space-x-1" onClick={(e) => e.stopPropagation()}>
            {can('goldsmith', 'create') && item.status === 'IN_STOCK' && (
              <button
                type="button"
                onClick={() => {
                  setGsItem(item);
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setGsReturnDue(d.toISOString().slice(0, 10));
                  setGsNote('');
                  setGsErr('');
                }}
                className="p-1.5 rounded-lg text-violet-500 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                title={language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Send to goldsmith'}
              >
                <Hammer className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setTagItem(item)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#D4AF37]"
              title="Print Barcode Tag"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openEditModal(item)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600"
              title={language === 'MM' ? 'ပြင်မည်' : 'Edit'}
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const ok = await dialog.confirm({
                    title: language === 'MM' ? 'ပစ္စည်း ဖျက်မည်' : 'Delete item',
                    message:
                      language === 'MM'
                        ? `"${item.name_mm || item.name}" ကို စာရင်းမှ ဖျက်မလား?`
                        : `Delete "${item.name_mm || item.name}" from inventory?`,
                    confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
                    cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
                    danger: true,
                  });
                  if (!ok) return;
                  await deleteInventoryItem(item.id);
                })();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600"
              title={language === 'MM' ? 'ဖျက်မည်' : 'Delete'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [language, deleteInventoryItem, kyatToGrams, goldPrices, getLivePriceForPurity, can, dialog]
  );

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header & Search Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Tag className="w-5 h-5 text-[#D4AF37]" />
            <span>{language === 'MM' ? 'ရွှေထည်ပစ္စည်း စာရင်း & ဘားကုဒ်စနစ်' : 'Stock Inventory & Barcode Management'}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {language === 'MM'
              ? 'ပစ္စည်းတစ်ခုချင်းစီတွင် ဘားကုဒ်တစ်ခုနှင့် စတော့တစ်ခုသာရှိသည်။'
              : 'Each item has its own barcode and a single stock unit.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={async () => {
              await api.revalueInventory();
              await refreshData();
            }}
            className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900 text-[#996515] dark:text-amber-300 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/30 transition flex items-center space-x-1.5"
            title={language === 'MM' ? 'နေ့စဉ်ဈေးဖြင့် စတော့တန်ဖိုး ပြန်တွက်မည်' : 'Revalue stock from live prices'}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'MM' ? 'ဈေးဖြင့် ပြန်တွက်' : 'Revalue'}</span>
          </button>

          <ExcelExportButton
            language={language}
            onClick={exportInventoryExcel}
            disabled={filteredItems.length === 0}
            className="!py-2 !rounded-xl"
          />

          {/* Add New — Myanmar / Thai */}
          <button
            type="button"
            onClick={() => openNewItemModal('MYANMAR')}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white text-xs font-bold hover:opacity-95 transition shadow-xs flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'MM' ? 'မြန်မာရွှေ ထည့်မည်' : 'Add Myanmar Gold'}</span>
          </button>
          <button
            type="button"
            onClick={() => openNewItemModal('THAI')}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold hover:opacity-95 transition shadow-xs flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'MM' ? 'ထိုင်းရွှေ ထည့်မည်' : 'Add Thai Gold'}</span>
          </button>

        </div>

      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        
        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] dark:text-gray-200 text-xs font-medium"
        >
          <option value="ALL">{language === 'MM' ? 'အမျိုးအစားအားလုံး' : 'All Categories'}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {language === 'MM' ? c.mm : c.en}
            </option>
          ))}
        </select>

        {/* Purity Filter */}
        <select
          value={selectedPurity}
          onChange={(e) => setSelectedPurity(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] dark:text-gray-200 text-xs font-medium"
        >
          <option value="ALL">{language === 'MM' ? 'ရွှေရည်အားလုံး' : 'All Purities'}</option>
          {Object.entries(PURITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {language === 'MM' ? v.mm : v.en}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] dark:text-gray-200 text-xs font-medium"
        >
          <option value="ALL">{language === 'MM' ? 'အခြေအနေအားလုံး' : 'All Statuses'}</option>
          <option value="IN_STOCK">{language === 'MM' ? 'ဆိုင်ရှိပစ္စည်း (In Stock)' : 'In Stock'}</option>
          <option value="WITH_GOLDSMITH">{language === 'MM' ? 'ပန်းထိမ်အပ်' : 'At goldsmith'}</option>
          <option value="SOLD">{language === 'MM' ? 'ရောင်းချပြီး (Sold)' : 'Sold'}</option>
          <option value="SHOP_OUT">{language === 'MM' ? 'ဆိုင်ထုတ်' : 'Shop out'}</option>
          <option value="UNDER_PAWN">{language === 'MM' ? 'ပေါင်နှံထားဆဲ (Under Pawn)' : 'Under Pawn'}</option>
        </select>

        <span className="text-gray-400 dark:text-gray-500 ml-auto">
          {filteredItems.length} {language === 'MM' ? 'ခု' : 'items'}
        </span>
      </div>

      <DataTable
        rows={filteredItems}
        columns={inventoryColumns}
        rowKey={(i) => i.id}
        language={language}
        searchable
        searchPlaceholder={language === 'MM' ? 'ဘားကုဒ် / အမည် ရှာရန်…' : 'Search barcode / name…'}
        getSearchText={(i) => [i.name, i.name_mm, i.barcode, i.category].join(' ')}
        resetDeps={[selectedCategory, selectedPurity, selectedStatus]}
        emptyMessage={language === 'MM' ? 'ပစ္စည်းမတွေ့ပါ' : 'No inventory items'}
        maxHeightClass={false}
        rowClassName={(i) => inventoryStatusRowClass(i.status)}
      />

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <ModalOverlay className="p-3 sm:p-5">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2">
                <Tag className="w-4 h-4 text-[#D4AF37]" />
                <span>
                  {editingItemId
                    ? language === 'MM'
                      ? 'ရွှေထည်ပစ္စည်း ပြင်ဆင်ရန်'
                      : 'Edit Stock Item'
                    : isThaiEntry
                      ? language === 'MM'
                        ? 'ထိုင်းရွှေ အသစ်ထည့်သွင်းခြင်း'
                        : 'Add Thai Gold Item'
                      : language === 'MM'
                        ? 'မြန်မာရွှေ အသစ်ထည့်သွင်းခြင်း'
                        : 'Add Myanmar Gold Item'}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-4 flex-1">
              
              {/* Row 1: Barcode & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'ဘားကုဒ်နံပါတ် (Barcode):' : 'Barcode ID:'}
                  </label>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      required
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setFormBarcode(generateBarcode())}
                      className="px-2.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl hover:bg-gray-200"
                    >
                      Gen
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'အမျိုးအစား (Category):' : 'Category:'}
                  </label>
                  {isThaiEntry ? (
                    <div className="px-3 py-2 text-xs font-bold rounded-xl border border-[#D4AF37]/40 bg-[#FAF8F2] dark:bg-[#201D17] text-[#996515] dark:text-amber-300">
                      {language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold'}
                    </div>
                  ) : (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                    >
                      {categoryGroups.map((g) => {
                        const opts = CATEGORIES.filter((c) => c.group === g);
                        if (!opts.length) return null;
                        const label =
                          g === 'PRODUCT'
                            ? language === 'MM'
                              ? 'ပစ္စည်းအမျိုးအစား'
                              : 'Item Types'
                            : g === 'GOLD_CLASS'
                              ? language === 'MM'
                                ? 'Categories (ပဲရည်)'
                                : 'Categories (Purity)'
                              : language === 'MM'
                                ? 'အခြား'
                                : 'Other';
                        return (
                          <optgroup key={g} label={label}>
                            {opts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {language === 'MM' ? c.mm : c.en}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>

              {/* Row 2: Names (Myanmar and English) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'မြန်မာအမည် (ဥပမာ- နဂါးလိမ်ဆွဲကြိုး):' : 'Item Name (Myanmar):'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ရွှေဆွဲကြိုး"
                    value={formNameMM}
                    onChange={(e) => setFormNameMM(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'အင်္ဂလိပ်အမည် (English Name):' : 'English Name:'}
                  </label>
                  <input
                    type="text"
                    placeholder="Gold Necklace"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Row 3: Locked gold path + Myanmar purity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'ရွှေအမျိုးအစား:' : 'Gold type:'}
                  </label>
                  <div
                    className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                      isThaiEntry
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'bg-[#FAF8F2] dark:bg-[#201D17] border-[#D4AF37]/40 text-[#996515] dark:text-amber-300'
                    }`}
                  >
                    {isThaiEntry
                      ? language === 'MM'
                        ? 'ထိုင်းရွှေ'
                        : 'Thai Gold'
                      : language === 'MM'
                        ? 'မြန်မာရွှေ'
                        : 'Myanmar Gold'}
                  </div>
                </div>
                {!isThaiEntry && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {language === 'MM' ? 'ရွှေရည် / အရည်အသွေး (Purity):' : 'Purity Standard:'}
                    </label>
                    <select
                      value={formPurity}
                      onChange={(e) => setFormPurity(e.target.value as GoldPurity)}
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                    >
                      {Object.entries(PURITY_LABELS)
                        .filter(([k]) => k !== 'THAI_GOLD')
                        .map(([k, v]) => (
                          <option key={k} value={k}>
                            {language === 'MM' ? v.mm : v.en}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Weight Tracking */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-3">
                {isThaiEntry ? (
                  <>
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {language === 'MM' ? 'ထိုင်းရွှေ Gram ယူနစ်' : 'Thai Gold — Gram units'}
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {THAI_GRAM_PRESETS.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setShowCustomThaiGram(false);
                                applyThaiGrams(g);
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                                !showCustomThaiGram && formThaiGrams === g
                                  ? 'bg-[#D4AF37] text-white border-transparent'
                                  : 'bg-white dark:bg-[#1A1A1A] border-gray-300 dark:border-gray-700'
                              }`}
                            >
                              {g} g
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setShowCustomThaiGram(true)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-dashed border-[#D4AF37] text-[#996515] flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Gram
                          </button>
                        </div>
                        {(showCustomThaiGram ||
                          !(THAI_GRAM_PRESETS as readonly number[]).includes(formThaiGrams)) && (
                          <div className="max-w-[160px]">
                            <label className="text-[11px] text-gray-500 block mb-0.5">Custom Gram</label>
                              <NumberInput
                              min={0}
                              step={0.001}
                              value={formThaiGrams}
                              onChange={applyThaiGrams}
                              className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
                            />
                          </div>
                        )}
                        <div className="text-[11px] text-gray-500">
                          {language === 'MM'
                            ? `ရွေးချယ်ထား = ${formThaiGrams} g · ထိုင်းရွှေနှုန်း ${fmtBaht(thaiBahtRate)} / ကျပ်`
                            : `Selected = ${formThaiGrams} g · Thai rate ${fmtBaht(thaiBahtRate)} / kyat`}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'အရင်းလက်ခ (ဘတ်)' : 'Cost craft (฿)'}
                          </label>
                          <NumberInput
                            min={0}
                            step={1}
                            value={formCraftsmanship}
                            onChange={setFormCraftsmanship}
                            className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'အမြတ်လက်ခ (ဘတ်)' : 'Profit craft (฿)'}
                          </label>
                          <NumberInput
                            min={0}
                            step={1}
                            value={formCraftProfit}
                            onChange={setFormCraftProfit}
                            className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'စုစုပေါင်းလက်ခ (ဘတ်)' : 'Total craft (฿)'}
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={fmtBaht(thaiCraftTotalBaht)}
                            className="w-full px-3 py-2 text-sm font-extrabold rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {language === 'MM' ? 'ရွှေချိန် (Net)' : 'Net Weight'}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formThaiGrams} g
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                      <span>{language === 'MM' ? '၁။ အထည်ချိန် (Gross Weight)' : '1. Gross Weight'}</span>
                      <span className="text-gray-400 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
                    </div>
                    <div className="flex flex-wrap items-end gap-y-2">
                      <div className="w-[7.5rem]">
                        <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                        <NumberInput min={0} step={0.001} value={formGrossGrams} onChange={applyGrossFromGrams} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]" />
                      </div>
                      <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                      <div className="hidden sm:block w-px self-stretch bg-gray-300 dark:bg-gray-600 my-1" />
                      <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                      <div className="flex flex-wrap gap-1.5">
                        <div className="w-[4.5rem]">
                          <label className="text-[11px] text-gray-500 block mb-0.5">ကျပ်</label>
                          <NumberInput min={0} value={formGrossKyat} onChange={(v) => applyGrossFromKpy({ kyat: v, pae: formGrossPae, yway: formGrossYway })} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                        </div>
                        <div className="w-[4.5rem]">
                          <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                          <NumberInput min={0} max={15} value={formGrossPae} onChange={(v) => applyGrossFromKpy({ kyat: formGrossKyat, pae: v, yway: formGrossYway })} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                        </div>
                        <div className="w-[4.5rem]">
                          <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                          <NumberInput min={0} step={0.1} value={formGrossYway} onChange={(v) => applyGrossFromKpy({ kyat: formGrossKyat, pae: formGrossPae, yway: v })} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="text-xs font-bold text-sky-700 dark:text-sky-300 mb-2 flex items-center justify-between">
                        <span>{language === 'MM' ? '၂။ ကျောက်ချိန်' : '2. Gemstone'}</span>
                        <span className="text-gray-400 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
                      </div>
                      <div className="flex flex-wrap items-end gap-y-2">
                        <div className="w-[7.5rem]">
                          <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                          <NumberInput min={0} step={0.001} value={formGemGrams} onChange={applyGemFromGrams} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]" />
                        </div>
                        <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                        <div className="hidden sm:block w-px self-stretch bg-gray-300 dark:bg-gray-600 my-1" />
                        <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                        <div className="flex flex-wrap gap-1.5">
                          <div className="w-[4.5rem]">
                            <label className="text-[11px] text-gray-500 block mb-0.5">ကျပ်</label>
                            <NumberInput min={0} value={formGemKyat} onChange={(v) => applyGemFromKpy({ kyat: v, pae: formGemPae, yway: formGemYway })} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                          <div className="w-[4.5rem]">
                            <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                            <NumberInput min={0} value={formGemPae} onChange={(v) => applyGemFromKpy({ kyat: formGemKyat, pae: v, yway: formGemYway })} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                          <div className="w-[4.5rem]">
                            <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                            <NumberInput min={0} step={0.1} value={formGemYway} onChange={(v) => applyGemFromKpy({ kyat: formGemKyat, pae: formGemPae, yway: v })} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        {language === 'MM' ? '၃။ အလျော့တွက်' : '3. Wastage'}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-rose-200/70 dark:border-rose-900/40 p-2.5 space-y-1.5">
                          <div className="text-[11px] font-semibold text-rose-500">
                            {language === 'MM' ? 'ပန်းထိမ်အလျော့တွက်' : 'Craft wastage'}
                          </div>
                          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                            <div className="w-[6.5rem]">
                              <label className="text-[10px] text-gray-500 block mb-0.5">Gram</label>
                              <NumberInput min={0} step={0.001} value={formCraftDedGrams} onChange={(v) => applyPaeYwayFromGrams(v, setFormCraftDedGrams, setFormCraftDedPae, setFormCraftDedYway)} className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]" />
                            </div>
                            <div className="hidden sm:block w-px self-stretch bg-gray-200 dark:bg-gray-700" />
                            <div className="w-[4rem]">
                              <label className="text-[10px] text-gray-500 block mb-0.5">ပဲ</label>
                              <NumberInput min={0} value={formCraftDedPae} onChange={(v) => applyGramsFromPaeYway(v, formCraftDedYway, setFormCraftDedPae, setFormCraftDedYway, setFormCraftDedGrams)} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                            </div>
                            <div className="w-[4rem]">
                              <label className="text-[10px] text-gray-500 block mb-0.5">ရွေး</label>
                              <NumberInput min={0} step={0.1} value={formCraftDedYway} onChange={(v) => applyGramsFromPaeYway(formCraftDedPae, v, setFormCraftDedPae, setFormCraftDedYway, setFormCraftDedGrams)} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-rose-200/70 dark:border-rose-900/40 p-2.5 space-y-1.5">
                          <div className="text-[11px] font-semibold text-rose-500">
                            {language === 'MM' ? 'အမြတ်အလျော့တွက်' : 'Profit wastage'}
                          </div>
                          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                            <div className="w-[6.5rem]">
                              <label className="text-[10px] text-gray-500 block mb-0.5">Gram</label>
                              <NumberInput min={0} step={0.001} value={formProfitDedGrams} onChange={(v) => applyPaeYwayFromGrams(v, setFormProfitDedGrams, setFormProfitDedPae, setFormProfitDedYway)} className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]" />
                            </div>
                            <div className="hidden sm:block w-px self-stretch bg-gray-200 dark:bg-gray-700" />
                            <div className="w-[4rem]">
                              <label className="text-[10px] text-gray-500 block mb-0.5">ပဲ</label>
                              <NumberInput min={0} value={formProfitDedPae} onChange={(v) => applyGramsFromPaeYway(v, formProfitDedYway, setFormProfitDedPae, setFormProfitDedYway, setFormProfitDedGrams)} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                            </div>
                            <div className="w-[4rem]">
                              <label className="text-[10px] text-gray-500 block mb-0.5">ရွေး</label>
                              <NumberInput min={0} step={0.1} value={formProfitDedYway} onChange={(v) => applyGramsFromPaeYway(formProfitDedPae, v, setFormProfitDedPae, setFormProfitDedYway, setFormProfitDedGrams)} className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
                          <span>{language === 'MM' ? 'စုစုပေါင်းအလျော့တွက်' : 'Total wastage'}</span>
                          <span className="text-rose-400/80 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
                        </div>
                        <div className="flex flex-wrap items-end gap-y-2">
                          <div className="w-[7.5rem]">
                            <label className="text-[11px] text-rose-500/80 block mb-0.5">Gram</label>
                            <input
                              type="text"
                              readOnly
                              value={totalWasteGrams}
                              className="w-full px-2.5 py-1.5 text-xs font-extrabold rounded-lg border border-rose-300 dark:border-rose-800 bg-white/80 dark:bg-[#1A1A1A] text-rose-800 dark:text-rose-200 font-mono"
                            />
                          </div>
                          <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                          <div className="hidden sm:block w-px self-stretch bg-rose-300 dark:bg-rose-700 my-1" />
                          <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                          <div className="flex flex-wrap gap-1.5">
                            <div className="w-[4.5rem]">
                              <label className="text-[11px] text-rose-500/80 block mb-0.5">ကျပ်</label>
                              <input
                                type="text"
                                readOnly
                                value={totalWasteKpy.kyat}
                                className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-rose-300 dark:border-rose-800 bg-white/80 dark:bg-[#1A1A1A] text-rose-800 dark:text-rose-200 font-mono"
                              />
                            </div>
                            <div className="w-[4.5rem]">
                              <label className="text-[11px] text-rose-500/80 block mb-0.5">ပဲ</label>
                              <input
                                type="text"
                                readOnly
                                value={totalWasteKpy.pae}
                                className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-rose-300 dark:border-rose-800 bg-white/80 dark:bg-[#1A1A1A] text-rose-800 dark:text-rose-200 font-mono"
                              />
                            </div>
                            <div className="w-[4.5rem]">
                              <label className="text-[11px] text-rose-500/80 block mb-0.5">ရွေး</label>
                              <input
                                type="text"
                                readOnly
                                value={totalWasteKpy.yway}
                                className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-rose-300 dark:border-rose-800 bg-white/80 dark:bg-[#1A1A1A] text-rose-800 dark:text-rose-200 font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'အရင်းလက်ခ' : 'Cost craft'}
                          </label>
                          <NumberInput step={1000} value={formCraftsmanship} onChange={setFormCraftsmanship} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono" />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'အမြတ်လက်ခ' : 'Profit craft'}
                          </label>
                          <NumberInput step={1000} value={formCraftProfit} onChange={setFormCraftProfit} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono" />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'စုစုပေါင်းလက်ခ' : 'Total craft'}
                          </label>
                          <input type="text" readOnly value={formatMMK(mmCraftTotal)} className="w-full px-2.5 py-1.5 text-xs font-extrabold rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-mono" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'ကျောက်ဖိုးအရင်း' : 'Stone cost'}
                          </label>
                          <NumberInput step={500} value={formStonePrice} onChange={setFormStonePrice} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono" />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'ကျောက်ဖိုးအမြတ်' : 'Stone profit'}
                          </label>
                          <NumberInput step={500} value={formStoneProfit} onChange={setFormStoneProfit} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono" />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                            {language === 'MM' ? 'ကျောက်ဖိုးစုစုပေါင်း' : 'Total stone'}
                          </label>
                          <input type="text" readOnly value={formatMMK(mmStoneTotal)} className="w-full px-2.5 py-1.5 text-xs font-extrabold rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 font-mono" />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {language === 'MM'
                          ? '၄။ ရွှေချိန် (Net) = (အထည် − ကျောက်) + စုစုပေါင်းအလျော့တွက်'
                          : '4. Net = (Gross − Gem) + Total wastage'}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                        {language === 'MM' ? formatKPYMyanmar(computedNet) : formatKPYEnglish(computedNet)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Total Summary Footer */}
              <div className="p-3 rounded-xl bg-[#FAF8F2] dark:bg-[#221F18] border border-[#D4AF37]/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    {isThaiEntry
                      ? language === 'MM'
                        ? 'ထိုင်းရွှေပေါက်ဈေးဖြင့် ခန့်မှန်းရောင်းဈေး (ဘတ်):'
                        : 'Estimated selling price (Baht):'
                      : language === 'MM'
                        ? 'ယနေ့ပေါက်ဈေးဖြင့် ခန့်မှန်းရောင်းဈေး:'
                        : 'Estimated Selling Price:'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {isThaiEntry
                      ? `(ရွှေတန်ဖိုး ${fmtBaht(valuation.goldAmount)} + အရင်းလက်ခ ${fmtBaht(formCraftsmanship)} + အမြတ်လက်ခ ${fmtBaht(formCraftProfit)})`
                      : `(ရွှေတန်ဖိုး ${formatMMK(valuation.goldAmount)} + စုစုပေါင်းလက်ခ ${formatMMK(mmCraftTotal)} + ကျောက်ဖိုးစုစုပေါင်း ${formatMMK(mmStoneTotal)})`}
                  </span>
                </div>
                <div className="text-lg font-extrabold text-[#996515] dark:text-amber-300 font-mono">
                  {isThaiEntry
                    ? fmtBaht(thaiBahtBreakdown?.totalPrice || 0)
                    : formatMMK(estimatedTotalSelling)}
                </div>
              </div>
              </div>

              <div className="px-5 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end space-x-2 shrink-0 bg-white dark:bg-[#1A1A1A]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold hover:bg-[#C5A059] transition shadow-md"
                >
                  {language === 'MM' ? 'စာရင်းသွင်းမည်' : 'Save Item'}
                </button>
              </div>

            </form>

          </div>
        </ModalOverlay>
      )}

      {/* Barcode Tag Print Preview Modal — 75mm × 15mm */}
      {tagItem && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#D4AF37]/30 print:max-w-none print:w-full print:p-0 print:shadow-none print:border-0 print:rounded-none">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800 print:hidden">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center space-x-2">
                <Printer className="w-4 h-4 text-[#D4AF37]" />
                <span>
                  {language === 'MM' ? 'ဘားကုဒ်ကတ်ပြား (75×15 mm)' : 'Barcode Tag (75×15 mm)'}
                </span>
              </h3>
              <button
                onClick={() => setTagItem(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center gap-3 print:mt-0 print:block">
              <p className="text-[10px] text-gray-500 print:hidden">
                {language === 'MM'
                  ? 'ပရင့်ထုတ်ချိန်တွင် စက္ကူအရွယ် 75mm × 15mm ရွေးပါ'
                  : 'Select 75mm × 15mm paper size when printing'}
              </p>
              <div className="scale-[1.35] origin-top print:scale-100 print:origin-top-left">
                <InventoryBarcodeTag
                  item={tagItem}
                  kyatToGrams={kyatToGrams}
                  bahtBuyRate={shopSettings?.baht_to_mmk_buy || 755}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2 print:hidden">
              <button
                onClick={() => setTagItem(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  document.documentElement.classList.add('print-barcode-tag');
                  const cleanup = () => {
                    document.documentElement.classList.remove('print-barcode-tag');
                    window.removeEventListener('afterprint', cleanup);
                  };
                  window.addEventListener('afterprint', cleanup);
                  window.print();
                  // Fallback if afterprint is skipped
                  window.setTimeout(cleanup, 2000);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#D4AF37] text-white text-xs font-bold hover:bg-[#C5A059] flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'MM' ? 'ကတ်ပြား ပရင့်ထုတ်' : 'Print Tag'}</span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {gsItem && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Hammer className="w-4 h-4 text-violet-600" />
                {language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Send to goldsmith'}
              </h3>
              <button type="button" onClick={() => setGsItem(null)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <p className="font-mono font-bold text-[#996515]">{gsItem.barcode}</p>
                <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                  {language === 'MM' ? gsItem.name_mm : gsItem.name}
                </p>
                <p className="text-gray-500 mt-1 font-mono">
                  {gsItem.item_type === 'THAI_GOLD' || gsItem.purity === 'THAI_GOLD'
                    ? `${Number(gsItem.thai_weight_unit || 0).toFixed(3)} g`
                    : formatKPYMyanmar({
                        kyat: gsItem.net_weight_kyat,
                        pae: gsItem.net_weight_pae,
                        yway: gsItem.net_weight_yway,
                      })}
                  {' · '}
                  {PURITY_LABELS[gsItem.purity]?.mm || gsItem.purity}
                </p>
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {language === 'MM' ? 'ပြန်လာအပ်ရမည့်ရက်' : 'Expected return date'}
                </label>
                <DateInput
                  required
                  value={gsReturnDue}
                  onChange={setGsReturnDue}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {language === 'MM'
                    ? 'ဤရက်ကျော်သေးပြီး ပြန်မလာသေးရင် ပန်းထိမ်အပ်မှာ အကြောင်းကြားပါမည် · လက်ခကို ပြန်လာမှ ထည့်ပါ'
                    : 'Overdue SENT jobs notify on Goldsmith · craft fee on return'}
                </p>
              </div>
              <input
                value={gsNote}
                onChange={(e) => setGsNote(e.target.value)}
                placeholder={language === 'MM' ? 'မှတ်ချက်' : 'Note'}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
              />
              {gsErr && <p className="text-rose-600">{gsErr}</p>}
              <button
                type="button"
                disabled={gsSaving || !gsReturnDue}
                onClick={async () => {
                  setGsSaving(true);
                  setGsErr('');
                  try {
                    await createGoldsmithJob({
                      source_type: 'INVENTORY',
                      inventory_item_id: gsItem.id,
                      craft_fee: 0,
                      return_due_date: gsReturnDue,
                      notes: gsNote || undefined,
                    });
                    setGsItem(null);
                  } catch (e) {
                    setGsErr(e instanceof Error ? e.message : 'Failed');
                  } finally {
                    setGsSaving(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold disabled:opacity-50"
              >
                {gsSaving ? '...' : language === 'MM' ? 'အပ်မည်' : 'Send'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
};
