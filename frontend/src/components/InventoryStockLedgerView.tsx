import React, { useMemo, useState } from 'react';
import { CalendarDays, RotateCcw, BookOpen, Gem, Layers, Filter } from 'lucide-react';
import { useGoldShop } from '../context/GoldShopContext';
import { InventoryItem } from '../types/gold';
import { formatDate, todayISO } from '../utils/dateFormat';
import {
  kpyToGrams,
  KYAT_TO_GRAMS,
  PURITY_LABELS,
  THAI_GRAM_PRESETS,
} from '../utils/goldCalculations';
import { DateInput } from './DateInput';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';

type GoldKindTab = 'MYANMAR' | 'THAI';

const FALLBACK_PRODUCT_CATEGORIES: Record<
  string,
  { mm: string; en: string; sort: number }
> = {
  NECKLACE: { mm: 'ဆွဲကြိုး', en: 'Necklace', sort: 10 },
  RING: { mm: 'လက်စွပ်', en: 'Ring', sort: 20 },
  BRACELET: { mm: 'လက်ကောက်', en: 'Bracelet', sort: 30 },
  EARRING: { mm: 'နားကပ်', en: 'Earring', sort: 40 },
  PENDANT: { mm: 'လော်ကပ်', en: 'Pendant', sort: 50 },
  BANGLE: { mm: 'ဘယက် / ဟန်းချိန်း', en: 'Bangle', sort: 60 },
  GOLD_BAR: { mm: 'ရွှေတုံး / ဒင်္ဂါး', en: 'Gold Bar', sort: 70 },
  ANKLET: { mm: 'ခြေချင်း', en: 'Anklet', sort: 80 },
  OLD_GOLD: { mm: 'ရွှေဟောင်း', en: 'Old Gold', sort: 90 },
  ER: { mm: 'နားကွင်း', en: 'ER', sort: 100 },
  ET: { mm: 'နားတွဲ', en: 'ET', sort: 110 },
  SRI: { mm: 'ကျောက်လက်စွပ်', en: 'SRI', sort: 120 },
  SER: { mm: 'ကျောက်နားကပ်', en: 'SER', sort: 130 },
  MIXER: { mm: 'အမယ်စုံ', en: 'Mix', sort: 140 },
  BROOCH: { mm: 'ရင်ထိုး', en: 'Brooch', sort: 150 },
  SPD: { mm: 'ကျောက်လော်ကပ်', en: 'SPD', sort: 160 },
  CLICK: { mm: 'ကလစ်', en: 'Click', sort: 170 },
  WRISTBAND: { mm: 'ဟမ်းချိန်း', en: 'Wristband', sort: 180 },
  PICHU: { mm: 'ပီချူး', en: 'Pichu', sort: 190 },
};

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

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function eachDayInclusive(from: string, to: string): string[] {
  if (!from || !to || from > to) return from ? [from] : [];
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 62) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
    guard += 1;
  }
  return out;
}

function isThaiInventoryItem(item: InventoryItem): boolean {
  const p = String(item.purity || '').trim().toUpperCase();
  const t = String(item.item_type || '').trim().toUpperCase();
  return (
    t === 'THAI_GOLD' ||
    p === 'THAI_GOLD' ||
    p === 'TH' ||
    p.startsWith('THAI') ||
    p.includes('ထိုင်း')
  );
}

function formatGramLabel(grams: number): string {
  const rounded = Number(grams.toFixed(3));
  return `${rounded} g`;
}

/**
 * Daily stock-on-hand ledger grouped by Product Category:
 * - Separate Nav Links for မြန်မာရွှေ (Myanmar Gold) and ထိုင်းရွှေ (Thai Gold)
 * - မြန်မာရွှေ: grouped by ပစ္စည်းအမျိုးအစား (Category) -> ရွှေရည် (Purity)
 * - ထိုင်းရွှေ: grouped by ပစ္စည်းအမျိုးအစား (Category) -> Gram ချိန် (Gram weight)
 * - Default date range: 7 days (today - 6 days -> today)
 */
