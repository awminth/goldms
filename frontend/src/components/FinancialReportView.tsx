import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { api, type FinancialReport } from '../services/api';
import { formatMMK } from '../utils/goldCalculations';
import { formatDate } from '../utils/dateFormat';
import { DateInput } from './DateInput';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';

type LedgerRow = FinancialReport['entries'][number];

type CardDef = {
  key: string;
  category: string;
  type: 'INCOME' | 'EXPENSE';
  labelMM: string;
  labelEN: string;
};

/** Known business categories shown as cards (even when total is 0). */
const CARD_DEFS: CardDef[] = [
  { key: 'GOLD_SALE', category: 'GOLD_SALE', type: 'INCOME', labelMM: 'ရွှေရောင်းရငွေ', labelEN: 'Gold sales' },
  {
    key: 'CUSTOM_ORDER',
    category: 'CUSTOM_ORDER',
    type: 'INCOME',
    labelMM: 'အော်ဒါဝင်ငွေ',
    labelEN: 'Custom order income',
  },
  {
    key: 'MELTING_PROFIT',
    category: 'MELTING_PROFIT',
    type: 'INCOME',
    labelMM: 'ရွှေကျိုအမြတ်',
    labelEN: 'Melting profit',
  },
  {
    key: 'OTHER_INCOME',
    category: 'OTHER_INCOME',
    type: 'INCOME',
    labelMM: 'အခြားဝင်ငွေ',
    labelEN: 'Other income',
  },
  {
    key: 'GOLD_PURCHASE',
    category: 'GOLD_PURCHASE',
    type: 'EXPENSE',
    labelMM: 'ရွှေဝယ်ယူငွေ',
    labelEN: 'Gold purchase',
  },
  {
    key: 'GOLDSMITH_FEE',
    category: 'GOLDSMITH_FEE',
    type: 'EXPENSE',
    labelMM: 'ပန်းထိမ်လက်ခ',
    labelEN: 'Goldsmith fee',
  },
  {
    key: 'STAFF_SALARY',
    category: 'STAFF_SALARY',
    type: 'EXPENSE',
    labelMM: 'ဝန်ထမ်းလစာ',
    labelEN: 'Staff salary',
  },
  {
    key: 'SHOP_RENT',
    category: 'SHOP_RENT',
    type: 'EXPENSE',
    labelMM: 'ဆိုင်ခန်းငှားရမ်းခ',
    labelEN: 'Shop rent',
  },
  {
    key: 'UTILITIES',
    category: 'UTILITIES',
    type: 'EXPENSE',
    labelMM: 'မီတာခ / အထွေထွေ',
    labelEN: 'Utilities',
  },
  {
    key: 'EQUIPMENT_ACID',
    category: 'EQUIPMENT_ACID',
    type: 'EXPENSE',
    labelMM: 'ပစ္စည်း / အက်ဆစ်',
    labelEN: 'Tools & acid',
  },
  { key: 'TAX', category: 'TAX', type: 'EXPENSE', labelMM: 'အခွန်အခ', labelEN: 'Tax' },
  {
    key: 'OTHER_EXPENSE',
    category: 'OTHER_EXPENSE',
    type: 'EXPENSE',
    labelMM: 'အခြားထွက်ငွေ',
    labelEN: 'Other expense',
  },
];

function monthStart(iso = new Date().toISOString().slice(0, 10)) {
  return `${iso.slice(0, 7)}-01`;
}

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

function categoryLabel(category: string, type: string, language: string): string {
  const known = CARD_DEFS.find((c) => c.category === category && c.type === type);
  if (known) return language === 'MM' ? known.labelMM : known.labelEN;
  return category;
}

type SelectedCard = {
  category: string;
  type: 'INCOME' | 'EXPENSE';
  label: string;
};

