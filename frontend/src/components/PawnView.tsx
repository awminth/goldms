import React, { useEffect, useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import { GoldPurity, PawnInterestPayment, PawnRecord } from '../types/gold';
import { ActiveTab } from './Navigation';
import {
  formatMMK,
  calculateGoldValuation,
  calculateNetWeight,
  kpyToGrams,
  gramsToKpy,
  KYAT_TO_GRAMS,
} from '../utils/goldCalculations';
import {
  ArrowLeft,
  Coins,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useClientPagination } from '../hooks/useClientPagination';
import { PaginationBar } from './PaginationBar';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { NumberInput } from './NumberInput';
import { DateInput } from './DateInput';
import { formatDate } from '../utils/dateFormat';
import { ModalOverlay } from './ModalOverlay';
import { DataTable, type DataTableColumn } from './DataTable';

export type PawnSection =
  | 'list'
  | 'interest-list'
  | 'redeem-list'
  | 'overdue-list'
  | 'form-create'
  | 'form-interest'
  | 'form-redeem';

type Props = {
  section: PawnSection;
  onNavigate: (tab: ActiveTab) => void;
  editId?: string | null;
  onEdit?: (id: string) => void;
  onClearEdit?: () => void;
};

const GOLD_KINDS = [
  { code: 'MYANMAR', mm: 'မြန်မာရွှေ', en: 'Myanmar Gold' },
  { code: 'BAR', mm: 'အခေါက်ရွှေ', en: 'Fine / Bar Gold' },
  { code: 'THAI', mm: 'ထိုင်းရွှေ', en: 'Thai Gold' },
];

function weightDecimal(r: Pick<PawnRecord, 'weight' | 'weight_grams'>): number {
  if (r.weight_grams && r.weight_grams > 0) return Number(r.weight_grams);
  const w = r.weight || { kyat: 0, pae: 0, yway: 0 };
  return Number((w.kyat + w.pae / 16 + w.yway / 128).toFixed(4));
}

function monthsBetween(start: string, end: string): number {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    return Math.max(1, m || 1);
  } catch {
    return 1;
  }
}

function daysBetween(start: string, end: string): number {
  try {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const d = Math.round((e.getTime() - s.getTime()) / 86400000);
    return Math.max(1, d || 1);
  } catch {
    return 1;
  }
}

function fmtNum(n: number | undefined | null, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function pawnLoanIsBaht(r: {
  loan_amount?: number | null;
  loan_amount_baht?: number | null;
}): boolean {
  return Number(r.loan_amount_baht || 0) > 0 && !(Number(r.loan_amount || 0) > 0);
}

function fmtPawnLoan(r: {
  loan_amount?: number | null;
  loan_amount_baht?: number | null;
}): string {
  if (pawnLoanIsBaht(r)) return `${fmtNum(r.loan_amount_baht, 0)} ฿`;
  return formatMMK(Number(r.loan_amount || 0));
}

function fmtPawnInterestAmount(r: {
  interest_kyat?: number | null;
  interest_baht?: number | null;
  loan_amount?: number | null;
  loan_amount_baht?: number | null;
}): string {
  if (pawnLoanIsBaht(r) || (Number(r.interest_baht || 0) > 0 && !(Number(r.interest_kyat || 0) > 0))) {
    return `${fmtNum(r.interest_baht, 0)} ฿`;
  }
  return formatMMK(Number(r.interest_kyat || 0));
}

function fmtPeriodMonthsDays(months?: number | null, days?: number | null): string {
  const m = Math.max(0, Number(months || 0));
  const d = Math.max(0, Number(days || 0));
  if (m <= 0 && d <= 0) return '—';
  const parts: string[] = [];
  if (m > 0) parts.push(`${m} လ`);
  if (d > 0) parts.push(`${d} ရက်`);
  return parts.join(' ');
}

function isOverduePawn(
  r: PawnRecord,
  today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })()
): boolean {
  if (r.status === 'REDEEMED' || r.status === 'CONFISCATED') return false;
  return r.due_date < today;
}

/** Display status from contract due_date (fixes stale OVERDUE in DB). */
function effectivePawnStatus(
  r: Pick<PawnRecord, 'status' | 'due_date'>,
  today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })()
): PawnRecord['status'] {
  if (r.status === 'REDEEMED' || r.status === 'CONFISCATED') return r.status;
  return r.due_date < today ? 'OVERDUE' : 'ACTIVE';
}

function pawnStatusLabel(status: string | undefined | null, language: 'MM' | 'EN'): string {
  const key = String(status || '').toUpperCase();
  const map: Record<string, { mm: string; en: string }> = {
    ACTIVE: { mm: 'ပေါင်ထား', en: 'On Pawn' },
    REDEEMED: { mm: 'ရွေးပြီး', en: 'Redeemed' },
    OVERDUE: { mm: 'ရက်လွန်', en: 'Overdue' },
    CONFISCATED: { mm: 'သိမ်းဆည်းပြီး', en: 'Confiscated' },
  };
  const m = map[key];
  if (!m) return status ? String(status) : '—';
  return language === 'MM' ? m.mm : m.en;
}