export const InventoryStockLedgerView: React.FC = () => {
  const {
    inventory,
    transactions,
    goldsmithJobs,
    masterCategories,
    shopSettings,
    language,
    getGoldOriginLabel,
    isThaiGoldClass,
  } = useGoldShop();

  const myanmarLabel = getGoldOriginLabel('MYANMAR_GOLD');
  const thaiLabel = getGoldOriginLabel('THAI_GOLD');

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;
  const lastDate = todayISO();
  const defaultFromDate = addDaysISO(lastDate, -6);

  const [goldTab, setGoldTab] = useState<GoldKindTab>('MYANMAR');
  const [from, setFrom] = useState<string>(() => defaultFromDate);
  const [to, setTo] = useState<string>(() => lastDate);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPurity, setSelectedPurity] = useState<string>('ALL');
  const [selectedGram, setSelectedGram] = useState<string>('ALL');

  const productCategoryMeta = useMemo(() => {
    const map = new Map<
      string,
      { code: string; mm: string; en: string; sort: number }
    >();
    const seenMm = new Set<string>();

    masterCategories
      .filter((c) => c.category_group === 'PRODUCT')
      .forEach((c, idx) => {
        const code = String(c.code || '').trim().toUpperCase();
        if (!code) return;
        const mm = (c.name_mm || code).trim();
        seenMm.add(mm.toUpperCase());
        map.set(code, {
          code,
          mm,
          en: c.name_en || c.name_mm || code,
          sort: Number(c.sort_order ?? (idx + 1) * 10),
        });
      });

    Object.entries(FALLBACK_PRODUCT_CATEGORIES).forEach(([code, info]) => {
      if (map.has(code) || seenMm.has(info.mm.trim().toUpperCase())) return;
      map.set(code, { code, mm: info.mm, en: info.en, sort: info.sort + 1000 });
    });

    return map;
  }, [masterCategories]);

  const goldClassMeta = useMemo(() => {
    const map = new Map<
      string,
      { code: string; mm: string; en: string; sort: number }
    >();

    Object.entries(PURITY_LABELS).forEach(([code, info], idx) => {
      map.set(code.toUpperCase(), {
        code: code.toUpperCase(),
        mm: info.mm,
        en: info.en,
        sort: (idx + 1) * 10,
      });
    });

    masterCategories
      .filter((c) => c.category_group === 'GOLD_CLASS')
      .forEach((c, idx) => {
        const code = String(c.code || '').trim().toUpperCase();
        if (!code) return;
        map.set(code, {
          code,
          mm: c.name_mm || code,
          en: c.name_en || c.name_mm || code,
          sort: Number(c.sort_order ?? (idx + 1) * 10),
        });
      });

    return map;
  }, [masterCategories]);

  const resolveProductCategory = (
    item: InventoryItem
  ): { code: string; mm: string; en: string; sort: number } => {
    const rawCat = String(item.category || '').trim().toUpperCase();
    if (rawCat && rawCat !== 'THAI_GOLD' && productCategoryMeta.has(rawCat)) {
      return productCategoryMeta.get(rawCat)!;
    }

    // Try matching item category or item name to known product category names
    for (const meta of productCategoryMeta.values()) {
      if (
        (meta.mm && rawCat === meta.mm.trim().toUpperCase()) ||
        (meta.en && rawCat === meta.en.trim().toUpperCase())
      ) {
        return meta;
      }
    }

    const itemName = `${item.name_mm || ''} ${item.name || ''}`.trim();
    if (itemName) {
      for (const meta of productCategoryMeta.values()) {
        if (meta.mm && itemName.includes(meta.mm)) {
          return meta;
        }
      }
    }

    if (rawCat && rawCat !== 'THAI_GOLD') {
      return {
        code: rawCat,
        mm: item.category || rawCat,
        en: item.category || rawCat,
        sort: 5000,
      };
    }

    const fallbackName = (item.name_mm || item.name || '').trim();
    if (fallbackName) {
      return {
        code: `NAME:${fallbackName}`,
        mm: fallbackName,
        en: item.name || fallbackName,
        sort: 6000,
      };
    }

    return {
      code: 'OTHER',
      mm: 'အခြား',
      en: 'Other',
      sort: 9999,
    };
  };

  const resolvePurityInfo = (
    purityRaw?: string | null
  ): { code: string; mm: string; en: string; sort: number } => {
    const code = String(purityRaw || 'OTHER').trim().toUpperCase();
    if (goldClassMeta.has(code)) {
      return goldClassMeta.get(code)!;
    }
    const label = PURITY_LABELS[code as keyof typeof PURITY_LABELS];
    return {
      code,
      mm: label?.mm || code,
      en: label?.en || code,
      sort: 9000,
    };
  };

  const resolveItemGramWeight = (item: InventoryItem): number => {
    const unit = Number(item.thai_weight_unit || 0);
    if (unit > 0) return Number(unit.toFixed(3));
    const g = kpyToGrams(
      {
        kyat: Number(item.net_weight_kyat || item.weight_kyat || 0),
        pae: Number(item.net_weight_pae || item.weight_pae || 0),
        yway: Number(item.net_weight_yway || item.weight_yway || 0),
      },
      kyatToGrams
    );
    return Number(g.toFixed(3));
  };

  const outflowByItemId = useMemo(() => {
    const map = new Map<string, string>();

    const mark = (itemId: string | undefined | null, day: string) => {
      const id = String(itemId || '').trim();
      if (!id || !day) return;
      const prev = map.get(id);
      if (!prev || day < prev) map.set(id, day);
    };

    for (const t of transactions) {
      const type = String(t.transaction_type || '').toUpperCase();
      if (type !== 'SALE' && type !== 'SHOP_OUT' && type !== 'EXCHANGE') continue;
      const day = toDayISO(t.created_at);
      if (!day) continue;
      for (const line of t.items || []) {
        if (
          type === 'EXCHANGE' &&
          String(line.line_role || '').toUpperCase() === 'TRADE_IN'
        ) {
          continue;
        }
        mark(line.item_id, day);
      }
    }

    for (const j of goldsmithJobs) {
      if (!j.inventory_item_id) continue;
      const day = toDayISO(j.sent_at || j.created_at);
      mark(j.inventory_item_id, day);
    }

    return map;
  }, [transactions, goldsmithJobs]);

  const dateCols = useMemo(() => {
    let f = from || defaultFromDate;
    let t = to || lastDate;
    if (f > t) {
      const tmp = f;
      f = t;
      t = tmp;
    }
    return eachDayInclusive(f, t);
  }, [from, to, defaultFromDate, lastDate]);

  type SubRow = {
    subKey: string;
    subLabelMm: string;
    subLabelEn: string;
    subSort: number;
    purityCode: string;
    gramKey: string;
    gramValue: number;
    gramLabel: string;
    outByDay: Record<string, number>;
    inByDay: Record<string, number>;
    qtyByDay: Record<string, number>;
    anyStock: boolean;
  };

  type CategoryGroup = {
    categoryCode: string;
    categoryMm: string;
    categoryEn: string;
    categorySort: number;
    subRows: SubRow[];
    groupOutByDay: Record<string, number>;
    groupInByDay: Record<string, number>;
    groupTotalsByDay: Record<string, number>;
  };

  const buildGroupedLedger = (targetTab: GoldKindTab): CategoryGroup[] => {
    type UnitMeta = {
      id: string;
      created: string;
      outflow: string | null;
      item: InventoryItem;
    };

    const catMap = new Map<
      string,
      {
        meta: { code: string; mm: string; en: string; sort: number };
        subMap: Map<
          string,
          {
            subKey: string;
            subLabelMm: string;
            subLabelEn: string;
            subSort: number;
            purityCode: string;
            gramKey: string;
            gramValue: number;
            gramLabel: string;
            units: UnitMeta[];
          }
        >;
      }
    >();

    for (const item of inventory) {
      const isThai = isThaiGoldClass(item.purity, item.item_type) || isThaiInventoryItem(item);
      if (targetTab === 'THAI' && !isThai) continue;
      if (targetTab === 'MYANMAR' && isThai) continue;

      const created = toDayISO(item.created_at);
      if (!created) continue;

      let outflow = outflowByItemId.get(item.id) || null;
      const status = String(item.status || '').toUpperCase();
      if (
        !outflow &&
        (status === 'SOLD' || status === 'SHOP_OUT' || status === 'WITH_GOLDSMITH')
      ) {
        outflow = created;
      }

      const catMeta = resolveProductCategory(item);
      const groupKey = (catMeta.mm || catMeta.code).trim();
      if (!catMap.has(groupKey)) {
        catMap.set(groupKey, {
          meta: catMeta,
          subMap: new Map(),
        });
      }
      const catEntry = catMap.get(groupKey)!;

      let subKey = '';
      let subLabelMm = '';
      let subLabelEn = '';
      let subSort = 0;
      let purityCode = '';
      let gramKey = '';
      let gramValue = 0;
      let gramLabel = '';

      if (targetTab === 'MYANMAR') {
        const pInfo = resolvePurityInfo(item.purity);
        subKey = pInfo.code;
        subLabelMm = pInfo.mm;
        subLabelEn = pInfo.en;
        subSort = pInfo.sort;
        purityCode = pInfo.code;
      } else {
        const pInfo = resolvePurityInfo(item.purity || 'THAI_GOLD');
        const g = resolveItemGramWeight(item);
        const gKey = g.toFixed(3);
        subKey = `${pInfo.code}:${gKey}`;
        const lbl = formatGramLabel(g);
        subLabelMm = `${pInfo.mm} · ${lbl}`;
        subLabelEn = `${pInfo.en} · ${lbl}`;
        subSort = pInfo.sort * 1000 + g;
        purityCode = pInfo.code;
        gramKey = gKey;
        gramValue = g;
        gramLabel = lbl;
      }

      if (!catEntry.subMap.has(subKey)) {
        catEntry.subMap.set(subKey, {
          subKey,
          subLabelMm,
          subLabelEn,
          subSort,
          purityCode,
          gramKey,
          gramValue,
          gramLabel,
          units: [],
        });
      }
      catEntry.subMap.get(subKey)!.units.push({
        id: item.id,
        created,
        outflow,
        item,
      });
    }

    const groups: CategoryGroup[] = [];

    for (const { meta, subMap } of catMap.values()) {
      const subRows: SubRow[] = [];
      const groupOutByDay: Record<string, number> = {};
      const groupInByDay: Record<string, number> = {};
      const groupTotalsByDay: Record<string, number> = {};
      for (const d of dateCols) {
        groupOutByDay[d] = 0;
        groupInByDay[d] = 0;
        groupTotalsByDay[d] = 0;
      }

      for (const sub of subMap.values()) {
        const outByDay: Record<string, number> = {};
        const inByDay: Record<string, number> = {};
        const qtyByDay: Record<string, number> = {};
        for (const day of dateCols) {
          let outQty = 0;
          let inQty = 0;
          let qty = 0;
          for (const u of sub.units) {
            if (u.created === day) inQty += 1;
            if (u.outflow && u.outflow === day) outQty += 1;
            if (u.created > day) continue;
            if (u.outflow && u.outflow <= day) continue;
            qty += 1;
          }
          outByDay[day] = outQty;
          inByDay[day] = inQty;
          qtyByDay[day] = qty;
        }
        const anyStock = dateCols.some(
          (d) => (qtyByDay[d] || 0) > 0 || (inByDay[d] || 0) > 0 || (outByDay[d] || 0) > 0
        );
        if (anyStock) {
          for (const d of dateCols) {
            groupOutByDay[d] = (groupOutByDay[d] || 0) + (outByDay[d] || 0);
            groupInByDay[d] = (groupInByDay[d] || 0) + (inByDay[d] || 0);
            groupTotalsByDay[d] = (groupTotalsByDay[d] || 0) + (qtyByDay[d] || 0);
          }
          subRows.push({
            subKey: sub.subKey,
            subLabelMm: sub.subLabelMm,
            subLabelEn: sub.subLabelEn,
            subSort: sub.subSort,
            purityCode: sub.purityCode,
            gramKey: sub.gramKey,
            gramValue: sub.gramValue,
            gramLabel: sub.gramLabel,
            outByDay,
            inByDay,
            qtyByDay,
            anyStock,
          });
        }
      }

      subRows.sort(
        (a, b) =>
          a.subSort - b.subSort || a.subLabelMm.localeCompare(b.subLabelMm)
      );

      if (subRows.length > 0) {
        groups.push({
          categoryCode: meta.code,
          categoryMm: meta.mm,
          categoryEn: meta.en,
          categorySort: meta.sort,
          subRows,
          groupOutByDay,
          groupInByDay,
          groupTotalsByDay,
        });
      }
    }

    groups.sort(
      (a, b) =>
        a.categorySort - b.categorySort ||
        a.categoryMm.localeCompare(b.categoryMm)
    );

    return groups;
  };

  const myanmarGroups = useMemo(
    () => buildGroupedLedger('MYANMAR'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inventory, outflowByItemId, dateCols, productCategoryMeta, goldClassMeta, kyatToGrams, isThaiGoldClass]
  );

  const thaiGroups = useMemo(
    () => buildGroupedLedger('THAI'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inventory, outflowByItemId, dateCols, productCategoryMeta, goldClassMeta, kyatToGrams, isThaiGoldClass]
  );

  const rawActiveGroups = goldTab === 'MYANMAR' ? myanmarGroups : thaiGroups;

  const categoryDropdownOptions = useMemo(() => {
    const map = new Map<string, { code: string; mm: string; en: string; sort: number }>();
    const seenMm = new Set<string>();

    rawActiveGroups.forEach((g) => {
      const mmKey = g.categoryMm.trim().toUpperCase();
      seenMm.add(mmKey);
      map.set(g.categoryCode, {
        code: g.categoryCode,
        mm: g.categoryMm,
        en: g.categoryEn,
        sort: g.categorySort,
      });
    });

    masterCategories
      .filter((c) => c.category_group === 'PRODUCT')
      .forEach((c, idx) => {
        const code = String(c.code || '').trim().toUpperCase();
        if (!code || code === 'THAI_GOLD') return;
        const mm = (c.name_mm || code).trim();
        const mmKey = mm.toUpperCase();
        if (map.has(code) || seenMm.has(mmKey)) return;
        seenMm.add(mmKey);
        map.set(code, {
          code,
          mm,
          en: c.name_en || c.name_mm || code,
          sort: Number(c.sort_order ?? (idx + 1) * 10),
        });
      });

    return Array.from(map.values()).sort(
      (a, b) => a.sort - b.sort || a.mm.localeCompare(b.mm)
    );
  }, [masterCategories, rawActiveGroups]);

  const myanmarPurityDropdownOptions = useMemo(() => {
    const map = new Map<string, { code: string; mm: string; en: string; sort: number }>();
    masterCategories
      .filter((c) => c.category_group === 'GOLD_CLASS')
      .forEach((c, idx) => {
        const code = String(c.code || '').trim().toUpperCase();
        if (!code || isThaiGoldClass(code, c.gold_origin)) return;
        map.set(code, {
          code,
          mm: c.name_mm || code,
          en: c.name_en || c.name_mm || code,
          sort: Number(c.sort_order ?? (idx + 1) * 10),
        });
      });
    myanmarGroups.forEach((g) => {
      g.subRows.forEach((sr) => {
        if (sr.purityCode && !map.has(sr.purityCode)) {
          const pInfo = resolvePurityInfo(sr.purityCode);
          map.set(sr.purityCode, pInfo);
        }
      });
    });
    return Array.from(map.values()).sort(
      (a, b) => a.sort - b.sort || a.mm.localeCompare(b.mm)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterCategories, myanmarGroups, isThaiGoldClass, goldClassMeta]);

  const thaiGramDropdownOptions = useMemo(() => {
    const map = new Map<string, { key: string; grams: number; label: string }>();
    for (const preset of THAI_GRAM_PRESETS) {
      const g = Number(preset);
      const key = g.toFixed(3);
      map.set(key, { key, grams: g, label: formatGramLabel(g) });
    }
    thaiGroups.forEach((g) => {
      g.subRows.forEach((sr) => {
        if (sr.gramKey && !map.has(sr.gramKey)) {
          map.set(sr.gramKey, {
            key: sr.gramKey,
            grams: sr.gramValue,
            label: sr.gramLabel || formatGramLabel(sr.gramValue),
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.grams - b.grams);
  }, [thaiGroups]);

  const activeGroups = useMemo((): CategoryGroup[] => {
    const out: CategoryGroup[] = [];
    for (const g of rawActiveGroups) {
      if (selectedCategory !== 'ALL' && g.categoryCode !== selectedCategory) {
        continue;
      }
      const matchingSubs = g.subRows.filter((sr) => {
        if (goldTab === 'MYANMAR') {
          return selectedPurity === 'ALL' || sr.purityCode === selectedPurity;
        }
        return selectedGram === 'ALL' || sr.gramKey === selectedGram;
      });
      if (matchingSubs.length === 0) continue;

      const groupOutByDay: Record<string, number> = {};
      const groupInByDay: Record<string, number> = {};
      const groupTotalsByDay: Record<string, number> = {};
      for (const d of dateCols) {
        let o = 0;
        let i = 0;
        let q = 0;
        for (const sr of matchingSubs) {
          o += sr.outByDay[d] || 0;
          i += sr.inByDay[d] || 0;
          q += sr.qtyByDay[d] || 0;
        }
        groupOutByDay[d] = o;
        groupInByDay[d] = i;
        groupTotalsByDay[d] = q;
      }

      out.push({
        ...g,
        subRows: matchingSubs,
        groupOutByDay,
        groupInByDay,
        groupTotalsByDay,
      });
    }
    return out;
  }, [rawActiveGroups, selectedCategory, selectedPurity, selectedGram, goldTab, dateCols]);

  const grandByDay = useMemo(() => {
    const out: Record<string, number> = {};
    const inn: Record<string, number> = {};
    const totals: Record<string, number> = {};
    for (const d of dateCols) {
      out[d] = 0;
      inn[d] = 0;
      totals[d] = 0;
    }
    for (const g of activeGroups) {
      for (const d of dateCols) {
        out[d] += g.groupOutByDay[d] || 0;
        inn[d] += g.groupInByDay[d] || 0;
        totals[d] += g.groupTotalsByDay[d] || 0;
      }
    }
    return { out, inn, totals };
  }, [activeGroups, dateCols]);

  const totalSubRowCount = useMemo(
    () => activeGroups.reduce((acc, g) => acc + g.subRows.length, 0),
    [activeGroups]
  );

  const exportExcel = () => {
    type ExportRow = {
      idx: number | string;
      categoryName: string;
      subLabel: string;
      outByDay: Record<string, number>;
      inByDay: Record<string, number>;
      qtyByDay: Record<string, number>;
    };

    const exportRows: ExportRow[] = [];
    activeGroups.forEach((g, gIdx) => {
      const catLabel = language === 'MM' ? g.categoryMm : g.categoryEn;
      g.subRows.forEach((sr, sIdx) => {
        exportRows.push({
          idx: sIdx === 0 ? gIdx + 1 : '',
          categoryName: sIdx === 0 ? catLabel : '',
          subLabel: language === 'MM' ? sr.subLabelMm : sr.subLabelEn,
          outByDay: sr.outByDay,
          inByDay: sr.inByDay,
          qtyByDay: sr.qtyByDay,
        });
      });
    });

    const subColTitle =
      goldTab === 'MYANMAR'
        ? language === 'MM'
          ? 'ရွှေရည်'
          : 'Purity'
        : language === 'MM'
          ? 'ရွှေရည် / Gram ချိန်'
          : 'Purity / Gram Weight';

    const tabTitle = goldTab === 'MYANMAR' ? myanmarLabel : thaiLabel;
    const filterParts: string[] = [];
    if (selectedCategory !== 'ALL') {
      const catOpt = categoryDropdownOptions.find((c) => c.code === selectedCategory);
      filterParts.push(
        catOpt ? (language === 'MM' ? catOpt.mm : catOpt.en) : selectedCategory
      );
    }
    if (goldTab === 'MYANMAR' && selectedPurity !== 'ALL') {
      const purOpt = myanmarPurityDropdownOptions.find((p) => p.code === selectedPurity);
      filterParts.push(
        purOpt ? (language === 'MM' ? purOpt.mm : purOpt.en) : selectedPurity
      );
    }
    if (goldTab === 'THAI' && selectedGram !== 'ALL') {
      const gOpt = thaiGramDropdownOptions.find((g) => g.key === selectedGram);
      filterParts.push(gOpt ? gOpt.label : `${Number(selectedGram)} g`);
    }
    const filterSuffix = filterParts.length > 0 ? ` [${filterParts.join(' / ')}]` : '';

    if (exportRows.length > 0) {
      exportRows.push({
        idx: '',
        categoryName: language === 'MM' ? 'စုစုပေါင်း လက်ကျန် (ခု)' : 'Total Stock On Hand (pcs)',
        subLabel: '',
        outByDay: grandByDay.out,
        inByDay: grandByDay.inn,
        qtyByDay: grandByDay.totals,
      });
    }

    exportToExcel({
      sheetName:
        goldTab === 'MYANMAR'
          ? language === 'MM'
            ? `${myanmarLabel} လက်ကျန်`
            : `${myanmarLabel} Ledger`
          : language === 'MM'
            ? `${thaiLabel} လက်ကျန်`
            : `${thaiLabel} Ledger`,
      title:
        language === 'MM'
          ? `နေ့စဉ်လက်ကျန်စာရင်း - ${tabTitle}${filterSuffix} (${formatDate(dateCols[0])} → ${formatDate(dateCols[dateCols.length - 1])})`
          : `Daily Stock Ledger - ${tabTitle}${filterSuffix} (${formatDate(dateCols[0])} → ${formatDate(dateCols[dateCols.length - 1])})`,
      filename: `stock_ledger_${goldTab.toLowerCase()}_${dateCols[0] || lastDate}_${dateCols[dateCols.length - 1] || lastDate}`,
      columns: [
        { header: language === 'MM' ? 'စဉ်' : '#', value: (r) => r.idx, width: 6 },
        {
          header: language === 'MM' ? 'ပစ္စည်းအမျိုးအစား' : 'Category',
          value: (r) => r.categoryName,
          width: 24,
        },
        {
          header: subColTitle,
          value: (r) => r.subLabel,
          width: 16,
        },
        ...dateCols.flatMap((d) => [
          {
            header: `${formatDate(d)} (${language === 'MM' ? 'အလျော့' : 'Out'})`,
            value: (r: ExportRow) => {
              const v = r.outByDay[d] || 0;
              return v > 0 ? v : '-';
            },
            width: 12,
          },
          {
            header: `${formatDate(d)} (${language === 'MM' ? 'အပေါင်း' : 'In'})`,
            value: (r: ExportRow) => {
              const v = r.inByDay[d] || 0;
              return v > 0 ? v : '-';
            },
            width: 12,
          },
          {
            header: `${formatDate(d)} (${language === 'MM' ? 'စုစုပေါင်း' : 'Total'})`,
            value: (r: ExportRow) => {
              const v = r.qtyByDay[d] || 0;
              return v > 0 ? v : '-';
            },
            width: 12,
          },
        ]),
      ],
      rows: exportRows,
    });
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header & Date Range Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-extrabold tracking-wide">
              {language === 'MM' ? 'စာရင်းချုပ်' : 'SUMMARY'}
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-[#D4AF37]" />
              <span>{language === 'MM' ? 'နေ့စဉ်လက်ကျန်စာရင်း' : 'Daily Stock Ledger'}</span>
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {goldTab === 'MYANMAR'
              ? language === 'MM'
                ? `${myanmarLabel} — ပစ္စည်းအမျိုးအစားအလိုက် ရွှေရည်ဖြင့် အုပ်စုခွဲ၍ နေ့စဉ်လက်ကျန်အရေအတွက် ပြသထားပါသည်`
                : `${myanmarLabel} — grouped by Item Category and Purity for each day`
              : language === 'MM'
                ? `${thaiLabel} — ပစ္စည်းအမျိုးအစားအလိုက် ရွှေရည် နှင့် Gram ချိန်ဖြင့် အုပ်စုခွဲ၍ နေ့စဉ်လက်ကျန်အရေအတွက် ပြသထားပါသည်`
                : `${thaiLabel} — grouped by Item Category, Purity and Gram weight for each day`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">
            <span>{language === 'MM' ? 'မှ' : 'From'}</span>
            <DateInput
              value={from}
              onChange={setFrom}
              className="w-36 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">
            <span>{language === 'MM' ? 'ထိ' : 'To'}</span>
            <DateInput
              value={to}
              onChange={setTo}
              className="w-36 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const t = todayISO();
              setFrom(addDaysISO(t, -6));
              setTo(t);
              setSelectedCategory('ALL');
              setSelectedPurity('ALL');
              setSelectedGram('ALL');
            }}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer flex items-center gap-1.5"
            title={language === 'MM' ? '၇ ရက်စာ မူလရက်စွဲ နှင့် Filter များ ပြန်ထားရန်' : 'Reset to default 7 days & filters'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'MM' ? 'Reset' : 'Reset'}</span>
          </button>
          <ExcelExportButton
            language={language}
            onClick={exportExcel}
            disabled={activeGroups.length === 0}
            className="!py-1.5 !rounded-xl"
          />
        </div>
      </div>

      {/* Nav Links: မြန်မာရွှေ | ထိုင်းရွှေ + Dropdown Search Boxes */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#1A1A1A] p-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setGoldTab('MYANMAR');
              setSelectedCategory('ALL');
              setSelectedPurity('ALL');
              setSelectedGram('ALL');
            }}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              goldTab === 'MYANMAR'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-[#FAF8F2] dark:hover:bg-[#222222] hover:text-[#996515]'
            }`}
          >
            <Gem className="w-4 h-4 shrink-0" />
            <span>{myanmarLabel}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                goldTab === 'MYANMAR'
                  ? 'bg-black/25 text-white'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
              }`}
            >
              {goldTab === 'MYANMAR' ? activeGroups.length : myanmarGroups.length}{' '}
              {language === 'MM' ? 'အုပ်စု' : 'groups'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGoldTab('THAI');
              setSelectedCategory('ALL');
              setSelectedPurity('ALL');
              setSelectedGram('ALL');
            }}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              goldTab === 'THAI'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-blue-50/60 dark:hover:bg-[#222222] hover:text-blue-600'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>{thaiLabel}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                goldTab === 'THAI'
                  ? 'bg-black/25 text-white'
                  : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
              }`}
            >
              {goldTab === 'THAI' ? activeGroups.length : thaiGroups.length}{' '}
              {language === 'MM' ? 'အုပ်စု' : 'groups'}
            </span>
          </button>
        </div>

        {/* 2 Dropdown Search Boxes:
            - မြန်မာရွှေ: ပစ္စည်းအမျိုးအစား + ရွှေရည်
            - ထိုင်းရွှေ: ပစ္စည်းအမျိုးအစား + ဂရမ်ချိန် */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 px-1">
            <Filter className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span>{language === 'MM' ? 'ရှာဖွေရန်:' : 'Filter:'}</span>
          </div>

          {/* Dropdown 1: ပစ္စည်းအမျိုးအစား */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label={language === 'MM' ? 'ပစ္စည်းအမျိုးအစား ရွေးချယ်ရန်' : 'Select Item Category'}
            className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-xs font-bold text-gray-800 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37]/40 cursor-pointer"
          >
            <option value="ALL">
              {language === 'MM' ? 'ပစ္စည်းအမျိုးအစား အားလုံး' : 'All Item Categories'}
            </option>
            {categoryDropdownOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {language === 'MM' ? c.mm : c.en}
              </option>
            ))}
          </select>

          {/* Dropdown 2: မြန်မာရွှေ -> ရွှေရည် | ထိုင်းရွှေ -> ဂရမ်ချိန် */}
          {goldTab === 'MYANMAR' ? (
            <select
              value={selectedPurity}
              onChange={(e) => setSelectedPurity(e.target.value)}
              aria-label={language === 'MM' ? 'ရွှေရည် ရွေးချယ်ရန်' : 'Select Purity'}
              className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-xs font-bold text-gray-800 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37]/40 cursor-pointer"
            >
              <option value="ALL">
                {language === 'MM' ? 'ရွှေရည် အားလုံး' : 'All Purities'}
              </option>
              {myanmarPurityDropdownOptions.map((p) => (
                <option key={p.code} value={p.code}>
                  {language === 'MM' ? p.mm : p.en}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedGram}
              onChange={(e) => setSelectedGram(e.target.value)}
              aria-label={language === 'MM' ? 'ဂရမ်ချိန် ရွေးချယ်ရန်' : 'Select Gram Weight'}
              className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-xs font-bold text-gray-800 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
            >
              <option value="ALL">
                {language === 'MM' ? 'ဂရမ်ချိန် အားလုံး' : 'All Gram Weights'}
              </option>
              {thaiGramDropdownOptions.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Grouped Stock Ledger Table */}
      <div className="rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-[11px] bg-amber-50/80 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span className="font-bold text-gray-900 dark:text-amber-100">
              {goldTab === 'MYANMAR'
                ? language === 'MM'
                  ? `${myanmarLabel} — ပစ္စည်းအမျိုးအစား နှင့် ရွှေရည်အလိုက် လက်ကျန်ဇယား`
                  : `${myanmarLabel} — Stock by Category & Purity`
                : language === 'MM'
                  ? `${thaiLabel} — ပစ္စည်းအမျိုးအစား၊ ရွှေရည် နှင့် Gram ချိန်အလိုက် လက်ကျန်ဇယား`
                  : `${thaiLabel} — Stock by Category, Purity & Gram Weight`}
            </span>
            <span className="font-mono text-amber-700/70 dark:text-amber-300/70">
              ({formatDate(dateCols[0])}
              {dateCols.length > 1 ? ` → ${formatDate(dateCols[dateCols.length - 1])}` : ''})
            </span>
          </div>
          <div className="font-mono text-gray-600 dark:text-gray-300">
            {activeGroups.length} {language === 'MM' ? 'အုပ်စု' : 'categories'} ·{' '}
            {totalSubRowCount}{' '}
            {goldTab === 'MYANMAR'
              ? language === 'MM'
                ? 'ရွှေရည်တန်း'
                : 'purity rows'
              : language === 'MM'
                ? 'Gram တန်း'
                : 'gram rows'}{' '}
            · {dateCols.length} {language === 'MM' ? 'ရက်' : 'days'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="ledger-table w-full text-[11px] text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#121212] text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-700">
                <th
                  rowSpan={2}
                  className="px-3 py-2.5 font-bold w-12 min-w-[48px] max-w-[48px] text-center sticky left-0 bg-gray-50 dark:bg-[#121212] z-20 align-middle"
                >
                  {language === 'MM' ? 'စဉ်' : '#'}
                </th>
                <th
                  rowSpan={2}
                  className="px-3.5 py-2.5 font-bold w-[160px] min-w-[160px] max-w-[160px] sticky left-[48px] bg-gray-50 dark:bg-[#121212] z-20 align-middle"
                >
                  {language === 'MM' ? 'ပစ္စည်းအမျိုးအစား' : 'Item Category'}
                </th>
                <th
                  rowSpan={2}
                  className="px-3.5 py-2.5 font-bold w-[135px] min-w-[135px] max-w-[135px] sticky left-[208px] bg-gray-50 dark:bg-[#121212] z-20 align-middle date-sep-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]"
                >
                  {goldTab === 'MYANMAR'
                    ? language === 'MM'
                      ? 'ရွှေရည်'
                      : 'Purity'
                    : language === 'MM'
                      ? 'ရွှေရည် / Gram ချိန်'
                      : 'Purity / Gram Weight'}
                </th>
                {dateCols.map((d) => (
                  <th
                    key={d}
                    colSpan={3}
                    className="px-3 py-2 font-bold text-center font-mono whitespace-nowrap date-sep-l date-sep-r"
                  >
                    {formatDate(d)}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50/90 dark:bg-[#141414] text-[10px] border-b border-gray-300 dark:border-gray-700">
                {dateCols.map((d) => (
                  <React.Fragment key={`${d}-sub`}>
                    <th className="px-2 py-1.5 font-bold text-center whitespace-nowrap text-rose-600 dark:text-rose-400 min-w-[46px] date-sep-l">
                      {language === 'MM' ? 'အလျော့' : 'Out'}
                    </th>
                    <th className="px-2 py-1.5 font-bold text-center whitespace-nowrap text-blue-600 dark:text-blue-400 min-w-[46px]">
                      {language === 'MM' ? 'အပေါင်း' : 'In'}
                    </th>
                    <th className="px-2 py-1.5 font-bold text-center whitespace-nowrap text-gray-900 dark:text-white bg-white/80 dark:bg-white/10 min-w-[52px] date-sep-r">
                      {language === 'MM' ? 'စုစုပေါင်း' : 'Total'}
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + dateCols.length * 3}
                    className="px-3 py-10 text-center text-gray-400 dark:text-gray-500"
                  >
                    {language === 'MM'
                      ? 'ရွေးချယ်ရက်အတွက် လက်ကျန် မရှိပါ'
                      : 'No stock on hand for the selected dates'}
                  </td>
                </tr>
              ) : (
                activeGroups.map((group, gIdx) => {
                  const catName =
                    language === 'MM' ? group.categoryMm : group.categoryEn;
                  const rowSpanCount = group.subRows.length;

                  return (
                    <React.Fragment key={group.categoryCode}>
                      {group.subRows.map((sr, sIdx) => {
                        const isLastInGroup = sIdx === group.subRows.length - 1;
                        return (
                          <tr
                            key={`${group.categoryCode}-${sr.subKey}`}
                            className={`hover:bg-amber-50/40 dark:hover:bg-amber-950/10 ${
                              isLastInGroup
                                ? 'border-b border-gray-300 dark:border-gray-700'
                                : 'border-b border-gray-200/80 dark:border-gray-800'
                            }`}
                          >
                            {sIdx === 0 && (
                              <td
                                rowSpan={rowSpanCount}
                                className="px-3 py-2.5 w-12 min-w-[48px] max-w-[48px] text-center font-mono font-bold text-amber-700 dark:text-amber-400 align-top sticky left-0 bg-[#FAF8F2] dark:bg-[#181612] z-10"
                              >
                                {gIdx + 1}
                              </td>
                            )}
                            {sIdx === 0 && (
                              <td
                                rowSpan={rowSpanCount}
                                className="px-3.5 py-2.5 w-[160px] min-w-[160px] max-w-[160px] font-bold text-gray-900 dark:text-gray-100 align-top sticky left-[48px] bg-[#FAF8F2] dark:bg-[#181612] z-10"
                              >
                                {catName}
                              </td>
                            )}
                            <td className="px-3.5 py-2 w-[135px] min-w-[135px] max-w-[135px] font-semibold sticky left-[208px] bg-[#FAF8F2] dark:bg-[#181612] z-10 date-sep-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono whitespace-nowrap ${
                                  goldTab === 'MYANMAR'
                                    ? 'bg-[#D4AF37]/15 text-[#996515] dark:text-[#FFD700] border border-[#D4AF37]/30'
                                    : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {language === 'MM' ? sr.subLabelMm : sr.subLabelEn}
                              </span>
                            </td>
                            {dateCols.map((d) => {
                              const outQty = sr.outByDay[d] || 0;
                              const inQty = sr.inByDay[d] || 0;
                              const q = sr.qtyByDay[d] || 0;
                              return (
                                <React.Fragment key={d}>
                                  <td
                                    className={`px-2 py-2 text-center font-mono date-sep-l ${
                                      outQty > 0
                                        ? 'font-bold text-rose-600 dark:text-rose-400'
                                        : 'text-gray-400 dark:text-gray-600'
                                    }`}
                                  >
                                    {outQty > 0 ? outQty : '-'}
                                  </td>
                                  <td
                                    className={`px-2 py-2 text-center font-mono ${
                                      inQty > 0
                                        ? 'font-bold text-blue-600 dark:text-blue-400'
                                        : 'text-gray-400 dark:text-gray-600'
                                    }`}
                                  >
                                    {inQty > 0 ? inQty : '-'}
                                  </td>
                                  <td
                                    className={`px-2 py-2 text-center font-mono date-sep-r ${
                                      q > 0
                                        ? 'font-bold text-gray-900 dark:text-white bg-white/80 dark:bg-white/10'
                                        : 'text-gray-400 dark:text-gray-600'
                                    }`}
                                  >
                                    {q > 0 ? q : '-'}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {activeGroups.length > 0 && (
              <tfoot>
                <tr className="bg-amber-100/80 dark:bg-amber-950/50 border-t-2 border-amber-300 dark:border-amber-700 font-bold">
                  <td
                    colSpan={3}
                    className="px-3.5 py-2.5 text-amber-950 dark:text-amber-100 sticky left-0 bg-amber-100 dark:bg-[#241c0c] z-20 date-sep-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]"
                  >
                    {language === 'MM' ? 'စုစုပေါင်း လက်ကျန် (ခု)' : 'Total Stock On Hand (pcs)'}
                  </td>
                  {dateCols.map((d) => {
                    const outTotal = grandByDay.out[d] || 0;
                    const inTotal = grandByDay.inn[d] || 0;
                    const total = grandByDay.totals[d] || 0;
                    return (
                      <React.Fragment key={d}>
                        <td
                          className={`px-2 py-2.5 text-center font-mono date-sep-l ${
                            outTotal > 0
                              ? 'font-extrabold text-rose-600 dark:text-rose-400'
                              : 'text-amber-900/50 dark:text-amber-200/40'
                          }`}
                        >
                          {outTotal > 0 ? outTotal : '-'}
                        </td>
                        <td
                          className={`px-2 py-2.5 text-center font-mono ${
                            inTotal > 0
                              ? 'font-extrabold text-blue-600 dark:text-blue-400'
                              : 'text-amber-900/50 dark:text-amber-200/40'
                          }`}
                        >
                          {inTotal > 0 ? inTotal : '-'}
                        </td>
                        <td
                          className={`px-2 py-2.5 text-center font-mono date-sep-r ${
                            total > 0
                              ? 'font-extrabold text-gray-900 dark:text-white bg-white/80 dark:bg-white/10'
                              : 'text-amber-900/50 dark:text-amber-200/40'
                          }`}
                        >
                          {total > 0 ? total : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
