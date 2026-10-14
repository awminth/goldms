import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import { CreditDebt, CreditDebtPayment, CreditDebtType, CreditDebtAssetType, CreditDebtStatus } from '../types/gold';
import { formatMMK, kpyToYway } from '../utils/goldCalculations';
import { formatDate, todayISO } from '../utils/dateFormat';
import { DateInput } from './DateInput';
import {
  WalletCards,
  Plus,
  X,
  Pencil,
  Trash2,
  Search,
  HandCoins,
  Scale,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  History,
  Calendar,
  User,
  Phone,
  FileText,
  DollarSign,
  BadgeAlert,
} from 'lucide-react';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { ModalOverlay } from './ModalOverlay';
import { PaginationBar } from './PaginationBar';
import { useClientPagination } from '../hooks/useClientPagination';

function formatGoldKPY(k: number, p: number, y: number): string {
  const parts: string[] = [];
  if (k > 0) parts.push(`${k} ကျပ်`);
  if (p > 0) parts.push(`${p} ပဲ`);
  if (y > 0) parts.push(`${Number(y.toFixed(2))} ရွေး`);
  if (parts.length === 0) return '၀ ကျပ်';
  return parts.join(' ');
}

type Props = {
  /** Optional starting tab when opened from a deep link */
  initialDebtType?: CreditDebtType;
};