export const FinancialReportView: React.FC = () => {
  const { language } = useGoldShop();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [selected, setSelected] = useState<SelectedCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.reportFinancial(from, to);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report load failed');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelected(null);
  }, [from, to]);

  const entries = report?.entries ?? [];
  const totals = report?.totals ?? { income: 0, expense: 0, net: 0 };

  const amountByKey = useMemo(() => {
    const map = new Map<string, { total: number; count: number; type: string; category: string }>();
    for (const e of entries) {
      const key = `${e.type}|${e.category}`;
      const prev = map.get(key) || {
        total: 0,
        count: 0,
        type: String(e.type),
        category: String(e.category),
      };
      prev.total += Number(e.amount) || 0;
      prev.count += 1;
      map.set(key, prev);
    }
    return map;
  }, [entries]);

  /** Cards: known defs first, then any extra categories present in data. */
  const cards = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{
      key: string;
      category: string;
      type: 'INCOME' | 'EXPENSE';
      label: string;
      total: number;
      count: number;
    }> = [];

    for (const def of CARD_DEFS) {
      const key = `${def.type}|${def.category}`;
      seen.add(key);
      const hit = amountByKey.get(key);
      list.push({
        key,
        category: def.category,
        type: def.type,
        label: language === 'MM' ? def.labelMM : def.labelEN,
        total: hit?.total ?? 0,
        count: hit?.count ?? 0,
      });
    }

    for (const [key, hit] of amountByKey) {
      if (seen.has(key)) continue;
      const type = hit.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
      list.push({
        key,
        category: hit.category,
        type,
        label: categoryLabel(hit.category, type, language),
        total: hit.total,
        count: hit.count,
      });
    }

    return list;
  }, [amountByKey, language]);

  const incomeCards = cards.filter((c) => c.type === 'INCOME');
  const expenseCards = cards.filter((c) => c.type === 'EXPENSE' && c.count > 0);

  const detailRows = useMemo(() => {
    if (!selected) return [];
    return entries.filter(
      (e) => e.category === selected.category && e.type === selected.type
    );
  }, [entries, selected]);

  const exportDetail = () => {
    const rows = selected ? detailRows : entries;
    const titleExtra = selected
      ? ` — ${selected.label}`
      : '';
    exportToExcel({
      filename: selected
        ? `financial_${selected.category}_${from}_${to}`
        : `financial_report_${from}_${to}`,
      sheetName: 'Detail',
      title:
        language === 'MM'
          ? `ဘဏ္ဍာရေးအစီရင်ခံစာ${titleExtra} (${from} → ${to})`
          : `Financial Report${titleExtra} (${from} → ${to})`,
      columns: [
        { header: language === 'MM' ? 'ရက်စွဲ' : 'Date', value: (e: LedgerRow) => e.date, width: 12 },
        { header: language === 'MM' ? 'အမျိုးအစား' : 'Type', value: (e) => e.type, width: 10 },
        { header: language === 'MM' ? 'ကဏ္ဍ' : 'Category', value: (e) => e.category, width: 16 },
        {
          header: language === 'MM' ? 'အကြောင်းအရာ' : 'Description',
          value: (e) => e.description,
          width: 40,
        },
        {
          header: language === 'MM' ? 'ကိုးကား' : 'Reference',
          value: (e) => e.reference_no || '',
          width: 16,
        },
        {
          header: language === 'MM' ? 'ပမာဏ' : 'Amount',
          value: (e) => (e.type === 'INCOME' ? e.amount : -e.amount),
          width: 14,
        },
      ],
      rows,
    });
  };

  const detailColumns = useMemo<DataTableColumn<LedgerRow>[]>(
    () => [
      {
        id: 'date',
        header: language === 'MM' ? 'ရက်စွဲ' : 'Date',
        slot: 'primary',
        accessor: (e) => e.date,
        cell: (e) => (
          <span className="font-mono whitespace-nowrap opacity-80">{formatDate(e.date)}</span>
        ),
      },
      {
        id: 'description',
        header: language === 'MM' ? 'အကြောင်းအရာ' : 'Description',
        slot: 'detail',
        accessor: (e) => e.description,
        cell: (e) => <span>{e.description}</span>,
      },
      {
        id: 'ref',
        header: language === 'MM' ? 'ကိုးကား' : 'Reference',
        slot: 'detail',
        accessor: (e) => e.reference_no || '',
        cell: (e) => <span className="font-mono opacity-70">{e.reference_no || '-'}</span>,
      },
      {
        id: 'amount',
        header: language === 'MM' ? 'ပမာဏ' : 'Amount',
        slot: 'primary',
        accessor: (e) => (e.type === 'INCOME' ? e.amount : -e.amount),
        align: 'right',
        cell: (e) => (
          <span className="font-mono font-bold whitespace-nowrap">
            {e.type === 'INCOME' ? '+' : '-'}
            {formatMMK(e.amount)}
          </span>
        ),
      },
    ],
    [language]
  );

  const openCard = (card: (typeof cards)[number]) => {
    setSelected({
      category: card.category,
      type: card.type,
      label: card.label,
    });
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
            {language === 'MM' ? 'ဘဏ္ဍာရေးအစီရင်ခံစာ' : 'Financial Report'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {language === 'MM'
              ? 'ကတ်ကို နှိပ်၍ အသေးစိတ်ကြည့်ပါ။ အပေါင်စာရင်း မပါဝင်ပါ။'
              : 'Tap a card for detail lines. Pawn flows excluded.'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">
              {language === 'MM' ? 'မှ' : 'From'}
            </label>
            <DateInput
              value={from}
              onChange={setFrom}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">
              {language === 'MM' ? 'ထိ' : 'To'}
            </label>
            <DateInput
              value={to}
              onChange={setTo}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {language === 'MM' ? 'ပြန်တင်' : 'Refresh'}
          </button>
          <ExcelExportButton
            language={language}
            onClick={exportDetail}
            disabled={(selected ? detailRows : entries).length === 0}
            className="!py-2 !rounded-xl"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs px-4 py-3">
          {error}
        </div>
      )}

      {loading && !report ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          {language === 'MM' ? 'တင်နေသည်…' : 'Loading…'}
        </div>
      ) : selected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {language === 'MM' ? 'ကတ်များသို့ ပြန်ရန်' : 'Back to cards'}
            </button>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-500">{selected.label}</p>
              <p
                className={`text-lg font-mono font-extrabold ${
                  selected.type === 'INCOME'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {selected.type === 'INCOME' ? '+' : '-'}
                {formatMMK(detailRows.reduce((s, e) => s + e.amount, 0))}
              </p>
            </div>
          </div>
          <DataTable
            rows={detailRows}
            columns={detailColumns}
            rowKey={(e) => e.id}
            language={language}
            searchable
            searchPlaceholder={
              language === 'MM' ? 'ဖော်ပြချက် / ကိုးကား ရှာရန်…' : 'Search description / reference…'
            }
            emptyMessage={language === 'MM' ? 'ဤကဏ္ဍတွင် စာရင်းမရှိပါ' : 'No entries in this category'}
            rowClassName={(e) => ledgerTypeRowClass(e.type)}
          />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {language === 'MM' ? 'ဝင်ငွေ' : 'Income'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {incomeCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => openCard(card)}
                  className="text-left p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-emerald-200/80 dark:border-emerald-950 shadow-xs hover:border-emerald-400 hover:shadow-md transition group"
                >
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                    {card.label}
                  </span>
                  <div className="mt-2 text-xl font-mono font-extrabold text-emerald-800 dark:text-emerald-300">
                    +{formatMMK(card.total)}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400 group-hover:text-emerald-600">
                    {card.count} {language === 'MM' ? 'စာရင်း · အသေးစိတ်ကြည့်ရန် နှိပ်ပါ' : 'rows · tap for detail'}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              {language === 'MM' ? 'ထွက်ငွေ' : 'Expense'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {expenseCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => openCard(card)}
                  className="text-left p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-rose-200/80 dark:border-rose-950 shadow-xs hover:border-rose-400 hover:shadow-md transition group"
                >
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 block">
                    {card.label}
                  </span>
                  <div className="mt-2 text-xl font-mono font-extrabold text-rose-800 dark:text-rose-300">
                    -{formatMMK(card.total)}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400 group-hover:text-rose-600">
                    {card.count} {language === 'MM' ? 'စာရင်း · အသေးစိတ်ကြည့်ရန် နှိပ်ပါ' : 'rows · tap for detail'}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="p-5 rounded-2xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/40 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37]">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#996515] dark:text-amber-300">
                    {language === 'MM' ? 'အသားတင် အမြတ် / အရှုံး' : 'Net profit / loss'}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                    {language === 'MM'
                      ? `ဝင်ငွေ ${formatMMK(totals.income)} − ထွက်ငွေ ${formatMMK(totals.expense)}`
                      : `Income ${formatMMK(totals.income)} − Expense ${formatMMK(totals.expense)}`}
                  </p>
                </div>
              </div>
              <div
                className={`text-2xl sm:text-3xl font-mono font-extrabold ${
                  totals.net >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {totals.net >= 0 ? '+' : ''}
                {formatMMK(totals.net)}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
