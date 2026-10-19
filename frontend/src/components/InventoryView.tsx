import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
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
  mmkToBahtFromSell,
  resolveBahtMmkRate,
} from '../utils/goldCalculations';
import { formatDate, todayISO } from '../utils/dateFormat';
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
  CalendarDays,
  Scale,
} from 'lucide-react';
import { api } from '../services/api';
import { DataTable, type DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { ModalOverlay } from './ModalOverlay';
import { InventoryBarcodeTag, BARCODE_TAG_PAGE_STYLE } from './InventoryBarcodeTag';
import { NumberInput } from './NumberInput';
import { DateInput } from './DateInput';
import { useDialog } from '../context/DialogContext';

/** Normalize inventory / transaction purity to a gold-class code (Setup GOLD_CLASS). */
function resolveGoldClassKey(purity?: string | null, itemType?: string | null): string {
  const p = String(purity || '').trim().toUpperCase();
  const t = String(itemType || '').trim().toUpperCase();
  if (t === 'THAI_GOLD' || p === 'THAI_GOLD' || p.includes('THAI') || p.includes('ထိုင်း')) {
    return 'THAI_GOLD';
  }
  return p || 'OTHER';
}

function toDayISO(value?: string | null): string {
  if (!value) return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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
    transactions,
    goldsmithJobs,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    goldPrices,
    language,
    refreshData,
    masterCategories,
    shopSettings,
    getLivePriceForPurity,
  } = useGoldShop();
  const dialog = useDialog();
  const barcodePrintRef = useRef<HTMLDivElement>(null);
  const handlePrintBarcodeTag = useReactToPrint({
    contentRef: barcodePrintRef,
    documentTitle: 'barcode-tag-75x15',
    pageStyle: BARCODE_TAG_PAGE_STYLE,
    // Avoid global voucher @media print rules (visibility/absolute) breaking sticker layout
    ignoreGlobalStyles: true,
    onBeforePrint: async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    },
  });

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  // Movement summary date range (default: today → today)
  const [summaryFrom, setSummaryFrom] = useState(() => todayISO());
  const [summaryTo, setSummaryTo] = useState(() => todayISO());
  const summaryTableRef = useRef<HTMLTableElement>(null);
  const [summaryVLines, setSummaryVLines] = useState<number[]>([]);

  const inventoryItemGrams = (item: InventoryItem): number => {
    const isThai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
    const unit = Number(item.thai_weight_unit || 0);
    if (isThai && unit > 0) return Number(unit.toFixed(3));
    return Number(
      kpyToGrams(
        {
          kyat: Number(item.net_weight_kyat || 0),
          pae: Number(item.net_weight_pae || 0),
          yway: Number(item.net_weight_yway || 0),
        },
        kyatToGrams
      ).toFixed(3)
    );
  };

  /**
   * Inventory movement by Setup GOLD_CLASS (မီးလင်း, 15A, …) for [from, to]:
   * - opening (ဆိုင်ရှိ): stocked before from − out before from
   * - dayIn (အဝင်): stocked in range
   * - dayOut (အထွက်): sold / shop-out / goldsmith send in range
   * - balance: opening + in − out
   */
  const inventoryDateSummary = useMemo(() => {
    let from = summaryFrom || todayISO();
    let to = summaryTo || todayISO();
    if (from > to) {
      const tmp = from;
      from = to;
      to = tmp;
    }

    type Stat = {
      openingGrams: number;
      openingCount: number;
      inCount: number;
      inGrams: number;
      outCount: number;
      outGrams: number;
    };
    const empty = (): Stat => ({
      openingGrams: 0,
      openingCount: 0,
      inCount: 0,
      inGrams: 0,
      outCount: 0,
      outGrams: 0,
    });

    const setupClasses = masterCategories
      .filter((c) => c.category_group === 'GOLD_CLASS' && c.is_active)
      .slice()
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

    const classMeta = new Map<
      string,
      { code: string; nameMm: string; nameEn: string; sort: number }
    >();

    if (setupClasses.length > 0) {
      for (const c of setupClasses) {
        const code = String(c.code || '').toUpperCase();
        if (!code) continue;
        classMeta.set(code, {
          code,
          nameMm: c.name_mm || code,
          nameEn: c.name_en || code,
          sort: Number(c.sort_order || 0),
        });
      }
    } else {
      Object.entries(PURITY_LABELS).forEach(([code, label], idx) => {
        classMeta.set(code, {
          code,
          nameMm: label.mm,
          nameEn: label.en,
          sort: (idx + 1) * 10,
        });
      });
    }

    const stats: Record<string, Stat> = {};
    for (const code of classMeta.keys()) stats[code] = empty();

    const ensureKey = (key: string) => {
      const k = key || 'OTHER';
      if (!stats[k]) {
        stats[k] = empty();
        if (!classMeta.has(k)) {
          const label = PURITY_LABELS[k as keyof typeof PURITY_LABELS];
          classMeta.set(k, {
            code: k,
            nameMm: label?.mm || k,
            nameEn: label?.en || k,
            sort: 9000 + classMeta.size,
          });
        }
      }
      return k;
    };

    const addIn = (rawKey: string, grams: number, before: boolean) => {
      const key = ensureKey(rawKey);
      const g = Number(grams) || 0;
      if (before) {
        stats[key].openingGrams += g;
        stats[key].openingCount += 1;
      } else {
        stats[key].inCount += 1;
        stats[key].inGrams += g;
      }
    };

    const addOut = (rawKey: string, grams: number, before: boolean) => {
      const key = ensureKey(rawKey);
      const g = Number(grams) || 0;
      if (before) {
        stats[key].openingGrams -= g;
        stats[key].openingCount -= 1;
      } else {
        stats[key].outCount += 1;
        stats[key].outGrams += g;
      }
    };

    // Stock-in movements from inventory created_at
    for (const item of inventory) {
      const day = toDayISO(item.created_at);
      if (!day) continue;
      const key = resolveGoldClassKey(item.purity, item.item_type);
      const grams = inventoryItemGrams(item);
      if (day < from) addIn(key, grams, true);
      else if (day >= from && day <= to) addIn(key, grams, false);
    }

    // Outflows from SALE / SHOP_OUT / EXCHANGE (new sold lines)
    for (const t of transactions) {
      const type = String(t.transaction_type || '').toUpperCase();
      if (type !== 'SALE' && type !== 'SHOP_OUT' && type !== 'EXCHANGE') continue;
      const day = toDayISO(t.created_at);
      if (!day) continue;
      const before = day < from;
      const inRange = day >= from && day <= to;
      if (!before && !inRange) continue;

      for (const line of t.items || []) {
        if (type === 'EXCHANGE' && String(line.line_role || '').toUpperCase() === 'TRADE_IN') {
          continue;
        }
        // Only inventory-linked lines affect stock (orphan sales without item_id stay out of this report)
        const linkedId = String(line.item_id || '').trim();
        if (!linkedId) continue;

        const key = resolveGoldClassKey(line.purity, line.item_type);
        const isThai = line.item_type === 'THAI_GOLD' || line.purity === 'THAI_GOLD';
        const unit = Number(line.thai_weight_unit || 0);
        const grams =
          isThai && unit > 0
            ? Number(unit.toFixed(3))
            : Number(
                kpyToGrams(line.net_weight || { kyat: 0, pae: 0, yway: 0 }, kyatToGrams).toFixed(3)
              );
        addOut(key, grams, before);
      }
    }

    // Outflows: inventory sent to goldsmith
    for (const j of goldsmithJobs) {
      if (j.source_type !== 'INVENTORY' && !j.inventory_item_id) continue;
      const day = toDayISO(j.sent_at || j.created_at);
      if (!day) continue;
      const before = day < from;
      const inRange = day >= from && day <= to;
      if (!before && !inRange) continue;
      const key = resolveGoldClassKey(j.purity || j.source_purity, j.item_type);
      const grams = Number(Number(j.source_grams || 0).toFixed(3));
      if (grams <= 0 && j.inventory_item_id) {
        const inv = inventory.find((i) => i.id === j.inventory_item_id);
        addOut(key, inv ? inventoryItemGrams(inv) : 0, before);
      } else {
        addOut(key, grams, before);
      }
    }

    const orderedKeys = Array.from(classMeta.values())
      .sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code))
      .map((m) => m.code);

    const rows = orderedKeys
      .map((key) => {
        const meta = classMeta.get(key)!;
        const s = stats[key] || empty();
        const openingGrams = Number(Math.max(0, s.openingGrams).toFixed(3));
        const openingCount = Math.max(0, s.openingCount);
        const inGrams = Number(s.inGrams.toFixed(3));
        const outGrams = Number(s.outGrams.toFixed(3));
        const balanceGrams = Number(Math.max(0, openingGrams + inGrams - outGrams).toFixed(3));
        const balanceCount = Math.max(0, openingCount + s.inCount - s.outCount);
        return {
          key,
          nameMm: meta.nameMm,
          nameEn: meta.nameEn,
          badgeClass:
            'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300 dark:border-amber-800',
          openingCount,
          openingGrams,
          inCount: s.inCount,
          inGrams,
          outCount: s.outCount,
          outGrams,
          balanceCount,
          balanceGrams,
        };
      })
      .filter(
        (r) =>
          r.openingCount > 0 ||
          r.inCount > 0 ||
          r.outCount > 0 ||
          r.balanceCount > 0 ||
          r.openingGrams > 0 ||
          r.inGrams > 0 ||
          r.outGrams > 0 ||
          r.balanceGrams > 0
      );

    const totals = rows.reduce(
      (acc, r) => {
        acc.openingCount += r.openingCount;
        acc.openingGrams += r.openingGrams;
        acc.inCount += r.inCount;
        acc.inGrams += r.inGrams;
        acc.outCount += r.outCount;
        acc.outGrams += r.outGrams;
        acc.balanceCount += r.balanceCount;
        acc.balanceGrams += r.balanceGrams;
        return acc;
      },
      {
        openingCount: 0,
        openingGrams: 0,
        inCount: 0,
        inGrams: 0,
        outCount: 0,
        outGrams: 0,
        balanceCount: 0,
        balanceGrams: 0,
      }
    );

    return {
      from,
      to,
      rows,
      totals: {
        openingCount: totals.openingCount,
        openingGrams: Number(totals.openingGrams.toFixed(3)),
        inCount: totals.inCount,
        inGrams: Number(totals.inGrams.toFixed(3)),
        outCount: totals.outCount,
        outGrams: Number(totals.outGrams.toFixed(3)),
        balanceCount: totals.balanceCount,
        balanceGrams: Number(totals.balanceGrams.toFixed(3)),
      },
    };
  }, [
    inventory,
    transactions,
    goldsmithJobs,
    masterCategories,
    summaryFrom,
    summaryTo,
    kyatToGrams,
  ]);

  /** Continuous vertical lines: ရွှေအမျိုးအစား → ကာလစုစုပေါင်း (full table height). */
  useLayoutEffect(() => {
    const table = summaryTableRef.current;
    if (!table) return;

    const measure = () => {
      const row =
        table.querySelector('tbody tr') ||
        table.querySelector('tfoot tr');
      if (!row) {
        setSummaryVLines([]);
        return;
      }
      const cells = Array.from(row.querySelectorAll('th, td'));
      const isFooter = row.parentElement?.tagName === 'TFOOT';
      // After: type | opening-g | in-g | out-g
      const rightEdgeIndices = isFooter ? [0, 2, 4, 6] : [1, 3, 5, 7];
      const tableLeft = table.getBoundingClientRect().left;
      setSummaryVLines(
        rightEdgeIndices
          .map((i) => cells[i])
          .filter(Boolean)
          .map((el) => Math.round(el.getBoundingClientRect().right - tableLeft))
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(table);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [inventoryDateSummary.rows.length, language]);

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

  // Form State
  const [formBarcode, setFormBarcode] = useState('');
  const [formNameMM, setFormNameMM] = useState('');
  const [formCategory, setFormCategory] = useState<string>('NECKLACE');
  const [formItemType, setFormItemType] = useState<ItemType>('MYANMAR_GOLD');
  const [formPurity, setFormPurity] = useState<GoldPurity>('MEELIN');


  // Weight tracking: Gross / Gemstone / Wastage (Myanmar) or Thai grams
  const [formGrossGrams, setFormGrossGrams] = useState<number>(0);
  const [formGrossKyat, setFormGrossKyat] = useState<number>(0);
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
  const [formThaiGrams, setFormThaiGrams] = useState<number>(0);
  const [showCustomThaiGram, setShowCustomThaiGram] = useState(false);
  const [formCraftsmanship, setFormCraftsmanship] = useState<number>(0);
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

  /** Empty defaults for new Myanmar / Thai item (no sample fees or weights). */
  const resetNewItemForm = (kind: 'MYANMAR' | 'THAI' = 'MYANMAR') => {
    setEditingItemId(null);
    setFormBarcode(generateBarcode());
    setFormNameMM('');
    setFormCategory('NECKLACE');
    if (kind === 'THAI') {
      setFormItemType('THAI_GOLD');
      setFormPurity('THAI_GOLD');
      setFormThaiGrams(0);
      setShowCustomThaiGram(false);
      setFormGrossKyat(0);
      setFormGrossPae(0);
      setFormGrossYway(0);
      setFormGrossGrams(0);
    } else {
      setFormItemType('MYANMAR_GOLD');
      setFormPurity('MEELIN');
      setFormThaiGrams(0);
      setShowCustomThaiGram(false);
      setFormGrossGrams(0);
      setFormGrossKyat(0);
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
    setFormCraftsmanship(0);
    setFormCraftProfit(0);
    setFormStonePrice(0);
    setFormStoneProfit(0);
  };

  // Open modal for new item (Myanmar or Thai)
  const openNewItemModal = (kind: 'MYANMAR' | 'THAI' = 'MYANMAR') => {
    resetNewItemForm(kind);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setFormBarcode(item.barcode);
    setFormNameMM(item.name_mm || item.name || '');
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
      const rate =
        Number(item.baht_mmk_rate) > 0
          ? Number(item.baht_mmk_rate)
          : resolveBahtMmkRate(shopSettings);
      const craftBaht = Number(item.craftsmanship_fee_baht);
      const craftProfitBaht = Number(item.craftsmanship_profit_fee_baht);
      setFormCraftsmanship(
        craftBaht > 0
          ? Math.round(craftBaht)
          : Math.round(mmkToBahtFromSell(Number(item.craftsmanship_fee || 0), rate))
      );
      setFormCraftProfit(
        craftProfitBaht > 0
          ? Math.round(craftProfitBaht)
          : Math.round(mmkToBahtFromSell(Number(item.craftsmanship_profit_fee || 0), rate))
      );
      setFormStonePrice(0);
      setFormStoneProfit(0);
    } else {
      setFormCraftsmanship(Number(item.craftsmanship_fee || 0));
      setFormCraftProfit(Number(item.craftsmanship_profit_fee || 0));
      setFormStonePrice(Number(item.stone_price || 0));
      setFormStoneProfit(Number(item.stone_profit_price || 0));
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
  const sellRate = resolveBahtMmkRate(shopSettings);
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
    // Flush NumberInput text → parent state before reading craft fees
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 0);
    });

    const itemName = formNameMM.trim();
    if (!itemName) return;

    const craftBaht = isThaiEntry ? Number(formCraftsmanship || 0) : 0;
    const craftProfitBaht = isThaiEntry ? Number(formCraftProfit || 0) : 0;
    const sellBaht = isThaiEntry ? Number(thaiBahtBreakdown!.totalPrice || 0) : 0;
    const craftMmk = isThaiEntry
      ? Math.round(bahtToMmk(craftBaht, sellRate))
      : Math.round(Number(formCraftsmanship || 0));
    const craftProfitMmk = isThaiEntry
      ? Math.round(bahtToMmk(craftProfitBaht, sellRate))
      : Math.round(Number(formCraftProfit || 0));
    const sellMmk = isThaiEntry
      ? Math.round(bahtToMmk(sellBaht, sellRate))
      : estimatedTotalSelling;

    const itemPayload = {
      barcode: formBarcode || generateBarcode(),
      category: isThaiEntry ? 'THAI_GOLD' : formCategory,
      name: itemName,
      name_mm: itemName,
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
      craftsmanship_fee_baht: isThaiEntry ? craftBaht : 0,
      craftsmanship_profit_fee_baht: isThaiEntry ? craftProfitBaht : 0,
      selling_price_baht: isThaiEntry ? sellBaht : 0,
      baht_mmk_rate: isThaiEntry ? sellRate : undefined,
      thai_gold_baht_snapshot: isThaiEntry ? thaiBahtRate : undefined,
      status: (editingItemId
        ? inventory.find((i) => i.id === editingItemId)?.status || 'IN_STOCK'
        : 'IN_STOCK') as InventoryItem['status'],
    };

    const wasEdit = Boolean(editingItemId);
    const savedId = editingItemId;
    const entryKind: 'MYANMAR' | 'THAI' = isThaiEntry ? 'THAI' : 'MYANMAR';
    try {
      if (savedId) {
        await updateInventoryItem(savedId, itemPayload);
      } else {
        await addInventoryItem(itemPayload);
      }
      setIsModalOpen(false);
      resetNewItemForm(entryKind);
      await dialog.alert({
        title: language === 'MM' ? 'အောင်မြင်ပါသည်' : 'Success',
        message: wasEdit
          ? language === 'MM'
            ? 'ပစ္စည်း ပြင်ဆင်ပြီးပါပြီ'
            : 'Item updated'
          : language === 'MM'
            ? 'ပစ္စည်း သိမ်းပြီးပါပြီ'
            : 'Item saved',
        variant: 'success',
      });
    } catch (err) {
      await dialog.alert({
        title: language === 'MM' ? 'မအောင်မြင်ပါ' : 'Failed',
        message: err instanceof Error ? err.message : 'Save failed',
        variant: 'error',
      });
    }
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
        { header: language === 'MM' ? 'ပစ္စည်းအမည်' : 'Product Name', value: (i) => i.name_mm || i.name, width: 24 },
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
        accessor: (i) => i.name_mm || i.name,
        cell: (item) => (
          <div className="min-w-0">
            <div className="font-semibold truncate max-w-[160px]">
              {item.name_mm || item.name}
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
                  await dialog.alert({
                    title: language === 'MM' ? 'အောင်မြင်ပါသည်' : 'Success',
                    message: language === 'MM' ? 'ပစ္စည်း ဖျက်ပြီးပါပြီ' : 'Item deleted',
                    variant: 'success',
                  });
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
    [language, deleteInventoryItem, kyatToGrams, goldPrices, getLivePriceForPurity, dialog]
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

      {/* Daily / period movement summary by gold type */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-extrabold tracking-wide">
                {language === 'MM' ? 'နေ့စဉ် / ကာလ' : 'PERIOD'}
              </span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {language === 'MM' ? 'ရွှေထည် အဝင်–အထွက် စာရင်းချုပ်' : 'Inventory In–Out Summary'}
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {language === 'MM'
                ? 'ရွေးချယ်ရက်အပိုင်းအတွက် — Setup ရွှေအမျိုးအစား (မီးလင်း အစရှိ) အကုန်လုံးဖြင့် စတော့အဝင်၊ ရောင်း/ဆိုင်ထုတ်/ပန်းထိမ်အပ် အထွက်'
                : 'For selected date range — all Setup gold classes (Meelin, …) with stock-in vs sold / shop-out / goldsmith'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">
              <span>{language === 'MM' ? 'မှ' : 'From'}</span>
              <DateInput
                value={summaryFrom}
                onChange={setSummaryFrom}
                className="w-36 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">
              <span>{language === 'MM' ? 'ထိ' : 'To'}</span>
              <DateInput
                value={summaryTo}
                onChange={setSummaryTo}
                className="w-36 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono text-gray-900 dark:text-white"
              />
            </div>
            {(summaryFrom !== todayISO() || summaryTo !== todayISO()) && (
              <button
                type="button"
                onClick={() => {
                  const t = todayISO();
                  setSummaryFrom(t);
                  setSummaryTo(t);
                }}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                {language === 'MM' ? 'ယနေ့' : 'Today'}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-800/50 overflow-hidden shadow-xs">
          <div className="px-3 py-2.5 border-b border-amber-200/80 dark:border-amber-800/40 flex flex-wrap items-center justify-between gap-2 text-[11px] bg-amber-100/50 dark:bg-amber-950/30">
            <div className="flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span className="font-bold text-amber-950 dark:text-amber-100">
                {language === 'MM' ? 'ရွှေအမျိုးအစားအလိုက် အဝင်–အထွက်' : 'In–Out by gold type'}
              </span>
              <span className="font-mono text-amber-700/70 dark:text-amber-300/70">
                ({formatDate(inventoryDateSummary.from)} → {formatDate(inventoryDateSummary.to)})
              </span>
            </div>
            <div className="font-mono text-amber-800 dark:text-amber-300 font-extrabold">
              {language === 'MM' ? 'လက်ကျန်' : 'Balance'}:{' '}
              {inventoryDateSummary.totals.balanceCount}{' '}
              {language === 'MM' ? 'ခု' : 'pcs'} · {inventoryDateSummary.totals.balanceGrams.toFixed(3)} g
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="relative min-w-[720px]">
              {/* Full-height continuous vertical lines (through ကာလစုစုပေါင်း) */}
              {summaryVLines.map((x) => (
                <div
                  key={x}
                  aria-hidden
                  className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-amber-500 dark:bg-amber-400"
                  style={{ left: x }}
                />
              ))}
              <table
                ref={summaryTableRef}
                className="w-full text-[11px] text-left border-collapse border border-amber-200 dark:border-amber-800/50"
              >
                <thead>
                  <tr className="bg-amber-100/70 dark:bg-amber-950/40 text-amber-900/80 dark:text-amber-200/80 border-b border-amber-200 dark:border-amber-800/40">
                    <th className="px-3 py-2.5 font-bold w-10" rowSpan={2}>
                      စဉ်
                    </th>
                    <th className="px-3 py-2.5 font-bold" rowSpan={2}>
                      {language === 'MM' ? 'ရွှေအမျိုးအစား' : 'Gold Type'}
                    </th>
                    <th className="px-3 py-2 font-bold text-center" colSpan={2}>
                      {language === 'MM' ? 'ဆိုင်ရှိ (မတိုင်မီ)' : 'Opening'}
                    </th>
                    <th
                      className="px-3 py-2 font-bold text-center text-emerald-700 dark:text-emerald-400"
                      colSpan={2}
                    >
                      {language === 'MM' ? 'အဝင်' : 'In'}
                    </th>
                    <th
                      className="px-3 py-2 font-bold text-center text-rose-700 dark:text-rose-400"
                      colSpan={2}
                    >
                      {language === 'MM' ? 'အထွက်' : 'Out'}
                    </th>
                    <th
                      className="px-3 py-2 font-bold text-center text-amber-800 dark:text-amber-300"
                      colSpan={2}
                    >
                      {language === 'MM' ? 'လက်ကျန်' : 'Balance'}
                    </th>
                  </tr>
                  <tr className="bg-amber-100/50 dark:bg-amber-950/30 text-amber-900/70 dark:text-amber-200/70 border-b border-amber-200 dark:border-amber-800/40">
                    <th className="px-3 py-1.5 font-bold text-right">
                      {language === 'MM' ? 'အရေအတွက်' : 'Qty'}
                    </th>
                    <th className="px-3 py-1.5 font-bold text-right">Gram</th>
                    <th className="px-3 py-1.5 font-bold text-right text-emerald-700 dark:text-emerald-400">
                      {language === 'MM' ? 'အရေအတွက်' : 'Qty'}
                    </th>
                    <th className="px-3 py-1.5 font-bold text-right text-emerald-700 dark:text-emerald-400">
                      Gram
                    </th>
                    <th className="px-3 py-1.5 font-bold text-right text-rose-700 dark:text-rose-400">
                      {language === 'MM' ? 'အရေအတွက်' : 'Qty'}
                    </th>
                    <th className="px-3 py-1.5 font-bold text-right text-rose-700 dark:text-rose-400">
                      Gram
                    </th>
                    <th className="px-3 py-1.5 font-bold text-right text-amber-800 dark:text-amber-300">
                      {language === 'MM' ? 'အရေအတွက်' : 'Qty'}
                    </th>
                    <th className="px-3 py-1.5 font-bold text-right text-amber-800 dark:text-amber-300">
                      Gram
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryDateSummary.rows.map((cat, idx) => (
                    <tr
                      key={cat.key}
                      className="hover:bg-amber-100/40 dark:hover:bg-amber-900/20 transition border-b border-amber-100 dark:border-amber-900/30"
                    >
                      <td className="px-3 py-2.5 font-mono text-amber-700/50 dark:text-amber-400/50">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cat.badgeClass}`}>
                          {language === 'MM' ? cat.nameMm : cat.nameEn}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800 dark:text-gray-100">
                        {cat.openingCount} {language === 'MM' ? 'ခု' : 'pcs'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800 dark:text-gray-100">
                        {cat.openingGrams.toFixed(3)} g
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                        {cat.inCount} {language === 'MM' ? 'ခု' : 'pcs'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                        {cat.inGrams.toFixed(3)} g
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-rose-700 dark:text-rose-400">
                        {cat.outCount} {language === 'MM' ? 'ခု' : 'pcs'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-rose-700 dark:text-rose-400">
                        {cat.outGrams.toFixed(3)} g
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-amber-800 dark:text-amber-300">
                        {cat.balanceCount} {language === 'MM' ? 'ခု' : 'pcs'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-amber-800 dark:text-amber-300">
                        {cat.balanceGrams.toFixed(3)} g
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-100/80 dark:bg-amber-950/50 border-t border-amber-200 dark:border-amber-800/40 font-bold">
                    <td className="px-3 py-2.5 text-amber-950 dark:text-amber-100" colSpan={2}>
                      {language === 'MM' ? 'ကာလ စုစုပေါင်း' : 'Period total'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800 dark:text-gray-100">
                      {inventoryDateSummary.totals.openingCount} {language === 'MM' ? 'ခု' : 'pcs'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800 dark:text-gray-100">
                      {inventoryDateSummary.totals.openingGrams.toFixed(3)} g
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {inventoryDateSummary.totals.inCount} {language === 'MM' ? 'ခု' : 'pcs'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {inventoryDateSummary.totals.inGrams.toFixed(3)} g
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-700 dark:text-rose-400">
                      {inventoryDateSummary.totals.outCount} {language === 'MM' ? 'ခု' : 'pcs'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-700 dark:text-rose-400">
                      {inventoryDateSummary.totals.outGrams.toFixed(3)} g
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-800 dark:text-amber-300">
                      {inventoryDateSummary.totals.balanceCount} {language === 'MM' ? 'ခု' : 'pcs'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-800 dark:text-amber-300">
                      {inventoryDateSummary.totals.balanceGrams.toFixed(3)} g
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
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

              {/* Row 2: Item name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ပစ္စည်းအမည် (ဥပမာ- နဂါးလိမ်ဆွဲကြိုး):' : 'Product name:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'MM' ? 'ရွှေဆွဲကြိုး' : 'Gold necklace'}
                  value={formNameMM}
                  onChange={(e) => setFormNameMM(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                />
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

      {/* Barcode Tag Print Preview Modal — 75mm × 15mm via react-to-print */}
      {tagItem && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#D4AF37]/30">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
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

            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="text-[10px] text-gray-500 text-center px-2">
                {language === 'MM'
                  ? 'ပရင့်ထုတ်ရင် အရွယ် 75×15 mm အတိုင်း ပုံမပျက် ထွက်ပါမည် (printer အမျိုးမျိုး OK)'
                  : 'Print keeps a fixed 75×15 mm layout on any printer'}
              </p>
              {/* Preview (screen) — same node is cloned by react-to-print */}
              <div className="w-full flex justify-center overflow-x-auto py-2">
                <InventoryBarcodeTag
                  ref={barcodePrintRef}
                  item={tagItem}
                  kyatToGrams={kyatToGrams}
                  bahtBuyRate={resolveBahtMmkRate(shopSettings)}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setTagItem(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handlePrintBarcodeTag()}
                className="px-4 py-1.5 rounded-lg bg-[#D4AF37] text-white text-xs font-bold hover:bg-[#C5A059] flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'MM' ? 'ကတ်ပြား ပရင့်ထုတ်' : 'Print Tag'}</span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
};