export const CreditDebtView: React.FC<Props> = ({ initialDebtType = 'RECEIVABLE' }) => {
  const {
    creditDebts,
    addCreditDebt,
    updateCreditDebt,
    deleteCreditDebt,
    addCreditDebtPayment,
    deleteCreditDebtPayment,
    language,
    can,
  } = useGoldShop();
  const dialog = useDialog();

  const mm = language === 'MM';
  const [debtType, setDebtType] = useState<CreditDebtType>(initialDebtType);
  const isReceivable = debtType === 'RECEIVABLE';

  // Filters (type locked by in-page tab)
  const [search, setSearch] = useState('');
  const [filterAsset, setFilterAsset] = useState<string>('ALL'); // ALL, MONEY, GOLD
  const [filterStatus, setFilterStatus] = useState<string>('ALL'); // ALL, UNSETTLED, PENDING, PARTIAL, SETTLED, CANCELLED
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<CreditDebt | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<CreditDebt | null>(null);
  const [detailDebt, setDetailDebt] = useState<CreditDebt | null>(null);
  const [busy, setBusy] = useState(false);

  // Form State — create = obligation only; paid comes from later settlements
  const [formAssetType, setFormAssetType] = useState<CreditDebtAssetType>('MONEY');
  const [formPersonName, setFormPersonName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formDebtNo, setFormDebtNo] = useState('');
  const [formDate, setFormDate] = useState(() => todayISO());
  const [formStatus, setFormStatus] = useState<CreditDebtStatus>('PENDING');
  const [formNotes, setFormNotes] = useState('');
  const [formGoldQuality, setFormGoldQuality] = useState('၁၆ ပဲရည်');

  // Money / gold totals only (no paid on create)
  const [formTotalAmount, setFormTotalAmount] = useState<number>(0);
  const [formTotalGoldK, setFormTotalGoldK] = useState<number>(0);
  const [formTotalGoldP, setFormTotalGoldP] = useState<number>(0);
  const [formTotalGoldY, setFormTotalGoldY] = useState<number>(0);

  // Payment Form State
  const [payDate, setPayDate] = useState(() => todayISO());
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payGoldK, setPayGoldK] = useState<number>(0);
  const [payGoldP, setPayGoldP] = useState<number>(0);
  const [payGoldY, setPayGoldY] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payNotes, setPayNotes] = useState('');

  // Reset form
  const resetForm = () => {
    setEditingDebt(null);
    setFormAssetType('MONEY');
    setFormPersonName('');
    setFormPhone('');
    setFormAddress('');
    setFormDebtNo('');
    setFormDate(todayISO());
    setFormStatus('PENDING');
    setFormNotes('');
    setFormGoldQuality('၁၆ ပဲရည်');
    setFormTotalAmount(0);
    setFormTotalGoldK(0);
    setFormTotalGoldP(0);
    setFormTotalGoldY(0);
  };

  const openCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEdit = (item: CreditDebt) => {
    setEditingDebt(item);
    setFormAssetType(item.asset_type);
    setFormPersonName(item.person_name);
    setFormPhone(item.phone || '');
    setFormAddress(item.address || '');
    setFormDebtNo(item.debt_no);
    setFormDate(item.date);
    setFormStatus(item.status);
    setFormNotes(item.notes || '');
    setFormGoldQuality(item.gold_quality || '၁၆ ပဲရည်');
    setFormTotalAmount(item.total_amount);
    setFormTotalGoldK(item.total_gold_k);
    setFormTotalGoldP(item.total_gold_p);
    setFormTotalGoldY(item.total_gold_y);
    setIsFormOpen(true);
  };

  const openPayment = (item: CreditDebt) => {
    setPaymentDebt(item);
    setPayDate(todayISO());
    setPayAmount(item.asset_type === 'MONEY' ? item.remaining_amount : 0);
    setPayGoldK(item.asset_type === 'GOLD' ? item.remaining_gold_k : 0);
    setPayGoldP(item.asset_type === 'GOLD' ? item.remaining_gold_p : 0);
    setPayGoldY(item.asset_type === 'GOLD' ? item.remaining_gold_y : 0);
    setPayMethod(item.asset_type === 'GOLD' ? 'GOLD' : 'CASH');
    setPayNotes('');
  };

  const handleSaveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPersonName.trim()) {
      dialog.alert({
        title: mm ? 'သတိပေးချက်' : 'Validation Error',
        message: mm ? 'အမည် ထည့်သွင်းရန် လိုအပ်ပါသည်' : 'Person name is required',
      });
      return;
    }

    if (formAssetType === 'MONEY' && formTotalAmount <= 0) {
      dialog.alert({
        title: mm ? 'သတိပေးချက်' : 'Validation Error',
        message: mm
          ? isReceivable
            ? 'ရရန်ငွေ ပမာဏ ထည့်သွင်းပါ'
            : 'ပေးရန်ငွေ ပမာဏ ထည့်သွင်းပါ'
          : 'Total amount must be greater than 0',
      });
      return;
    }

    if (
      formAssetType === 'GOLD' &&
      kpyToYway(formTotalGoldK, formTotalGoldP, formTotalGoldY) <= 0
    ) {
      dialog.alert({
        title: mm ? 'သတိပေးချက်' : 'Validation Error',
        message: mm
          ? isReceivable
            ? 'ရရန်ရွှေချိန် ထည့်သွင်းပါ'
            : 'ပေးရန်ရွှေချိန် ထည့်သွင်းပါ'
          : 'Total gold weight must be greater than 0',
      });
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        debt_no: formDebtNo.trim() || undefined,
        type: debtType,
        asset_type: formAssetType,
        person_name: formPersonName.trim(),
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        date: formDate,
        notes: formNotes.trim() || undefined,
        gold_quality: formAssetType === 'GOLD' ? formGoldQuality : undefined,
        total_amount: formAssetType === 'MONEY' ? Number(formTotalAmount) : 0,
        total_gold_k: formAssetType === 'GOLD' ? Number(formTotalGoldK) : 0,
        total_gold_p: formAssetType === 'GOLD' ? Number(formTotalGoldP) : 0,
        total_gold_y: formAssetType === 'GOLD' ? Number(formTotalGoldY) : 0,
      };

      if (editingDebt) {
        // Keep paid totals from settlement history; status cancel allowed on edit
        payload.status = formStatus;
        await updateCreditDebt(editingDebt.id, payload);
      } else {
        // New obligation only — settlements happen later via payment modal
        payload.paid_amount = 0;
        payload.paid_gold_k = 0;
        payload.paid_gold_p = 0;
        payload.paid_gold_y = 0;
        payload.status = 'PENDING';
        await addCreditDebt(payload);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (err: unknown) {
      dialog.alert({
        title: mm ? 'မှားယွင်းမှု' : 'Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDebt = async (item: CreditDebt) => {
    const ok = await dialog.confirm({
      title: mm ? 'မှတ်တမ်းဖျက်မည်' : 'Delete Record',
      message: mm
        ? `"${item.person_name}" ၏ အကြွေးမှတ်တမ်း (${item.debt_no}) ကို ဖျက်ရန် သေချာပါသလား?`
        : `Are you sure you want to delete debt record "${item.debt_no}" for ${item.person_name}?`,
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCreditDebt(item.id);
    } catch (err: unknown) {
      dialog.alert({
        title: mm ? 'မှားယွင်းမှု' : 'Error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDebt) return;

    if (paymentDebt.asset_type === 'MONEY' && payAmount <= 0) {
      dialog.alert({
        title: mm ? 'သတိပေးချက်' : 'Validation Error',
        message: mm
          ? paymentDebt.type === 'RECEIVABLE'
            ? 'သွင်းငွေ ပမာဏ ထည့်ပါ'
            : 'ပေးငွေ ပမာဏ ထည့်ပါ'
          : 'Amount must be greater than 0',
      });
      return;
    }

    if (
      paymentDebt.asset_type === 'GOLD' &&
      kpyToYway(payGoldK, payGoldP, payGoldY) <= 0
    ) {
      dialog.alert({
        title: mm ? 'သတိပေးချက်' : 'Validation Error',
        message: mm
          ? paymentDebt.type === 'RECEIVABLE'
            ? 'ရရွှေချိန် ထည့်ပါ'
            : 'ပေးရွှေချိန် ထည့်ပါ'
          : 'Gold weight must be greater than 0',
      });
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        payment_date: payDate,
        payment_method: paymentDebt.asset_type === 'GOLD' ? 'GOLD' : payMethod || 'CASH',
        notes: payNotes.trim() || undefined,
        amount: paymentDebt.asset_type === 'MONEY' ? Number(payAmount) : 0,
        gold_k: paymentDebt.asset_type === 'GOLD' ? Number(payGoldK) : 0,
        gold_p: paymentDebt.asset_type === 'GOLD' ? Number(payGoldP) : 0,
        gold_y: paymentDebt.asset_type === 'GOLD' ? Number(payGoldY) : 0,
      };

      const updated = await addCreditDebtPayment(paymentDebt.id, payload);
      setPaymentDebt(null);
      if (detailDebt && detailDebt.id === updated.id) {
        setDetailDebt(updated);
      }
    } catch (err: unknown) {
      dialog.alert({
        title: mm ? 'မှားယွင်းမှု' : 'Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePayment = async (debt: CreditDebt, payment: CreditDebtPayment) => {
    const ok = await dialog.confirm({
      title: mm ? 'ပေးဆပ်မှုမှတ်တမ်း ဖျက်မည်' : 'Delete Payment',
      message: mm
        ? `ရက်စွဲ ${formatDate(payment.payment_date)} တွင် ပေးဆပ်ခဲ့သော မှတ်တမ်းကို ဖျက်ရန် သေချာပါသလား?`
        : `Delete payment record on ${formatDate(payment.payment_date)}?`,
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = await deleteCreditDebtPayment(debt.id, payment.id);
      if (detailDebt && detailDebt.id === updated.id) {
        setDetailDebt(updated);
      }
    } catch (err: unknown) {
      dialog.alert({
        title: mm ? 'မှားယွင်းမှု' : 'Error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Filtered rows — type locked to this nav page
  const filteredDebts = useMemo(() => {
    return (creditDebts || []).filter((item) => {
      if (item.type !== debtType) return false;
      if (filterAsset !== 'ALL' && item.asset_type !== filterAsset) return false;
      if (filterStatus === 'UNSETTLED') {
        if (item.status === 'SETTLED' || item.status === 'CANCELLED') return false;
      } else if (filterStatus !== 'ALL') {
        if (item.status !== filterStatus) return false;
      }
      if (dateFrom && item.date < dateFrom) return false;
      if (dateTo && item.date > dateTo) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const text = [
          item.debt_no,
          item.person_name,
          item.phone,
          item.address,
          item.notes,
          item.gold_quality,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [creditDebts, debtType, filterAsset, filterStatus, dateFrom, dateTo, search]);

  const pendingByType = useMemo(() => {
    let rec = 0;
    let pay = 0;
    for (const d of creditDebts || []) {
      if (d.status === 'SETTLED' || d.status === 'CANCELLED') continue;
      if (d.type === 'RECEIVABLE') rec += 1;
      else if (d.type === 'PAYABLE') pay += 1;
    }
    return { rec, pay };
  }, [creditDebts]);

  // Pagination hook
  const {
    page,
    pageSize,
    totalPages,
    total,
    from,
    to,
    pageItems,
    setPage,
    setPageSize,
  } = useClientPagination(filteredDebts, [debtType, search, filterAsset, filterStatus, dateFrom, dateTo]);

  // Excel export using xlsx-js-style via exportToExcel
  const handleExportExcel = () => {
    exportToExcel({
      filename: 'credit_debt_records',
      sheetName: 'CreditDebts',
      title: isReceivable
        ? mm
          ? 'အကြွေးရရန်ကျန် စာရင်း'
          : 'Receivables'
        : mm
          ? 'အကြွေးပေးရန် စာရင်း'
          : 'Payables',
      columns: [
        { header: mm ? 'အမှတ်' : 'Record No', value: (d: CreditDebt) => d.debt_no, width: 16 },
        { header: mm ? 'ရက်စွဲ' : 'Date', value: (d: CreditDebt) => d.date, width: 12 },
        {
          header: mm ? 'ပစ္စည်း' : 'Asset',
          value: (d: CreditDebt) =>
            d.asset_type === 'MONEY'
              ? mm
                ? 'ငွေ'
                : 'Money'
              : `${mm ? 'ရွှေ' : 'Gold'}${d.gold_quality ? ` (${d.gold_quality})` : ''}`,
          width: 16,
        },
        { header: mm ? 'အမည်' : 'Name', value: (d: CreditDebt) => d.person_name, width: 20 },
        { header: mm ? 'ဖုန်း' : 'Phone', value: (d: CreditDebt) => d.phone || '-', width: 14 },
        {
          header: mm ? 'စုစုပေါင်း' : 'Total',
          value: (d: CreditDebt) =>
            d.asset_type === 'MONEY'
              ? d.total_amount
              : formatGoldKPY(d.total_gold_k, d.total_gold_p, d.total_gold_y),
          width: 18,
        },
        {
          header: mm ? 'ပေးပြီး/ရပြီး' : 'Settled',
          value: (d: CreditDebt) =>
            d.asset_type === 'MONEY'
              ? d.paid_amount
              : formatGoldKPY(d.paid_gold_k, d.paid_gold_p, d.paid_gold_y),
          width: 18,
        },
        {
          header: mm ? 'ကျန်ရှိ' : 'Remaining',
          value: (d: CreditDebt) =>
            d.asset_type === 'MONEY'
              ? d.remaining_amount
              : formatGoldKPY(d.remaining_gold_k, d.remaining_gold_p, d.remaining_gold_y),
          width: 18,
        },
        {
          header: mm ? 'အခြေအနေ' : 'Status',
          value: (d: CreditDebt) => {
            switch (d.status) {
              case 'PENDING':
                return mm ? 'မပေးရသေး' : 'Pending';
              case 'PARTIAL':
                return mm ? 'တစ်စိတ်တစ်ပိုင်း' : 'Partial';
              case 'SETTLED':
                return mm ? 'ကျေပြီး' : 'Settled';
              case 'CANCELLED':
                return mm ? 'ပယ်ဖျက်' : 'Cancelled';
              default:
                return d.status;
            }
          },
          width: 14,
        },
        { header: mm ? 'မှတ်ချက်' : 'Notes', value: (d: CreditDebt) => d.notes || '', width: 24 },
      ],
      rows: filteredDebts,
    });
  };

  const switchTab = (next: CreditDebtType) => {
    if (next === debtType) return;
    setDebtType(next);
    setSearch('');
    setFilterAsset('ALL');
    setFilterStatus('ALL');
    setDateFrom('');
    setDateTo('');
    setDetailDebt(null);
    setPaymentDebt(null);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/30 dark:from-amber-600/30 dark:to-yellow-500/20 border border-amber-500/30 flex items-center justify-center text-[#B8860B] dark:text-[#E6CA65] shadow-xs">
            <WalletCards className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {mm ? 'အကြွေးပေး / ရရန်ကျန်' : 'Credit & Debt'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {mm
                ? 'ပမာဏ သတ်မှတ်ပြီးမှ ငွေသွင်း / ချေမှတ်တမ်း ထည့်ပါ'
                : 'Register amounts first, then record cash or gold settlements'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <ExcelExportButton
            language={language}
            onClick={handleExportExcel}
            disabled={filteredDebts.length === 0}
            labelMm="Excel ထုတ်မည်"
            labelEn="Export Excel"
          />

          {can('credit_debt', 'create') && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white shadow-xs hover:opacity-95 transition"
            >
              <Plus className="w-4 h-4" />
              {isReceivable
                ? mm
                  ? 'ရရန် အသစ်'
                  : 'New receivable'
                : mm
                  ? 'ပေးရန် အသစ်'
                  : 'New payable'}
            </button>
          )}
        </div>
      </div>

      {/* In-page tabs: receivable vs payable */}
      <div className="bg-white dark:bg-[#1A1A1A] p-1.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => switchTab('RECEIVABLE')}
          className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            isReceivable
              ? 'bg-emerald-500 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#121212]'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          {mm ? 'အကြွေးရရန်ကျန်' : 'Receivables'}
          {pendingByType.rec > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                isReceivable ? 'bg-white/20' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {pendingByType.rec}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => switchTab('PAYABLE')}
          className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            !isReceivable
              ? 'bg-rose-500 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#121212]'
          }`}
        >
          <WalletCards className="w-4 h-4" />
          {mm ? 'အကြွေးပေးရန်' : 'Payables'}
          {pendingByType.pay > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                !isReceivable ? 'bg-white/20' : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
              }`}
            >
              {pendingByType.pay}
            </span>
          )}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#1A1A1A] p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mm ? 'အမည်၊ ဖုန်း၊ အမှတ်၊ မှတ်ချက် ဖြင့် ရှာဖွေပါ...' : 'Search by name, phone, ref, notes...'}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-[#121212] text-xs text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Asset filter */}
          <div>
            <select
              value={filterAsset}
              onChange={(e) => setFilterAsset(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-[#121212] text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              <option value="ALL">{mm ? 'ရွှေ / ငွေ အားလုံး' : 'All Assets'}</option>
              <option value="MONEY">{mm ? 'ငွေသား (Cash)' : 'Money'}</option>
              <option value="GOLD">{mm ? 'ရွှေ (Gold)' : 'Gold'}</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-[#121212] text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              <option value="ALL">{mm ? 'အခြေအနေ အားလုံး' : 'All Statuses'}</option>
              <option value="UNSETTLED">{mm ? 'မပြီးပြတ်သေး (ကျန်ရှိဆဲ)' : 'Unsettled (Active)'}</option>
              <option value="PENDING">{mm ? 'မပေးရသေး (Pending)' : 'Pending'}</option>
              <option value="PARTIAL">{mm ? 'တစ်စိတ်တစ်ပိုင်း (Partial)' : 'Partial'}</option>
              <option value="SETTLED">{mm ? 'ကျေပြီး (Settled)' : 'Settled'}</option>
              <option value="CANCELLED">{mm ? 'ပယ်ဖျက် (Cancelled)' : 'Cancelled'}</option>
            </select>
          </div>
        </div>

        {/* Date Filters & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 font-semibold">{mm ? 'ရက်စွဲ:' : 'Date:'}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono"
            />

            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-amber-600 hover:underline text-[11px] font-bold"
              >
                {mm ? 'ရက်စွဲရှင်းမည်' : 'Clear dates'}
              </button>
            )}
          </div>

          <div className="text-[11px] text-gray-500 font-mono">
            {mm ? `တွေ့ရှိမှတ်တမ်း ${filteredDebts.length} ခု` : `Found ${filteredDebts.length} records`}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F2] dark:bg-[#151515] border-b border-gray-200 dark:border-gray-800 text-[11px] font-bold text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap">{mm ? 'အမှတ်' : 'Ref No'}</th>
                <th className="px-3.5 py-3 whitespace-nowrap">{mm ? 'ရက်စွဲ' : 'Date'}</th>
                <th className="px-3.5 py-3 whitespace-nowrap">{mm ? 'ပစ္စည်း' : 'Asset'}</th>
                <th className="px-3.5 py-3 whitespace-nowrap">{mm ? 'အမည် / ဖုန်း' : 'Party / Phone'}</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">{mm ? 'စုစုပေါင်း' : 'Total'}</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">{mm ? 'ပေး/ရပြီး' : 'Settled'}</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">{mm ? 'ကျန်ရှိ' : 'Remaining'}</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-center">{mm ? 'အခြေအနေ' : 'Status'}</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">{mm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    {mm ? 'မှတ်တမ်း မရှိပါ' : 'No records found'}
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const isMoney = item.asset_type === 'MONEY';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-amber-500/5 transition-colors cursor-pointer"
                      onClick={() => setDetailDebt(item)}
                    >
                      {/* Ref No */}
                      <td className="px-3.5 py-2.5 font-mono font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {item.debt_no}
                      </td>

                      {/* Record date only — settlement dates live on payment history */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-gray-800 dark:text-gray-200">
                        {formatDate(item.date)}
                      </td>

                      {/* Asset */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isMoney ? 'text-gray-700 dark:text-gray-300' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isMoney ? (
                            <>
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{mm ? 'ငွေ' : 'Cash'}</span>
                            </>
                          ) : (
                            <>
                              <Scale className="w-3.5 h-3.5 text-amber-500" />
                              <span>{item.gold_quality || (mm ? 'ရွှေ' : 'Gold')}</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Party */}
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-gray-900 dark:text-white truncate max-w-[180px]">
                          {item.person_name}
                        </div>
                        {item.phone && (
                          <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                            {item.phone}
                          </div>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-3.5 py-2.5 text-right font-mono font-medium whitespace-nowrap">
                        {isMoney ? formatMMK(item.total_amount) : formatGoldKPY(item.total_gold_k, item.total_gold_p, item.total_gold_y)}
                      </td>

                      {/* Paid */}
                      <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {isMoney ? formatMMK(item.paid_amount) : formatGoldKPY(item.paid_gold_k, item.paid_gold_p, item.paid_gold_y)}
                      </td>

                      {/* Remaining */}
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            item.status === 'SETTLED'
                              ? 'text-gray-400 line-through'
                              : item.type === 'RECEIVABLE'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-rose-700 dark:text-rose-300'
                          }
                        >
                          {isMoney
                            ? formatMMK(item.remaining_amount)
                            : formatGoldKPY(
                                item.remaining_gold_k,
                                item.remaining_gold_p,
                                item.remaining_gold_y
                              )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        {item.status === 'SETTLED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            {mm ? 'ကျေပြီး' : 'Settled'}
                          </span>
                        )}
                        {item.status === 'PARTIAL' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            {mm ? 'တစ်စိတ်တစ်ပိုင်း' : 'Partial'}
                          </span>
                        )}
                        {item.status === 'PENDING' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/30">
                            {mm ? 'မပေးရသေး' : 'Pending'}
                          </span>
                        )}
                        {item.status === 'CANCELLED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            {mm ? 'ပယ်ဖျက်' : 'Cancelled'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-3.5 py-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* Payment button */}
                          {item.status !== 'SETTLED' && item.status !== 'CANCELLED' && can('credit_debt', 'update') && (
                            <button
                              type="button"
                              onClick={() => openPayment(item)}
                              title={
                                item.type === 'RECEIVABLE'
                                  ? mm
                                    ? 'ငွေသွင်း / ရငွေ'
                                    : 'Receive'
                                  : mm
                                    ? 'ငွေပေး / ချေမည်'
                                    : 'Pay'
                              }
                              className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition flex items-center gap-1"
                            >
                              <HandCoins className="w-3 h-3" />
                              <span>
                                {item.type === 'RECEIVABLE'
                                  ? mm
                                    ? 'ငွေသွင်း'
                                    : 'Receive'
                                  : mm
                                    ? 'ချေမည်'
                                    : 'Pay'}
                              </span>
                            </button>
                          )}

                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => setDetailDebt(item)}
                            title={mm ? 'အသေးစိတ်ကြည့်ရန်' : 'View details'}
                            className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit button */}
                          {can('credit_debt', 'update') && (
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              title={mm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                              className="p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete button */}
                          {can('credit_debt', 'delete') && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDebt(item)}
                              title={mm ? 'ဖျက်ရန်' : 'Delete'}
                              className="p-1 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-white dark:bg-[#1A1A1A]">
          <PaginationBar
            language={language}
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isFormOpen && (
        <ModalOverlay onBackdropClick={() => setIsFormOpen(false)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-xl w-full border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <WalletCards className="w-4 h-4 text-amber-500" />
                {editingDebt
                  ? isReceivable
                    ? mm
                      ? 'ရရန် ပြင်ဆင်ရန်'
                      : 'Edit receivable'
                    : mm
                      ? 'ပေးရန် ပြင်ဆင်ရန်'
                      : 'Edit payable'
                  : isReceivable
                    ? mm
                      ? 'ရရန် အသစ်ထည့်ရန်'
                      : 'New receivable'
                    : mm
                      ? 'ပေးရန် အသစ်ထည့်ရန်'
                      : 'New payable'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDebt} className="p-5 overflow-y-auto space-y-4">
              {!editingDebt && (
                <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2">
                  {mm
                    ? isReceivable
                      ? '၁) ရရန် ပမာဏသာ သတ်မှတ်ပါ။ ၂) သိမ်းပြီးမှ “ငွေသွင်း” ဖြင့် ငွေသား/ရွှေ ရယူမှတ်ပါ။'
                      : '၁) ပေးရန် ပမာဏသာ သတ်မှတ်ပါ။ ၂) သိမ်းပြီးမှ “ချေမည်” ဖြင့် ငွေသား/ရွှေ ပေးချေမှတ်ပါ။'
                    : isReceivable
                      ? '1) Register amount to receive. 2) After saving, record receipts via Receive.'
                      : '1) Register amount to pay. 2) After saving, settle via Pay.'}
                </p>
              )}

              {/* Asset Type Toggle: MONEY vs GOLD */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {mm ? 'ပေး/ရ မည့် ပုံစံ' : 'Owed as'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAssetType('MONEY')}
                    disabled={!!editingDebt}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                      formAssetType === 'MONEY'
                        ? 'bg-[#D4AF37] text-white border-amber-600 shadow-xs'
                        : 'bg-gray-50 dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{mm ? 'ငွေသား' : 'Cash'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAssetType('GOLD')}
                    disabled={!!editingDebt}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                      formAssetType === 'GOLD'
                        ? 'bg-[#D4AF37] text-white border-amber-600 shadow-xs'
                        : 'bg-gray-50 dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>{mm ? 'ရွှေ' : 'Gold'}</span>
                  </button>
                </div>
              </div>

              {/* Party details — free text, no customer picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {mm ? 'အမည် *' : 'Person / Party Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formPersonName}
                    onChange={(e) => setFormPersonName(e.target.value)}
                    placeholder={mm ? 'အမည် ထည့်ပါ' : 'Enter name'}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {mm ? 'ဖုန်းနံပါတ်' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="09..."
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {mm ? 'မှတ်တမ်းနံပါတ်' : 'Ref No'}
                  </label>
                  <input
                    type="text"
                    value={formDebtNo}
                    onChange={(e) => setFormDebtNo(e.target.value)}
                    placeholder={mm ? 'အလိုအလျောက်ထုတ်ပေးမည်' : 'Auto generated'}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {mm ? 'လိပ်စာ' : 'Address'}
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {mm ? 'မှတ်တမ်းရက်စွဲ *' : 'Record Date *'}
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono"
                />
                <p className="text-[10px] text-gray-500">
                  {mm
                    ? 'ပေး/သွင်း ရက်စွဲကို ချေတဲ့အခါမှသာ မှတ်ပါမည်'
                    : 'Payment/receipt date is recorded only when you settle'}
                </p>
              </div>

              {/* MONEY — total obligation only */}
              {formAssetType === 'MONEY' && (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 space-y-2">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    {mm
                      ? isReceivable
                        ? 'ရရန်ငွေ ပမာဏ (MMK)'
                        : 'ပေးရန်ငွေ ပမာဏ (MMK)'
                      : isReceivable
                        ? 'Amount to receive (MMK)'
                        : 'Amount to pay (MMK)'}
                  </h4>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formTotalAmount || ''}
                    onChange={(e) => setFormTotalAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#151515] text-sm font-mono font-bold"
                  />
                  {editingDebt && (
                    <p className="text-[10px] text-gray-500">
                      {mm
                        ? `ပေး/ရပြီး: ${formatMMK(editingDebt.paid_amount)} · ကျန်: ${formatMMK(editingDebt.remaining_amount)} (ချေမှတ်တမ်းမှ)`
                        : `Settled: ${formatMMK(editingDebt.paid_amount)} · Left: ${formatMMK(editingDebt.remaining_amount)} (from payments)`}
                    </p>
                  )}
                </div>
              )}

              {/* GOLD — total obligation only */}
              {formAssetType === 'GOLD' && (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                      {mm
                        ? isReceivable
                          ? 'ရရန်ရွှေချိန်'
                          : 'ပေးရန်ရွှေချိန်'
                        : isReceivable
                          ? 'Gold to receive'
                          : 'Gold to pay'}
                    </h4>
                    <input
                      type="text"
                      value={formGoldQuality}
                      onChange={(e) => setFormGoldQuality(e.target.value)}
                      placeholder={mm ? 'ဥပမာ- ၁၆ပဲရည်' : 'e.g. 16-Pae'}
                      className="px-2 py-0.5 rounded text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#151515]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder={mm ? 'ကျပ်' : 'Kyat'}
                      value={formTotalGoldK || ''}
                      onChange={(e) => setFormTotalGoldK(Number(e.target.value))}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#151515] text-xs font-mono"
                    />
                    <input
                      type="number"
                      min="0"
                      max="15"
                      placeholder={mm ? 'ပဲ' : 'Pae'}
                      value={formTotalGoldP || ''}
                      onChange={(e) => setFormTotalGoldP(Number(e.target.value))}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#151515] text-xs font-mono"
                    />
                    <input
                      type="number"
                      min="0"
                      max="7.99"
                      step="any"
                      placeholder={mm ? 'ရွေး' : 'Yway'}
                      value={formTotalGoldY || ''}
                      onChange={(e) => setFormTotalGoldY(Number(e.target.value))}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#151515] text-xs font-mono"
                    />
                  </div>
                  {editingDebt && (
                    <p className="text-[10px] text-gray-500">
                      {mm
                        ? `ပေး/ရပြီး: ${formatGoldKPY(editingDebt.paid_gold_k, editingDebt.paid_gold_p, editingDebt.paid_gold_y)} · ကျန်: ${formatGoldKPY(editingDebt.remaining_gold_k, editingDebt.remaining_gold_p, editingDebt.remaining_gold_y)}`
                        : `Settled: ${formatGoldKPY(editingDebt.paid_gold_k, editingDebt.paid_gold_p, editingDebt.paid_gold_y)} · Left: ${formatGoldKPY(editingDebt.remaining_gold_k, editingDebt.remaining_gold_p, editingDebt.remaining_gold_y)}`}
                    </p>
                  )}
                </div>
              )}

              {/* Status — edit only (create always PENDING) */}
              {editingDebt && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {mm ? 'အခြေအနေ' : 'Status'}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as CreditDebtStatus)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-semibold"
                  >
                    <option value="PENDING">{mm ? 'မပေးရသေး (Pending)' : 'Pending'}</option>
                    <option value="PARTIAL">{mm ? 'တစ်စိတ်တစ်ပိုင်း (Partial)' : 'Partial'}</option>
                    <option value="SETTLED">{mm ? 'ကျေပြီး (Settled)' : 'Settled'}</option>
                    <option value="CANCELLED">{mm ? 'ပယ်ဖျက် (Cancelled)' : 'Cancelled'}</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {mm ? 'မှတ်ချက် / အကြောင်းအရာ' : 'Notes / Description'}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={mm ? 'မှတ်ချက်ရေးပါ...' : 'Enter notes...'}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {mm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white disabled:opacity-50 shadow-xs"
                >
                  {busy ? (mm ? 'သိမ်းဆည်းနေသည်...' : 'Saving...') : mm ? 'သိမ်းဆည်းမည်' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* RECORD PAYMENT / SETTLEMENT MODAL */}
      {paymentDebt && (
        <ModalOverlay onBackdropClick={() => setPaymentDebt(null)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <HandCoins className="w-4 h-4 text-amber-500" />
                  {paymentDebt.type === 'RECEIVABLE'
                    ? mm
                      ? 'ငွေသွင်း / ရငွေ မှတ်မည်'
                      : 'Record receipt'
                    : mm
                      ? 'ငွေပေး / ချေမည်'
                      : 'Record payment'}
                </h3>
                <span className="text-[11px] text-gray-500 font-mono">
                  {paymentDebt.debt_no} · {paymentDebt.person_name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentDebt(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-gray-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">{mm ? 'အမျိုးအစား:' : 'Type:'}</span>
                  <span className="font-bold">
                    {paymentDebt.type === 'RECEIVABLE'
                      ? mm
                        ? 'အကြွေးရရန်'
                        : 'Receivable'
                      : mm
                        ? 'အကြွေးပေးရန်'
                        : 'Payable'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{mm ? 'ကျန်ရှိ:' : 'Outstanding:'}</span>
                  <span className="font-mono font-bold text-amber-600">
                    {paymentDebt.asset_type === 'MONEY'
                      ? formatMMK(paymentDebt.remaining_amount)
                      : formatGoldKPY(
                          paymentDebt.remaining_gold_k,
                          paymentDebt.remaining_gold_p,
                          paymentDebt.remaining_gold_y
                        )}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {mm ? 'ရက်စွဲ *' : 'Date *'}
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono"
                />
              </div>

              {/* Settle with cash or gold — matches how the obligation was registered */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {mm ? 'ချေမည့် ပုံစံ' : 'Settle with'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={paymentDebt.asset_type !== 'MONEY'}
                    onClick={() => setPayMethod('CASH')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 disabled:opacity-40 ${
                      payMethod !== 'GOLD'
                        ? 'bg-[#D4AF37] text-white border-amber-600'
                        : 'bg-gray-50 dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    {mm ? 'ငွေသား' : 'Cash'}
                  </button>
                  <button
                    type="button"
                    disabled={paymentDebt.asset_type !== 'GOLD'}
                    onClick={() => setPayMethod('GOLD')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 disabled:opacity-40 ${
                      payMethod === 'GOLD'
                        ? 'bg-[#D4AF37] text-white border-amber-600'
                        : 'bg-gray-50 dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    {mm ? 'ရွှေ' : 'Gold'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">
                  {mm
                    ? 'ငွေသားအကြွေးကို ငွေသားဖြင့်၊ ရွှေအကြွေးကို ရွှေချိန်ဖြင့် ချေပါ။'
                    : 'Cash debts settle in cash; gold debts settle by weight.'}
                </p>
              </div>

              {paymentDebt.asset_type === 'MONEY' ? (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {paymentDebt.type === 'RECEIVABLE'
                      ? mm
                        ? 'သွင်းငွေ (MMK) *'
                        : 'Cash received (MMK) *'
                      : mm
                        ? 'ပေးငွေ (MMK) *'
                        : 'Cash paid (MMK) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-sm font-mono font-bold"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {paymentDebt.type === 'RECEIVABLE'
                      ? mm
                        ? 'ရရွှေချိန် (ကျပ် / ပဲ / ရွေး) *'
                        : 'Gold received *'
                      : mm
                        ? 'ပေးရွှေချိန် (ကျပ် / ပဲ / ရွေး) *'
                        : 'Gold paid *'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder={mm ? 'ကျပ်' : 'Kyat'}
                      value={payGoldK || ''}
                      onChange={(e) => setPayGoldK(Number(e.target.value))}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#121212] text-xs font-mono"
                    />
                    <input
                      type="number"
                      min="0"
                      max="15"
                      placeholder={mm ? 'ပဲ' : 'Pae'}
                      value={payGoldP || ''}
                      onChange={(e) => setPayGoldP(Number(e.target.value))}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#121212] text-xs font-mono"
                    />
                    <input
                      type="number"
                      min="0"
                      max="7.99"
                      step="any"
                      placeholder={mm ? 'ရွေး' : 'Yway'}
                      value={payGoldY || ''}
                      onChange={(e) => setPayGoldY(Number(e.target.value))}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#121212] text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {mm ? 'မှတ်ချက်' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder={mm ? 'မှတ်ချက်ရေးပါ' : 'Notes'}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setPaymentDebt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                >
                  {mm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white disabled:opacity-50 shadow-xs"
                >
                  {busy
                    ? mm
                      ? 'သိမ်းနေသည်...'
                      : 'Saving...'
                    : paymentDebt.type === 'RECEIVABLE'
                      ? mm
                        ? 'သွင်းငွေ အတည်ပြုမည်'
                        : 'Confirm receipt'
                      : mm
                        ? 'ပေးငွေ အတည်ပြုမည်'
                        : 'Confirm payment'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* DETAIL & PAYMENT HISTORY MODAL */}
      {detailDebt && (
        <ModalOverlay onBackdropClick={() => setDetailDebt(null)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    detailDebt.type === 'RECEIVABLE' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  {detailDebt.debt_no} · {detailDebt.person_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailDebt(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Summary Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-gray-800 font-mono">
                <div>
                  <span className="text-[10px] text-gray-400 font-sans block">{mm ? 'အမျိုးအစား' : 'Type'}</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {detailDebt.type === 'RECEIVABLE' ? (mm ? 'အကြွေးရရန်' : 'Receivable') : mm ? 'အကြွေးပေးရန်' : 'Payable'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-sans block">{mm ? 'ပစ္စည်း' : 'Asset'}</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {detailDebt.asset_type === 'MONEY'
                      ? mm
                        ? 'ငွေသား'
                        : 'Cash'
                      : `${mm ? 'ရွှေ' : 'Gold'} (${detailDebt.gold_quality || '-'})`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-sans block">{mm ? 'မှတ်တမ်းရက်' : 'Recorded'}</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {formatDate(detailDebt.date)}
                  </span>
                </div>
              </div>

              {/* Balances */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] text-gray-500 block mb-0.5">{mm ? 'စုစုပေါင်း' : 'Total'}</span>
                  <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">
                    {detailDebt.asset_type === 'MONEY'
                      ? formatMMK(detailDebt.total_amount)
                      : formatGoldKPY(
                          detailDebt.total_gold_k,
                          detailDebt.total_gold_p,
                          detailDebt.total_gold_y
                        )}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block mb-0.5">{mm ? 'ပေး/ရပြီး' : 'Settled'}</span>
                  <span className="text-sm font-bold font-mono text-emerald-800 dark:text-emerald-300">
                    {detailDebt.asset_type === 'MONEY'
                      ? formatMMK(detailDebt.paid_amount)
                      : formatGoldKPY(
                          detailDebt.paid_gold_k,
                          detailDebt.paid_gold_p,
                          detailDebt.paid_gold_y
                        )}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 block mb-0.5">{mm ? 'ကျန်ရှိ' : 'Remaining'}</span>
                  <span className="text-sm font-bold font-mono text-amber-800 dark:text-amber-300">
                    {detailDebt.asset_type === 'MONEY'
                      ? formatMMK(detailDebt.remaining_amount)
                      : formatGoldKPY(
                          detailDebt.remaining_gold_k,
                          detailDebt.remaining_gold_p,
                          detailDebt.remaining_gold_y
                        )}
                  </span>
                </div>
              </div>

              {/* Contact info & Notes */}
              {(detailDebt.phone || detailDebt.address || detailDebt.notes) && (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-gray-800 space-y-1">
                  {detailDebt.phone && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-16">{mm ? 'ဖုန်း:' : 'Phone:'}</span>
                      <span className="font-mono text-gray-700 dark:text-gray-300">{detailDebt.phone}</span>
                    </div>
                  )}
                  {detailDebt.address && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-16">{mm ? 'လိပ်စာ:' : 'Address:'}</span>
                      <span className="text-gray-700 dark:text-gray-300">{detailDebt.address}</span>
                    </div>
                  )}
                  {detailDebt.notes && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-16">{mm ? 'မှတ်ချက်:' : 'Notes:'}</span>
                      <span className="text-gray-700 dark:text-gray-300">{detailDebt.notes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment History List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-amber-500" />
                    <span>{mm ? 'ပေးဆပ်မှု မှတ်တမ်းများ' : 'Payment History'}</span>
                  </h4>
                  {detailDebt.status !== 'SETTLED' && detailDebt.status !== 'CANCELLED' && can('credit_debt', 'update') && (
                    <button
                      type="button"
                      onClick={() => openPayment(detailDebt)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition"
                    >
                      {detailDebt.type === 'RECEIVABLE'
                        ? mm
                          ? '+ ငွေသွင်းမည်'
                          : '+ Receive'
                        : mm
                          ? '+ ချေမည်'
                          : '+ Pay'}
                    </button>
                  )}
                </div>

                {(!detailDebt.payments || detailDebt.payments.length === 0) ? (
                  <p className="text-gray-400 italic py-2 text-center">
                    {mm ? 'ပေးဆပ်မှု မှတ်တမ်း မရှိသေးပါ' : 'No payments recorded yet'}
                  </p>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF8F2] dark:bg-[#151515] text-[10px] font-bold text-gray-500">
                        <tr>
                          <th className="px-3 py-2">{mm ? 'ရက်စွဲ' : 'Date'}</th>
                          <th className="px-3 py-2">{mm ? 'နည်းလမ်း' : 'Method'}</th>
                          <th className="px-3 py-2 text-right">{mm ? 'ပမာဏ / ရွှေချိန်' : 'Amount / Gold'}</th>
                          <th className="px-3 py-2">{mm ? 'မှတ်ချက်' : 'Notes'}</th>
                          {can('credit_debt', 'delete') && <th className="px-3 py-2 text-right">{mm ? 'ဖျက်' : 'Del'}</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {detailDebt.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 font-mono whitespace-nowrap">{formatDate(p.payment_date)}</td>
                            <td className="px-3 py-2 font-mono font-semibold">{p.payment_method}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {detailDebt.asset_type === 'MONEY'
                                ? formatMMK(p.amount)
                                : formatGoldKPY(p.gold_k, p.gold_p, p.gold_y)}
                            </td>
                            <td className="px-3 py-2 text-gray-500 truncate max-w-[120px]">{p.notes || '-'}</td>
                            {can('credit_debt', 'delete') && (
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(detailDebt, p)}
                                  className="text-rose-500 hover:text-rose-700 p-0.5"
                                  title={mm ? 'ဖျက်မည်' : 'Delete'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailDebt(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                {mm ? 'ပိတ်မည်' : 'Close'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};
