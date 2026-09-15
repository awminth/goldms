import React, { useEffect, useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { GoldPurity, PawnInterestPayment, PawnRecord } from '../types/gold';
import { ActiveTab } from './Navigation';
import {
  formatMMK,
  calculateGoldValuation,
  PURITY_LABELS,
  calculateNetWeight,
  kpyToGrams,
  gramsToKpy,
  KYAT_TO_GRAMS,
} from '../utils/goldCalculations';
import {
  AlertOctagon,
  ArrowLeft,
  Coins,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useClientPagination } from '../hooks/useClientPagination';
import { PaginationBar } from './PaginationBar';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';

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

function fmtNum(n: number | undefined | null, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function isOverduePawn(r: PawnRecord, today = new Date().toISOString().slice(0, 10)): boolean {
  if (r.status === 'REDEEMED' || r.status === 'CONFISCATED') return false;
  return r.status === 'OVERDUE' || r.due_date < today;
}

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
    redeemPawnRecord,
    goldPrices,
    language,
    masterCategories,
    shopSettings,
  } = useGoldShop();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;
  const isForm =
    section === 'form-create' || section === 'form-interest' || section === 'form-redeem';

  const [qName, setQName] = useState('');
  const [qItem, setQItem] = useState('');
  const [qFrom, setQFrom] = useState('');
  const [qTo, setQTo] = useState('');
  const [searchTick, setSearchTick] = useState(0);

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
  const [formRate, setFormRate] = useState(5);
  const [formMonths, setFormMonths] = useState(3);
  const [formInterestKyat, setFormInterestKyat] = useState(0);
  const [formInterestBaht, setFormInterestBaht] = useState(0);
  const [formNotes, setFormNotes] = useState('');
  const [formVno, setFormVno] = useState('');
  const [discountKyat, setDiscountKyat] = useState(0);
  const [discountBaht, setDiscountBaht] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const productCats = masterCategories.filter((c) => c.category_group === 'PRODUCT' && c.is_active);
  const itemTypeOptions =
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

  const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const specificPrice = goldPrices.find((p) => p.gold_type === formPurity)?.price_per_kyat;

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

  const calcInterest = (principal: number, rate: number, months: number) =>
    Math.round((principal * rate * Math.max(1, months)) / 100);

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
    setFormRate(5);
    setFormMonths(3);
    setFormInterestKyat(0);
    setFormInterestBaht(0);
    setFormNotes('');
    setFormVno('');
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
    setFormLoanKyat(r.loan_amount);
    setFormLoanBaht(r.loan_amount_baht || 0);
    setFormRate(r.monthly_interest_rate || 5);
    setFormVno(r.vno || '');
    setFormNotes(r.notes || '');
    syncWeightFromGrams(weightDecimal(r));
    const today = new Date().toISOString().slice(0, 10);
    const base = r.last_interest_date || r.start_date;
    const m = monthsBetween(base, today);
    setFormMonths(m);
    setFormInterestKyat(calcInterest(r.loan_amount, r.monthly_interest_rate || 5, m));
    setFormInterestBaht(calcInterest(r.loan_amount_baht || 0, r.monthly_interest_rate || 5, m));
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

  const filterBySearch = <
    T extends {
      customer_name?: string;
      item_name?: string;
      start_date?: string;
      payment_date?: string;
      redeem_date?: string;
    },
  >(
    rows: T[],
    dateKey: 'start_date' | 'payment_date' | 'redeem_date'
  ) => {
    void searchTick;
    return rows.filter((r) => {
      if (qName && !(r.customer_name || '').includes(qName.trim())) return false;
      if (qItem && !(r.item_name || '').includes(qItem.trim())) return false;
      const d = (r as Record<string, string | undefined>)[dateKey] || '';
      if (qFrom && d && d < qFrom) return false;
      if (qTo && d && d > qTo) return false;
      return true;
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

  const listPawnRows = filterBySearch(pawnRecords, 'start_date');
  const listInterestRows = filterBySearch(pawnInterestPayments, 'payment_date');
  const listRedeemRows = filterBySearch(redeemedPawns, 'redeem_date');
  const overduePawns = useMemo(
    () => pawnRecords.filter((r) => isOverduePawn(r)),
    [pawnRecords]
  );
  const listOverdueRows = filterBySearch(overduePawns, 'start_date');
  const selectList = filterBySearch(activePawns, 'start_date');

  const pawnListPager = useClientPagination(listPawnRows, [searchTick, qName, qItem, qFrom, qTo, section]);
  const interestListPager = useClientPagination(listInterestRows, [
    searchTick,
    qName,
    qItem,
    qFrom,
    qTo,
    section,
  ]);
  const redeemListPager = useClientPagination(listRedeemRows, [
    searchTick,
    qName,
    qItem,
    qFrom,
    qTo,
    section,
  ]);
  const overdueListPager = useClientPagination(listOverdueRows, [
    searchTick,
    qName,
    qItem,
    qFrom,
    qTo,
    section,
  ]);
  const selectPager = useClientPagination(selectList, [searchTick, qName, qItem, qFrom, qTo, section]);

  const showOverdueWarning =
    section !== 'overdue-list' && overduePawns.length > 0;

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
          { header: 'Date', value: (r) => r.start_date, width: 12 },
          { header: 'Name', value: (r) => r.customer_name, width: 18 },
          { header: 'Phone', value: (r) => r.customer_phone, width: 14 },
          { header: 'Type', value: (r) => goldKindLabel(r.gold_kind), width: 12 },
          { header: 'Item', value: (r) => r.item_name, width: 22 },
          { header: 'Weight', value: (r) => weightDecimal(r), width: 10 },
          { header: 'Loan Kyat', value: (r) => r.loan_amount, width: 12 },
          { header: 'Loan Baht', value: (r) => r.loan_amount_baht || 0, width: 12 },
          { header: 'Rate%', value: (r) => r.monthly_interest_rate, width: 8 },
          { header: 'Due', value: (r) => r.due_date, width: 12 },
          { header: 'Status', value: (r) => r.status, width: 12 },
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
          { header: 'Voucher', value: (r) => r.voucher_no, width: 14 },
          { header: 'Date', value: (r) => r.payment_date, width: 12 },
          { header: 'Name', value: (r) => r.customer_name, width: 18 },
          { header: 'Type', value: (r) => goldKindLabel(r.gold_kind), width: 12 },
          { header: 'Item', value: (r) => r.item_name, width: 22 },
          {
            header: 'Weight',
            value: (r) =>
              r.weight_grams ||
              (r.weight ? r.weight.kyat + r.weight.pae / 16 + r.weight.yway / 128 : 0),
            width: 10,
          },
          { header: 'Loan Kyat', value: (r) => r.loan_amount || 0, width: 12 },
          { header: 'Interest Kyat', value: (r) => r.interest_kyat, width: 12 },
          { header: 'Interest Baht', value: (r) => r.interest_baht, width: 12 },
          { header: 'Rate%', value: (r) => r.interest_rate, width: 8 },
          { header: 'Months', value: (r) => r.months_paid, width: 8 },
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
          { header: 'Date', value: (r) => r.redeem_date || '', width: 12 },
          { header: 'Name', value: (r) => r.customer_name, width: 18 },
          { header: 'Type', value: (r) => goldKindLabel(r.gold_kind), width: 12 },
          { header: 'Item', value: (r) => r.item_name, width: 22 },
          { header: 'Weight', value: (r) => weightDecimal(r), width: 10 },
          { header: 'Loan Kyat', value: (r) => r.loan_amount, width: 12 },
          { header: 'Interest Kyat', value: (r) => r.redeem_interest_kyat || 0, width: 12 },
          { header: 'Discount', value: (r) => r.discount_kyat || 0, width: 10 },
          { header: 'Total', value: (r) => r.redeem_total_kyat || 0, width: 12 },
          { header: 'Months', value: (r) => r.redeem_months ?? '', width: 8 },
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
          { header: 'Start', value: (r) => r.start_date, width: 12 },
          { header: 'Due', value: (r) => r.due_date, width: 12 },
          { header: 'Name', value: (r) => r.customer_name, width: 18 },
          { header: 'Phone', value: (r) => r.customer_phone, width: 14 },
          { header: 'Item', value: (r) => r.item_name, width: 22 },
          { header: 'Loan Kyat', value: (r) => r.loan_amount, width: 12 },
          { header: 'Rate%', value: (r) => r.monthly_interest_rate, width: 8 },
          { header: 'Status', value: (r) => r.status, width: 12 },
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
    setSaving(true);
    setMsg('');
    try {
      const net = calculateNetWeight({ kyat: formKyat, pae: formPae, yway: formYway }, 0, 0);
      const val = calculateGoldValuation(net, formPurity, pure16Price, specificPrice);
      const lossMonths = Number(formMonths || 3);
      const payload = {
        customer_name: formName.trim(),
        customer_phone: formPhone.trim(),
        item_name: formItem.trim(),
        item_type: formItemType,
        gold_kind: formGoldKind,
        purity: formPurity,
        weight: net,
        weight_grams: formGrams,
        weight_kyat: net.kyat,
        weight_pae: net.pae,
        weight_yway: net.yway,
        evaluated_value: val.goldAmount,
        loan_amount: Number(formLoanKyat || 0),
        loan_amount_baht: Number(formLoanBaht || 0),
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
          purity: formPurity,
          evaluated_value: val.goldAmount,
          loan_amount: payload.loan_amount,
          loan_amount_baht: payload.loan_amount_baht,
          monthly_interest_rate: payload.monthly_interest_rate,
          loss_months: lossMonths,
          start_date: formStart,
          due_date: formDue || duePreview,
          status: 'ACTIVE',
          accrued_interest: calcInterest(formLoanKyat, formRate, 1),
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
        interest_kyat: Number(formInterestKyat || 0),
        interest_baht: Number(formInterestBaht || 0),
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
      await redeemPawnRecord(selectedId, redeemTotalKyat, {
        redeem_date: formStart,
        redeem_months: Number(formMonths || 1),
        redeem_interest_kyat: Number(formInterestKyat || 0),
        redeem_interest_baht: Number(formInterestBaht || 0),
        discount_kyat: Number(discountKyat || 0),
        discount_baht: Number(discountBaht || 0),
        redeem_total_kyat: redeemTotalKyat,
        redeem_total_baht: redeemTotalBaht,
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
    if (!window.confirm(language === 'MM' ? 'ဤအပေါင်ကို ဖျက်မလား?' : 'Delete this pawn?')) return;
    try {
      await deletePawnRecord(id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const searchBar = (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end w-full [&>*]:min-w-0 [&>*]:w-full">
      <div className="w-full min-w-0">
        <label className={labelCls}>{language === 'MM' ? 'လူအမည်' : 'Name'}</label>
        <input className={inputCls} value={qName} onChange={(e) => setQName(e.target.value)} />
      </div>
      <div className="w-full min-w-0">
        <label className={labelCls}>{language === 'MM' ? 'ပစ္စည်းအမည်' : 'Item'}</label>
        <input className={inputCls} value={qItem} onChange={(e) => setQItem(e.target.value)} />
      </div>
      <div className="w-full min-w-0">
        <label className={labelCls}>{language === 'MM' ? 'စနေ့' : 'From'}</label>
        <input type="date" className={inputCls} value={qFrom} onChange={(e) => setQFrom(e.target.value)} />
      </div>
      <div className="w-full min-w-0">
        <label className={labelCls}>{language === 'MM' ? 'ဆုံးနေ့' : 'To'}</label>
        <input type="date" className={inputCls} value={qTo} onChange={(e) => setQTo(e.target.value)} />
      </div>
      <button
        type="button"
        onClick={() => setSearchTick((n) => n + 1)}
        className="h-[34px] w-full min-w-0 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1"
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
        <div className="min-w-0 w-full">
          <label className={labelCls}>ပစ္စည်းအမည်</label>
          <input
            className={inputCls}
            required={section === 'form-create'}
            value={formItem}
            onChange={(e) => setFormItem(e.target.value)}
            readOnly={section !== 'form-create'}
          />
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
          <div className="min-w-0 w-full">
            <label className={labelCls}>အမျိုးအစား (ရွှေ)</label>
            <select
              className={inputCls}
              value={formGoldKind}
              onChange={(e) => {
                setFormGoldKind(e.target.value);
                if (e.target.value === 'THAI') setFormPurity('THAI_GOLD');
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
          <div className="min-w-0 w-full">
            <label className={labelCls}>ရွှေရည်</label>
            <select
              className={inputCls}
              value={formPurity}
              onChange={(e) => setFormPurity(e.target.value as GoldPurity)}
            >
              {Object.entries(PURITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {language === 'MM' ? v.mm : v.en}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
        <div className="min-w-0 w-full">
          <label className={labelCls}>
            {section === 'form-create' ? 'ပေါင်ရက်' : section === 'form-interest' ? 'သွင်းရက်' : 'ရွေးရက်'}
          </label>
          <input
            type="date"
            className={inputCls}
            value={formStart}
            onChange={(e) => setFormStart(e.target.value)}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>နောက်ဆုံးရက် / Due</label>
          <input
            type="date"
            className={inputCls}
            value={section === 'form-create' ? formDue || duePreview : formDue}
            onChange={(e) => setFormDue(e.target.value)}
            readOnly={section !== 'form-create'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
        <div className="min-w-0 w-full">
          <label className={labelCls}>အလေးချိန် (g)</label>
          <input
            type="number"
            step="0.0001"
            className={inputCls}
            value={formGrams}
            onChange={(e) => syncWeightFromGrams(Number(e.target.value))}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>ကျပ်</label>
          <input
            type="number"
            className={inputCls}
            value={formKyat}
            onChange={(e) => syncWeightFromKpy(Number(e.target.value), formPae, formYway)}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>ပဲ</label>
          <input
            type="number"
            className={inputCls}
            value={formPae}
            onChange={(e) => syncWeightFromKpy(formKyat, Number(e.target.value), formYway)}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>ရွေး</label>
          <input
            type="number"
            step="0.1"
            className={inputCls}
            value={formYway}
            onChange={(e) => syncWeightFromKpy(formKyat, formPae, Number(e.target.value))}
            readOnly={section !== 'form-create'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
        <div className="min-w-0 w-full">
          <label className={labelCls}>ယူငွေ (ကျပ်)</label>
          <input
            type="number"
            className={inputCls}
            value={formLoanKyat}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFormLoanKyat(v);
              setFormInterestKyat(calcInterest(v, formRate, formMonths));
            }}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>ယူငွေ (ဘတ်)</label>
          <input
            type="number"
            className={inputCls}
            value={formLoanBaht}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFormLoanBaht(v);
              setFormInterestBaht(calcInterest(v, formRate, formMonths));
            }}
            readOnly={section !== 'form-create'}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>အတိုးနှုန်း %</label>
          <input
            type="number"
            step="0.1"
            className={inputCls}
            value={formRate}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFormRate(v);
              setFormInterestKyat(calcInterest(formLoanKyat, v, formMonths));
              setFormInterestBaht(calcInterest(formLoanBaht, v, formMonths));
            }}
            readOnly={section === 'form-redeem' && !!selectedId}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>လစုစုပေါင်း</label>
          <input
            type="number"
            min={1}
            className={inputCls}
            value={formMonths}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFormMonths(v);
              setFormInterestKyat(calcInterest(formLoanKyat, formRate, v));
              setFormInterestBaht(calcInterest(formLoanBaht, formRate, v));
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
        <div className="min-w-0 w-full">
          <label className={labelCls}>အတိုး (ကျပ်)</label>
          <input
            type="number"
            className={inputCls}
            value={formInterestKyat}
            onChange={(e) => setFormInterestKyat(Number(e.target.value))}
          />
        </div>
        <div className="min-w-0 w-full">
          <label className={labelCls}>အတိုး (ဘတ်)</label>
          <input
            type="number"
            className={inputCls}
            value={formInterestBaht}
            onChange={(e) => setFormInterestBaht(Number(e.target.value))}
          />
        </div>
      </div>

      {section === 'form-redeem' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
          <div className="min-w-0 w-full">
            <label className={labelCls}>Discount (ကျပ်)</label>
            <input
              type="number"
              className={inputCls}
              value={discountKyat}
              onChange={(e) => setDiscountKyat(Number(e.target.value))}
            />
          </div>
          <div className="min-w-0 w-full">
            <label className={labelCls}>Discount (ဘတ်)</label>
            <input
              type="number"
              className={inputCls}
              value={discountBaht}
              onChange={(e) => setDiscountBaht(Number(e.target.value))}
            />
          </div>
          <div className="min-w-0 w-full">
            <label className={labelCls}>စုစုပေါင်း (ကျပ်)</label>
            <input className={`${inputCls} font-bold`} readOnly value={redeemTotalKyat} />
          </div>
          <div className="min-w-0 w-full">
            <label className={labelCls}>စုစုပေါင်း (ဘတ်)</label>
            <input className={`${inputCls} font-bold`} readOnly value={redeemTotalBaht} />
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
        <div className="flex flex-wrap gap-2">
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

      {showOverdueWarning && !isForm && (
        <button
          type="button"
          onClick={() => onNavigate('pawn-overdue')}
          className="w-full text-left flex items-start gap-2 p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs hover:bg-rose-100 dark:hover:bg-rose-950/60 transition"
        >
          <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">
            {language === 'MM'
              ? `ရက်လွန် အပေါင်များ ${overduePawns.length} ခု ရှိနေပါသည် — နှိပ်၍ စာရင်းကြည့်မည်။`
              : `${overduePawns.length} overdue pawn(s) — click to view the list.`}
          </span>
          <span className="shrink-0 font-bold underline underline-offset-2">
            {language === 'MM' ? 'ကြည့်မည်' : 'View'}
          </span>
        </button>
      )}

      {msg && (
        <div className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900">
          {msg}
        </div>
      )}

      {!isForm && searchBar}
      {(section === 'form-interest' || section === 'form-redeem') && searchBar}

      {/* LIST: Pawn */}
      {section === 'list' && (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden p-3 w-full min-w-0 max-w-full">
          <div className="w-full max-w-full overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full min-w-[1100px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-[#141414]">
                <tr>
                  <th className={thCls}>စဉ်</th>
                  <th className={thCls}>VNO</th>
                  <th className={thCls}>ရက်စွဲ</th>
                  <th className={thCls}>အမည်</th>
                  <th className={thCls}>အမျိုးအစား</th>
                  <th className={thCls}>ပစ္စည်း</th>
                  <th className={thCls}>အလေးချိန်</th>
                  <th className={thCls}>ယူငွေ(ကျပ်)</th>
                  <th className={thCls}>ယူငွေ(ဘတ်)</th>
                  <th className={thCls}>အတိုး%</th>
                  <th className={thCls}>Due</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pawnListPager.pageItems.map((r, i) => (
                  <tr key={r.id}>
                    <td className={tdCls}>{pawnListPager.from + i}</td>
                    <td className={tdCls}>{r.vno || r.pawn_ticket_no}</td>
                    <td className={tdCls}>{r.start_date}</td>
                    <td className={tdCls}>{r.customer_name}</td>
                    <td className={tdCls}>{goldKindLabel(r.gold_kind)}</td>
                    <td className={tdCls}>{r.item_name}</td>
                    <td className={tdCls}>{fmtNum(weightDecimal(r), 4)}</td>
                    <td className={tdCls}>{formatMMK(r.loan_amount)}</td>
                    <td className={tdCls}>{fmtNum(r.loan_amount_baht, 0)}</td>
                    <td className={tdCls}>{r.monthly_interest_rate}</td>
                    <td className={tdCls}>{r.due_date}</td>
                    <td className={tdCls}>{r.status}</td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/50"
                          title="Edit"
                          onClick={() => onEdit?.(r.id)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/50"
                          title="Delete"
                          onClick={() => handleDeletePawn(r.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            language={language}
            page={pawnListPager.page}
            totalPages={pawnListPager.totalPages}
            total={pawnListPager.total}
            from={pawnListPager.from}
            to={pawnListPager.to}
            pageSize={pawnListPager.pageSize}
            onPageChange={pawnListPager.setPage}
            onPageSizeChange={pawnListPager.setPageSize}
          />
        </div>
      )}

      {/* LIST: Interest */}
      {section === 'interest-list' && (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden p-3 w-full min-w-0 max-w-full">
          <div className="w-full max-w-full overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full min-w-[1200px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-[#141414]">
                <tr>
                  <th className={thCls}>ဗောင်နံပါတ်</th>
                  <th className={thCls}>ရက်စွဲ</th>
                  <th className={thCls}>အမည်</th>
                  <th className={thCls}>အမျိုးအစား</th>
                  <th className={thCls}>ပစ္စည်း</th>
                  <th className={thCls}>အလေးချိန်</th>
                  <th className={thCls}>ယူငွေ(ကျပ်)</th>
                  <th className={thCls}>အတိုး(ကျပ်)</th>
                  <th className={thCls}>အတိုး(ဘတ်)</th>
                  <th className={thCls}>နှုန်း%</th>
                  <th className={thCls}>လ</th>
                  <th className={thCls}>မှတ်ချက်</th>
                </tr>
              </thead>
              <tbody>
                {interestListPager.pageItems.map((r: PawnInterestPayment) => (
                  <tr key={r.id}>
                    <td className={tdCls}>{r.voucher_no}</td>
                    <td className={tdCls}>{r.payment_date}</td>
                    <td className={tdCls}>{r.customer_name}</td>
                    <td className={tdCls}>{goldKindLabel(r.gold_kind)}</td>
                    <td className={tdCls}>{r.item_name}</td>
                    <td className={tdCls}>
                      {fmtNum(
                        r.weight_grams ||
                          (r.weight ? r.weight.kyat + r.weight.pae / 16 + r.weight.yway / 128 : 0),
                        4
                      )}
                    </td>
                    <td className={tdCls}>{fmtNum(r.loan_amount, 0)}</td>
                    <td className={tdCls}>{fmtNum(r.interest_kyat, 0)}</td>
                    <td className={tdCls}>{fmtNum(r.interest_baht, 0)}</td>
                    <td className={tdCls}>{r.interest_rate}</td>
                    <td className={tdCls}>{r.months_paid}</td>
                    <td className={tdCls}>{r.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            language={language}
            page={interestListPager.page}
            totalPages={interestListPager.totalPages}
            total={interestListPager.total}
            from={interestListPager.from}
            to={interestListPager.to}
            pageSize={interestListPager.pageSize}
            onPageChange={interestListPager.setPage}
            onPageSizeChange={interestListPager.setPageSize}
          />
        </div>
      )}

      {/* LIST: Redeem */}
      {section === 'redeem-list' && (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden p-3 w-full min-w-0 max-w-full">
          <div className="w-full max-w-full overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full min-w-[1100px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-[#141414]">
                <tr>
                  <th className={thCls}>စဉ်</th>
                  <th className={thCls}>ရက်စွဲ</th>
                  <th className={thCls}>အမည်</th>
                  <th className={thCls}>အမျိုးအစား</th>
                  <th className={thCls}>ပစ္စည်း</th>
                  <th className={thCls}>အလေးချိန်</th>
                  <th className={thCls}>ယူငွေ(ကျပ်)</th>
                  <th className={thCls}>အတိုး(ကျပ်)</th>
                  <th className={thCls}>Discount</th>
                  <th className={thCls}>စုစုပေါင်း</th>
                  <th className={thCls}>လ</th>
                  <th className={thCls}>မှတ်ချက်</th>
                </tr>
              </thead>
              <tbody>
                {redeemListPager.pageItems.map((r, i) => (
                  <tr key={r.id}>
                    <td className={tdCls}>{redeemListPager.from + i}</td>
                    <td className={tdCls}>{r.redeem_date || ''}</td>
                    <td className={tdCls}>{r.customer_name}</td>
                    <td className={tdCls}>{goldKindLabel(r.gold_kind)}</td>
                    <td className={tdCls}>{r.item_name}</td>
                    <td className={tdCls}>{fmtNum(weightDecimal(r), 4)}</td>
                    <td className={tdCls}>{fmtNum(r.loan_amount, 0)}</td>
                    <td className={tdCls}>{fmtNum(r.redeem_interest_kyat, 0)}</td>
                    <td className={tdCls}>{fmtNum(r.discount_kyat, 0)}</td>
                    <td className={tdCls}>{fmtNum(r.redeem_total_kyat, 0)}</td>
                    <td className={tdCls}>{r.redeem_months ?? ''}</td>
                    <td className={tdCls}>{r.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            language={language}
            page={redeemListPager.page}
            totalPages={redeemListPager.totalPages}
            total={redeemListPager.total}
            from={redeemListPager.from}
            to={redeemListPager.to}
            pageSize={redeemListPager.pageSize}
            onPageChange={redeemListPager.setPage}
            onPageSizeChange={redeemListPager.setPageSize}
          />
        </div>
      )}

      {/* LIST: Overdue */}
      {section === 'overdue-list' && (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden p-3 w-full min-w-0 max-w-full">
          <div className="w-full max-w-full overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full min-w-[1100px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-[#141414]">
                <tr>
                  <th className={thCls}>စဉ်</th>
                  <th className={thCls}>VNO</th>
                  <th className={thCls}>ပေါင်ရက်</th>
                  <th className={thCls}>Due</th>
                  <th className={thCls}>အမည်</th>
                  <th className={thCls}>ဖုန်း</th>
                  <th className={thCls}>ပစ္စည်း</th>
                  <th className={thCls}>အလေးချိန်</th>
                  <th className={thCls}>ယူငွေ(ကျပ်)</th>
                  <th className={thCls}>အတိုး%</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {overdueListPager.pageItems.map((r, i) => (
                  <tr key={r.id} className="bg-rose-50/40 dark:bg-rose-950/20">
                    <td className={tdCls}>{overdueListPager.from + i}</td>
                    <td className={tdCls}>{r.vno || r.pawn_ticket_no}</td>
                    <td className={tdCls}>{r.start_date}</td>
                    <td className={`${tdCls} font-bold text-rose-600 dark:text-rose-400`}>{r.due_date}</td>
                    <td className={tdCls}>{r.customer_name}</td>
                    <td className={tdCls}>{r.customer_phone}</td>
                    <td className={tdCls}>{r.item_name}</td>
                    <td className={tdCls}>{fmtNum(weightDecimal(r), 4)}</td>
                    <td className={tdCls}>{formatMMK(r.loan_amount)}</td>
                    <td className={tdCls}>{r.monthly_interest_rate}</td>
                    <td className={tdCls}>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                        {r.status === 'OVERDUE' ? 'OVERDUE' : 'DUE PASSED'}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-1.5">
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
                    </td>
                  </tr>
                ))}
                {overdueListPager.total === 0 && (
                  <tr>
                    <td colSpan={12} className={`${tdCls} text-center text-gray-500 py-6`}>
                      {language === 'MM' ? 'ရက်လွန် အပေါင် မရှိပါ' : 'No overdue pawns'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            language={language}
            page={overdueListPager.page}
            totalPages={overdueListPager.totalPages}
            total={overdueListPager.total}
            from={overdueListPager.from}
            to={overdueListPager.to}
            pageSize={overdueListPager.pageSize}
            onPageChange={overdueListPager.setPage}
            onPageSizeChange={overdueListPager.setPageSize}
          />
        </div>
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
              <div className="w-full max-w-full overflow-x-auto overflow-y-auto max-h-[42vh]">
                <table className="w-full min-w-[520px]">
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
                        <td className={tdCls}>{fmtNum(r.loan_amount, 0)}</td>
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
    </div>
  );
};