function pawnStatusBadgeClass(status: string | undefined | null): string {
  const key = String(status || '').toUpperCase();
  switch (key) {
    case 'ACTIVE':
      return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
    case 'REDEEMED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
    case 'OVERDUE':
      return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
    case 'CONFISCATED':
      return 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

/** Full-row text color by pawn status (list tables). */
function pawnStatusRowClass(status: string | undefined | null): string {
  const key = String(status || '').toUpperCase();
  switch (key) {
    case 'ACTIVE':
      return 'text-sky-700 dark:text-sky-300';
    case 'REDEEMED':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'OVERDUE':
      return 'text-rose-700 dark:text-rose-300';
    case 'CONFISCATED':
      return 'text-slate-600 dark:text-slate-300';
    default:
      return '';
  }
}

function PawnStatusBadge({
  status,
  language,
}: {
  status: string | undefined | null;
  language: 'MM' | 'EN';
}) {
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${pawnStatusBadgeClass(status)}`}
    >
      {pawnStatusLabel(status, language)}
    </span>
  );
}

type DetailField = { label: string; value: React.ReactNode };

type DetailViewState =
  | { kind: 'pawn'; record: PawnRecord }
  | { kind: 'interest'; record: PawnInterestPayment; pawnStatus?: string }
  | { kind: 'redeem'; record: PawnRecord };

const inputCls =
  'w-full min-w-0 box-border px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white text-xs';
const labelCls = 'block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-0.5';
const thCls =
  'px-2 py-2 text-left text-[10px] font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap border-b border-gray-200 dark:border-gray-700';
const tdCls = 'px-2 py-1.5 text-[11px] border-b border-gray-100 dark:border-gray-800 whitespace-nowrap';

export const PawnView: React.FC<Props> = ({ section, onNavigate, editId, onEdit, onClearEdit }) => {
  const {
    pawnRecords,
    pawnInterestPayments,
    addPawnRecord,
    updatePawnRecord,
    deletePawnRecord,
    payPawnInterest,
    deletePawnInterestPayment,
    deletePawnRedeem,
    redeemPawnRecord,
    goldPrices,
    language,
    masterCategories,
    shopSettings,
  } = useGoldShop();
  const dialog = useDialog();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;
  const isForm =
    section === 'form-create' || section === 'form-interest' || section === 'form-redeem';

  const [qSearch, setQSearch] = useState('');
  const [searchTick, setSearchTick] = useState(0);
  const [detailView, setDetailView] = useState<DetailViewState | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formItem, setFormItem] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGoldKind, setFormGoldKind] = useState('MYANMAR');
  const [formItemType, setFormItemType] = useState('RING');
  const [formPurity, setFormPurity] = useState<GoldPurity>('MEELIN');
  const [formStart, setFormStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [formDue, setFormDue] = useState('');
  const [formGrams, setFormGrams] = useState(0);
  const [formKyat, setFormKyat] = useState(0);
  const [formPae, setFormPae] = useState(0);
  const [formYway, setFormYway] = useState(0);
  const [formLoanKyat, setFormLoanKyat] = useState(0);
  const [formLoanBaht, setFormLoanBaht] = useState(0);
  const [formLoanCurrency, setFormLoanCurrency] = useState<'MMK' | 'BAHT'>('MMK');
  const [formRate, setFormRate] = useState(5);
  const [formMonths, setFormMonths] = useState(3);
  const [formDaysPaid, setFormDaysPaid] = useState(30);
  const [formLastInterestPaid, setFormLastInterestPaid] = useState('');
  const [formInterestKyat, setFormInterestKyat] = useState(0);
  const [formInterestBaht, setFormInterestBaht] = useState(0);
  const [formNotes, setFormNotes] = useState('');
  const [formVno, setFormVno] = useState('');
  const [formWeightPartsText, setFormWeightPartsText] = useState('');
  const [discountKyat, setDiscountKyat] = useState(0);
  const [discountBaht, setDiscountBaht] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const productCats = masterCategories.filter((c) => c.category_group === 'PRODUCT' && c.is_active);
  const itemTypeOptions = (() => {
    const base =
      productCats.length > 0
        ? productCats.map((c) => ({ code: c.code, mm: c.name_mm, en: c.name_en }))
        : [
            { code: 'RING', mm: 'လက်စွပ်', en: 'Ring' },
            { code: 'NECKLACE', mm: 'လည်ဆွဲ', en: 'Necklace' },
            { code: 'BRACELET', mm: 'လက်ကောက်', en: 'Bracelet' },
            { code: 'EARRING', mm: 'နားကပ်', en: 'Earrings' },
            { code: 'PENDANT', mm: 'ဆွဲသီး', en: 'Pendant' },
            { code: 'BANGLE', mm: 'လက်ကြပ်', en: 'Bangle' },
          ];
    if (!base.some((o) => o.code === 'MIXED')) {
      base.push({ code: 'MIXED', mm: 'အမယ်စုံ', en: 'Mixed items' });
    }
    return base;
  })();
  const isMixedItems = formItemType === 'MIXED';
  const loanIsBaht = formLoanCurrency === 'BAHT';

  const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const effectivePurity: GoldPurity =
    formGoldKind === 'THAI' ? 'THAI_GOLD' : formPurity || 'MEELIN';
  const specificPrice = goldPrices.find((p) => p.gold_type === effectivePurity)?.price_per_kyat;

  const goldKindLabel = (code?: string) => {
    const g = GOLD_KINDS.find((x) => x.code === code);
    if (g) return language === 'MM' ? g.mm : g.en;
    return code || (language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar');
  };

  const syncWeightFromGrams = (g: number) => {
    setFormGrams(g);
    const kpy = gramsToKpy(g, kyatToGrams);
    setFormKyat(kpy.kyat);
    setFormPae(kpy.pae);
    setFormYway(Number(kpy.yway.toFixed(3)));
  };

  const syncWeightFromKpy = (k: number, p: number, y: number) => {
    setFormKyat(k);
    setFormPae(p);
    setFormYway(y);
    setFormGrams(Number(kpyToGrams({ kyat: k, pae: p, yway: y }, kyatToGrams).toFixed(4)));
  };

  const applyWeightPartsSum = (raw: string) => {
    setFormWeightPartsText(raw);
    const parts = raw
      .split(/[,၊]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    if (parts.length === 0) return;
    const sum = Number(parts.reduce((a, b) => a + b, 0).toFixed(4));
    syncWeightFromGrams(sum);
  };

  const calcInterest = (principal: number, rate: number, months: number) =>
    Math.round((principal * rate * Math.max(0, months)) / 100);

  /** Monthly rate applied pro-rata over days (30-day month). */
  const calcInterestByDays = (principal: number, rate: number, days: number) =>
    Math.round((principal * rate * Math.max(0, days)) / 30 / 100);

  const calcInterestParts = (principal: number, rate: number, months: number, days: number) => {
    const m = Math.max(0, months);
    const d = Math.max(0, days);
    if (m <= 0 && d <= 0) return calcInterest(principal, rate, 1);
    return calcInterest(principal, rate, m) + calcInterestByDays(principal, rate, d);
  };

  const syncInterestFromLoan = (
    kyat: number,
    baht: number,
    rate: number,
    months: number,
    currency: 'MMK' | 'BAHT' = formLoanCurrency
  ) => {
    if (currency === 'BAHT') {
      setFormInterestBaht(calcInterest(baht, rate, Math.max(1, months)));
      setFormInterestKyat(0);
    } else {
      setFormInterestKyat(calcInterest(kyat, rate, Math.max(1, months)));
      setFormInterestBaht(0);
    }
  };

  const syncInterestFromParts = (
    kyat: number,
    baht: number,
    rate: number,
    months: number,
    days: number,
    currency: 'MMK' | 'BAHT' = formLoanCurrency
  ) => {
    if (currency === 'BAHT') {
      setFormInterestBaht(calcInterestParts(baht, rate, months, days));
      setFormInterestKyat(0);
    } else {
      setFormInterestKyat(calcInterestParts(kyat, rate, months, days));
      setFormInterestBaht(0);
    }
  };

  const resetCreateForm = () => {
    setSelectedId(null);
    setFormName('');
    setFormItem('');
    setFormPhone('');
    setFormGoldKind('MYANMAR');
    setFormItemType('RING');
    setFormPurity('MEELIN');
    setFormStart(new Date().toISOString().slice(0, 10));
    setFormDue('');
    setFormGrams(0);
    setFormKyat(0);
    setFormPae(0);
    setFormYway(0);
    setFormLoanKyat(0);
    setFormLoanBaht(0);
    setFormLoanCurrency('MMK');
    setFormRate(5);
    setFormMonths(3);
    setFormDaysPaid(30);
    setFormLastInterestPaid('');
    setFormInterestKyat(0);
    setFormInterestBaht(0);
    setFormNotes('');
    setFormVno('');
    setFormWeightPartsText('');
    setDiscountKyat(0);
    setDiscountBaht(0);
  };

  const loadPawnIntoForm = (r: PawnRecord) => {
    setSelectedId(r.id);
    setFormName(r.customer_name);
    setFormItem(r.item_name);
    setFormPhone(r.customer_phone || '');
    setFormGoldKind(r.gold_kind || 'MYANMAR');
    setFormItemType(r.item_type || 'RING');
    setFormPurity(r.purity);
    setFormStart(r.start_date);
    setFormDue(r.due_date);
    const loanKyat = Number(r.loan_amount || 0);
    const loanBaht = Number(r.loan_amount_baht || 0);
    const currency: 'MMK' | 'BAHT' = loanBaht > 0 && loanKyat <= 0 ? 'BAHT' : 'MMK';
    setFormLoanCurrency(currency);
    setFormLoanKyat(currency === 'MMK' ? loanKyat : 0);
    setFormLoanBaht(currency === 'BAHT' ? loanBaht : 0);
    setFormRate(r.monthly_interest_rate || 5);
    setFormVno(r.vno || '');
    setFormNotes(r.notes || '');
    setFormWeightPartsText('');
    syncWeightFromGrams(weightDecimal(r));
    const today = new Date().toISOString().slice(0, 10);
    const base = r.last_interest_date || r.start_date;
    const rate = r.monthly_interest_rate || 5;
    if (section === 'form-create' && r.loss_months) {
      setFormMonths(Number(r.loss_months));
      if (currency === 'BAHT') {
        setFormInterestBaht(calcInterest(loanBaht, rate, Number(r.loss_months)));
        setFormInterestKyat(0);
      } else {
        setFormInterestKyat(calcInterest(loanKyat, rate, Number(r.loss_months)));
        setFormInterestBaht(0);
      }
    } else if (section === 'form-interest') {
      const prevPays = pawnInterestPayments
        .filter((p) => String(p.pawn_id) === String(r.id))
        .sort((a, b) => {
          const byDate = String(b.payment_date).localeCompare(String(a.payment_date));
          if (byDate !== 0) return byDate;
          return Number(b.id) - Number(a.id);
        });
      const lastPaid = prevPays[0]?.payment_date || '';
      setFormLastInterestPaid(lastPaid);
      const periodBase = lastPaid || r.start_date;
      const days = daysBetween(periodBase, today);
      const months = Math.max(1, Math.round(days / 30) || 1);
      setFormMonths(months);
      setFormDaysPaid(0);
      setFormStart(today);
      syncInterestFromLoan(loanKyat, loanBaht, rate, months, currency);
    } else if (section === 'form-redeem') {
      const prevPays = pawnInterestPayments
        .filter((p) => String(p.pawn_id) === String(r.id))
        .sort((a, b) => {
          const byDate = String(b.payment_date).localeCompare(String(a.payment_date));
          if (byDate !== 0) return byDate;
          return Number(b.id) - Number(a.id);
        });
      const lastPaid = prevPays[0]?.payment_date || '';
      setFormLastInterestPaid(lastPaid);
      const periodBase = lastPaid || r.start_date;
      const daysTotal = daysBetween(periodBase, today);
      const months = Math.floor(daysTotal / 30);
      const days = daysTotal % 30;
      setFormMonths(months);
      setFormDaysPaid(days);
      setFormStart(today);
      syncInterestFromParts(loanKyat, loanBaht, rate, months, days, currency);
    } else {
      const m = monthsBetween(base, today);
      setFormMonths(m);
      if (currency === 'BAHT') {
        setFormInterestBaht(calcInterest(loanBaht, rate, m));
        setFormInterestKyat(0);
      } else {
        setFormInterestKyat(calcInterest(loanKyat, rate, m));
        setFormInterestBaht(0);
      }
    }
    setDiscountKyat(0);
    setDiscountBaht(0);
  };

  useEffect(() => {
    if (!isForm) return;
    if (section === 'form-create') {
      if (editId) {
        const r = pawnRecords.find((p) => p.id === editId);
        if (r) loadPawnIntoForm(r);
      } else {
        resetCreateForm();
      }
    } else {
      resetCreateForm();
      setFormStart(new Date().toISOString().slice(0, 10));
    }
    setMsg('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, editId]);

  const duePreview = (() => {
    if (formDue) return formDue;
    const d = new Date(formStart);
    d.setMonth(d.getMonth() + Number(formMonths || 3));
    return d.toISOString().slice(0, 10);
  })();

  const redeemTotalKyat = Math.max(0, formLoanKyat + formInterestKyat - Number(discountKyat || 0));
  const redeemTotalBaht = Math.max(0, formLoanBaht + formInterestBaht - Number(discountBaht || 0));

  const filterBySearch = (rows: Record<string, unknown>[]) => {
    void searchTick;
    const q = qSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.customer_name,
        r.customer_phone,
        r.item_name,
        r.item_type,
        r.gold_kind,
        r.purity,
        r.vno,
        r.pawn_ticket_no,
        r.status,
        r.status != null ? pawnStatusLabel(String(r.status), 'MM') : '',
        r.status != null ? pawnStatusLabel(String(r.status), 'EN') : '',
        r.voucher_no,
        r.notes,
        r.start_date,
        r.due_date,
        r.payment_date,
        r.redeem_date,
        r.loan_amount != null ? String(r.loan_amount) : '',
        r.loan_amount_baht != null ? String(r.loan_amount_baht) : '',
      ]
        .filter((x) => x != null && String(x).length > 0)
        .map((x) => String(x).toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  };

  const activePawns = useMemo(
    () => pawnRecords.filter((r) => r.status === 'ACTIVE' || r.status === 'OVERDUE'),
    [pawnRecords]
  );
  const redeemedPawns = useMemo(
    () => pawnRecords.filter((r) => r.status === 'REDEEMED'),
    [pawnRecords]
  );

  const pawnById = useMemo(() => {
    const m = new Map<string, PawnRecord>();
    for (const p of pawnRecords) m.set(p.id, p);
    return m;
  }, [pawnRecords]);

  const interestRowsWithStatus = useMemo(
    () =>
      pawnInterestPayments.map((p) => ({
        ...p,
        status: pawnById.get(String(p.pawn_id))?.status,
      })),
    [pawnInterestPayments, pawnById]
  );

  const listPawnRows = filterBySearch(
    activePawns as unknown as Record<string, unknown>[]
  ) as unknown as PawnRecord[];
  const listInterestRows = filterBySearch(
    interestRowsWithStatus as unknown as Record<string, unknown>[]
  ) as unknown as PawnInterestPayment[];
  const listRedeemRows = filterBySearch(
    redeemedPawns as unknown as Record<string, unknown>[]
  ) as unknown as PawnRecord[];
  const overduePawns = useMemo(
    () => pawnRecords.filter((r) => isOverduePawn(r)),
    [pawnRecords]
  );
  const listOverdueRows = filterBySearch(
    overduePawns as unknown as Record<string, unknown>[]
  ) as unknown as PawnRecord[];
  const selectList = filterBySearch(
    activePawns as unknown as Record<string, unknown>[]
  ) as unknown as PawnRecord[];

  const selectPager = useClientPagination(selectList, [searchTick, qSearch, section]);

  const listPawnTotals = useMemo(() => {
    const count = listPawnRows.length;
    const mmk = listPawnRows.reduce((s, r) => s + Number(r.loan_amount || 0), 0);
    const baht = listPawnRows.reduce((s, r) => s + Number(r.loan_amount_baht || 0), 0);
    return { count, mmk, baht };
  }, [listPawnRows]);

  const listInterestTotals = useMemo(() => {
    const count = listInterestRows.length;
    const mmk = listInterestRows.reduce((s, r) => s + Number(r.interest_kyat || 0), 0);
    const baht = listInterestRows.reduce((s, r) => s + Number(r.interest_baht || 0), 0);
    return { count, mmk, baht };
  }, [listInterestRows]);

  const listRedeemTotals = useMemo(() => {
    const count = listRedeemRows.length;
    const mmk = listRedeemRows.reduce((s, r) => s + Number(r.redeem_interest_kyat || 0), 0);
    const baht = listRedeemRows.reduce((s, r) => s + Number(r.redeem_interest_baht || 0), 0);
    return { count, mmk, baht };
  }, [listRedeemRows]);

  const statusHeader = language === 'MM' ? 'အခြေအနေ' : 'Status';
  const dueHeader = language === 'MM' ? 'စာချုပ်နောက်ဆုံးရက်' : 'Contract Due';
  const pawnDateHeader = language === 'MM' ? 'အပေါင်ရက်' : 'Pawn Date';
  const lastInterestHeader =
    language === 'MM' ? 'နောက်ဆုံးအတိုးရက်' : 'Last Interest';

  const summaryChips = (totals: { count: number; mmk: number; baht: number }, interestMode: boolean) => (
    <div className="flex flex-wrap items-center gap-1.5 mr-1">
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-200">
        {language === 'MM' ? 'အရေအတွက်' : 'Count'}{' '}
        <span className="font-mono text-[#996515] dark:text-amber-300">{totals.count}</span>
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-800 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-900">
        {interestMode
          ? language === 'MM'
            ? 'စုစုပေါင်းအတိုး (MMK)'
            : 'Total Interest MMK'
          : language === 'MM'
            ? 'စုစုပေါင်း (MMK)'
            : 'Total MMK'}{' '}
        <span className="font-mono">{formatMMK(totals.mmk)}</span>
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-[10px] font-bold text-sky-800 dark:text-sky-200 border border-sky-200/60 dark:border-sky-900">
        {interestMode
          ? language === 'MM'
            ? 'စုစုပေါင်းအတိုး (Baht)'
            : 'Total Interest Baht'
          : language === 'MM'
            ? 'စုစုပေါင်း (Baht)'
            : 'Total Baht'}{' '}
        <span className="font-mono">
          {totals.baht.toLocaleString(undefined, { maximumFractionDigits: 2 })} ฿
        </span>
      </span>
    </div>
  );

  const title =
    section === 'list' || section === 'form-create'
      ? language === 'MM'
        ? 'အပေါင်စာရင်း'
        : 'Pawn List'
      : section === 'interest-list' || section === 'form-interest'
        ? language === 'MM'
          ? 'အတိုးစာရင်း'
          : 'Interest List'
        : section === 'overdue-list'
          ? language === 'MM'
            ? 'ရက်လွန်အပေါင်များ'
            : 'Overdue Pawns'
          : language === 'MM'
            ? 'အရွေးစာရင်း'
            : 'Redeem List';

  const formTitle =
    section === 'form-create'
      ? editId
        ? language === 'MM'
          ? 'အပေါင် ပြင်ဆင်မည်'
          : 'Edit Pawn'
        : language === 'MM'
          ? 'ပေါင်မည် (အသစ်)'
          : 'New Pawn'
      : section === 'form-interest'
        ? language === 'MM'
          ? 'အတိုးသွင်းမည်'
          : 'Pay Interest'
        : language === 'MM'
          ? 'ပြန်ရွေးမည်'
          : 'Redeem';

  const backTab: ActiveTab =
    section === 'form-create'
      ? 'pawn'
      : section === 'form-interest'
        ? 'pawn-interest'
        : 'pawn-redeem';

  const exportCurrentList = () => {
    if (section === 'list') {
      exportToExcel({
        filename: 'pawn_list',
        sheetName: 'Pawn',
        title: language === 'MM' ? 'အပေါင်စာရင်း' : 'Pawn List',
        rows: listPawnRows,
        columns: [
          { header: 'VNO', value: (r) => r.vno || r.pawn_ticket_no, width: 16 },
          { header: pawnDateHeader, value: (r) => formatDate(r.start_date), width: 12 },
          { header: 'Name', value: (r) => r.customer_name, width: 18 },
          { header: 'Phone', value: (r) => r.customer_phone, width: 14 },
          { header: 'Type', value: (r) => goldKindLabel(r.gold_kind), width: 12 },
          { header: 'Item', value: (r) => r.item_name, width: 22 },
          { header: 'Weight', value: (r) => weightDecimal(r), width: 10 },
          { header: 'Loan Kyat', value: (r) => r.loan_amount, width: 12 },
          { header: 'Loan Baht', value: (r) => r.loan_amount_baht || 0, width: 12 },
          { header: 'Rate%', value: (r) => r.monthly_interest_rate, width: 8 },
          {
            header: lastInterestHeader,
            value: (r) => (r.last_interest_date ? formatDate(r.last_interest_date) : '—'),
            width: 12,
          },
          { header: dueHeader, value: (r) => formatDate(r.due_date), width: 12 },
          {
            header: statusHeader,
            value: (r) => pawnStatusLabel(effectivePawnStatus(r), language),
            width: 12,
          },
        ],
      });
      return;
    }
    if (section === 'interest-list') {
      exportToExcel({
        filename: 'pawn_interest_list',
        sheetName: 'Interest',
        title: language === 'MM' ? 'အတိုးစာရင်း' : 'Interest List',
        rows: listInterestRows,
        columns: [
          { header: 'VNO', value: (r) => r.vno || r.pawn_ticket_no || '', width: 14 },
          { header: 'Payment Date', value: (r) => formatDate(r.payment_date), width: 12 },
          { header: 'Name', value: (r) => r.customer_name, width: 18 },
          { header: 'Item', value: (r) => r.item_name, width: 22 },
          { header: 'Loan', value: (r) => fmtPawnLoan(r), width: 14 },
          { header: 'Rate%', value: (r) => r.interest_rate, width: 8 },
          { header: 'Months', value: (r) => r.months_paid || 0, width: 8 },
          { header: 'Interest', value: (r) => fmtPawnInterestAmount(r), width: 14 },
          { header: dueHeader, value: (r) => formatDate(r.due_date), width: 12 },
          {
            header: statusHeader,
            value: (r) => {
              const p = pawnById.get(String(r.pawn_id));
              return p ? pawnStatusLabel(effectivePawnStatus(p), language) : '—';
            },
            width: 12,
          },
          { header: 'Notes', value: (r) => r.notes || '', width: 20 },
        ],
      });
      return;
    }
    if (section === 'redeem-list') {
      exportToExcel({
        filename: 'pawn_redeem_list',
        sheetName: 'Redeem',
        title: language === 'MM' ? 'အရွေးစာရင်း' : 'Redeem List',
        rows: listRedeemRows,
        columns: [
          { header: 'VNO', value: (r) => r.vno || r.pawn_ticket_no, width: 14 },
          { header: 'Redeem Date', value: (r) => formatDate(r.redeem_date || ''), width: 12 },
          { header: 'Name', value: (r) => r.customer_name, width: 18 },
          { header: 'Item', value: (r) => r.item_name, width: 22 },
          { header: 'Loan', value: (r) => fmtPawnLoan(r), width: 14 },
          { header: 'Rate%', value: (r) => r.monthly_interest_rate, width: 8 },
          {
            header: 'Period',
            value: (r) => fmtPeriodMonthsDays(r.redeem_months, r.redeem_days),
            width: 12,
          },
          {
            header: 'Interest',
            value: (r) =>
              pawnLoanIsBaht(r)
                ? `${fmtNum(r.redeem_interest_baht, 0)} ฿`
                : formatMMK(Number(r.redeem_interest_kyat || 0)),
            width: 14,
          },
          {
            header: 'Discount',
            value: (r) =>
              pawnLoanIsBaht(r)
                ? `${fmtNum(r.discount_baht, 0)} ฿`
                : formatMMK(Number(r.discount_kyat || 0)),
            width: 12,
          },
          {
            header: 'Total',
            value: (r) =>
              pawnLoanIsBaht(r)
                ? `${fmtNum(r.redeem_total_baht, 0)} ฿`
                : formatMMK(Number(r.redeem_total_kyat || 0)),
            width: 14,
          },
          { header: dueHeader, value: (r) => formatDate(r.due_date), width: 12 },
          {
            header: statusHeader,
            value: (r) => pawnStatusLabel(effectivePawnStatus(r), language),
            width: 12,
          },
          { header: 'Notes', value: (r) => r.notes || '', width: 20 },
        ],
      });
      return;
    }
    if (section === 'overdue-list') {
      exportToExcel({
        filename: 'pawn_overdue_list',
        sheetName: 'Overdue',
        title: language === 'MM' ? 'ရက်လွန်အပေါင်များ' : 'Overdue Pawns',
        rows: listOverdueRows,
        columns: [
          { header: 'VNO', value: (r) => r.vno || r.pawn_ticket_no, width: 16 },
          { header: pawnDateHeader, value: (r) => formatDate(r.start_date), width: 12 },
          { header: dueHeader, value: (r) => formatDate(r.due_date), width: 12 },
          { header: 'Name', value: (r) => r.customer_name, width: 18 },
          { header: 'Phone', value: (r) => r.customer_phone, width: 14 },
          { header: 'Item', value: (r) => r.item_name, width: 22 },
          { header: 'Loan Kyat', value: (r) => r.loan_amount, width: 12 },
          { header: 'Rate%', value: (r) => r.monthly_interest_rate, width: 8 },
          {
            header: statusHeader,
            value: (r) => pawnStatusLabel(effectivePawnStatus(r), language),
            width: 12,
          },
        ],
      });
    }
  };

  const exportRowsCount =
    section === 'list'
      ? listPawnRows.length
      : section === 'interest-list'
        ? listInterestRows.length
        : section === 'redeem-list'
          ? listRedeemRows.length
          : section === 'overdue-list'
            ? listOverdueRows.length
            : 0;

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formItem.trim()) return;
    const loanKyat = formLoanCurrency === 'MMK' ? Number(formLoanKyat || 0) : 0;
    const loanBaht = formLoanCurrency === 'BAHT' ? Number(formLoanBaht || 0) : 0;
    if (loanKyat <= 0 && loanBaht <= 0) {
      setMsg(
        language === 'MM'
          ? 'ယူငွေ (ကျပ် သို့မဟုတ် ဘတ်) တစ်ခု ထည့်ပါ'
          : 'Enter loan amount in MMK or Baht'
      );
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const net = calculateNetWeight({ kyat: formKyat, pae: formPae, yway: formYway }, 0, 0);
      const val = calculateGoldValuation(net, effectivePurity, pure16Price, specificPrice);
      const lossMonths = Number(formMonths || 3);
      const principal = formLoanCurrency === 'BAHT' ? loanBaht : loanKyat;
      const payload = {
        customer_name: formName.trim(),
        customer_phone: formPhone.trim(),
        item_name: formItem.trim(),
        item_type: formItemType,
        gold_kind: formGoldKind,
        purity: effectivePurity,
        weight: net,
        weight_grams: formGrams,
        weight_kyat: net.kyat,
        weight_pae: net.pae,
        weight_yway: net.yway,
        evaluated_value: val.goldAmount,
        loan_amount: loanKyat,
        loan_amount_baht: loanBaht,
        monthly_interest_rate: Number(formRate || 5),
        loss_months: lossMonths,
        start_date: formStart,
        due_date: formDue || duePreview,
        notes: formNotes,
        vno: formVno.trim() || undefined,
      };

      if (editId) {
        await updatePawnRecord(editId, payload);
        setMsg(language === 'MM' ? 'ပြင်ဆင်ပြီးပါပြီ' : 'Updated');
      } else {
        const ticketNo = `PWN-${formStart.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
        await addPawnRecord({
          pawn_ticket_no: ticketNo,
          vno: formVno.trim() || `V-${ticketNo}`,
          customer_id: '',
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone,
          item_name: payload.item_name,
          item_type: payload.item_type,
          gold_kind: payload.gold_kind,
          weight: net,
          weight_grams: formGrams,
          purity: effectivePurity,
          evaluated_value: val.goldAmount,
          loan_amount: payload.loan_amount,
          loan_amount_baht: payload.loan_amount_baht,
          monthly_interest_rate: payload.monthly_interest_rate,
          loss_months: lossMonths,
          start_date: formStart,
          due_date: formDue || duePreview,
          status: 'ACTIVE',
          accrued_interest: calcInterest(principal, formRate, 1),
          notes: formNotes,
        });
        setMsg(language === 'MM' ? 'အပေါင် သိမ်းပြီးပါပြီ' : 'Pawn saved');
      }
      onClearEdit?.();
      onNavigate('pawn');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePayInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setMsg(language === 'MM' ? 'စာရင်းမှ တစ်ခုရွေးပါ' : 'Select a pawn first');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await payPawnInterest(selectedId, {
        payment_date: formStart,
        months_paid: Number(formMonths || 1),
        days_paid: Number(formMonths || 1) * 30,
        interest_kyat: loanIsBaht ? 0 : Number(formInterestKyat || 0),
        interest_baht: loanIsBaht ? Number(formInterestBaht || 0) : 0,
        interest_rate: Number(formRate || 5),
        notes: formNotes,
      });
      onNavigate('pawn-interest');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setMsg(language === 'MM' ? 'စာရင်းမှ တစ်ခုရွေးပါ' : 'Select a pawn first');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await redeemPawnRecord(selectedId, loanIsBaht ? redeemTotalBaht : redeemTotalKyat, {
        redeem_date: formStart,
        redeem_months: Number(formMonths || 0),
        redeem_days: Number(formDaysPaid || 0),
        redeem_interest_kyat: loanIsBaht ? 0 : Number(formInterestKyat || 0),
        redeem_interest_baht: loanIsBaht ? Number(formInterestBaht || 0) : 0,
        discount_kyat: loanIsBaht ? 0 : Number(discountKyat || 0),
        discount_baht: loanIsBaht ? Number(discountBaht || 0) : 0,
        redeem_total_kyat: loanIsBaht ? 0 : redeemTotalKyat,
        redeem_total_baht: loanIsBaht ? redeemTotalBaht : 0,
        notes: formNotes,
      });
      onNavigate('pawn-redeem');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePawn = async (id: string) => {
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'အပေါင် ဖျက်မည်' : 'Delete pawn',
      message: language === 'MM' ? 'ဤအပေါင်ကို ဖျက်မလား?' : 'Delete this pawn?',
      confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePawnRecord(id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeleteInterest = async (id: string) => {
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'အတိုးစာရင်း ဖျက်မည်' : 'Delete interest',
      message:
        language === 'MM'
          ? 'ဤအတိုးသွင်းမှတ်တမ်းကို ဖျက်မလား?'
          : 'Delete this interest payment?',
      confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePawnInterestPayment(id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeleteRedeem = async (id: string) => {
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'အရွေးစာရင်း ဖျက်မည်' : 'Delete redeem',
      message:
        language === 'MM'
          ? 'ဤအရွေးမှတ်တမ်းကို ဖျက်ပြီး အပေါင်ကို ပေါင်ထားအဖြစ် ပြန်ထားမလား?'
          : 'Delete this redeem and restore the pawn to On Pawn?',
      confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePawnRedeem(id);
      setDetailView(null);
      setMsg(language === 'MM' ? 'အရွေးဖျက်ပြီးပါပြီ' : 'Redeem deleted');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const detailFields = ((): DetailField[] => {
    if (!detailView) return [];
    if (detailView.kind === 'pawn') {
      const r = detailView.record;
      return [
        { label: 'VNO', value: r.vno || r.pawn_ticket_no },
        { label: language === 'MM' ? 'အမည်' : 'Name', value: r.customer_name },
        { label: language === 'MM' ? 'ဖုန်း' : 'Phone', value: r.customer_phone || '—' },
        { label: language === 'MM' ? 'ပစ္စည်း' : 'Item', value: r.item_name },
        { label: language === 'MM' ? 'အမျိုးအစား' : 'Type', value: goldKindLabel(r.gold_kind) },
        { label: language === 'MM' ? 'အလေးချိန်' : 'Weight', value: fmtNum(weightDecimal(r), 4) },
        { label: language === 'MM' ? 'ယူငွေ' : 'Loan', value: fmtPawnLoan(r) },
        { label: language === 'MM' ? 'အတိုး%' : 'Rate%', value: r.monthly_interest_rate },
        { label: language === 'MM' ? 'အပေါင်ရက်' : 'Pawn Date', value: formatDate(r.start_date) },
        { label: dueHeader, value: formatDate(r.due_date) },
        {
          label: lastInterestHeader,
          value: r.last_interest_date ? formatDate(r.last_interest_date) : '—',
        },
        {
          label: statusHeader,
          value: <PawnStatusBadge status={effectivePawnStatus(r)} language={language} />,
        },
        { label: language === 'MM' ? 'မှတ်ချက်' : 'Notes', value: r.notes || '—' },
      ];
    }
    if (detailView.kind === 'interest') {
      const r = detailView.record;
      const related = pawnById.get(String(r.pawn_id));
      return [
        { label: 'VNO', value: r.vno || r.pawn_ticket_no || r.voucher_no },
        { label: language === 'MM' ? 'သွင်းရက်' : 'Payment Date', value: formatDate(r.payment_date) },
        { label: language === 'MM' ? 'အမည်' : 'Name', value: r.customer_name || '—' },
        { label: language === 'MM' ? 'ပစ္စည်း' : 'Item', value: r.item_name || '—' },
        { label: language === 'MM' ? 'ယူငွေ' : 'Loan', value: fmtPawnLoan(r) },
        { label: language === 'MM' ? 'အတိုး%' : 'Rate%', value: r.interest_rate },
        {
          label: language === 'MM' ? 'သွင်းရက်စာ' : 'Period',
          value: `${r.months_paid || 0} လ`,
        },
        { label: language === 'MM' ? 'အတိုး' : 'Interest', value: fmtPawnInterestAmount(r) },
        { label: dueHeader, value: formatDate(r.due_date || '') },
        {
          label: statusHeader,
          value: (
            <PawnStatusBadge
              status={related ? effectivePawnStatus(related) : detailView.pawnStatus}
              language={language}
            />
          ),
        },
        { label: language === 'MM' ? 'မှတ်ချက်' : 'Notes', value: r.notes || '—' },
      ];
    }
    const r = detailView.record;
    return [
      { label: 'VNO', value: r.vno || r.pawn_ticket_no },
      { label: language === 'MM' ? 'ရွေးရက်' : 'Redeem Date', value: formatDate(r.redeem_date || '') },
      { label: language === 'MM' ? 'အမည်' : 'Name', value: r.customer_name },
      { label: language === 'MM' ? 'ပစ္စည်း' : 'Item', value: r.item_name },
      { label: language === 'MM' ? 'ယူငွေ' : 'Loan', value: fmtPawnLoan(r) },
      { label: language === 'MM' ? 'အတိုး%' : 'Rate%', value: r.monthly_interest_rate },
      {
        label: language === 'MM' ? 'သွင်းရက်စာ' : 'Period',
        value: fmtPeriodMonthsDays(r.redeem_months, r.redeem_days),
      },
      {
        label: language === 'MM' ? 'အတိုး' : 'Interest',
        value: pawnLoanIsBaht(r)
          ? `${fmtNum(r.redeem_interest_baht, 0)} ฿`
          : formatMMK(Number(r.redeem_interest_kyat || 0)),
      },
      {
        label: 'Discount',
        value: pawnLoanIsBaht(r)
          ? `${fmtNum(r.discount_baht, 0)} ฿`
          : formatMMK(Number(r.discount_kyat || 0)),
      },
      {
        label: language === 'MM' ? 'စုစုပေါင်း' : 'Total',
        value: pawnLoanIsBaht(r)
          ? `${fmtNum(r.redeem_total_baht, 0)} ฿`
          : formatMMK(Number(r.redeem_total_kyat || 0)),
      },
      { label: dueHeader, value: formatDate(r.due_date) },
      {
        label: statusHeader,
        value: <PawnStatusBadge status={effectivePawnStatus(r)} language={language} />,
      },
      { label: language === 'MM' ? 'မှတ်ချက်' : 'Notes', value: r.notes || '—' },
    ];
  })();

  const pawnListColumns = useMemo<DataTableColumn<PawnRecord>[]>(
    () => [
      {
        id: 'vno',
        header: 'VNO',
        slot: 'primary',
        accessor: (r) => r.vno || r.pawn_ticket_no,
        cell: (r) => (
          <span className="font-mono font-bold whitespace-nowrap">{r.vno || r.pawn_ticket_no}</span>
        ),
      },
      {
        id: 'start_date',
        header: pawnDateHeader,
        slot: 'primary',
        accessor: (r) => r.start_date,
        cell: (r) => (
          <span className="font-mono text-[11px] whitespace-nowrap">{formatDate(r.start_date)}</span>
        ),
      },
      {
        id: 'name',
        header: language === 'MM' ? 'အမည်' : 'Name',
        slot: 'primary',
        accessor: (r) => r.customer_name,
        cell: (r) => <span className="font-semibold truncate block max-w-[120px]">{r.customer_name}</span>,
      },
      {
        id: 'item',
        header: language === 'MM' ? 'ပစ္စည်း' : 'Item',
        slot: 'primary',
        accessor: (r) => r.item_name,
        cell: (r) => <span className="truncate block max-w-[120px]">{r.item_name}</span>,
      },
      {
        id: 'loan',
        header: language === 'MM' ? 'ယူငွေ' : 'Loan',
        slot: 'primary',
        accessor: (r) => Number(r.loan_amount || 0) + Number(r.loan_amount_baht || 0),
        cell: (r) => <span className="font-mono font-bold whitespace-nowrap">{fmtPawnLoan(r)}</span>,
      },
      {
        id: 'status',
        header: statusHeader,
        slot: 'primary',
        accessor: (r) => effectivePawnStatus(r),
        cell: (r) => <PawnStatusBadge status={effectivePawnStatus(r)} language={language} />,
      },
      {
        id: 'phone',
        header: language === 'MM' ? 'ဖုန်း' : 'Phone',
        slot: 'detail',
        accessor: (r) => r.customer_phone || '',
        cell: (r) => <span className="font-mono">{r.customer_phone || '—'}</span>,
      },
      {
        id: 'type',
        header: language === 'MM' ? 'အမျိုးအစား' : 'Type',
        slot: 'detail',
        accessor: (r) => r.gold_kind,
        cell: (r) => goldKindLabel(r.gold_kind),
      },
      {
        id: 'weight',
        header: language === 'MM' ? 'အလေးချိန်' : 'Weight',
        slot: 'detail',
        accessor: (r) => weightDecimal(r),
        cell: (r) => <span className="font-mono">{fmtNum(weightDecimal(r), 4)}</span>,
      },
      {
        id: 'loan_mmk',
        header: language === 'MM' ? 'ယူငွေ(ကျပ်)' : 'Loan MMK',
        slot: 'detail',
        accessor: (r) => r.loan_amount,
        cell: (r) => formatMMK(r.loan_amount),
      },
      {
        id: 'loan_baht',
        header: language === 'MM' ? 'ယူငွေ(ဘတ်)' : 'Loan Baht',
        slot: 'detail',
        accessor: (r) => r.loan_amount_baht || 0,
        cell: (r) => fmtNum(r.loan_amount_baht, 0),
      },
      {
        id: 'rate',
        header: language === 'MM' ? 'အတိုး%' : 'Rate%',
        slot: 'detail',
        accessor: (r) => r.monthly_interest_rate,
        cell: (r) => r.monthly_interest_rate,
      },
      {
        id: 'last_interest',
        header: lastInterestHeader,
        slot: 'detail',
        accessor: (r) => r.last_interest_date || '',
        cell: (r) => (r.last_interest_date ? formatDate(r.last_interest_date) : '—'),
      },
      {
        id: 'due',
        header: dueHeader,
        slot: 'detail',
        accessor: (r) => r.due_date,
        cell: (r) => formatDate(r.due_date),
      },
      {
        id: 'notes',
        header: language === 'MM' ? 'မှတ်ချက်' : 'Notes',
        slot: 'detail',
        accessor: (r) => r.notes || '',
        cell: (r) => r.notes || '—',
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
        slot: 'action',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (r) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700"
              title={language === 'MM' ? 'ကြည့်မည်' : 'View'}
              onClick={() => setDetailView({ kind: 'pawn', record: r })}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
              title="Edit"
              onClick={() => onEdit?.(r.id)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
              title="Delete"
              onClick={() => handleDeletePawn(r.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [language, pawnDateHeader, statusHeader, lastInterestHeader, dueHeader, onEdit]
  );

  const interestListColumns = useMemo<DataTableColumn<PawnInterestPayment>[]>(
    () => [
      {
        id: 'vno',
        header: 'VNO',
        slot: 'primary',
        accessor: (r) => r.vno || r.pawn_ticket_no || r.voucher_no || '',
        cell: (r) => (
          <span className="font-mono font-bold whitespace-nowrap">
            {r.vno || r.pawn_ticket_no || r.voucher_no}
          </span>
        ),
      },
      {
        id: 'payment_date',
        header: language === 'MM' ? 'သွင်းရက်' : 'Payment Date',
        slot: 'primary',
        accessor: (r) => r.payment_date,
        cell: (r) => (
          <span className="font-mono text-[11px] whitespace-nowrap">{formatDate(r.payment_date)}</span>
        ),
      },
      {
        id: 'name',
        header: language === 'MM' ? 'အမည်' : 'Name',
        slot: 'primary',
        accessor: (r) => r.customer_name,
        cell: (r) => <span className="font-semibold truncate block max-w-[120px]">{r.customer_name}</span>,
      },
      {
        id: 'item',
        header: language === 'MM' ? 'ပစ္စည်း' : 'Item',
        slot: 'primary',
        accessor: (r) => r.item_name || '',
        cell: (r) => <span className="truncate block max-w-[120px]">{r.item_name || '—'}</span>,
      },
      {
        id: 'interest_amt',
        header: language === 'MM' ? 'အတိုး' : 'Interest',
        slot: 'primary',
        accessor: (r) => Number(r.interest_kyat || 0) + Number(r.interest_baht || 0),
        cell: (r) => (
          <span className="font-mono font-bold whitespace-nowrap">{fmtPawnInterestAmount(r)}</span>
        ),
      },
      {
        id: 'status',
        header: statusHeader,
        slot: 'primary',
        accessor: (r) => {
          const p = pawnById.get(String(r.pawn_id));
          return p ? effectivePawnStatus(p) : '';
        },
        cell: (r) => {
          const p = pawnById.get(String(r.pawn_id));
          return (
            <PawnStatusBadge
              status={p ? effectivePawnStatus(p) : undefined}
              language={language}
            />
          );
        },
      },
      {
        id: 'loan',
        header: language === 'MM' ? 'ယူငွေ' : 'Loan',
        slot: 'detail',
        accessor: (r) => fmtPawnLoan(r),
        cell: (r) => fmtPawnLoan(r),
      },
      {
        id: 'rate',
        header: language === 'MM' ? 'အတိုး%' : 'Rate%',
        slot: 'detail',
        accessor: (r) => r.interest_rate,
        cell: (r) => r.interest_rate,
      },
      {
        id: 'days',
        header: language === 'MM' ? 'သွင်းရက်စာ' : 'Months',
        slot: 'detail',
        accessor: (r) => r.months_paid || 0,
        cell: (r) => `${r.months_paid || 0} လ`,
      },
      {
        id: 'due',
        header: dueHeader,
        slot: 'detail',
        accessor: (r) => r.due_date || '',
        cell: (r) => formatDate(r.due_date || ''),
      },
      {
        id: 'notes',
        header: language === 'MM' ? 'မှတ်ချက်' : 'Notes',
        slot: 'detail',
        accessor: (r) => r.notes || '',
        cell: (r) => r.notes || '—',
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
        slot: 'action',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (r) => {
          const related = pawnById.get(String(r.pawn_id));
          const pawnStatus = related ? effectivePawnStatus(related) : undefined;
          return (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700"
                title={language === 'MM' ? 'ကြည့်မည်' : 'View'}
                onClick={() => setDetailView({ kind: 'interest', record: r, pawnStatus })}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                title={language === 'MM' ? 'ဖျက်မည်' : 'Delete'}
                onClick={() => handleDeleteInterest(r.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [language, statusHeader, dueHeader, pawnById]
  );

  const redeemListColumns = useMemo<DataTableColumn<PawnRecord>[]>(
    () => [
      {
        id: 'vno',
        header: 'VNO',
        slot: 'primary',
        accessor: (r) => r.vno || r.pawn_ticket_no,
        cell: (r) => (
          <span className="font-mono font-bold whitespace-nowrap">{r.vno || r.pawn_ticket_no}</span>
        ),
      },
      {
        id: 'redeem_date',
        header: language === 'MM' ? 'ရွေးရက်' : 'Redeem Date',
        slot: 'primary',
        accessor: (r) => r.redeem_date || '',
        cell: (r) => (
          <span className="font-mono text-[11px] whitespace-nowrap">
            {formatDate(r.redeem_date || '')}
          </span>
        ),
      },
      {
        id: 'name',
        header: language === 'MM' ? 'အမည်' : 'Name',
        slot: 'primary',
        accessor: (r) => r.customer_name,
        cell: (r) => <span className="font-semibold truncate block max-w-[120px]">{r.customer_name}</span>,
      },
      {
        id: 'item',
        header: language === 'MM' ? 'ပစ္စည်း' : 'Item',
        slot: 'primary',
        accessor: (r) => r.item_name,
        cell: (r) => <span className="truncate block max-w-[120px]">{r.item_name}</span>,
      },
      {
        id: 'total',
        header: language === 'MM' ? 'စုစုပေါင်း' : 'Total',
        slot: 'primary',
        accessor: (r) =>
          pawnLoanIsBaht(r)
            ? Number(r.redeem_total_baht || 0)
            : Number(r.redeem_total_kyat || 0),
        cell: (r) => (
          <span className="font-mono font-bold whitespace-nowrap">
            {pawnLoanIsBaht(r)
              ? `${fmtNum(r.redeem_total_baht, 0)} ฿`
              : formatMMK(Number(r.redeem_total_kyat || 0))}
          </span>
        ),
      },
      {
        id: 'status',
        header: statusHeader,
        slot: 'primary',
        accessor: (r) => r.status,
        cell: (r) => <PawnStatusBadge status={r.status} language={language} />,
      },
      {
        id: 'loan',
        header: language === 'MM' ? 'ယူငွေ' : 'Loan',
        slot: 'detail',
        accessor: (r) => fmtPawnLoan(r),
        cell: (r) => fmtPawnLoan(r),
      },
      {
        id: 'rate',
        header: language === 'MM' ? 'အတိုး%' : 'Rate%',
        slot: 'detail',
        accessor: (r) => r.monthly_interest_rate,
        cell: (r) => r.monthly_interest_rate,
      },
      {
        id: 'days',
        header: language === 'MM' ? 'သွင်းရက်စာ' : 'Period',
        slot: 'detail',
        accessor: (r) =>
          `${Number(r.redeem_months || 0)}-${Number(r.redeem_days || 0)}`,
        cell: (r) => fmtPeriodMonthsDays(r.redeem_months, r.redeem_days),
      },
      {
        id: 'interest',
        header: language === 'MM' ? 'အတိုး' : 'Interest',
        slot: 'detail',
        accessor: (r) =>
          pawnLoanIsBaht(r)
            ? Number(r.redeem_interest_baht || 0)
            : Number(r.redeem_interest_kyat || 0),
        cell: (r) =>
          pawnLoanIsBaht(r)
            ? `${fmtNum(r.redeem_interest_baht, 0)} ฿`
            : formatMMK(Number(r.redeem_interest_kyat || 0)),
      },
      {
        id: 'discount',
        header: 'Discount',
        slot: 'detail',
        accessor: (r) =>
          pawnLoanIsBaht(r) ? Number(r.discount_baht || 0) : Number(r.discount_kyat || 0),
        cell: (r) =>
          pawnLoanIsBaht(r)
            ? `${fmtNum(r.discount_baht, 0)} ฿`
            : formatMMK(Number(r.discount_kyat || 0)),
      },
      {
        id: 'due',
        header: dueHeader,
        slot: 'detail',
        accessor: (r) => r.due_date,
        cell: (r) => formatDate(r.due_date),
      },
      {
        id: 'notes',
        header: language === 'MM' ? 'မှတ်ချက်' : 'Notes',
        slot: 'detail',
        accessor: (r) => r.notes || '',
        cell: (r) => r.notes || '—',
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
        slot: 'action',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (r) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700"
              title={language === 'MM' ? 'ကြည့်မည်' : 'View'}
              onClick={() => setDetailView({ kind: 'redeem', record: r })}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
              title={language === 'MM' ? 'ဖျက်မည်' : 'Delete'}
              onClick={() => handleDeleteRedeem(r.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [language, statusHeader, dueHeader]
  );

  const overdueListColumns = useMemo<DataTableColumn<PawnRecord>[]>(
    () => [
      {
        id: 'vno',
        header: 'VNO',
        slot: 'primary',
        accessor: (r) => r.vno || r.pawn_ticket_no,
        cell: (r) => (
          <span className="font-mono font-bold whitespace-nowrap">{r.vno || r.pawn_ticket_no}</span>
        ),
      },
      {
        id: 'start_date',
        header: pawnDateHeader,
        slot: 'primary',
        accessor: (r) => r.start_date,
        cell: (r) => (
          <span className="font-mono text-[11px] whitespace-nowrap">{formatDate(r.start_date)}</span>
        ),
      },
      {
        id: 'name',
        header: language === 'MM' ? 'အမည်' : 'Name',
        slot: 'primary',
        accessor: (r) => r.customer_name,
        cell: (r) => <span className="font-semibold truncate block max-w-[140px]">{r.customer_name}</span>,
      },
      {
        id: 'due',
        header: dueHeader,
        slot: 'primary',
        accessor: (r) => r.due_date,
        cell: (r) => (
          <span className="font-mono text-[11px] font-bold whitespace-nowrap">
            {formatDate(r.due_date)}
          </span>
        ),
      },
      {
        id: 'status',
        header: statusHeader,
        slot: 'primary',
        accessor: () => 'OVERDUE',
        cell: () => <PawnStatusBadge status="OVERDUE" language={language} />,
      },
      {
        id: 'phone',
        header: language === 'MM' ? 'ဖုန်း' : 'Phone',
        slot: 'detail',
        accessor: (r) => r.customer_phone || '',
        cell: (r) => <span className="font-mono">{r.customer_phone || '—'}</span>,
      },
      {
        id: 'item',
        header: language === 'MM' ? 'ပစ္စည်း' : 'Item',
        slot: 'detail',
        accessor: (r) => r.item_name,
        cell: (r) => r.item_name,
      },
      {
        id: 'weight',
        header: language === 'MM' ? 'အလေးချိန်' : 'Weight',
        slot: 'detail',
        accessor: (r) => weightDecimal(r),
        cell: (r) => <span className="font-mono">{fmtNum(weightDecimal(r), 4)}</span>,
      },
      {
        id: 'loan_mmk',
        header: language === 'MM' ? 'ယူငွေ(ကျပ်)' : 'Loan MMK',
        slot: 'detail',
        accessor: (r) => r.loan_amount,
        cell: (r) => formatMMK(r.loan_amount),
      },
      {
        id: 'loan_baht',
        header: language === 'MM' ? 'ယူငွေ(ဘတ်)' : 'Loan Baht',
        slot: 'detail',
        accessor: (r) => r.loan_amount_baht || 0,
        cell: (r) => fmtNum(r.loan_amount_baht, 0),
      },
      {
        id: 'rate',
        header: language === 'MM' ? 'အတိုး%' : 'Rate%',
        slot: 'detail',
        accessor: (r) => r.monthly_interest_rate,
        cell: (r) => r.monthly_interest_rate,
      },
      {
        id: 'last_interest',
        header: lastInterestHeader,
        slot: 'detail',
        accessor: (r) => r.last_interest_date || '',
        cell: (r) => (r.last_interest_date ? formatDate(r.last_interest_date) : '—'),
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
        slot: 'action',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (r) => (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <button
              type="button"
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700"
              title={language === 'MM' ? 'ကြည့်မည်' : 'View'}
              onClick={() => setDetailView({ kind: 'pawn', record: r })}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold hover:bg-amber-100"
              onClick={() => onNavigate('pawn-interest-new')}
            >
              {language === 'MM' ? 'အတိုး' : 'Interest'}
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100"
              onClick={() => onNavigate('pawn-redeem-new')}
            >
              {language === 'MM' ? 'ရွေး' : 'Redeem'}
            </button>
          </div>
        ),
      },
    ],
    [language, pawnDateHeader, dueHeader, statusHeader, lastInterestHeader, onNavigate]
  );

  const searchBar = (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full">
      <div className="relative flex-1 min-w-0">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          className={`${inputCls} pl-8`}
          value={qSearch}
          onChange={(e) => setQSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearchTick((n) => n + 1);
          }}
          placeholder={
            language === 'MM'
              ? 'အမည် / ပစ္စည်း / VNO / ဖုန်း / Status… ရှာရန်'
              : 'Search name / item / VNO / phone / status…'
          }
        />
      </div>
      <button
        type="button"
        onClick={() => setSearchTick((n) => n + 1)}
        className="h-[34px] px-4 shrink-0 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1"
      >
        <Search className="w-3.5 h-3.5" />
        {language === 'MM' ? 'ရှာဖွေမည်' : 'Search'}
      </button>
    </div>
  );

  const formFields = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 w-full">
        <div className="min-w-0 w-full">
          <label className={labelCls}>လူအမည်</label>
          <input
            className={inputCls}
            required={section === 'form-create'}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            readOnly={section !== 'form-create'}
          />
        </div>
        {section === 'form-create' ? (
          <div className="min-w-0 w-full">
            <label className={labelCls}>ပစ္စည်းအမျိုးအစား</label>
            <select
              className={inputCls}
              value={formItemType}
              onChange={(e) => setFormItemType(e.target.value)}
            >
              {itemTypeOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {language === 'MM' ? o.mm : o.en}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="min-w-0 w-full">
            <label className={labelCls}>ပစ္စည်းအမည်</label>
            <input className={inputCls} value={formItem} readOnly />
          </div>
        )}
        <div className="min-w-0 w-full">
          <label className={labelCls}>ဖုန်းနံပါတ်</label>
          <input
            className={inputCls}
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>VNO</label>
          <input
            className={inputCls}
            value={formVno}
            onChange={(e) => setFormVno(e.target.value)}
            readOnly={section !== 'form-create'}
          />
        </div>
      </div>

      {section === 'form-create' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
          <div className="min-w-0 w-full">
            <label className={labelCls}>အမျိုးအစား (ရွှေ)</label>
            <select
              className={inputCls}
              value={formGoldKind}
              onChange={(e) => {
                setFormGoldKind(e.target.value);
                if (e.target.value === 'THAI') setFormPurity('THAI_GOLD');
                else setFormPurity('MEELIN');
              }}
            >
              {GOLD_KINDS.map((g) => (
                <option key={g.code} value={g.code}>
                  {language === 'MM' ? g.mm : g.en}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 w-full">
            <label className={labelCls}>ပစ္စည်းအမည်</label>
            <input
              className={inputCls}
              required
              value={formItem}
              onChange={(e) => setFormItem(e.target.value)}
              placeholder={
                isMixedItems
                  ? language === 'MM'
                    ? 'ဥပမာ — လက်စွပ်, လည်ဆွဲ, နားကပ်'
                    : 'e.g. Ring, Necklace, Earrings'
                  : undefined
              }
            />
            {isMixedItems && (
              <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                {language === 'MM'
                  ? 'အမယ်စုံ — ပစ္စည်းအမည်များကို "," ခံ၍ ရေးပါ'
                  : 'Mixed — separate item names with commas'}
              </p>
            )}
          </div>
        </div>
      )}

      {section === 'form-interest' || section === 'form-redeem' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
          <div className="min-w-0 w-full">
            <label className={labelCls}>
              {loanIsBaht ? 'ယူငွေ (ဘတ်)' : 'ယူငွေ (ကျပ်)'}
            </label>
            <NumberInput
              className={inputCls}
              value={loanIsBaht ? formLoanBaht : formLoanKyat}
              onChange={() => {}}
              readOnly
            />
          </div>
          <div className="min-w-0 w-full">
            <label className={labelCls}>အတိုးနှုန်း %</label>
            <NumberInput className={inputCls} value={formRate} onChange={() => {}} readOnly />
          </div>
          <div className="min-w-0 w-full">
            <label className={labelCls}>
              {language === 'MM' ? 'စာချုပ် နောက်ဆုံးရက်' : 'Contract due'}
            </label>
            <DateInput className={inputCls} value={formDue} onChange={() => {}} readOnly />
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              {language === 'MM'
                ? 'အပေါင်စာရင်းမှ — ဒီမှာ ပြင်၍မရပါ'
                : 'From pawn record — not editable here'}
            </p>
          </div>
        </div>
      ) : null}

      {section === 'form-create' && isMixedItems && (
        <div className="min-w-0 w-full">
          <label className={labelCls}>
            {language === 'MM'
              ? 'အလေးချိန်များ (g) — "," ခံရေးပါ (အလိုအလျောက် စုစုပေါင်း)'
              : 'Weights (g) — comma-separated (auto total)'}
          </label>
          <input
            className={inputCls}
            value={formWeightPartsText}
            onChange={(e) => applyWeightPartsSum(e.target.value)}
            placeholder={language === 'MM' ? 'ဥပမာ — 10.5, 8.2, 3' : 'e.g. 10.5, 8.2, 3'}
          />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
        <div className="min-w-0 w-full">
          <label className={labelCls}>
            {isMixedItems && section === 'form-create'
              ? language === 'MM'
                ? 'စုစုပေါင်း အလေးချိန် (g)'
                : 'Total weight (g)'
              : 'အလေးချိန် (g)'}
          </label>
          <NumberInput
            step={0.0001}
            className={inputCls}
            value={formGrams}
            onChange={(v) => {
              setFormWeightPartsText('');
              syncWeightFromGrams(v);
            }}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>ကျပ်</label>
          <NumberInput
            className={inputCls}
            value={formKyat}
            onChange={(v) => {
              setFormWeightPartsText('');
              syncWeightFromKpy(v, formPae, formYway);
            }}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>ပဲ</label>
          <NumberInput
            className={inputCls}
            value={formPae}
            onChange={(v) => {
              setFormWeightPartsText('');
              syncWeightFromKpy(formKyat, v, formYway);
            }}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>ရွေး</label>
          <NumberInput
            step={0.1}
            className={inputCls}
            value={formYway}
            onChange={(v) => {
              setFormWeightPartsText('');
              syncWeightFromKpy(formKyat, formPae, v);
            }}
            readOnly={section !== 'form-create'}
          />
        </div>
      </div>

      <div
        className={`grid grid-cols-2 gap-2 w-full ${
          section === 'form-create' ? 'md:grid-cols-3' : 'md:grid-cols-2'
        }`}
      >
        {section === 'form-create' ? (
          <>
            <div className="min-w-0 w-full">
              <label className={labelCls}>ယူငွေ ငွေကြေး</label>
              <select
                className={inputCls}
                value={formLoanCurrency}
                onChange={(e) => {
                  const next = e.target.value as 'MMK' | 'BAHT';
                  setFormLoanCurrency(next);
                  if (next === 'MMK') {
                    setFormLoanBaht(0);
                    setFormInterestBaht(0);
                    setFormInterestKyat(calcInterest(formLoanKyat, formRate, formMonths));
                  } else {
                    setFormLoanKyat(0);
                    setFormInterestKyat(0);
                    setFormInterestBaht(calcInterest(formLoanBaht, formRate, formMonths));
                  }
                }}
              >
                <option value="MMK">{language === 'MM' ? 'ကျပ် (MMK)' : 'MMK'}</option>
                <option value="BAHT">{language === 'MM' ? 'ဘတ် (Baht)' : 'Baht'}</option>
              </select>
            </div>
            <div className="min-w-0 w-full">
              <label className={labelCls}>
                {loanIsBaht ? 'ယူငွေ (ဘတ်)' : 'ယူငွေ (ကျပ်)'}
              </label>
              <NumberInput
                className={inputCls}
                value={loanIsBaht ? formLoanBaht : formLoanKyat}
                onChange={(v) => {
                  if (loanIsBaht) {
                    setFormLoanBaht(v);
                    setFormLoanKyat(0);
                    setFormInterestBaht(calcInterest(v, formRate, formMonths));
                    setFormInterestKyat(0);
                  } else {
                    setFormLoanKyat(v);
                    setFormLoanBaht(0);
                    setFormInterestKyat(calcInterest(v, formRate, formMonths));
                    setFormInterestBaht(0);
                  }
                }}
              />
            </div>
            <div className="min-w-0 w-full">
              <label className={labelCls}>အတိုးနှုန်း %</label>
              <NumberInput
                step={0.1}
                className={inputCls}
                value={formRate}
                onChange={(v) => {
                  setFormRate(v);
                  syncInterestFromLoan(formLoanKyat, formLoanBaht, v, formMonths);
                }}
              />
            </div>
          </>
        ) : section === 'form-interest' || section === 'form-redeem' ? (
          <>
            <div className="min-w-0 w-full">
              <label className={labelCls}>
                {language === 'MM' ? 'နောက်ဆုံးအတိုးပေးရက်' : 'Last interest paid'}
              </label>
              {formLastInterestPaid ? (
                <DateInput
                  className={inputCls}
                  value={formLastInterestPaid}
                  onChange={() => {}}
                  readOnly
                />
              ) : (
                <input
                  className={inputCls}
                  readOnly
                  value={language === 'MM' ? 'မရှိသေးပါ (ပထမအကြိမ်)' : 'None yet (first payment)'}
                />
              )}
            </div>
            <div className="min-w-0 w-full">
              <label className={labelCls}>
                {section === 'form-redeem'
                  ? language === 'MM'
                    ? 'ရွေးရက်'
                    : 'Redeem date'
                  : language === 'MM'
                    ? 'သွင်းရက်'
                    : 'Payment date'}
              </label>
              <DateInput className={inputCls} value={formStart} onChange={setFormStart} />
            </div>
          </>
        ) : null}
      </div>

      {(section === 'form-interest' || section === 'form-redeem') && (
        <div
          className={`grid grid-cols-1 gap-2 w-full ${
            section === 'form-redeem' ? 'md:grid-cols-3' : 'md:grid-cols-2'
          }`}
        >
          {section === 'form-interest' ? (
            <div className="min-w-0 w-full">
              <label className={labelCls}>
                {language === 'MM' ? 'သွင်းရက်စာ (လ)' : 'Months covered'}
              </label>
              <NumberInput
                min={1}
                className={inputCls}
                value={formMonths}
                onChange={(v) => {
                  const months = Math.max(1, v || 1);
                  setFormMonths(months);
                  setFormDaysPaid(0);
                  syncInterestFromLoan(formLoanKyat, formLoanBaht, formRate, months);
                }}
              />
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                {language === 'MM'
                  ? 'နောက်ဆုံးအတိုးပေးရက်မှ ယခုအထိ လစာ (လစဉ်နှုန်း)'
                  : 'Months from last interest paid (monthly rate)'}
              </p>
            </div>
          ) : (
            <>
              <div className="min-w-0 w-full">
                <label className={labelCls}>
                  {language === 'MM' ? 'သွင်းရက်စာ (လ)' : 'Months'}
                </label>
                <NumberInput
                  min={0}
                  className={inputCls}
                  value={formMonths}
                  onChange={(v) => {
                    const months = Math.max(0, v || 0);
                    setFormMonths(months);
                    syncInterestFromParts(
                      formLoanKyat,
                      formLoanBaht,
                      formRate,
                      months,
                      formDaysPaid
                    );
                  }}
                />
              </div>
              <div className="min-w-0 w-full">
                <label className={labelCls}>
                  {language === 'MM' ? 'သွင်းရက်စာ (ရက်)' : 'Days'}
                </label>
                <NumberInput
                  min={0}
                  className={inputCls}
                  value={formDaysPaid}
                  onChange={(v) => {
                    const days = Math.max(0, v || 0);
                    setFormDaysPaid(days);
                    syncInterestFromParts(
                      formLoanKyat,
                      formLoanBaht,
                      formRate,
                      formMonths,
                      days
                    );
                  }}
                />
                <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                  {language === 'MM'
                    ? 'လ နှင့် ရက် သီးခြားထည့်ပါ (ရက်ပြောင်းလဲခြင်းဖြင့် လ မပြောင်းပါ)'
                    : 'Months and days are separate (changing days does not alter months)'}
                </p>
              </div>
            </>
          )}
          <div className="min-w-0 w-full">
            <label className={labelCls}>{loanIsBaht ? 'အတိုး (ဘတ်)' : 'အတိုး (ကျပ်)'}</label>
            <NumberInput
              className={inputCls}
              value={loanIsBaht ? formInterestBaht : formInterestKyat}
              onChange={(v) => {
                if (loanIsBaht) {
                  setFormInterestBaht(v);
                  setFormInterestKyat(0);
                } else {
                  setFormInterestKyat(v);
                  setFormInterestBaht(0);
                }
              }}
            />
          </div>
        </div>
      )}

      {section === 'form-redeem' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
          <div className="min-w-0 w-full">
            <label className={labelCls}>
              {loanIsBaht ? 'Discount (ဘတ်)' : 'Discount (ကျပ်)'}
            </label>
            <NumberInput
              className={inputCls}
              value={loanIsBaht ? discountBaht : discountKyat}
              onChange={(v) => {
                if (loanIsBaht) {
                  setDiscountBaht(v);
                  setDiscountKyat(0);
                } else {
                  setDiscountKyat(v);
                  setDiscountBaht(0);
                }
              }}
            />
          </div>
          <div className="min-w-0 w-full md:col-span-2">
            <label className={labelCls}>
              {loanIsBaht ? 'စုစုပေါင်း (ဘတ်)' : 'စုစုပေါင်း (ကျပ်)'}
            </label>
            <input
              className={`${inputCls} font-bold`}
              readOnly
              value={loanIsBaht ? redeemTotalBaht : redeemTotalKyat}
            />
          </div>
        </div>
      )}

      {section === 'form-create' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
          <div className="min-w-0 w-full">
            <label className={labelCls}>ပေါင်ရက်</label>
            <DateInput
              className={inputCls}
              value={formStart}
              onChange={(start) => {
                setFormStart(start);
                if (!start) return;
                const d = new Date(start);
                d.setMonth(d.getMonth() + Number(formMonths || 3));
                setFormDue(d.toISOString().slice(0, 10));
              }}
            />
          </div>
          <div className="min-w-0 w-full">
            <label className={labelCls}>အရှုံးလ</label>
            <NumberInput
              min={1}
              className={inputCls}
              value={formMonths}
              onChange={(v) => {
                const months = Math.max(1, v || 1);
                setFormMonths(months);
                syncInterestFromLoan(formLoanKyat, formLoanBaht, formRate, months);
                const d = new Date(formStart);
                d.setMonth(d.getMonth() + months);
                setFormDue(d.toISOString().slice(0, 10));
              }}
            />
          </div>
          <div className="min-w-0 w-full">
            <label className={labelCls}>နောက်ဆုံးရက် / Due</label>
            <DateInput
              className={inputCls}
              value={formDue || duePreview}
              onChange={setFormDue}
            />
          </div>
        </div>
      )}

      <div className="w-full min-w-0">
        <label className={labelCls}>မှတ်ချက်</label>
        <textarea
          className={inputCls}
          rows={2}
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-3 pb-10 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-[#D4AF37]" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {isForm ? formTitle : title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {section === 'list' && !isForm && summaryChips(listPawnTotals, false)}
          {section === 'interest-list' && !isForm && summaryChips(listInterestTotals, true)}
          {section === 'redeem-list' && !isForm && summaryChips(listRedeemTotals, true)}
          {isForm ? (
              <button
              type="button"
              onClick={() => {
                onClearEdit?.();
                onNavigate(backTab);
              }}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {language === 'MM' ? 'စာရင်းသို့' : 'Back to list'}
              </button>
          ) : (
            <>
              <ExcelExportButton
                language={language}
                onClick={exportCurrentList}
                disabled={exportRowsCount === 0}
              />
              {section !== 'overdue-list' && (
              <button
                  type="button"
                  onClick={() => {
                    onClearEdit?.();
                    if (section === 'list') onNavigate('pawn-new');
                    else if (section === 'interest-list') onNavigate('pawn-interest-new');
                    else onNavigate('pawn-redeem-new');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#C5A059] text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {language === 'MM' ? 'အသစ်' : 'New'}
              </button>
              )}
            </>
          )}
            </div>
          </div>

      {msg && (
        <div className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900">
          {msg}
            </div>
      )}

      {!isForm && searchBar}
      {(section === 'form-interest' || section === 'form-redeem') && searchBar}

      {/* LIST: Pawn */}
      {section === 'list' && (
        <DataTable
          rows={listPawnRows}
          columns={pawnListColumns}
          rowKey={(r) => r.id}
          language={language}
          searchable={false}
          selectable={false}
          resetDeps={[searchTick, qSearch, section]}
          emptyMessage={language === 'MM' ? 'စာရင်းမရှိပါ' : 'No records'}
          rowClassName={(r) => pawnStatusRowClass(effectivePawnStatus(r))}
        />
      )}

      {/* LIST: Interest */}
      {section === 'interest-list' && (
        <DataTable
          rows={listInterestRows}
          columns={interestListColumns}
          rowKey={(r) => r.id}
          language={language}
          searchable={false}
          selectable={false}
          resetDeps={[searchTick, qSearch, section]}
          emptyMessage={language === 'MM' ? 'စာရင်းမရှိပါ' : 'No records'}
          rowClassName={(r) => {
            const p = pawnById.get(String(r.pawn_id));
            return pawnStatusRowClass(p ? effectivePawnStatus(p) : undefined);
          }}
        />
      )}

      {/* LIST: Redeem */}
      {section === 'redeem-list' && (
        <DataTable
          rows={listRedeemRows}
          columns={redeemListColumns}
          rowKey={(r) => r.id}
          language={language}
          searchable={false}
          selectable={false}
          resetDeps={[searchTick, qSearch, section]}
          emptyMessage={language === 'MM' ? 'စာရင်းမရှိပါ' : 'No records'}
          rowClassName={(r) => pawnStatusRowClass(r.status)}
        />
      )}

      {/* LIST: Overdue */}
      {section === 'overdue-list' && (
        <DataTable
          rows={listOverdueRows}
          columns={overdueListColumns}
          rowKey={(r) => r.id}
          language={language}
          searchable={false}
          selectable={false}
          resetDeps={[searchTick, qSearch, section]}
          emptyMessage={language === 'MM' ? 'ရက်လွန် အပေါင် မရှိပါ' : 'No overdue pawns'}
          rowClassName={() => pawnStatusRowClass('OVERDUE')}
        />
      )}

      {/* FORMS */}
      {isForm && (
        <div
          className={`grid grid-cols-1 gap-3 ${
            section === 'form-interest' || section === 'form-redeem' ? 'xl:grid-cols-12' : ''
          }`}
        >
          {(section === 'form-interest' || section === 'form-redeem') && (
            <div className="xl:col-span-5 bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
              <div className="px-3 py-2 text-[11px] font-bold border-b border-gray-200 dark:border-gray-800">
                {language === 'MM' ? 'ရွေးရန် အပေါင်စာရင်း' : 'Select active pawn'}
                </div>
              <div className="w-full max-w-full overflow-y-auto overflow-x-hidden max-h-[42vh]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-[#141414]">
                    <tr>
                      <th className={thCls}>စဉ်</th>
                      <th className={thCls}>အမည်</th>
                      <th className={thCls}>ပစ္စည်း</th>
                      <th className={thCls}>ယူငွေ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectPager.pageItems.map((r, i) => (
                      <tr
                        key={r.id}
                        onClick={() => loadPawnIntoForm(r)}
                        className={`cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 ${
                          selectedId === r.id ? 'bg-amber-100 dark:bg-amber-900/40' : ''
                        }`}
                      >
                        <td className={tdCls}>{selectPager.from + i}</td>
                        <td className={tdCls}>{r.customer_name}</td>
                        <td className={tdCls}>{r.item_name}</td>
                        <td className={tdCls}>{fmtPawnLoan(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 pb-2">
                <PaginationBar
                  language={language}
                  page={selectPager.page}
                  totalPages={selectPager.totalPages}
                  total={selectPager.total}
                  from={selectPager.from}
                  to={selectPager.to}
                  pageSize={selectPager.pageSize}
                  onPageChange={selectPager.setPage}
                  onPageSizeChange={selectPager.setPageSize}
                />
                </div>
                </div>
          )}

          <form
            onSubmit={
              section === 'form-create'
                ? handleCreateOrUpdate
                : section === 'form-interest'
                  ? handlePayInterest
                  : handleRedeem
            }
            className={`bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-3 space-y-3 w-full min-w-0 ${
              section === 'form-create' ? '' : 'xl:col-span-7'
            }`}
          >
            {formFields}
            <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                onClick={() => {
                  onClearEdit?.();
                  onNavigate(backTab);
                }}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#C5A059] text-white text-xs font-bold disabled:opacity-60"
                >
                {saving ? '...' : language === 'MM' ? 'သိမ်းမည်' : 'Save'}
                </button>
              </div>
            </form>
        </div>
      )}

      {detailView && (
        <ModalOverlay onBackdropClick={() => setDetailView(null)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#D4AF37]" />
                <span>
                  {detailView.kind === 'pawn'
                    ? language === 'MM'
                      ? 'အပေါင် အသေးစိတ်'
                      : 'Pawn Detail'
                    : detailView.kind === 'interest'
                      ? language === 'MM'
                        ? 'အတိုး အသေးစိတ်'
                        : 'Interest Detail'
                      : language === 'MM'
                        ? 'အရွေး အသေးစိတ်'
                        : 'Redeem Detail'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setDetailView(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 text-xs">
              {detailFields.map((f) => (
                <div
                  key={f.label}
                  className="grid grid-cols-[140px_1fr] gap-2 items-start border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0"
                >
                  <span className="font-semibold text-gray-500 dark:text-gray-400">{f.label}</span>
                  <span className="text-gray-900 dark:text-gray-100 break-words">{f.value}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setDetailView(null)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              >
                {language === 'MM' ? 'ပိတ်မည်' : 'Close'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};
