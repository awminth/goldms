import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import { FinancialLedger } from '../types/gold';
import { formatMMK } from '../utils/goldCalculations';
import { formatDate, inDateRange, todayISO } from '../utils/dateFormat';
import { DateInput } from './DateInput';
import { DateRangeFilter } from './DateRangeFilter';
import {
  Wallet,
  Plus,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { ModalOverlay } from './ModalOverlay';

/** Full-row text color by ledger entry type. */
function ledgerTypeRowClass(type: string | undefined | null): string {
  switch (String(type || '').toUpperCase()) {
    case 'INCOME':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'EXPENSE':
      return 'text-rose-700 dark:text-rose-300';
    default:
      return '';
  }
}

export const LedgerView: React.FC = () => {
  const {
    ledger,
    addLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
    language,
    can,
  } = useGoldShop();
  const dialog = useDialog();

  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState(() => todayISO());
  const [dateTo, setDateTo] = useState(() => todayISO());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [formType, setFormType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [formCategory, setFormCategory] = useState<FinancialLedger['category']>('UTILITIES');
  const [formAmount, setFormAmount] = useState<number>(100000);
  const [formDescription, setFormDescription] = useState('ဆိုင်အထွေထွေ အသုံးစရိတ်');
  const [formRefNo, setFormRefNo] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));

  const resetForm = () => {
    setEditingId(null);
    setFormType('EXPENSE');
    setFormCategory('UTILITIES');
    setFormAmount(100000);
    setFormDescription('ဆိုင်အထွေထွေ အသုံးစရိတ်');
    setFormRefNo('');
    setFormDate(new Date().toISOString().slice(0, 10));
  };

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (entry: FinancialLedger) => {
    setEditingId(entry.id);
    setFormType(entry.type);
    setFormCategory(entry.category);
    setFormAmount(entry.amount);
    setFormDescription(entry.description);
    setFormRefNo(entry.reference_no || '');
    setFormDate(entry.date);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription || formAmount <= 0) return;
    setBusy(true);
    try {
      const payload = {
        date: formDate,
        type: formType,
        category: formCategory,
        amount: Number(formAmount),
        description: formDescription,
        reference_no: formRefNo || undefined,
      };
      if (editingId) await updateLedgerEntry(editingId, payload);
      else await addLedgerEntry(payload);
      closeModal();
      await dialog.alert({
        title: language === 'MM' ? 'အောင်မြင်ပါသည်' : 'Success',
        message:
          language === 'MM'
            ? editingId
              ? 'စာရင်း ပြင်ဆင်ပြီးပါပြီ'
              : 'စာရင်း သိမ်းပြီးပါပြီ'
            : editingId
              ? 'Entry updated'
              : 'Entry saved',
        variant: 'success',
      });
    } catch (err) {
      await dialog.alert({
        title: language === 'MM' ? 'မအောင်မြင်ပါ' : 'Failed',
        message: err instanceof Error ? err.message : 'Save failed',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (entry: FinancialLedger) => {
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'စာရင်း ဖျက်မည်' : 'Delete entry',
      message:
        language === 'MM' ? 'ဤစာရင်းကို ဖျက်မလား?' : 'Delete this ledger entry?',
      confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteLedgerEntry(entry.id);
      await dialog.alert({
        title: language === 'MM' ? 'အောင်မြင်ပါသည်' : 'Success',
        message: language === 'MM' ? 'စာရင်း ဖျက်ပြီးပါပြီ' : 'Entry deleted',
        variant: 'success',
      });
    } catch (err) {
      await dialog.alert({
        title: language === 'MM' ? 'မအောင်မြင်ပါ' : 'Failed',
        message: err instanceof Error ? err.message : 'Delete failed',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const filteredLedger = ledger.filter((item) => {
    if (String(item.entry_source || '').toUpperCase() !== 'MANUAL') return false;
    if (!inDateRange(item.date, dateFrom, dateTo)) return false;
    const matchesType = filterType === 'ALL' || item.type === filterType;
    const matchesCat = filterCategory === 'ALL' || item.category === filterCategory;
    return matchesType && matchesCat;
  });

  const exportLedgerExcel = () => {
    exportToExcel({
      filename: 'other_income_expense_entries',
      sheetName: 'OtherIncomeExpense',
      title: language === 'MM' ? 'အခြားဝင်ငွေ / ထွက်ငွေ စာရင်း' : 'Other Income & Expense',
      columns: [
        { header: language === 'MM' ? 'ရက်စွဲ' : 'Date', value: (e) => e.date, width: 12 },
        { header: language === 'MM' ? 'အမျိုးအစား' : 'Type', value: (e) => e.type, width: 10 },
        { header: language === 'MM' ? 'ကဏ္ဍ' : 'Category', value: (e) => e.category, width: 16 },
        { header: language === 'MM' ? 'အကြောင်းအရာ' : 'Description', value: (e) => e.description, width: 36 },
        { header: language === 'MM' ? 'ကိုးကား' : 'Reference', value: (e) => e.reference_no || '', width: 16 },
        { header: language === 'MM' ? 'ပမာဏ' : 'Amount', value: (e) => e.amount, width: 14 },
      ],
      rows: filteredLedger,
    });
  };

  const ledgerColumns = useMemo<DataTableColumn<FinancialLedger>[]>(
    () => [
      {
        id: 'date',
        header: language === 'MM' ? 'ရက်စွဲ' : 'Date',
        slot: 'primary',
        accessor: (e) => e.date,
        cell: (entry) => (
          <span className="font-mono whitespace-nowrap opacity-80">{formatDate(entry.date)}</span>
        ),
      },
      {
        id: 'type',
        header: language === 'MM' ? 'အမျိုးအစား' : 'Type',
        slot: 'primary',
        accessor: (e) => e.type,
        cell: (entry) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
              entry.type === 'INCOME'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
            }`}
          >
            {entry.type}
          </span>
        ),
      },
      {
        id: 'category',
        header: language === 'MM' ? 'ကဏ္ဍ' : 'Category',
        slot: 'primary',
        accessor: (e) => e.category,
        cell: (entry) => <span className="font-semibold">{entry.category}</span>,
      },
      {
        id: 'description',
        header: language === 'MM' ? 'အကြောင်းအရာ' : 'Description',
        slot: 'detail',
        accessor: (e) => e.description,
        cell: (entry) => <span>{entry.description}</span>,
      },
      {
        id: 'ref',
        header: language === 'MM' ? 'ကိုးကားအမှတ်' : 'Reference',
        slot: 'detail',
        accessor: (e) => e.reference_no || '',
        cell: (entry) => (
          <span className="font-mono opacity-70">{entry.reference_no || '-'}</span>
        ),
      },
      {
        id: 'amount',
        header: language === 'MM' ? 'ပမာဏ' : 'Amount',
        slot: 'primary',
        accessor: (e) => (e.type === 'INCOME' ? e.amount : -e.amount),
        align: 'right',
        cell: (entry) => (
          <span className="font-mono font-bold whitespace-nowrap">
            {entry.type === 'INCOME' ? '+' : '-'}
            {formatMMK(entry.amount)}
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
        cell: (entry) => (
          <div className="inline-flex items-center gap-1.5">
            {can('ledger', 'update') && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(entry);
                }}
                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {can('ledger', 'delete') && (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(entry);
                }}
                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [language, can, busy]
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-[#D4AF37]" />
            <span>
              {language === 'MM'
                ? 'အခြားဝင်ငွေ / ထွက်ငွေ ထည့်သွင်းခြင်း'
                : 'Other Income & Expenses'}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {language === 'MM'
              ? 'ဤစာမျက်နှာမှ ထည့်သွင်းသော စာရင်းများကိုသာ ပြသည်။ ရောင်း/ဝယ်/အပေါင် အလိုအလျောက်စာရင်းများ မပါပါ။'
              : 'Shows only entries recorded here. Auto postings from sales/buy/pawn are excluded.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelExportButton
            language={language}
            onClick={exportLedgerExcel}
            disabled={filteredLedger.length === 0}
            className="!py-2 !rounded-xl"
          />
          {can('ledger', 'create') && (
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white text-xs font-bold hover:opacity-95 transition shadow-xs flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'MM' ? 'စာရင်း အသစ်ထည့်သွင်းမည်' : 'Record Entry'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 text-xs">
        <div className="flex flex-wrap items-end gap-2">
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            language={language}
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] dark:text-white"
          >
            <option value="ALL">{language === 'MM' ? 'အမျိုးအစားအားလုံး' : 'All Types'}</option>
            <option value="INCOME">{language === 'MM' ? 'အခြားဝင်ငွေ' : 'Other Income'}</option>
            <option value="EXPENSE">{language === 'MM' ? 'အခြားထွက်ငွေ' : 'Other Expense'}</option>
          </select>
        </div>

        <span className="text-gray-400 self-end pb-2">
          {filteredLedger.length} {language === 'MM' ? 'စောင် တွေ့ရှိ' : 'records'}
        </span>
      </div>

      <DataTable
        rows={filteredLedger}
        columns={ledgerColumns}
        rowKey={(e) => e.id}
        language={language}
        searchable
        searchPlaceholder={language === 'MM' ? 'ဖော်ပြချက် / ကိုးကား ရှာရန်…' : 'Search description / reference…'}
        resetDeps={[filterType, filterCategory, dateFrom, dateTo]}
        emptyMessage={language === 'MM' ? 'စာရင်းမရှိပါ' : 'No ledger entries'}
        rowClassName={(e) => ledgerTypeRowClass(e.type)}
      />

      {isModalOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2">
                <Wallet className="w-4 h-4 text-[#D4AF37]" />
                <span>
                  {editingId
                    ? language === 'MM'
                      ? 'စာရင်း ပြင်ဆင်ရန်'
                      : 'Edit Entry'
                    : language === 'MM'
                      ? 'အခြားဝင်ငွေ / ထွက်ငွေ အသစ်'
                      : 'Add Other Income / Expense'}
                </span>
              </h3>
              <button type="button" onClick={closeModal} className="p-1 rounded text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormType('INCOME');
                    setFormCategory('OTHER_INCOME');
                  }}
                  className={`py-2 rounded-xl font-bold border transition ${
                    formType === 'INCOME'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'border-gray-300 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {language === 'MM' ? 'အခြားဝင်ငွေ' : 'Other Income'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('EXPENSE');
                    setFormCategory('UTILITIES');
                  }}
                  className={`py-2 rounded-xl font-bold border transition ${
                    formType === 'EXPENSE'
                      ? 'bg-rose-600 text-white border-rose-700'
                      : 'border-gray-300 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {language === 'MM' ? 'အခြားထွက်ငွေ' : 'Other Expense'}
                </button>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ရက်စွဲ:' : 'Date:'}
                </label>
                <DateInput
                  required
                  value={formDate}
                  onChange={setFormDate}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ကဏ္ဍ (Category):' : 'Category:'}
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as FinancialLedger['category'])}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                >
                  {formType === 'INCOME' ? (
                    <>
                      <option value="GOLD_SALE">ရွှေရောင်းရငွေ (Gold Sales)</option>
                      <option value="CUSTOM_ORDER">အော်ဒါဝင်ငွေ (Custom Order Deposit)</option>
                      <option value="MELTING_PROFIT">ရွှေကျိုအမြတ် (Melting Profit)</option>
                      <option value="OTHER_INCOME">အခြားဝင်ငွေ (Other Income)</option>
                    </>
                  ) : (
                    <>
                      <option value="GOLD_PURCHASE">ရွှေဝယ်ယူငွေ (Gold Purchase)</option>
                      <option value="STAFF_SALARY">ဝန်ထမ်းလစာ (Staff Payroll)</option>
                      <option value="SHOP_RENT">ဆိုင်ခန်းငှားရမ်းခ (Shop Rent)</option>
                      <option value="UTILITIES">မီတာခနှင့် အထွေထွေ (Utilities)</option>
                      <option value="EQUIPMENT_ACID">ပန်းထိမ်သုံးပစ္စည်း/အက်ဆစ် (Tools & Acid)</option>
                      <option value="TAX">အခွန်အခ (Taxes)</option>
                      <option value="GOLDSMITH_FEE">ပန်းထိမ်လက်ခ (Goldsmith Fee)</option>
                      <option value="OTHER_EXPENSE">အခြားထွက်ငွေ (Other Expenses)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ပမာဏ (Amount MMK):' : 'Amount (MMK):'}
                </label>
                <input
                  type="number"
                  step="10000"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'အကြောင်းအရာ ဖော်ပြချက်:' : 'Description:'}
                </label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ကိုးကားအမှတ် (Reference No):' : 'Reference No:'}
                </label>
                <input
                  type="text"
                  placeholder="INV-001, REF-01..."
                  value={formRefNo}
                  onChange={(e) => setFormRefNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold"
                >
                  {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] text-white font-bold hover:bg-[#C5A059]"
                >
                  {editingId
                    ? language === 'MM'
                      ? 'သိမ်းမည်'
                      : 'Save'
                    : language === 'MM'
                      ? 'ထည့်မည်'
                      : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};
