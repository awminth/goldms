import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { FinancialLedger } from '../types/gold';
import { formatMMK } from '../utils/goldCalculations';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  TrendingUp,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { ModalOverlay } from './ModalOverlay';

export const LedgerView: React.FC = () => {
  const {
    ledger,
    addLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
    language,
    can,
  } = useGoldShop();

  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [formType, setFormType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [formCategory, setFormCategory] = useState<FinancialLedger['category']>('UTILITIES');
  const [formAmount, setFormAmount] = useState<number>(100000);
  const [formDescription, setFormDescription] = useState('ဆိုင်အထွေထွေ အသုံးစရိတ်');
  const [formRefNo, setFormRefNo] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));

  const totalIncome = ledger
    .filter((l) => l.type === 'INCOME')
    .reduce((sum, l) => sum + l.amount, 0);

  const totalExpense = ledger
    .filter((l) => l.type === 'EXPENSE')
    .reduce((sum, l) => sum + l.amount, 0);

  const netBalance = totalIncome - totalExpense;

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
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (entry: FinancialLedger) => {
    if (
      !window.confirm(
        language === 'MM'
          ? 'ဤစာရင်းကို ဖျက်မလား?'
          : 'Delete this ledger entry?'
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteLedgerEntry(entry.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const filteredLedger = ledger.filter((item) => {
    const matchesType = filterType === 'ALL' || item.type === filterType;
    const matchesCat = filterCategory === 'ALL' || item.category === filterCategory;
    return matchesType && matchesCat;
  });

  const exportLedgerExcel = () => {
    exportToExcel({
      filename: 'financial_ledger',
      sheetName: 'Ledger',
      title: language === 'MM' ? 'ဘဏ္ဍာရေး စာရင်း (Financial Ledger)' : 'Financial Ledger Report',
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
        accessor: (e) => e.date,
        cell: (entry) => (
          <span className="font-mono text-gray-500 whitespace-nowrap">{entry.date}</span>
        ),
      },
      {
        id: 'type',
        header: language === 'MM' ? 'အမျိုးအစား' : 'Type',
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
        accessor: (e) => e.category,
        cell: (entry) => (
          <span className="font-semibold text-gray-800 dark:text-gray-200">{entry.category}</span>
        ),
      },
      {
        id: 'description',
        header: language === 'MM' ? 'အကြောင်းအရာ' : 'Description',
        accessor: (e) => e.description,
        cell: (entry) => (
          <span className="text-gray-700 dark:text-gray-300">{entry.description}</span>
        ),
      },
      {
        id: 'ref',
        header: language === 'MM' ? 'ကိုးကားအမှတ်' : 'Reference',
        accessor: (e) => e.reference_no || '',
        cell: (entry) => (
          <span className="font-mono text-gray-500">{entry.reference_no || '-'}</span>
        ),
      },
      {
        id: 'amount',
        header: language === 'MM' ? 'ပမာဏ' : 'Amount',
        accessor: (e) => (e.type === 'INCOME' ? e.amount : -e.amount),
        align: 'right',
        cell: (entry) => (
          <span
            className={`font-mono font-bold whitespace-nowrap ${
              entry.type === 'INCOME'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {entry.type === 'INCOME' ? '+' : '-'}
            {formatMMK(entry.amount)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
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
                ? 'စာရင်းစစ် & အထွေထွေ ဝင်ငွေ/ထွက်ငွေ (Financial Ledger)'
                : 'Financial Accounting & General Ledger'}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {language === 'MM'
              ? 'ရွှေအရောင်း၊ အဝယ်၊ ပန်းထိန်းလက်ခနှင့် ဆိုင်လည်ပတ်မှု အသုံးစရိတ် စာရင်းဇယားများ'
              : 'Income, expenses, craftsmanship proceeds, utilities, staff payroll and daily cashflow'}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-emerald-200 dark:border-emerald-950 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold block">
              {language === 'MM' ? 'စုစုပေါင်း ဝင်ငွေ (Total Income)' : 'Total Revenue / Income'}
            </span>
            <div className="text-xl font-mono font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
              +{formatMMK(totalIncome)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-rose-200 dark:border-rose-950 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold block">
              {language === 'MM' ? 'စုစုပေါင်း ထွက်ငွေ (Total Expense)' : 'Total Expenses'}
            </span>
            <div className="text-xl font-mono font-extrabold text-rose-700 dark:text-rose-400 mt-1">
              -{formatMMK(totalExpense)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/30 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#996515] dark:text-[#E5C158] font-bold block">
              {language === 'MM' ? 'အသားတင် ကျန်ငွေ (Net Cash Balance)' : 'Net Cash Position'}
            </span>
            <div className="text-xl font-mono font-extrabold text-[#996515] dark:text-amber-300 mt-1">
              {formatMMK(netBalance)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37]">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] dark:text-white"
        >
          <option value="ALL">{language === 'MM' ? 'အမျိုးအစားအားလုံး' : 'All Types'}</option>
          <option value="INCOME">{language === 'MM' ? 'ဝင်ငွေ (Income)' : 'Income'}</option>
          <option value="EXPENSE">{language === 'MM' ? 'ထွက်ငွေ (Expense)' : 'Expense'}</option>
        </select>

        <span className="text-gray-400 ml-auto">
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
        resetDeps={[filterType, filterCategory]}
        emptyMessage={language === 'MM' ? 'စာရင်းမရှိပါ' : 'No ledger entries'}
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
                      : 'Edit Ledger Entry'
                    : language === 'MM'
                      ? 'စာရင်းသွင်းလွှာ အသစ်'
                      : 'Add Financial Ledger Record'}
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
                    setFormCategory('GOLD_SALE');
                  }}
                  className={`py-2 rounded-xl font-bold border transition ${
                    formType === 'INCOME'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'border-gray-300 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {language === 'MM' ? 'ဝင်ငွေ (Income)' : 'Income'}
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
                  {language === 'MM' ? 'ထွက်ငွေ (Expense)' : 'Expense'}
                </button>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ရက်စွဲ:' : 'Date:'}
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
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
                      <option value="PAWN_INTEREST">အပေါင်အတိုးရငွေ (Pawn Interest)</option>
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
