import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import { WeightKPY, GoldsmithJob } from '../types/gold';
import {
  formatMMK,
  formatKPYMyanmar,
  kpyToGrams,
  kpyToYway,
  ywayToKpy,
  gramsToKpy,
  KYAT_TO_GRAMS,
  PURITY_LABELS,
  getOldGoldCategory,
  OLD_GOLD_CATEGORY_CONFIG,
  OldGoldCategoryKey,
} from '../utils/goldCalculations';
import { formatDate, todayISO } from '../utils/dateFormat';
import { exportToExcel } from '../utils/excelExport';
import type { ActiveTab } from './Navigation';
import {
  PackageOpen,
  Hammer,
  X,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Scale,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Undo2,
  Trash2,
  Store,
  Flame,
  Filter,
  FileSpreadsheet,
  List,
  PackageMinus,
  CalendarDays,
} from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import { NumberInput } from './NumberInput';
import { DateInput } from './DateInput';

type FlowTab = 'INFLOW' | 'OUTFLOW';
type CategoryFilter = 'ALL' | OldGoldCategoryKey;

type InflowSource = 'PURCHASE' | 'SHOP_OUT' | 'PAWN_CONFISCATED' | 'OTHER_IN' | 'EXCHANGE';

type OldGoldInflowRow = {
  key: string;
  source: InflowSource;
  sourceLabelMm: string;
  sourceLabelEn: string;
  invoice_no: string;
  created_at: string;
  customer_name: string;
  item_name: string;
  category_label: string;
  purity: string;
  goldCategory: OldGoldCategoryKey;
  weight: WeightKPY;
  net_grams: number;
};

type OutflowType =
  | 'MERCHANT_RETURN'
  | 'SHOP_TRANSFER'
  | 'MELT'
  | 'GOLDSMITH_MELT'
  | 'OTHER_OUTFLOW';

type OldGoldOutflowRow = {
  key: string;
  id?: string;
  outflowType: OutflowType;
  typeLabelMm: string;
  typeLabelEn: string;
  job_no: string;
  created_at: string;
  destination: string;
  description?: string;
  category: OldGoldCategoryKey;
  grams: number;
  weight?: WeightKPY;
  craft_fee?: number;
  received_amount?: number;
  return_due_date?: string;
  status?: GoldsmithJob['status'];
  notes?: string;
  /** Linked custom order when ပန်းထိမ်အပ် is for an order */
  order_no?: string;
};

const CATEGORY_KEYS: OldGoldCategoryKey[] = ['THAI_GOLD', 'PAE_16', 'PAE_15', 'PAE_14'];

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

interface OldGoldViewProps {
  section?: 'summary' | 'outflows';
  onNavigate?: (tab: ActiveTab) => void;
}

export const OldGoldView: React.FC<OldGoldViewProps> = ({
  section = 'summary',
  onNavigate,
}) => {
  const dialog = useDialog();
  const {
    transactions,
    pawnRecords,
    language,
    shopSettings,
    masterCategories,
    goldsmithJobs,
    merchantReturns,
    shopTransfers,
    melts,
    otherOutflows,
    createGoldsmithJob,
    addMerchantReturn,
    deleteMerchantReturn,
    addShopTransfer,
    deleteShopTransfer,
    addMelt,
    deleteMelt,
    addOtherOutflow,
    deleteOtherOutflow,
    customers,
    can,
  } = useGoldShop();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  // Main navigation tab: Inflow (အဝင်) vs Outflow (အထွက်)
  const [flowTab, setFlowTab] = useState<FlowTab>('INFLOW');

  // Category filter: defaults to ALL so all gold categories are shown together
  const [catFilter, setCatFilter] = useState<CategoryFilter>('ALL');

  // Outflow type filter: MERCHANT_RETURN | SHOP_TRANSFER | MELT | GOLDSMITH_MELT
  const [outflowTypeFilter, setOutflowTypeFilter] = useState<OutflowType>('MERCHANT_RETURN');

  // Search keyword
  const [searchTerm, setSearchTerm] = useState('');

  // Summary date filter (default: today)
  const [summaryDate, setSummaryDate] = useState(() => todayISO());

  // Merchant Return (ကုန်သည်ပြန်ပေး) modal state
  const [mrOpen, setMrOpen] = useState(false);
  const [mrMerchantName, setMrMerchantName] = useState('');
  const [mrMerchantPhone, setMrMerchantPhone] = useState('');
  const [mrDescription, setMrDescription] = useState('');
  const [mrReturnDate, setMrReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mrCategory, setMrCategory] = useState<OldGoldCategoryKey>('PAE_16');
  const [mrGramsInput, setMrGramsInput] = useState('');
  const [mrNotes, setMrNotes] = useState('');
  const [mrSaving, setMrSaving] = useState(false);
  const [mrErr, setMrErr] = useState('');

  // Shop Transfer (ဆိုင်သွင်း) modal state
  const [stOpen, setStOpen] = useState(false);
  const [stCategory, setStCategory] = useState<OldGoldCategoryKey>('PAE_16');
  const [stItemName, setStItemName] = useState('');
  const [stDescription, setStDescription] = useState('');
  const [stGramsInput, setStGramsInput] = useState('');
  const [stTransferDate, setStTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [stNotes, setStNotes] = useState('');
  const [stSaving, setStSaving] = useState(false);
  const [stErr, setStErr] = useState('');

  // Melt (အရည်ကျို) modal state
  const [meltOpen, setMeltOpen] = useState(false);
  const [meltName, setMeltName] = useState('');
  const [meltDescription, setMeltDescription] = useState('');
  const [meltDate, setMeltDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meltCategory, setMeltCategory] = useState<OldGoldCategoryKey>('PAE_16');
  const [meltGramsInput, setMeltGramsInput] = useState('');
  const [meltCraftFee, setMeltCraftFee] = useState(0);
  const [meltNotes, setMeltNotes] = useState('');
  const [meltSaving, setMeltSaving] = useState(false);
  const [meltErr, setMeltErr] = useState('');

  // Other outflow (အခြားအထွက်) modal state
  const [ooOpen, setOoOpen] = useState(false);
  const [ooName, setOoName] = useState('');
  const [ooDescription, setOoDescription] = useState('');
  const [ooDate, setOoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ooCategory, setOoCategory] = useState<OldGoldCategoryKey>('PAE_16');
  const [ooGramsInput, setOoGramsInput] = useState('');
  const [ooReceivedAmount, setOoReceivedAmount] = useState(0);
  const [ooNotes, setOoNotes] = useState('');
  const [ooSaving, setOoSaving] = useState(false);
  const [ooErr, setOoErr] = useState('');

  // Goldsmith job (Melt / Outflow) modal state
  const [gsOpen, setGsOpen] = useState(false);
  const [gsCategory, setGsCategory] = useState<OldGoldCategoryKey>('PAE_16');
  const [gsGrams, setGsGrams] = useState(0);
  const [gsCraftFee, setGsCraftFee] = useState(0);
  const [gsReturnDue, setGsReturnDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [gsName, setGsName] = useState('');
  const [gsSaving, setGsSaving] = useState(false);
  const [gsErr, setGsErr] = useState('');

  const switchFlowTab = (tab: FlowTab) => {
    setFlowTab(tab);
    setCatFilter('ALL');
    setOutflowTypeFilter('MERCHANT_RETURN');
  };

  const categoryLabel = (code: string) => {
    const found = masterCategories.find(
      (c) => c.code === code || c.code?.toUpperCase() === code.toUpperCase()
    );
    if (found) return language === 'MM' ? found.name_mm : found.name_en || found.name_mm;
    if (code === 'OLD_GOLD')
      return language === 'MM' ? 'အဟောင်းရွှေ' : 'Old gold';
    return code;
  };

  // Build Inflow Rows from:
  // 1. Transactions (PURCHASE, SHOP_OUT & OTHER_IN)
  // 2. Confiscated Pawns (CONFISCATED)
  const inflowRows = useMemo(() => {
    const list: OldGoldInflowRow[] = [];

    // 1. Customer Purchases, Shop-Out items and Other Gold Inflows
    for (const t of transactions) {
      if (
        t.transaction_type !== 'PURCHASE' &&
        t.transaction_type !== 'SHOP_OUT' &&
        t.transaction_type !== 'OTHER_IN' &&
        t.transaction_type !== 'EXCHANGE'
      )
        continue;
      for (const item of t.items) {
        if (t.transaction_type === 'EXCHANGE' && item.line_role !== 'TRADE_IN') {
          continue; // only trade-in old gold is inflow
        }
        const catKey = getOldGoldCategory(item.purity, item.item_type);
        const unit = Number(item.thai_weight_unit || 0);
        const grams =
          (catKey === 'THAI_GOLD' || t.transaction_type === 'OTHER_IN') && unit > 0
            ? unit
            : kpyToGrams(item.net_weight || { kyat: 0, pae: 0, yway: 0 }, kyatToGrams);

        list.push({
          key: `txn-${t.id}-${item.id}`,
          source: t.transaction_type as InflowSource,
          sourceLabelMm:
            t.transaction_type === 'PURCHASE'
              ? 'အဝယ်'
              : t.transaction_type === 'OTHER_IN'
                ? 'အခြားရွှေအဝင်'
                : t.transaction_type === 'EXCHANGE'
                  ? 'အလဲအလှယ်'
                  : 'ဆိုင်ထုတ်',
          sourceLabelEn:
            t.transaction_type === 'PURCHASE'
              ? 'Purchase'
              : t.transaction_type === 'OTHER_IN'
                ? 'Other Inflow'
                : t.transaction_type === 'EXCHANGE'
                  ? 'Exchange Trade-in'
                  : 'Shop Out',
          invoice_no: t.invoice_no,
          created_at: t.created_at,
          customer_name: t.customer_name || '—',
          item_name: item.item_name || '—',
          category_label: categoryLabel(String(item.category || '')),
          purity: item.purity,
          goldCategory: catKey,
          weight: item.net_weight || { kyat: 0, pae: 0, yway: 0 },
          net_grams: Number(grams.toFixed(3)),
        });
      }
    }

    // 2. Confiscated Pawns (ပေါင်ရှုံး)
    for (const p of pawnRecords) {
      if (p.status !== 'CONFISCATED') continue;
      const catKey = getOldGoldCategory(p.purity, p.item_type || p.gold_kind);
      const unit = Number(p.weight_grams || 0);
      const calculated = kpyToGrams(p.weight || { kyat: 0, pae: 0, yway: 0 }, kyatToGrams);
      const grams = catKey === 'THAI_GOLD' && unit > 0 ? unit : calculated > 0 ? calculated : unit;

      list.push({
        key: `pawn-${p.id}`,
        source: 'PAWN_CONFISCATED',
        sourceLabelMm: 'ပေါင်ရှုံး',
        sourceLabelEn: 'Pawn Forfeit',
        invoice_no: p.vno || p.pawn_ticket_no,
        created_at: p.due_date || p.start_date,
        customer_name: p.customer_name || '—',
        item_name: p.item_name || '—',
        category_label: p.item_type ? categoryLabel(p.item_type) : language === 'MM' ? 'ပေါင်နှံပစ္စည်း' : 'Pawn Item',
        purity: p.purity,
        goldCategory: catKey,
        weight: p.weight || { kyat: 0, pae: 0, yway: 0 },
        net_grams: Number(grams.toFixed(3)),
      });
    }

    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [transactions, pawnRecords, kyatToGrams, masterCategories, language]);

  // Build Outflow Rows from:
  // 1. Merchant Returns (ကုန်သည်ပြန်ပေး)
  // 2. Goldsmith jobs (OLD_GOLD melts + ORDER jobs that consume old-gold grams)
  const outflowRows = useMemo(() => {
    const list: OldGoldOutflowRow[] = [];

    // 1. Merchant Returns
    for (const mr of merchantReturns) {
      list.push({
        key: `mr-${mr.id}`,
        id: mr.id,
        outflowType: 'MERCHANT_RETURN',
        typeLabelMm: 'ကုန်သည်ပြန်ပေး',
        typeLabelEn: 'Merchant Return',
        job_no: mr.return_no,
        created_at: mr.return_date,
        destination: mr.merchant_name,
        description: mr.description,
        category: mr.gold_category,
        grams: Number(Number(mr.grams || 0).toFixed(3)),
        weight: mr.weight,
        notes: mr.notes,
      });
    }

    // 2. Shop Transfers (ဆိုင်သွင်း)
    for (const st of shopTransfers) {
      list.push({
        key: `st-${st.id}`,
        id: st.id,
        outflowType: 'SHOP_TRANSFER',
        typeLabelMm: 'ဆိုင်သွင်း',
        typeLabelEn: 'Shop Transfer',
        job_no: st.transfer_no,
        created_at: st.transfer_date,
        destination: st.item_name,
        description: st.description,
        category: st.gold_category,
        grams: Number(Number(st.grams || 0).toFixed(3)),
        weight: st.weight,
        notes: st.notes,
      });
    }

    // 3. Gold Melts (အရည်ကျို)
    for (const m of melts) {
      list.push({
        key: `melt-${m.id}`,
        id: m.id,
        outflowType: 'MELT',
        typeLabelMm: 'အရည်ကျို',
        typeLabelEn: 'Gold Melt',
        job_no: m.melt_no,
        created_at: m.melt_date,
        destination: m.name,
        description: m.description,
        category: m.gold_category,
        grams: Number(Number(m.grams || 0).toFixed(3)),
        weight: m.weight,
        craft_fee: Number(m.craft_fee || 0),
        notes: m.notes,
      });
    }

    // 4. Other outflows (အခြားအထွက်)
    for (const o of otherOutflows) {
      list.push({
        key: `oo-${o.id}`,
        id: o.id,
        outflowType: 'OTHER_OUTFLOW',
        typeLabelMm: 'အခြားအထွက်',
        typeLabelEn: 'Other Outflow',
        job_no: o.outflow_no,
        created_at: o.outflow_date,
        destination: o.name,
        description: o.description,
        category: o.gold_category,
        grams: Number(Number(o.grams || 0).toFixed(3)),
        weight: o.weight,
        received_amount: Number(o.received_amount || 0),
        notes: o.notes,
      });
    }

    // 5. Goldsmith jobs consuming old-gold pool
    for (const j of goldsmithJobs) {
      const isOldGoldMelt = j.source_type === 'OLD_GOLD';
      const isOrderFromPool =
        j.source_type === 'ORDER' && Number(j.source_grams || 0) > 0;
      if (!isOldGoldMelt && !isOrderFromPool) continue;
      const catKey = getOldGoldCategory(
        j.source_purity || j.purity,
        j.source_category || j.item_type
      );
      const orderRef = j.order_no ? String(j.order_no) : '';
      list.push({
        key: `gs-${j.id}`,
        id: j.id,
        outflowType: 'GOLDSMITH_MELT',
        typeLabelMm: isOrderFromPool ? 'ပန်းထိမ်အပ် (Order)' : 'ပန်းထိမ်အပ်',
        typeLabelEn: isOrderFromPool ? 'Goldsmith (Order)' : 'Goldsmith Melt',
        job_no: j.job_no,
        created_at: j.sent_at || j.created_at,
        destination:
          orderRef ||
          j.item_name ||
          (language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Goldsmith'),
        description: orderRef
          ? j.item_name || j.customer_name || ''
          : j.item_name || (language === 'MM' ? 'ပန်းထိမ်အပ် အရည်ကျို' : 'Goldsmith melt'),
        category: catKey,
        grams: Number(Number(j.source_grams || 0).toFixed(3)),
        craft_fee: Number(j.craft_fee || 0),
        return_due_date: j.return_due_date ? String(j.return_due_date).slice(0, 10) : '',
        status: j.status,
        order_no: orderRef || undefined,
      });
    }

    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [merchantReturns, shopTransfers, melts, otherOutflows, goldsmithJobs, language]);

  // Category-wise stats calculations (Inflow, Outflow, Balance)
  const categoryStats = useMemo(() => {
    const stats: Record<
      OldGoldCategoryKey,
      {
        inflowCount: number;
        inflowGrams: number;
        inflowKpy: WeightKPY;
        outflowCount: number;
        outflowGrams: number;
        balanceGrams: number;
      }
    > = {
      THAI_GOLD: {
        inflowCount: 0,
        inflowGrams: 0,
        inflowKpy: { kyat: 0, pae: 0, yway: 0 },
        outflowCount: 0,
        outflowGrams: 0,
        balanceGrams: 0,
      },
      PAE_16: {
        inflowCount: 0,
        inflowGrams: 0,
        inflowKpy: { kyat: 0, pae: 0, yway: 0 },
        outflowCount: 0,
        outflowGrams: 0,
        balanceGrams: 0,
      },
      PAE_15: {
        inflowCount: 0,
        inflowGrams: 0,
        inflowKpy: { kyat: 0, pae: 0, yway: 0 },
        outflowCount: 0,
        outflowGrams: 0,
        balanceGrams: 0,
      },
      PAE_14: {
        inflowCount: 0,
        inflowGrams: 0,
        inflowKpy: { kyat: 0, pae: 0, yway: 0 },
        outflowCount: 0,
        outflowGrams: 0,
        balanceGrams: 0,
      },
    };

    // Calculate Inflows
    for (const r of inflowRows) {
      const s = stats[r.goldCategory];
      s.inflowCount += 1;
      s.inflowGrams += r.net_grams;
    }

    // Convert total Myanmar inflows to KPY
    for (const key of ['PAE_16', 'PAE_15', 'PAE_14'] as OldGoldCategoryKey[]) {
      const rowsForCat = inflowRows.filter((r) => r.goldCategory === key);
      const totalYway = rowsForCat.reduce(
        (acc, r) => acc + kpyToYway(r.weight.kyat || 0, r.weight.pae || 0, r.weight.yway || 0),
        0
      );
      stats[key].inflowKpy = ywayToKpy(totalYway);
    }

    // Calculate Outflows
    for (const r of outflowRows) {
      const s = stats[r.category];
      s.outflowCount += 1;
      s.outflowGrams += r.grams;
    }

    // Calculate Balances
    for (const key of CATEGORY_KEYS) {
      const s = stats[key];
      s.inflowGrams = Number(s.inflowGrams.toFixed(3));
      s.outflowGrams = Number(s.outflowGrams.toFixed(3));
      s.balanceGrams = Number(Math.max(0, s.inflowGrams - s.outflowGrams).toFixed(3));
    }

    return stats;
  }, [inflowRows, outflowRows]);

  // Overall totals across all 4 categories
  const overallTotals = useMemo(() => {
    let inG = 0;
    let outG = 0;
    let inCount = inflowRows.length;
    let outCount = outflowRows.length;

    for (const key of CATEGORY_KEYS) {
      inG += categoryStats[key].inflowGrams;
      outG += categoryStats[key].outflowGrams;
    }

    return {
      inflowCount: inCount,
      inflowGrams: Number(inG.toFixed(3)),
      outflowCount: outCount,
      outflowGrams: Number(outG.toFixed(3)),
      balanceGrams: Number(Math.max(0, inG - outG).toFixed(3)),
    };
  }, [inflowRows, outflowRows, categoryStats]);

  /**
   * Per-category daily summary for selected date:
   * - shopStock (ဆိုင်ရှိအဟောင်းထည်): opening = inflows before date − outflows before date
   * - dayIn (ယနေ့အဟောင်းအဝင်): inflows on selected date
   * - dayOut (ယနေ့အဟောင်းအထွက်): outflows on selected date
   * - balance (စုစုပေါင်းလက်ကျန်): shopStock + dayIn − dayOut
   */
  const dateCategorySummary = useMemo(() => {
    const day = summaryDate || todayISO();
    const rows = CATEGORY_KEYS.map((key) => {
      const cfg = OLD_GOLD_CATEGORY_CONFIG[key];
      let beforeIn = 0;
      let beforeOut = 0;
      let dayIn = 0;
      let dayInCount = 0;
      let dayOut = 0;
      let dayOutCount = 0;

      for (const r of inflowRows) {
        if (r.goldCategory !== key) continue;
        const d = toDayISO(r.created_at);
        if (!d) continue;
        if (d < day) beforeIn += r.net_grams;
        else if (d === day) {
          dayIn += r.net_grams;
          dayInCount += 1;
        }
      }

      for (const r of outflowRows) {
        if (r.category !== key) continue;
        const d = toDayISO(r.created_at);
        if (!d) continue;
        if (d < day) beforeOut += r.grams;
        else if (d === day) {
          dayOut += r.grams;
          dayOutCount += 1;
        }
      }

      const shopStock = Number(Math.max(0, beforeIn - beforeOut).toFixed(3));
      dayIn = Number(dayIn.toFixed(3));
      dayOut = Number(dayOut.toFixed(3));
      const balance = Number(Math.max(0, shopStock + dayIn - dayOut).toFixed(3));

      return {
        key,
        nameMm: cfg.nameMm,
        nameEn: cfg.nameEn,
        badgeClass: cfg.badgeClass,
        shopStock,
        dayIn,
        dayInCount,
        dayOut,
        dayOutCount,
        balance,
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.shopStock += r.shopStock;
        acc.dayIn += r.dayIn;
        acc.dayInCount += r.dayInCount;
        acc.dayOut += r.dayOut;
        acc.dayOutCount += r.dayOutCount;
        acc.balance += r.balance;
        return acc;
      },
      { shopStock: 0, dayIn: 0, dayInCount: 0, dayOut: 0, dayOutCount: 0, balance: 0 }
    );

    return {
      day,
      rows,
      totals: {
        shopStock: Number(totals.shopStock.toFixed(3)),
        dayIn: Number(totals.dayIn.toFixed(3)),
        dayInCount: totals.dayInCount,
        dayOut: Number(totals.dayOut.toFixed(3)),
        dayOutCount: totals.dayOutCount,
        balance: Number(totals.balance.toFixed(3)),
      },
    };
  }, [inflowRows, outflowRows, summaryDate]);

  // Filtered rows for current view
  const filteredInflows = useMemo(() => {
    return inflowRows.filter((r) => {
      if (catFilter !== 'ALL' && r.goldCategory !== catFilter) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.invoice_no.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.item_name.toLowerCase().includes(q) ||
        r.purity.toLowerCase().includes(q) ||
        r.sourceLabelMm.toLowerCase().includes(q)
      );
    });
  }, [inflowRows, catFilter, searchTerm]);

  const filteredOutflows = useMemo(() => {
    return outflowRows.filter((r) => {
      if (r.outflowType !== outflowTypeFilter) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.job_no.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.typeLabelMm.toLowerCase().includes(q) ||
        r.typeLabelEn.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q))
      );
    });
  }, [outflowRows, outflowTypeFilter, searchTerm]);

  const totalInflowGrams = useMemo(() => {
    return filteredInflows.reduce((sum, r) => sum + r.net_grams, 0);
  }, [filteredInflows]);

  const totalInflowKpy = useMemo(() => {
    return gramsToKpy(totalInflowGrams, kyatToGrams);
  }, [totalInflowGrams, kyatToGrams]);

  const totalOutflowGrams = useMemo(() => {
    return filteredOutflows.reduce((sum, r) => sum + r.grams, 0);
  }, [filteredOutflows]);

  const totalOutflowKpy = useMemo(() => {
    return gramsToKpy(totalOutflowGrams, kyatToGrams);
  }, [totalOutflowGrams, kyatToGrams]);

  const outflowBreakdownByType = useMemo(() => {
    let merchantGrams = 0;
    let merchantCount = 0;
    let transferGrams = 0;
    let transferCount = 0;
    let meltGrams = 0;
    let meltCount = 0;
    let otherGrams = 0;
    let otherCount = 0;
    let goldsmithGrams = 0;
    let goldsmithCount = 0;

    for (const r of outflowRows) {
      if (r.outflowType === 'MERCHANT_RETURN') {
        merchantGrams += r.grams;
        merchantCount++;
      } else if (r.outflowType === 'SHOP_TRANSFER') {
        transferGrams += r.grams;
        transferCount++;
      } else if (r.outflowType === 'MELT') {
        meltGrams += r.grams;
        meltCount++;
      } else if (r.outflowType === 'OTHER_OUTFLOW') {
        otherGrams += r.grams;
        otherCount++;
      } else if (r.outflowType === 'GOLDSMITH_MELT') {
        goldsmithGrams += r.grams;
        goldsmithCount++;
      }
    }
    return {
      merchantGrams: Number(merchantGrams.toFixed(3)),
      merchantCount,
      transferGrams: Number(transferGrams.toFixed(3)),
      transferCount,
      meltGrams: Number(meltGrams.toFixed(3)),
      meltCount,
      otherGrams: Number(otherGrams.toFixed(3)),
      otherCount,
      goldsmithGrams: Number(goldsmithGrams.toFixed(3)),
      goldsmithCount,
    };
  }, [outflowRows]);

  const handleExportExcel = () => {
    type ExportOutflowRow = {
      index: number;
      date: string;
      type: string;
      refNo: string;
      destination: string;
      description: string;
      category: string;
      grams: number;
      weightDetail: string;
      notes: string;
    };

    exportToExcel<ExportOutflowRow>({
      filename: `old_gold_outflows_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Outflows',
      title:
        language === 'MM'
          ? 'အဟောင်းထည် အထွက် အသေးစိတ် မှတ်တမ်းများ'
          : 'Old Gold Outflow Detailed Records',
      columns: [
        { header: language === 'MM' ? 'စဉ်' : 'No', value: (r) => r.index, width: 6 },
        { header: language === 'MM' ? 'ရက်စွဲ' : 'Date', value: (r) => r.date, width: 14 },
        { header: language === 'MM' ? 'အမျိုးအစား' : 'Type', value: (r) => r.type, width: 18 },
        { header: language === 'MM' ? 'အမှတ်/နံပါတ်' : 'Ref No', value: (r) => r.refNo, width: 18 },
        { header: language === 'MM' ? 'နာမည်/ကုန်သည်/ပစ္စည်း' : 'Destination', value: (r) => r.destination, width: 22 },
        { header: language === 'MM' ? 'အကြောင်းအရာ' : 'Description', value: (r) => r.description, width: 22 },
        { header: language === 'MM' ? 'ရွှေအမျိုးအစား' : 'Category', value: (r) => r.category, width: 14 },
        { header: language === 'MM' ? 'အထွက် Gram' : 'Grams', value: (r) => r.grams, width: 14 },
        {
          header: language === 'MM' ? 'အလေးချိန်/လက်ခ/ပြန်ရငွေ' : 'Weight/Fee/Received',
          value: (r) => r.weightDetail,
          width: 20,
        },
        { header: language === 'MM' ? 'မှတ်ချက်' : 'Notes', value: (r) => r.notes, width: 20 },
      ],
      rows: filteredOutflows.map((r, i) => {
        const cfg = OLD_GOLD_CATEGORY_CONFIG[r.category];
        const weightStr =
          r.outflowType === 'GOLDSMITH_MELT' && r.craft_fee
            ? formatMMK(r.craft_fee)
            : r.outflowType === 'MELT'
            ? [
                r.weight ? formatKPYMyanmar(r.weight) : null,
                r.craft_fee && r.craft_fee > 0 ? formatMMK(r.craft_fee) : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : r.outflowType === 'OTHER_OUTFLOW'
            ? [
                r.weight ? formatKPYMyanmar(r.weight) : null,
                r.received_amount && r.received_amount > 0
                  ? formatMMK(r.received_amount)
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : r.weight
            ? formatKPYMyanmar(r.weight)
            : '';
        return {
          index: i + 1,
          date: formatDate(r.created_at),
          type: language === 'MM' ? r.typeLabelMm : r.typeLabelEn,
          refNo: r.job_no,
          destination: r.destination,
          description: r.description || '',
          category: language === 'MM' ? cfg.nameMm : cfg.nameEn,
          grams: r.grams,
          weightDetail: weightStr,
          notes: r.notes || '',
        };
      }),
    });
  };

  const categoryInflowSummary = useMemo(() => {
    return CATEGORY_KEYS.map((k) => {
      const rows = inflowRows.filter((r) => r.goldCategory === k);
      const count = rows.length;
      const grams = Number(rows.reduce((sum, r) => sum + r.net_grams, 0).toFixed(3));
      return { key: k, count, grams, ...OLD_GOLD_CATEGORY_CONFIG[k] };
    });
  }, [inflowRows]);

  const categoryOutflowSummary = useMemo(() => {
    return CATEGORY_KEYS.map((k) => {
      const rows = outflowRows.filter((r) => r.category === k);
      const count = rows.length;
      const grams = Number(rows.reduce((sum, r) => sum + r.grams, 0).toFixed(3));
      return { key: k, count, grams, ...OLD_GOLD_CATEGORY_CONFIG[k] };
    });
  }, [outflowRows]);

  const merchantSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const mr of merchantReturns) {
      if (mr.merchant_name) set.add(mr.merchant_name);
    }
    for (const c of customers) {
      if (c.name) set.add(c.name);
    }
    return Array.from(set);
  }, [merchantReturns, customers]);

  const mrGrams = parseFloat(mrGramsInput) || 0;

  const mrKpy = useMemo(() => {
    if (mrGrams <= 0) return { kyat: 0, pae: 0, yway: 0 };
    return gramsToKpy(mrGrams, kyatToGrams);
  }, [mrGrams, kyatToGrams]);

  const selectedMrCategoryBalance = categoryStats[mrCategory].balanceGrams;

  const handleSaveMerchantReturn = async () => {
    const name = mrMerchantName.trim();
    if (!name) {
      setMrErr(language === 'MM' ? 'ကုန်သည်အမည် ထည့်သွင်းပေးပါ' : 'Merchant name is required');
      return;
    }
    const desc = mrDescription.trim();
    if (!desc) {
      setMrErr(language === 'MM' ? 'အကြောင်းအရာ ထည့်သွင်းပေးပါ' : 'Description / Reason is required');
      return;
    }
    if (mrGrams <= 0) {
      setMrErr(language === 'MM' ? 'ပြန်ပေးမည့် ဂရမ်ချိန် ထည့်သွင်းပေးပါ' : 'Please enter valid gram weight');
      return;
    }
    if (mrGrams > selectedMrCategoryBalance + 0.001) {
      setMrErr(
        language === 'MM'
          ? `ရွေးချယ်ထားသော အမျိုးအစားတွင် လက်ကျန် ${selectedMrCategoryBalance.toFixed(3)}g သာရှိပါသည်`
          : `Insufficient balance: max ${selectedMrCategoryBalance.toFixed(3)}g`
      );
      return;
    }

    setMrSaving(true);
    setMrErr('');
    try {
      await addMerchantReturn({
        merchant_name: name,
        merchant_phone: mrMerchantPhone.trim() || undefined,
        description: desc,
        return_date: mrReturnDate,
        gold_category: mrCategory,
        grams: mrGrams,
        notes: mrNotes.trim() || undefined,
      });
      setMrOpen(false);
      setMrMerchantName('');
      setMrMerchantPhone('');
      setMrDescription('');
      setMrGramsInput('');
      setMrNotes('');
      void dialog.alert(
        language === 'MM'
          ? 'ကုန်သည်ပြန်ပေး စာရင်းသိမ်းဆည်းပြီးပါပြီ (သက်ဆိုင်ရာ အဝင်ထဲမှ နှုတ်ပြီးပါပြီ)'
          : 'Merchant return recorded and deducted from inflow balance'
      );
    } catch (err) {
      setMrErr(err instanceof Error ? err.message : String(err));
    } finally {
      setMrSaving(false);
    }
  };

  const stGrams = parseFloat(stGramsInput) || 0;

  const stKpy = useMemo(() => {
    if (stGrams <= 0) return { kyat: 0, pae: 0, yway: 0 };
    return gramsToKpy(stGrams, kyatToGrams);
  }, [stGrams, kyatToGrams]);

  const selectedStCategoryBalance = categoryStats[stCategory].balanceGrams;

  const handleSaveShopTransfer = async () => {
    const itemName = stItemName.trim();
    if (!itemName) {
      setStErr(language === 'MM' ? 'ပစ္စည်းဖော်ပြချက် ထည့်သွင်းပေးပါ' : 'Item description is required');
      return;
    }
    if (stGrams <= 0) {
      setStErr(language === 'MM' ? 'ဆိုင်သွင်းမည့် ဂရမ်ချိန် ထည့်သွင်းပေးပါ' : 'Please enter valid gram weight');
      return;
    }
    if (stGrams > selectedStCategoryBalance + 0.001) {
      setStErr(
        language === 'MM'
          ? `ရွေးချယ်ထားသော အမျိုးအစားတွင် လက်ကျန် ${selectedStCategoryBalance.toFixed(3)}g သာရှိပါသည်`
          : `Insufficient balance: max ${selectedStCategoryBalance.toFixed(3)}g`
      );
      return;
    }

    setStSaving(true);
    setStErr('');
    try {
      await addShopTransfer({
        item_name: itemName,
        description: stDescription.trim() || undefined,
        transfer_date: stTransferDate,
        gold_category: stCategory,
        grams: stGrams,
        notes: stNotes.trim() || undefined,
      });
      setStOpen(false);
      setStItemName('');
      setStDescription('');
      setStGramsInput('');
      setStNotes('');
      void dialog.alert(
        language === 'MM'
          ? 'ဆိုင်သွင်း စာရင်းသိမ်းဆည်းပြီးပါပြီ (သက်ဆိုင်ရာ အဝင်ထဲမှ နှုတ်ပြီးပါပြီ)'
          : 'Shop transfer recorded and deducted from inflow balance'
      );
    } catch (err) {
      setStErr(err instanceof Error ? err.message : String(err));
    } finally {
      setStSaving(false);
    }
  };

  const meltGrams = parseFloat(meltGramsInput) || 0;
  const ooGrams = parseFloat(ooGramsInput) || 0;

  const meltKpy = useMemo(() => {
    if (meltGrams <= 0) return { kyat: 0, pae: 0, yway: 0 };
    return gramsToKpy(meltGrams, kyatToGrams);
  }, [meltGrams, kyatToGrams]);

  const ooKpy = useMemo(() => {
    if (ooGrams <= 0) return { kyat: 0, pae: 0, yway: 0 };
    return gramsToKpy(ooGrams, kyatToGrams);
  }, [ooGrams, kyatToGrams]);

  const selectedMeltCategoryBalance = categoryStats[meltCategory].balanceGrams;
  const selectedOoCategoryBalance = categoryStats[ooCategory].balanceGrams;
  const selectedGsCategoryBalance = categoryStats[gsCategory].balanceGrams;

  const handleSaveMelt = async () => {
    const name = meltName.trim();
    if (!name) {
      setMeltErr(language === 'MM' ? 'နာမည် ထည့်သွင်းပေးပါ' : 'Name is required');
      return;
    }
    const desc = meltDescription.trim();
    if (!desc) {
      setMeltErr(language === 'MM' ? 'အကြောင်းအရာ ထည့်သွင်းပေးပါ' : 'Description is required');
      return;
    }
    if (meltGrams <= 0) {
      setMeltErr(language === 'MM' ? 'အလေးချိန် (Gram) ထည့်သွင်းပေးပါ' : 'Valid grams required');
      return;
    }
    if (meltGrams > selectedMeltCategoryBalance + 0.001) {
      setMeltErr(
        language === 'MM'
          ? `လက်ကျန်အလေးချိန် (${selectedMeltCategoryBalance.toFixed(3)} g) ထက် မကျော်လွန်ရပါ`
          : `Cannot exceed available balance (${selectedMeltCategoryBalance.toFixed(3)} g)`
      );
      return;
    }
    setMeltSaving(true);
    setMeltErr('');
    try {
      await addMelt({
        name,
        description: desc,
        melt_date: meltDate,
        gold_category: meltCategory,
        grams: meltGrams,
        craft_fee: Number(meltCraftFee || 0),
        notes: meltNotes.trim() || undefined,
      });
      setMeltOpen(false);
      setMeltName('');
      setMeltDescription('');
      setMeltGramsInput('');
      setMeltCraftFee(0);
      setMeltNotes('');
      void dialog.alert(
        language === 'MM'
          ? 'အရည်ကျို စာရင်းသိမ်းဆည်းပြီးပါပြီ (သက်ဆိုင်ရာ အဝင်ထဲမှ နှုတ်ပြီးပါပြီ)'
          : 'Gold melt recorded and deducted from inflow balance'
      );
    } catch (err) {
      setMeltErr(err instanceof Error ? err.message : String(err));
    } finally {
      setMeltSaving(false);
    }
  };

  const handleSaveOtherOutflow = async () => {
    const name = ooName.trim();
    if (!name) {
      setOoErr(language === 'MM' ? 'နာမည် ထည့်သွင်းပေးပါ' : 'Name is required');
      return;
    }
    const desc = ooDescription.trim();
    if (!desc) {
      setOoErr(language === 'MM' ? 'ပစ္စည်းဖော်ပြချက် ထည့်သွင်းပေးပါ' : 'Description is required');
      return;
    }
    if (ooGrams <= 0) {
      setOoErr(language === 'MM' ? 'အလေးချိန် (Gram) ထည့်သွင်းပေးပါ' : 'Valid grams required');
      return;
    }
    if (ooGrams > selectedOoCategoryBalance + 0.001) {
      setOoErr(
        language === 'MM'
          ? `လက်ကျန်အလေးချိန် (${selectedOoCategoryBalance.toFixed(3)} g) ထက် မကျော်လွန်ရပါ`
          : `Cannot exceed available balance (${selectedOoCategoryBalance.toFixed(3)} g)`
      );
      return;
    }
    setOoSaving(true);
    setOoErr('');
    try {
      await addOtherOutflow({
        name,
        description: desc,
        outflow_date: ooDate,
        gold_category: ooCategory,
        grams: ooGrams,
        received_amount: Number(ooReceivedAmount || 0),
        notes: ooNotes.trim() || undefined,
      });
      setOoOpen(false);
      setOoName('');
      setOoDescription('');
      setOoGramsInput('');
      setOoReceivedAmount(0);
      setOoNotes('');
      void dialog.alert(
        language === 'MM'
          ? 'အခြားအထွက် စာရင်းသိမ်းဆည်းပြီးပါပြီ (သက်ဆိုင်ရာ အဝင်ထဲမှ နှုတ်ပြီးပါပြီ)'
          : 'Other outflow recorded and deducted from inflow balance'
      );
    } catch (err) {
      setOoErr(err instanceof Error ? err.message : String(err));
    } finally {
      setOoSaving(false);
    }
  };

  const renderOutflowDetailsContent = () => (
    <div className="space-y-4">
      {/* DETAIL CONTROLS & FILTER BAR */}
      <div className="bg-white dark:bg-[#1A1A1A] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Outflow Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              {language === 'MM' ? 'အထွက်ပုံစံ:' : 'Outflow Type:'}
            </span>
            {(
              [
                {
                  key: 'MERCHANT_RETURN' as const,
                  mm: 'ကုန်သည်ပြန်ပေး',
                  en: 'Merchant Return',
                  count: outflowBreakdownByType.merchantCount,
                  grams: outflowBreakdownByType.merchantGrams,
                },
                {
                  key: 'SHOP_TRANSFER' as const,
                  mm: 'ဆိုင်သွင်း',
                  en: 'Shop Transfer',
                  count: outflowBreakdownByType.transferCount,
                  grams: outflowBreakdownByType.transferGrams,
                },
                {
                  key: 'MELT' as const,
                  mm: 'အရည်ကျို',
                  en: 'Gold Melt',
                  count: outflowBreakdownByType.meltCount,
                  grams: outflowBreakdownByType.meltGrams,
                },
                {
                  key: 'OTHER_OUTFLOW' as const,
                  mm: 'အခြားအထွက်',
                  en: 'Other Outflow',
                  count: outflowBreakdownByType.otherCount,
                  grams: outflowBreakdownByType.otherGrams,
                },
                {
                  key: 'GOLDSMITH_MELT' as const,
                  mm: 'ပန်းထိမ်အပ်',
                  en: 'Goldsmith Melt',
                  count: outflowBreakdownByType.goldsmithCount,
                  grams: outflowBreakdownByType.goldsmithGrams,
                },
              ]
            ).map((tab) => {
              const active = outflowTypeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setOutflowTypeFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400/40 ring-offset-1'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{language === 'MM' ? tab.mm : tab.en}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {tab.count} ({tab.grams.toFixed(3)} g)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box & Excel Export */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full lg:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={language === 'MM' ? 'အမှတ် / နာမည် / အကြောင်းအရာ ရှာရန်…' : 'Search name / ref / description…'}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-gray-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer shrink-0"
              title={language === 'MM' ? 'Excel ထုတ်ယူမည်' : 'Export to Excel'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'MM' ? 'Excel ထုတ်' : 'Export'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* OUTFLOW DETAILED RECORDS TABLE */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-gray-50/50 dark:bg-[#141414] border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {language === 'MM' ? 'အဟောင်းထည် အထွက် အသေးစိတ် မှတ်တမ်းများ' : 'Old Gold Outflow Detailed Records'}
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {outflowTypeFilter === 'MERCHANT_RETURN'
                ? (language === 'MM' ? 'ကုန်သည်ပြန်ပေး' : 'Merchant Return')
                : outflowTypeFilter === 'SHOP_TRANSFER'
                ? (language === 'MM' ? 'ဆိုင်သွင်း' : 'Shop Transfer')
                : outflowTypeFilter === 'MELT'
                ? (language === 'MM' ? 'အရည်ကျို' : 'Gold Melt')
                : outflowTypeFilter === 'OTHER_OUTFLOW'
                ? (language === 'MM' ? 'အခြားအထွက်' : 'Other Outflow')
                : (language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Goldsmith Melt')}
            </span>
          </div>
          <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300">
            <span className="text-gray-500 font-sans mr-1">{language === 'MM' ? 'မှတ်တမ်းပေါင်း:' : 'Records:'}</span>
            <strong className="text-gray-900 dark:text-white font-bold">{filteredOutflows.length}</strong> {language === 'MM' ? 'ခု' : 'items'}
            <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
            <strong className="text-rose-700 dark:text-rose-400 font-bold">{totalOutflowGrams.toFixed(3)} g</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th className="px-3 py-2.5 font-bold w-12">စဉ်</th>
                <th className="px-3 py-2.5 font-bold">ရက်စွဲ</th>
                <th className="px-3 py-2.5 font-bold">အမျိုးအစား</th>
                <th className="px-3 py-2.5 font-bold">အမှတ် / နံပါတ်</th>
                <th className="px-3 py-2.5 font-bold">နာမည် / ကုန်သည် / ပစ္စည်း</th>
                <th className="px-3 py-2.5 font-bold">အကြောင်းအရာ</th>
                <th className="px-3 py-2.5 font-bold">ရွှေအမျိုးအစား</th>
                <th className="px-3 py-2.5 font-bold text-right">အထွက် Gram</th>
                <th className="px-3 py-2.5 font-bold text-right">အလေးချိန် / လက်ခ / ပြန်ရငွေ</th>
                <th className="px-3 py-2.5 font-bold">မှတ်ချက်</th>
                <th className="px-3 py-2.5 font-bold text-center">လုပ်ဆောင်ချက်</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
              {filteredOutflows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-xs">
                    {language === 'MM' ? 'အထွက်မှတ်တမ်း မရှိပါ' : 'No outflow records found'}
                  </td>
                </tr>
              ) : (
                filteredOutflows.map((r, i) => {
                  const cfg = OLD_GOLD_CATEGORY_CONFIG[r.category];
                  return (
                    <tr
                      key={r.key}
                      className="hover:bg-gray-50/80 dark:hover:bg-[#141414] transition"
                    >
                      <td className="px-3 py-2.5 font-mono text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            r.outflowType === 'MERCHANT_RETURN'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : r.outflowType === 'SHOP_TRANSFER'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                              : r.outflowType === 'MELT'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-300 dark:border-orange-800'
                              : r.outflowType === 'OTHER_OUTFLOW'
                              ? 'bg-slate-100 text-slate-800 dark:bg-slate-950/50 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                              : 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300 border border-violet-300 dark:border-violet-800'
                          }`}
                        >
                          {r.outflowType === 'MELT' && <Flame className="w-2.5 h-2.5" />}
                          {r.outflowType === 'OTHER_OUTFLOW' && <PackageMinus className="w-2.5 h-2.5" />}
                          {language === 'MM' ? r.typeLabelMm : r.typeLabelEn}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {r.job_no}
                      </td>
                      <td className="px-3 py-2.5 truncate max-w-[170px] font-medium text-gray-800 dark:text-gray-200">
                        {r.order_no ? (
                          <span className="inline-flex flex-col">
                            <span className="font-mono font-bold text-violet-700 dark:text-violet-300">
                              {r.order_no}
                            </span>
                            <span className="text-[10px] text-gray-500 truncate">
                              {r.description || r.destination}
                            </span>
                          </span>
                        ) : (
                          r.destination
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 truncate max-w-[170px]">
                        {r.order_no ? '—' : r.description || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${cfg.badgeClass}`}>
                          {language === 'MM' ? cfg.nameMm : cfg.nameEn}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                        {r.grams.toFixed(3)} g
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {r.outflowType === 'MELT' ? (
                          <span className="inline-flex flex-col items-end gap-0.5">
                            {r.weight ? <span>{formatKPYMyanmar(r.weight)}</span> : null}
                            {r.craft_fee && r.craft_fee > 0 ? (
                              <span className="text-[10px] text-violet-700 dark:text-violet-300">
                                {formatMMK(r.craft_fee)}
                              </span>
                            ) : !r.weight ? (
                              '—'
                            ) : null}
                          </span>
                        ) : r.outflowType === 'OTHER_OUTFLOW' ? (
                          <span className="inline-flex flex-col items-end gap-0.5">
                            {r.weight ? <span>{formatKPYMyanmar(r.weight)}</span> : null}
                            {r.received_amount && r.received_amount > 0 ? (
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                                {formatMMK(r.received_amount)}
                              </span>
                            ) : !r.weight ? (
                              '—'
                            ) : null}
                          </span>
                        ) : r.outflowType === 'MERCHANT_RETURN' || r.outflowType === 'SHOP_TRANSFER' ? (
                          r.weight ? formatKPYMyanmar(r.weight) : '—'
                        ) : r.craft_fee && r.craft_fee > 0 ? (
                          `${r.craft_fee.toLocaleString()} Ks`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 truncate max-w-[160px]">
                        {r.outflowType === 'MERCHANT_RETURN' ||
                        r.outflowType === 'SHOP_TRANSFER' ||
                        r.outflowType === 'MELT' ||
                        r.outflowType === 'OTHER_OUTFLOW'
                          ? r.notes || '—'
                          : r.return_due_date
                          ? formatDate(r.return_due_date)
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {r.outflowType === 'SHOP_TRANSFER' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await dialog.confirm({
                                message:
                                  language === 'MM'
                                    ? `ဆိုင်သွင်း "${r.job_no}" ကို ပယ်ဖျက်ပြီး လက်ကျန်ထဲသို့ ပြန်ပေါင်းထည့်မလား?`
                                    : `Delete shop transfer "${r.job_no}" and restore balance?`,
                                danger: true,
                              });
                              if (ok && r.id) {
                                await deleteShopTransfer(r.id);
                              }
                            }}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center gap-1 cursor-pointer"
                            title={language === 'MM' ? 'ပယ်ဖျက်မည်' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden sm:inline">{language === 'MM' ? 'ပယ်ဖျက်' : 'Delete'}</span>
                          </button>
                        ) : r.outflowType === 'MERCHANT_RETURN' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await dialog.confirm({
                                message:
                                  language === 'MM'
                                    ? `ကုန်သည်ပြန်ပေး "${r.job_no}" ကို ပယ်ဖျက်ပြီး လက်ကျန်ထဲသို့ ပြန်ပေါင်းထည့်မလား?`
                                    : `Delete merchant return "${r.job_no}" and restore balance?`,
                                danger: true,
                              });
                              if (ok && r.id) {
                                await deleteMerchantReturn(r.id);
                              }
                            }}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center gap-1 cursor-pointer"
                            title={language === 'MM' ? 'ပယ်ဖျက်မည်' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden sm:inline">{language === 'MM' ? 'ပယ်ဖျက်' : 'Delete'}</span>
                          </button>
                        ) : r.outflowType === 'MELT' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await dialog.confirm({
                                message:
                                  language === 'MM'
                                    ? `အရည်ကျို "${r.job_no}" ကို ပယ်ဖျက်ပြီး လက်ကျန်ထဲသို့ ပြန်ပေါင်းထည့်မလား?`
                                    : `Delete melt record "${r.job_no}" and restore balance?`,
                                danger: true,
                              });
                              if (ok && r.id) {
                                await deleteMelt(r.id);
                              }
                            }}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center gap-1 cursor-pointer"
                            title={language === 'MM' ? 'ပယ်ဖျက်မည်' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden sm:inline">{language === 'MM' ? 'ပယ်ဖျက်' : 'Delete'}</span>
                          </button>
                        ) : r.outflowType === 'OTHER_OUTFLOW' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await dialog.confirm({
                                message:
                                  language === 'MM'
                                    ? `အခြားအထွက် "${r.job_no}" ကို ပယ်ဖျက်ပြီး လက်ကျန်ထဲသို့ ပြန်ပေါင်းထည့်မလား?`
                                    : `Delete other outflow "${r.job_no}" and restore balance?`,
                                danger: true,
                              });
                              if (ok && r.id) {
                                await deleteOtherOutflow(r.id);
                              }
                            }}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center gap-1 cursor-pointer"
                            title={language === 'MM' ? 'ပယ်ဖျက်မည်' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden sm:inline">{language === 'MM' ? 'ပယ်ဖျက်' : 'Delete'}</span>
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              r.status === 'SENT'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300'
                                : r.status === 'RETURNED'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            }`}
                          >
                            {r.status === 'SENT'
                              ? language === 'MM'
                                ? 'အပ်ထားဆဲ'
                                : 'Sent'
                              : r.status === 'RETURNED'
                              ? language === 'MM'
                                ? 'ပြန်လည်လက်ခံ'
                                : 'Returned'
                              : language === 'MM'
                              ? 'ပြီးဆုံး'
                              : 'Done'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderOutflowsView = () => (
    <div className="space-y-4">
      {/* Top Banner / Header for Outflow Details */}
      <div className="bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('old-gold')}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0"
                title={language === 'MM' ? 'အဟောင်းထည် လက်ကျန် စာရင်းချုပ်သို့ ပြန်သွားမည်' : 'Back to Summary'}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'MM' ? 'လက်ကျန်သို့' : 'Back'}</span>
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0">
              <List className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  {language === 'MM' ? 'အဟောင်းထည် အထွက် အသေးစိတ် မှတ်တမ်းများ' : 'Old Gold Outflow Detailed Records'}
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-mono">
                  {filteredOutflows.length} {language === 'MM' ? 'ခု' : 'items'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {language === 'MM'
                  ? 'ကုန်သည်ပြန်ပေး၊ ဆိုင်သွင်း၊ အရည်ကျို၊ အခြားအထွက် နှင့် ပန်းထိမ်အပ် မှတ်တမ်းများ အသေးစိတ် ရှာဖွေစစ်ဆေးခြင်း'
                  : 'Merchant returns, shop transfers, gold melts & goldsmith jobs outflow records'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {renderOutflowDetailsContent()}
    </div>
  );

  const renderSummaryView = () => (
    <div className="space-y-4">
      {/* Top Banner / Header */}
      <div className="bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <PackageOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  {language === 'MM' ? 'အဟောင်းထည် လက်ကျန် စာရင်းချုပ်' : 'Old Gold Balance & Summary'}
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {language === 'MM' ? 'အမျိုးအစား အားလုံး' : 'All Categories'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {language === 'MM'
                  ? 'အဝယ်၊ ဆိုင်ထုတ်၊ ပေါင်ရှုံး၊ အခြားရွှေအဝင် — ကုန်သည်ပြန်ပေး၊ ဆိုင်သွင်း၊ အရည်ကျို၊ အခြားအထွက် နှင့် ပန်းထိမ်အပ်'
                  : 'Purchases, shop-outs, pawns & other inflows vs returns, transfers, melts, other outflows & goldsmith'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full lg:w-auto">
            {/* ကုန်သည်ပြန်ပေး */}
            <button
              type="button"
              onClick={() => {
                setMrOpen(true);
                setMrErr('');
                setMrGramsInput('');
                setMrMerchantName('');
                setMrMerchantPhone('');
                setMrDescription('');
                setMrNotes('');
                setMrCategory('PAE_16');
                setMrReturnDate(new Date().toISOString().slice(0, 10));
              }}
              className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition hover:shadow-md cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'MM' ? 'ကုန်သည်ပြန်ပေး' : 'Return'}</span>
            </button>

            {/* ဆိုင်သွင်း */}
            <button
              type="button"
              onClick={() => {
                setStOpen(true);
                setStErr('');
                setStGramsInput('');
                setStItemName('');
                setStDescription('');
                setStNotes('');
                setStCategory('PAE_16');
                setStTransferDate(new Date().toISOString().slice(0, 10));
              }}
              className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition hover:shadow-md cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'MM' ? 'ဆိုင်သွင်း' : 'Transfer'}</span>
            </button>

            {/* အရည်ကျို */}
            <button
              type="button"
              onClick={() => {
                setMeltOpen(true);
                setMeltErr('');
                setMeltGramsInput('');
                setMeltName('');
                setMeltDescription('');
                setMeltNotes('');
                setMeltCraftFee(0);
                setMeltCategory('PAE_16');
                setMeltDate(new Date().toISOString().slice(0, 10));
              }}
              className="px-3.5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition hover:shadow-md cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'MM' ? 'အရည်ကျို' : 'Melt'}</span>
            </button>

            {/* အခြားအထွက် */}
            <button
              type="button"
              onClick={() => {
                setOoOpen(true);
                setOoErr('');
                setOoGramsInput('');
                setOoName('');
                setOoDescription('');
                setOoNotes('');
                setOoReceivedAmount(0);
                setOoCategory('PAE_16');
                setOoDate(new Date().toISOString().slice(0, 10));
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition hover:shadow-md cursor-pointer"
            >
              <PackageMinus className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'MM' ? 'အခြားအထွက်' : 'Other Out'}</span>
            </button>

            {can('goldsmith', 'create') && (
              <button
                type="button"
                onClick={() => {
                  setGsOpen(true);
                  setGsErr('');
                  setGsGrams(0);
                  setGsCraftFee(0);
                  setGsName('');
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setGsReturnDue(d.toISOString().slice(0, 10));
                }}
                className="px-3.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition hover:shadow-md cursor-pointer"
              >
                <Hammer className="w-3.5 h-3.5 shrink-0" />
                <span>{language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Goldsmith'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Daily summary (date-filtered) */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-extrabold tracking-wide">
                  {language === 'MM' ? 'နေ့စဉ်' : 'DAILY'}
                </span>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  {language === 'MM' ? 'နေ့စဉ် စာရင်းချုပ်' : 'Daily Summary'}
                </h2>
                {summaryDate === todayISO() && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-semibold">
                    {language === 'MM' ? 'ယနေ့' : 'Today'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {language === 'MM'
                  ? 'ရွေးချယ်ထားသော ရက်တစ်ရက်အတွက်သာ — ဆိုင်ရှိလက်ကျန်၊ ယနေ့အဝင်၊ ယနေ့အထွက်'
                  : 'For the selected date only — opening stock, day in, day out'}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <CalendarDays className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 hidden sm:block" />
              <DateInput
                value={summaryDate}
                onChange={setSummaryDate}
                className="w-full sm:w-44 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono text-gray-900 dark:text-white"
              />
              {summaryDate !== todayISO() && (
                <button
                  type="button"
                  onClick={() => setSummaryDate(todayISO())}
                  className="px-3 py-2 rounded-xl text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer whitespace-nowrap"
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
                  {language === 'MM' ? 'နေ့စဉ် — ရွှေအမျိုးအစားအလိုက်' : 'Daily — by gold type'}
                </span>
                <span className="font-mono text-amber-700/70 dark:text-amber-300/70">
                  ({formatDate(dateCategorySummary.day)})
                </span>
              </div>
              <div className="font-mono text-amber-800 dark:text-amber-300 font-extrabold">
                {language === 'MM' ? 'နေ့စဉ် လက်ကျန်' : 'Daily net'}:{' '}
                {dateCategorySummary.totals.balance.toFixed(3)} g
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-amber-100/70 dark:bg-amber-950/40 text-amber-900/80 dark:text-amber-200/80 border-b border-amber-200 dark:border-amber-800/40">
                    <th className="px-3 py-2.5 font-bold w-10">စဉ်</th>
                    <th className="px-3 py-2.5 font-bold">
                      {language === 'MM' ? 'ရွှေအမျိုးအစား' : 'Gold Type'}
                    </th>
                    <th className="px-3 py-2.5 font-bold text-right">
                      {language === 'MM' ? 'ဆိုင်ရှိအဟောင်းထည်' : 'Shop stock'}
                    </th>
                    <th className="px-3 py-2.5 font-bold text-right text-emerald-700 dark:text-emerald-400">
                      {language === 'MM' ? 'ယနေ့အဟောင်းအဝင်' : 'Day inflow'}
                    </th>
                    <th className="px-3 py-2.5 font-bold text-right text-rose-700 dark:text-rose-400">
                      {language === 'MM' ? 'ယနေ့အဟောင်းအထွက်' : 'Day outflow'}
                    </th>
                    <th className="px-3 py-2.5 font-bold text-right text-amber-800 dark:text-amber-300">
                      {language === 'MM' ? 'စုစုပေါင်းလက်ကျန်' : 'Net balance'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">
                  {dateCategorySummary.rows.map((cat, idx) => (
                    <tr key={cat.key} className="hover:bg-amber-100/40 dark:hover:bg-amber-900/20 transition">
                      <td className="px-3 py-2.5 font-mono text-amber-700/50 dark:text-amber-400/50">{idx + 1}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cat.badgeClass}`}>
                          {language === 'MM' ? cat.nameMm : cat.nameEn}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800 dark:text-gray-100">
                        {cat.shopStock.toFixed(3)} g
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                        {cat.dayIn.toFixed(3)} g
                        <span className="text-gray-400 dark:text-gray-500 ml-1">({cat.dayInCount})</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-rose-700 dark:text-rose-400">
                        {cat.dayOut.toFixed(3)} g
                        <span className="text-gray-400 dark:text-gray-500 ml-1">({cat.dayOutCount})</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-amber-800 dark:text-amber-300">
                        {cat.balance.toFixed(3)} g
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-100/80 dark:bg-amber-950/50 border-t border-amber-200 dark:border-amber-800/50 font-bold">
                    <td className="px-3 py-2.5 text-amber-950 dark:text-amber-100" colSpan={2}>
                      {language === 'MM' ? 'နေ့စဉ် စုစုပေါင်း' : 'Daily total'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800 dark:text-gray-100">
                      {dateCategorySummary.totals.shopStock.toFixed(3)} g
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {dateCategorySummary.totals.dayIn.toFixed(3)} g
                      <span className="text-gray-400 dark:text-gray-500 ml-1 font-normal">
                        ({dateCategorySummary.totals.dayInCount})
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-700 dark:text-rose-400">
                      {dateCategorySummary.totals.dayOut.toFixed(3)} g
                      <span className="text-gray-400 dark:text-gray-500 ml-1 font-normal">
                        ({dateCategorySummary.totals.dayOutCount})
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-800 dark:text-amber-300">
                      {dateCategorySummary.totals.balance.toFixed(3)} g
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Lifetime summary section */}
      <div className="space-y-3">
        <div className="space-y-1 px-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700 text-white text-[10px] font-extrabold tracking-wide">
              {language === 'MM' ? 'အစဉ်အဆက်' : 'LIFETIME'}
            </span>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              {language === 'MM' ? 'စုစုပေါင်း အားလုံး (Lifetime)' : 'Lifetime Totals'}
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {language === 'MM'
              ? 'ရက်စွဲ မစစ်ဘဲ — အစမှ ယနေ့အထိ အဝင်/အထွက် စုစုပေါင်း (အပေါ် Daily နှင့် မတူပါ)'
              : 'All-time totals — not filtered by the date above (different from Daily)'}
          </p>
        </div>

      {/* Main Tabs (အဝင် vs အထွက်) */}
      <div className="bg-white dark:bg-[#1A1A1A] p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Inflow vs Outflow toggle */}
          <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-gray-800/60 w-fit">
            <button
              type="button"
              onClick={() => switchFlowTab('INFLOW')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                flowTab === 'INFLOW'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>{language === 'MM' ? 'Lifetime အဝင်' : 'Lifetime Inflow'}</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                  flowTab === 'INFLOW' ? 'bg-black/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {inflowRows.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => switchFlowTab('OUTFLOW')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                flowTab === 'OUTFLOW'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{language === 'MM' ? 'Lifetime အထွက်' : 'Lifetime Outflow'}</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                  flowTab === 'OUTFLOW' ? 'bg-black/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {outflowRows.length}
              </span>
            </button>
          </div>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('old-gold-outflows')}
              className="px-3.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <List className="w-3.5 h-3.5" />
              <span>{language === 'MM' ? 'အထွက် အသေးစိတ် မှတ်တမ်းကြည့်ရန် →' : 'View Outflow Details →'}</span>
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY TABLES */}
      {flowTab === 'INFLOW' ? (
        /* INFLOW SUMMARY TABLE */
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-gray-50/50 dark:bg-[#141414] border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                {language === 'MM' ? 'Lifetime — အဟောင်းထည် အဝင်' : 'Lifetime — Inflow by type'}
              </h2>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold">
                {language === 'MM' ? 'အားလုံး' : 'All time'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300">
              <span className="text-gray-500 font-sans mr-1">{language === 'MM' ? 'Lifetime စုစုပေါင်း:' : 'Lifetime total:'}</span>
              <strong className="text-gray-900 dark:text-white font-bold">{overallTotals.inflowCount}</strong> {language === 'MM' ? 'ခု' : 'items'}
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
              <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{overallTotals.inflowGrams.toFixed(3)} g</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="px-4 py-3 font-bold w-16">စဉ်</th>
                  <th className="px-4 py-3 font-bold">{language === 'MM' ? 'ရွှေအမျိုးအစား' : 'Gold Type'}</th>
                  <th className="px-4 py-3 font-bold text-right">{language === 'MM' ? 'စုစုပေါင်း အရေအတွက်' : 'Total Qty'}</th>
                  <th className="px-4 py-3 font-bold text-right">{language === 'MM' ? 'စုစုပေါင်း Gram ချိန်' : 'Total Grams'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
                {categoryInflowSummary.map((cat, idx) => (
                  <tr key={cat.key} className="hover:bg-gray-50/50 dark:hover:bg-[#141414] transition">
                    <td className="px-4 py-3.5 font-mono text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${cat.badgeClass}`}>
                        {language === 'MM' ? cat.nameMm : cat.nameEn}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white text-xs">
                      {cat.count} {language === 'MM' ? 'ခု' : 'items'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                      {cat.grams.toFixed(3)} g
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/80 dark:bg-[#141414] border-t-2 border-gray-200 dark:border-gray-700 font-bold">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-bold" colSpan={2}>
                    {language === 'MM' ? 'Lifetime စုစုပေါင်း' : 'Lifetime total'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white font-bold">
                    {overallTotals.inflowCount} {language === 'MM' ? 'ခု' : 'items'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                    {overallTotals.inflowGrams.toFixed(3)} g
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* OUTFLOW SECTION (SUMMARY ONLY) */
        <div className="space-y-4">
          {/* OUTFLOW SUMMARY TABLE */}
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-gray-50/50 dark:bg-[#141414] border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  {language === 'MM' ? 'Lifetime — အဟောင်းထည် အထွက်' : 'Lifetime — Outflow by type'}
                </h2>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold">
                  {language === 'MM' ? 'အားလုံး' : 'All time'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300">
                <span className="text-gray-500 font-sans mr-1">{language === 'MM' ? 'Lifetime စုစုပေါင်း:' : 'Lifetime total:'}</span>
                <strong className="text-gray-900 dark:text-white font-bold">{overallTotals.outflowCount}</strong> {language === 'MM' ? 'ခု' : 'items'}
                <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
                <strong className="text-rose-700 dark:text-rose-400 font-bold">{overallTotals.outflowGrams.toFixed(3)} g</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th className="px-4 py-3 font-bold w-16">စဉ်</th>
                    <th className="px-4 py-3 font-bold">{language === 'MM' ? 'ရွှေအမျိုးအစား' : 'Gold Type'}</th>
                    <th className="px-4 py-3 font-bold text-right">{language === 'MM' ? 'စုစုပေါင်း အရေအတွက်' : 'Total Qty'}</th>
                    <th className="px-4 py-3 font-bold text-right">{language === 'MM' ? 'စုစုပေါင်း Gram ချိန်' : 'Total Grams'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
                  {categoryOutflowSummary.map((cat, idx) => (
                    <tr
                      key={cat.key}
                      className="hover:bg-gray-50/60 dark:hover:bg-[#141414] transition"
                    >
                      <td className="px-4 py-3.5 font-mono text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-md inline-flex items-center gap-1.5 ${
                            cat.badgeClass
                          }`}
                        >
                          <span>{language === 'MM' ? cat.nameMm : cat.nameEn}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white text-xs">
                        {cat.count} {language === 'MM' ? 'ခု' : 'items'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-rose-700 dark:text-rose-400 text-xs">
                        {cat.grams.toFixed(3)} g
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/80 dark:bg-[#141414] border-t-2 border-gray-200 dark:border-gray-700 font-bold">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-bold" colSpan={2}>
                      <span>{language === 'MM' ? 'Lifetime စုစုပေါင်း' : 'Lifetime total'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white font-bold">
                      {overallTotals.outflowCount} {language === 'MM' ? 'ခု' : 'items'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-700 dark:text-rose-400 text-sm font-bold">
                      {overallTotals.outflowGrams.toFixed(3)} g
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* NAVIGATION BANNER TO DETAILED RECORDS */}
          <div className="p-4 sm:p-5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-gradient-to-r from-rose-50/80 via-amber-50/40 to-transparent dark:from-rose-950/20 dark:via-amber-950/10 dark:to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                <List className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  {language === 'MM'
                    ? 'အဟောင်းထည် အထွက် အသေးစိတ် မှတ်တမ်းများ'
                    : 'Detailed Outflow History & Records'}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
                  {language === 'MM'
                    ? 'ကုန်သည်ပြန်ပေး၊ ဆိုင်သွင်း၊ အရည်ကျို၊ အခြားအထွက် နှင့် ပန်းထိမ်အပ် မှတ်တမ်းအသေးစိတ်များကို သီးသန့် အသေးစိတ်မှတ်တမ်း စာမျက်နှာတွင် စစ်ဆေး၊ ရှာဖွေ၊ Excel ထုတ်ယူနိုင်ပါသည်။'
                    : 'View, filter, search and export all merchant returns, shop transfers, melts and goldsmith melt outflow records.'}
                </p>
              </div>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('old-gold-outflows')}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold flex items-center justify-center gap-2 shrink-0 shadow-xs transition hover:shadow-md cursor-pointer"
              >
                <span>{language === 'MM' ? 'အသေးစိတ် မှတ်တမ်းသို့ သွားမည်' : 'View Outflow Details'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-16">
      {section === 'outflows' ? renderOutflowsView() : renderSummaryView()}

      {/* Modal: Send to Goldsmith (ပန်းထိမ်အပ် / အရည်ကျို အထွက်) */}
      {gsOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                <Hammer className="w-4 h-4 text-violet-600" />
                <span>{language === 'MM' ? 'အဟောင်းထည် → ပန်းထိမ်အပ် (အထွက်)' : 'Old Gold → Send to Goldsmith'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setGsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5 text-xs">
              {/* Category Picker */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ရွှေအမျိုးအစား ရွေးချယ်ရန်' : 'Select Gold Category'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_KEYS.map((k) => {
                    const cfg = OLD_GOLD_CATEGORY_CONFIG[k];
                    const isSel = gsCategory === k;
                    const bal = categoryStats[k].balanceGrams;

                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setGsCategory(k);
                          setGsErr('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSel
                            ? 'border-violet-600 bg-violet-50/60 dark:bg-violet-950/30 ring-1 ring-violet-500'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                        }`}
                      >
                        <span className="font-bold text-xs text-gray-900 dark:text-white">
                          {language === 'MM' ? cfg.nameMm : cfg.nameEn}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {cfg.puritiesMm}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-violet-700 dark:text-violet-300 mt-1">
                          {language === 'MM' ? 'ကျန်' : 'Avail'}: {bal.toFixed(3)} g
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gram Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'အပ်မည့် Gram ချိန်' : 'Grams to Melt / Send'}
                  </label>
                  <span className="text-[11px] font-mono text-violet-700 dark:text-violet-300">
                    {language === 'MM' ? 'လက်ကျန်အများဆုံး' : 'Max Available'}: {selectedGsCategoryBalance.toFixed(3)} g
                  </span>
                </div>
                <NumberInput
                  value={gsGrams}
                  onChange={(v) => {
                    setGsGrams(v);
                    setGsErr('');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ဖော်ပြချက် (Optional)' : 'Description (Optional)'}
                </label>
                <input
                  value={gsName}
                  onChange={(e) => setGsName(e.target.value)}
                  placeholder={
                    language === 'MM'
                      ? `${OLD_GOLD_CATEGORY_CONFIG[gsCategory].nameMm} အရည်ကျို / ပန်းထိမ်အပ်`
                      : 'Melt description'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {/* Craft fee */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'လက်ခ (Ks)' : 'Craftsmanship Fee (Ks)'}
                </label>
                <NumberInput
                  value={gsCraftFee}
                  onChange={setGsCraftFee}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-xs"
                />
              </div>

              {/* Expected Return Date */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ပြန်လာအပ်ရမည့်ရက်' : 'Expected Return Date'}
                </label>
                <DateInput
                  required
                  value={gsReturnDue}
                  onChange={setGsReturnDue}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-xs"
                />
              </div>

              {gsErr && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-semibold">
                  {gsErr}
                </div>
              )}

              <button
                type="button"
                disabled={
                  gsSaving ||
                  gsGrams <= 0 ||
                  !gsReturnDue ||
                  gsGrams > selectedGsCategoryBalance + 0.001
                }
                onClick={async () => {
                  if (gsGrams > selectedGsCategoryBalance + 0.001) {
                    setGsErr(
                      language === 'MM'
                        ? `ရွေးချယ်ထားသော အမျိုးအစားတွင် လက်ကျန် ${selectedGsCategoryBalance.toFixed(3)}g သာရှိပါသည်`
                        : `Insufficient balance: max ${selectedGsCategoryBalance.toFixed(3)}g`
                    );
                    return;
                  }
                  setGsSaving(true);
                  setGsErr('');
                  try {
                    const fallbackPurity =
                      gsCategory === 'THAI_GOLD'
                        ? 'THAI_GOLD'
                        : gsCategory === 'PAE_16'
                        ? 'MEELIN'
                        : gsCategory === 'PAE_15'
                        ? 'PE15A'
                        : 'PE14A';

                    await createGoldsmithJob({
                      source_type: 'OLD_GOLD',
                      source_category: gsCategory,
                      source_purity: fallbackPurity,
                      source_grams: gsGrams,
                      item_name:
                        gsName ||
                        (language === 'MM'
                          ? `${OLD_GOLD_CATEGORY_CONFIG[gsCategory].nameMm} အရည်ကျို`
                          : `${OLD_GOLD_CATEGORY_CONFIG[gsCategory].nameEn} Melt`),
                      craft_fee: gsCraftFee,
                      return_due_date: gsReturnDue,
                    });
                    setGsOpen(false);
                  } catch (e) {
                    setGsErr(e instanceof Error ? e.message : 'Failed to create job');
                  } finally {
                    setGsSaving(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs disabled:opacity-50 transition shadow-xs"
              >
                {gsSaving ? '...' : language === 'MM' ? 'ပန်းထိမ်အပ်မည်' : 'Submit Outflow'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Modal: Return to Merchant (ကုန်သည်ပြန်ပေး အထွက်) */}
      {mrOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                <Undo2 className="w-4 h-4 text-amber-600" />
                <span>{language === 'MM' ? 'အဟောင်းထည် → ကုန်သည်ပြန်ပေး (အထွက်)' : 'Old Gold → Return to Merchant'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setMrOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5 text-xs">
              {/* Category Picker */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ရွှေအမျိုးအစား ရွေးချယ်ရန်' : 'Select Gold Category'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_KEYS.map((k) => {
                    const cfg = OLD_GOLD_CATEGORY_CONFIG[k];
                    const isSel = mrCategory === k;
                    const bal = categoryStats[k].balanceGrams;

                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setMrCategory(k);
                          setMrErr('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSel
                            ? 'border-amber-600 bg-amber-50/60 dark:bg-amber-950/30 ring-1 ring-amber-500'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                        }`}
                      >
                        <span className="font-bold text-xs text-gray-900 dark:text-white">
                          {language === 'MM' ? cfg.nameMm : cfg.nameEn}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {cfg.puritiesMm}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300 mt-1">
                          {language === 'MM' ? 'လက်ကျန်' : 'Avail'}: {bal.toFixed(3)} g
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Merchant Name */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ကုန်သည် / ဆိုင်အမည် *' : 'Merchant / Store Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={mrMerchantName}
                  onChange={(e) => {
                    setMrMerchantName(e.target.value);
                    setMrErr('');
                  }}
                  placeholder={language === 'MM' ? 'ကုန်သည်အမည် ထည့်ပါ' : 'Enter merchant name'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-medium"
                />
              </div>

              {/* Merchant Phone */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ဖုန်းနံပါတ် (Optional)' : 'Phone Number (Optional)'}
                </label>
                <input
                  type="text"
                  value={mrMerchantPhone}
                  onChange={(e) => setMrMerchantPhone(e.target.value)}
                  placeholder="09..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono"
                />
              </div>

              {/* Return Date */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ပြန်ပေးသည့် ရက်စွဲ *' : 'Return Date *'}
                </label>
                <DateInput
                  required
                  value={mrReturnDate}
                  onChange={setMrReturnDate}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-xs"
                />
              </div>

              {/* Grams Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'ပြန်ပေးမည့် Gram ချိန် *' : 'Return Grams *'}
                  </label>
                  <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300">
                    {language === 'MM' ? 'လက်ကျန်အများဆုံး' : 'Max Available'}: {selectedMrCategoryBalance.toFixed(3)} g
                  </span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={selectedMrCategoryBalance}
                  value={mrGramsInput}
                  onChange={(e) => {
                    setMrGramsInput(e.target.value);
                    setMrErr('');
                  }}
                  placeholder="0.000"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-sm"
                />
                {mrGrams > 0 && mrCategory !== 'THAI_GOLD' && (
                  <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                    ≈ {formatKPYMyanmar(mrKpy)}
                  </div>
                )}
              </div>

              {/* Description / Reason */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'အကြောင်းအရာ / ဖော်ပြချက် *' : 'Description / Item *'}
                </label>
                <input
                  type="text"
                  required
                  value={mrDescription}
                  onChange={(e) => {
                    setMrDescription(e.target.value);
                    setMrErr('');
                  }}
                  placeholder={
                    language === 'MM'
                      ? `${OLD_GOLD_CATEGORY_CONFIG[mrCategory].nameMm} ကုန်သည်ပြန်ပေး`
                      : 'Return description'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'မှတ်ချက် (Optional)' : 'Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={mrNotes}
                  onChange={(e) => setMrNotes(e.target.value)}
                  placeholder={language === 'MM' ? 'အပိုဆောင်း မှတ်ချက်' : 'Additional notes'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {mrErr && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-semibold">
                  {mrErr}
                </div>
              )}

              <button
                type="button"
                disabled={
                  mrSaving ||
                  mrGrams <= 0 ||
                  !mrMerchantName.trim() ||
                  !mrDescription.trim() ||
                  mrGrams > selectedMrCategoryBalance + 0.001
                }
                onClick={handleSaveMerchantReturn}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-50 transition shadow-xs cursor-pointer"
              >
                {mrSaving ? '...' : language === 'MM' ? 'ကုန်သည်ပြန်ပေး သိမ်းမည်' : 'Submit Return'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Modal: Shop Transfer (ဆိုင်သွင်း အထွက်) */}
      {stOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                <Store className="w-4 h-4 text-indigo-600" />
                <span>{language === 'MM' ? 'အဟောင်းထည် → ဆိုင်သွင်း (အထွက်)' : 'Old Gold → Shop Transfer'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setStOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5 text-xs">
              {/* Category Picker */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ရွှေအမျိုးအစား ရွေးချယ်ရန်' : 'Select Gold Category'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_KEYS.map((k) => {
                    const cfg = OLD_GOLD_CATEGORY_CONFIG[k];
                    const isSel = stCategory === k;
                    const bal = categoryStats[k].balanceGrams;

                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setStCategory(k);
                          setStErr('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSel
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                        }`}
                      >
                        <span className="font-bold text-xs text-gray-900 dark:text-white">
                          {language === 'MM' ? cfg.nameMm : cfg.nameEn}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {cfg.puritiesMm}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 mt-1">
                          {language === 'MM' ? 'လက်ကျန်' : 'Avail'}: {bal.toFixed(3)} g
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Item Description (ပစ္စည်းဖော်ပြချက်) */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ပစ္စည်းဖော်ပြချက် *' : 'Item Description *'}
                </label>
                <input
                  type="text"
                  required
                  value={stItemName}
                  onChange={(e) => {
                    setStItemName(e.target.value);
                    setStErr('');
                  }}
                  placeholder={language === 'MM' ? 'ပစ္စည်းဖော်ပြချက် (ဥပမာ- ဆွဲကြိုး၊ လက်စွပ်)' : 'Enter item description'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-medium"
                />
              </div>

              {/* Transfer Date */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ဆိုင်သွင်းသည့် ရက်စွဲ *' : 'Transfer Date *'}
                </label>
                <DateInput
                  required
                  value={stTransferDate}
                  onChange={setStTransferDate}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-xs"
                />
              </div>

              {/* Grams Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'ဆိုင်သွင်းမည့် Gram ချိန် *' : 'Transfer Grams *'}
                  </label>
                  <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                    {language === 'MM' ? 'လက်ကျန်အများဆုံး' : 'Max Available'}: {selectedStCategoryBalance.toFixed(3)} g
                  </span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={selectedStCategoryBalance}
                  value={stGramsInput}
                  onChange={(e) => {
                    setStGramsInput(e.target.value);
                    setStErr('');
                  }}
                  placeholder="0.000"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-sm"
                />
                {stGrams > 0 && stCategory !== 'THAI_GOLD' && (
                  <div className="mt-1 text-[11px] text-indigo-700 dark:text-indigo-400 font-mono">
                    ≈ {formatKPYMyanmar(stKpy)}
                  </div>
                )}
              </div>

              {/* Description / Extra Details (Optional) */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'အသေးစိတ် / အကြောင်းအရာ (Optional)' : 'Extra Details / Reason (Optional)'}
                </label>
                <input
                  type="text"
                  value={stDescription}
                  onChange={(e) => {
                    setStDescription(e.target.value);
                    setStErr('');
                  }}
                  placeholder={
                    language === 'MM'
                      ? `${OLD_GOLD_CATEGORY_CONFIG[stCategory].nameMm} ဆိုင်သွင်း`
                      : 'Extra details'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'မှတ်ချက် (Optional)' : 'Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={stNotes}
                  onChange={(e) => setStNotes(e.target.value)}
                  placeholder={language === 'MM' ? 'အပိုဆောင်း မှတ်ချက်' : 'Additional notes'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {stErr && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-semibold">
                  {stErr}
                </div>
              )}

              <button
                type="button"
                disabled={
                  stSaving ||
                  stGrams <= 0 ||
                  !stItemName.trim() ||
                  stGrams > selectedStCategoryBalance + 0.001
                }
                onClick={handleSaveShopTransfer}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 transition shadow-xs cursor-pointer"
              >
                {stSaving ? '...' : language === 'MM' ? 'ဆိုင်သွင်း သိမ်းမည်' : 'Submit Transfer'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Modal: Melt (အရည်ကျို အထွက်) */}
      {meltOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>{language === 'MM' ? 'အဟောင်းထည် → အရည်ကျို (အထွက်)' : 'Old Gold → Gold Melt (Outflow)'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setMeltOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5 text-xs">
              {/* Category Picker */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ရွှေအမျိုးအစား ရွေးချယ်ရန် *' : 'Select Gold Category *'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_KEYS.map((k) => {
                    const cfg = OLD_GOLD_CATEGORY_CONFIG[k];
                    const isSel = meltCategory === k;
                    const bal = categoryStats[k].balanceGrams;

                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setMeltCategory(k);
                          setMeltErr('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSel
                            ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/30 ring-1 ring-orange-500'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                        }`}
                      >
                        <span className="font-bold text-xs text-gray-900 dark:text-white">
                          {language === 'MM' ? cfg.nameMm : cfg.nameEn}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {cfg.puritiesMm}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-orange-600 dark:text-orange-400 mt-1">
                          {language === 'MM' ? 'လက်ကျန်' : 'Avail'}: {bal.toFixed(3)} g
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name (နာမည်) */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'နာမည် / ပြုလုပ်သူ *' : 'Name / Operator *'}
                </label>
                <input
                  type="text"
                  value={meltName}
                  onChange={(e) => {
                    setMeltName(e.target.value);
                    setMeltErr('');
                  }}
                  placeholder={language === 'MM' ? 'ဥပမာ - မီးလင်းအရည်ကျို / ဦးဘ' : 'e.g. Meelin Melt / Operator name'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {/* Description (အကြောင်းအရာ) */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'အကြောင်းအရာ *' : 'Description / Purpose *'}
                </label>
                <input
                  type="text"
                  value={meltDescription}
                  onChange={(e) => {
                    setMeltDescription(e.target.value);
                    setMeltErr('');
                  }}
                  placeholder={
                    language === 'MM'
                      ? 'ဥပမာ - အခေါက်တုံးသွန်းလုပ်ရန် / အရည်ကျိုစစ်ဆေးရန်'
                      : 'e.g. Melt to bar / Refining'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {/* Date (ရက်စွဲ) */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ရက်စွဲ *' : 'Melt Date *'}
                </label>
                <DateInput
                  value={meltDate}
                  onChange={(val) => {
                    setMeltDate(val);
                    setMeltErr('');
                  }}
                  className="w-full"
                />
              </div>

              {/* Grams (စုစုပေါင်းဂရမ်ချိန်) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'စုစုပေါင်းဂရမ်ချိန် *' : 'Total Grams *'}
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {language === 'MM' ? 'အများဆုံး:' : 'Max available:'}{' '}
                    <strong className="font-mono text-orange-600 dark:text-orange-400">
                      {selectedMeltCategoryBalance.toFixed(3)} g
                    </strong>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={selectedMeltCategoryBalance}
                    value={meltGramsInput}
                    onChange={(e) => {
                      setMeltGramsInput(e.target.value);
                      setMeltErr('');
                    }}
                    placeholder="0.000"
                    className="w-full px-3 py-2 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">
                    g
                  </span>
                </div>

                {meltGrams > 0 && (
                  <div className="mt-1.5 p-2 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 text-[11px] text-gray-600 dark:text-gray-300 flex items-center justify-between">
                    <span>{language === 'MM' ? 'မြန်မာအလေးချိန် တွက်ချက်မှု:' : 'Myanmar Weight:'}</span>
                    <strong className="font-medium text-orange-700 dark:text-orange-400">
                      {formatKPYMyanmar(meltKpy)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Craft fee (လက်ခ) */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'လက်ခ (Ks)' : 'Craft fee (Ks)'}
                </label>
                <NumberInput
                  value={meltCraftFee}
                  onChange={setMeltCraftFee}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-xs"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'မှတ်ချက် (Optional)' : 'Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={meltNotes}
                  onChange={(e) => setMeltNotes(e.target.value)}
                  placeholder={language === 'MM' ? 'အပိုဆောင်း မှတ်ချက်' : 'Additional notes'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {meltErr && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-semibold">
                  {meltErr}
                </div>
              )}

              <button
                type="button"
                disabled={
                  meltSaving ||
                  meltGrams <= 0 ||
                  !meltName.trim() ||
                  !meltDescription.trim() ||
                  meltGrams > selectedMeltCategoryBalance + 0.001
                }
                onClick={handleSaveMelt}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs disabled:opacity-50 transition shadow-xs cursor-pointer"
              >
                {meltSaving ? '...' : language === 'MM' ? 'အရည်ကျို စာရင်းသိမ်းမည်' : 'Submit Melt'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Modal: Other Outflow (အခြားအထွက်) */}
      {ooOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                <PackageMinus className="w-4 h-4 text-slate-600" />
                <span>
                  {language === 'MM'
                    ? 'အဟောင်းထည် → အခြားအထွက်'
                    : 'Old Gold → Other Outflow'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setOoOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ရွှေအမျိုးအစား ရွေးချယ်ရန် *' : 'Select Gold Category *'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_KEYS.map((k) => {
                    const cfg = OLD_GOLD_CATEGORY_CONFIG[k];
                    const isSel = ooCategory === k;
                    const bal = categoryStats[k].balanceGrams;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setOoCategory(k);
                          setOoErr('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSel
                            ? 'border-slate-600 bg-slate-50/80 dark:bg-slate-950/40 ring-1 ring-slate-500'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                        }`}
                      >
                        <span className="font-bold text-xs text-gray-900 dark:text-white">
                          {language === 'MM' ? cfg.nameMm : cfg.nameEn}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {cfg.puritiesMm}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {language === 'MM' ? 'လက်ကျန်' : 'Avail'}: {bal.toFixed(3)} g
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'နာမည် *' : 'Name *'}
                </label>
                <input
                  type="text"
                  value={ooName}
                  onChange={(e) => {
                    setOoName(e.target.value);
                    setOoErr('');
                  }}
                  placeholder={language === 'MM' ? 'နာမည် ထည့်ပါ' : 'Enter name'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ပစ္စည်းဖော်ပြချက် *' : 'Item description *'}
                </label>
                <input
                  type="text"
                  value={ooDescription}
                  onChange={(e) => {
                    setOoDescription(e.target.value);
                    setOoErr('');
                  }}
                  placeholder={
                    language === 'MM' ? 'ပစ္စည်း / အကြောင်းအရာ ဖော်ပြချက်' : 'Item / purpose description'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ရက်စွဲ *' : 'Date *'}
                </label>
                <DateInput
                  value={ooDate}
                  onChange={(val) => {
                    setOoDate(val);
                    setOoErr('');
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'ထွက်မည့် ဂရမ်ချိန် *' : 'Outflow grams *'}
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {language === 'MM' ? 'အများဆုံး:' : 'Max:'}{' '}
                    <strong className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedOoCategoryBalance.toFixed(3)} g
                    </strong>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={selectedOoCategoryBalance}
                    value={ooGramsInput}
                    onChange={(e) => {
                      setOoGramsInput(e.target.value);
                      setOoErr('');
                    }}
                    placeholder="0.000"
                    className="w-full px-3 py-2 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">
                    g
                  </span>
                </div>
                {ooGrams > 0 && (
                  <div className="mt-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/30 text-[11px] text-gray-600 dark:text-gray-300 flex items-center justify-between">
                    <span>{language === 'MM' ? 'မြန်မာအလေးချိန်:' : 'Myanmar weight:'}</span>
                    <strong className="font-medium text-slate-700 dark:text-slate-300">
                      {formatKPYMyanmar(ooKpy)}
                    </strong>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ပြန်ရငွေ (Ks)' : 'Amount received (Ks)'}
                </label>
                <NumberInput
                  value={ooReceivedAmount}
                  onChange={setOoReceivedAmount}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'မှတ်ချက် (Optional)' : 'Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={ooNotes}
                  onChange={(e) => setOoNotes(e.target.value)}
                  placeholder={language === 'MM' ? 'အပိုဆောင်း မှတ်ချက်' : 'Additional notes'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {ooErr && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-semibold">
                  {ooErr}
                </div>
              )}

              <button
                type="button"
                disabled={
                  ooSaving ||
                  ooGrams <= 0 ||
                  !ooName.trim() ||
                  !ooDescription.trim() ||
                  ooGrams > selectedOoCategoryBalance + 0.001
                }
                onClick={handleSaveOtherOutflow}
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs disabled:opacity-50 transition shadow-xs cursor-pointer"
              >
                {ooSaving
                  ? '...'
                  : language === 'MM'
                    ? 'အခြားအထွက် စာရင်းသိမ်းမည်'
                    : 'Submit other outflow'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};
