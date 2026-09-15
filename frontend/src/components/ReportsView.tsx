import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { api, type DelayedReport, type OutstandingReport, type ReportSummary } from '../services/api';
import { formatMMK } from '../utils/goldCalculations';
import {
  FileBarChart2,
  Printer,
  RefreshCw,
  AlertTriangle,
  Clock,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { cacheGet, cacheSet, cacheInvalidate, cacheKey } from '../utils/listCache';
import { DataTable, type DataTableColumn } from './DataTable';
import type { CustomerTracking } from '../types/gold';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';

type ReportTab = 'outstanding' | 'delayed' | 'summary';

export const ReportsView: React.FC = () => {
  const { language } = useGoldShop();
  const [tab, setTab] = useState<ReportTab>('outstanding');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingReport | null>(null);
  const [delayed, setDelayed] = useState<DelayedReport | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const key = cacheKey(['reports', 'bundle']);
      if (!force) {
        const cached = cacheGet<{
          o: OutstandingReport;
          d: DelayedReport;
          s: ReportSummary;
        }>(key);
        if (cached) {
          setOutstanding(cached.o);
          setDelayed(cached.d);
          setSummary(cached.s);
          setLoading(false);
          return;
        }
      } else {
        cacheInvalidate('reports');
      }
      const [o, d, s] = await Promise.all([
        api.reportOutstandingCredit(),
        api.reportDelayed(),
        api.reportSummary(),
      ]);
      cacheSet(key, { o, d, s }, 45_000);
      setOutstanding(o);
      setDelayed(d);
      setSummary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const title =
    tab === 'outstanding'
      ? language === 'MM'
        ? 'ငွေထပ်လွှဲနေသူများစာရင်း (Outstanding Credit)'
        : 'Outstanding Credit Report'
      : tab === 'delayed'
        ? language === 'MM'
          ? 'ရက်လွှဲ / အရစ်ကျ စာရင်း (Delayed & Installment)'
          : 'Delayed / Installment Report'
        : language === 'MM'
          ? 'အစီရင်ခံစာ အနှစ်ချုပ်'
          : 'Reports Summary';

  const exportCurrentReport = () => {
    if (tab === 'summary' && summary) {
      exportToExcel({
        filename: 'reports_summary',
        sheetName: 'Summary',
        title: language === 'MM' ? 'အစီရင်ခံစာ အနှစ်ချုပ်' : 'Reports Summary',
        columns: [
          { header: language === 'MM' ? 'အချက်' : 'Metric', value: (r) => r.label, width: 32 },
          { header: language === 'MM' ? 'တန်ဖိုး' : 'Value', value: (r) => r.value, width: 18 },
        ],
        rows: [
          {
            label: language === 'MM' ? 'ငွေထပ်လွှဲ အရေအတွက်' : 'Outstanding count',
            value: summary.outstanding_credit.count,
          },
          {
            label: language === 'MM' ? 'ငွေထပ်လွှဲ စုစုပေါင်း' : 'Outstanding total',
            value: summary.outstanding_credit.total,
          },
          {
            label: language === 'MM' ? 'ရက်လွှဲ အရေအတွက်' : 'Delayed count',
            value: summary.delayed_payments.count,
          },
          {
            label: language === 'MM' ? 'ရက်လွှဲ စုစုပေါင်း' : 'Delayed total',
            value: summary.delayed_payments.total,
          },
          { label: 'Aging 0–7d', value: summary.delayed_payments.aging.d0_7 },
          { label: 'Aging 8–30d', value: summary.delayed_payments.aging.d8_30 },
          { label: 'Aging 31+d', value: summary.delayed_payments.aging.d31_plus },
          {
            label: language === 'MM' ? 'ဖောက်သည် လက်ကျန်စုစုပေါင်း' : 'Customer balances',
            value: summary.customer_balance_total,
          },
        ],
      });
      return;
    }

    const reportRows =
      tab === 'outstanding' ? outstanding?.items : tab === 'delayed' ? delayed?.items : [];
    if (!reportRows?.length) return;

    exportToExcel({
      filename: tab === 'delayed' ? 'report_delayed' : 'report_outstanding',
      sheetName: tab === 'delayed' ? 'Delayed' : 'Outstanding',
      title,
      columns: [
        { header: language === 'MM' ? 'အမည်' : 'Name', value: (r) => r.customer_name, width: 20 },
        { header: language === 'MM' ? 'ဖုန်း' : 'Phone', value: (r) => r.customer_phone, width: 14 },
        { header: language === 'MM' ? 'ကိုးကား' : 'Ref', value: (r) => r.reference_no, width: 16 },
        {
          header: language === 'MM' ? 'သတ်မှတ်ရက်' : 'Due',
          value: (r) => String(r.due_date).slice(0, 10),
          width: 12,
        },
        ...(tab === 'delayed'
          ? [
              {
                header: language === 'MM' ? 'ရက်ကျော်' : 'Days',
                value: (r: CustomerTracking) => r.days_overdue || 0,
                width: 10,
              },
            ]
          : []),
        { header: language === 'MM' ? 'ကျန်ငွေ' : 'Due Amt', value: (r) => r.amount_due, width: 14 },
        { header: language === 'MM' ? 'အခြေအနေ' : 'Status', value: (r) => r.status, width: 12 },
      ],
      rows: reportRows,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs print:border-0 print:shadow-none">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <FileBarChart2 className="w-5 h-5 text-[#D4AF37]" />
            <span>{language === 'MM' ? 'အစီရင်ခံစာများ (Reports)' : 'Business Reports'}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {language === 'MM'
              ? 'ကျန်ငွေစာရင်းနှင့် ရက်လွန်/အရစ်ကျ စာရင်းများကို ပုံနှိပ်ထုတ်ယူနိုင်သည်'
              : 'Printable outstanding credit and overdue installment lists'}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <ExcelExportButton
            language={language}
            onClick={exportCurrentReport}
            disabled={
              (tab === 'summary' && !summary) ||
              (tab === 'outstanding' && !outstanding?.items.length) ||
              (tab === 'delayed' && !delayed?.items.length)
            }
            className="!py-2 !rounded-xl"
          />
          <button
            type="button"
            onClick={() => void load(true)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {language === 'MM' ? 'ပြန်တင်မည်' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            {language === 'MM' ? 'ပုံနှိပ်မည်' : 'Print'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {(
          [
            { id: 'outstanding' as const, icon: CreditCard, mm: 'ငွေထပ်လွှဲ', en: 'Outstanding' },
            { id: 'delayed' as const, icon: Clock, mm: 'ရက်လွှဲ', en: 'Delayed' },
            { id: 'summary' as const, icon: AlertTriangle, mm: 'အနှစ်ချုပ်', en: 'Summary' },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                active
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white border-transparent'
                  : 'bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {language === 'MM' ? t.mm : t.en}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm border border-rose-200">{error}</div>
      )}

      {loading && !outstanding && (
        <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />
          <span className="text-sm">{language === 'MM' ? 'တင်ဆောင်နေသည်…' : 'Loading…'}</span>
        </div>
      )}

      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs print:shadow-none print:border print:rounded-none">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h3>
          <span className="text-[11px] text-gray-400 font-mono">
            {(tab === 'outstanding'
              ? outstanding?.generated_at
              : tab === 'delayed'
                ? delayed?.generated_at
                : summary?.generated_at
            )
              ?.slice(0, 19)
              .replace('T', ' ') || '—'}
          </span>
        </div>

        {tab === 'summary' && summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric
              tone="amber"
              label={language === 'MM' ? 'ငွေထပ်လွှဲ အရေအတွက်' : 'Outstanding count'}
              value={String(summary.outstanding_credit.count)}
            />
            <Metric
              tone="rose"
              label={language === 'MM' ? 'ငွေထပ်လွှဲ စုစုပေါင်း' : 'Outstanding total'}
              value={formatMMK(summary.outstanding_credit.total)}
            />
            <Metric
              tone="orange"
              label={language === 'MM' ? 'ရက်လွှဲ အရေအတွက်' : 'Delayed count'}
              value={String(summary.delayed_payments.count)}
            />
            <Metric
              tone="rose"
              label={language === 'MM' ? 'ရက်လွှဲ စုစုပေါင်း' : 'Delayed total'}
              value={formatMMK(summary.delayed_payments.total)}
            />
            <Metric
              tone="emerald"
              label={language === 'MM' ? 'အိုမင်းမှု ၀–၇ ရက်' : 'Aging 0–7d'}
              value={String(summary.delayed_payments.aging.d0_7)}
            />
            <Metric
              tone="amber"
              label={language === 'MM' ? 'အိုမင်းမှု ၈–၃၀ ရက်' : 'Aging 8–30d'}
              value={String(summary.delayed_payments.aging.d8_30)}
            />
            <Metric
              tone="rose"
              label={language === 'MM' ? 'အိုမင်းမှု ၃၁+ ရက်' : 'Aging 31+d'}
              value={String(summary.delayed_payments.aging.d31_plus)}
            />
            <Metric
              tone="gold"
              label={language === 'MM' ? 'ဖောက်သည် လက်ကျန်စုစုပေါင်း' : 'Customer balances'}
              value={formatMMK(summary.customer_balance_total)}
            />
          </div>
        )}

        {tab === 'outstanding' && outstanding && (
          <ReportTable
            language={language}
            total={outstanding.total_amount_due}
            count={outstanding.count}
            rows={outstanding.items}
            showDays={false}
            variant="outstanding"
          />
        )}

        {tab === 'delayed' && delayed && (
          <>
            <div className="flex flex-wrap gap-2 mb-4 text-[11px] font-semibold print:hidden">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                0–7d: {delayed.aging.d0_7}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                8–30d: {delayed.aging.d8_30}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                31+d: {delayed.aging.d31_plus}
              </span>
            </div>
            <ReportTable
              language={language}
              total={delayed.total_amount_due}
              count={delayed.count}
              rows={delayed.items}
              showDays
              variant="delayed"
            />
          </>
        )}
      </div>
    </div>
  );
};

const metricTone: Record<
  'amber' | 'rose' | 'orange' | 'emerald' | 'gold',
  { box: string; value: string }
> = {
  amber: {
    box: 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30',
    value: 'text-amber-800 dark:text-amber-300',
  },
  rose: {
    box: 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30',
    value: 'text-rose-700 dark:text-rose-300',
  },
  orange: {
    box: 'border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30',
    value: 'text-orange-800 dark:text-orange-300',
  },
  emerald: {
    box: 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30',
    value: 'text-emerald-800 dark:text-emerald-300',
  },
  gold: {
    box: 'border-[#D4AF37]/50 bg-[#FAF8F2] dark:bg-[#1E1B15]',
    value: 'text-[#996515] dark:text-amber-300',
  },
};

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof metricTone;
}) {
  const t = metricTone[tone];
  return (
    <div className={`p-3 rounded-xl border ${t.box}`}>
      <div className="text-[11px] text-gray-600 dark:text-gray-400 font-semibold">{label}</div>
      <div className={`mt-1 text-sm font-mono font-bold ${t.value}`}>{value}</div>
    </div>
  );
}

function daysTone(days: number): string {
  if (days >= 31) return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300 dark:border-rose-800';
  if (days >= 8) return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800';
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
}

function statusTone(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('OVERDUE') || s.includes('DELAY') || s.includes('PAST')) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300';
  }
  if (s.includes('ACTIVE') || s.includes('OPEN') || s.includes('PENDING')) {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300';
  }
  if (s.includes('PAID') || s.includes('DONE') || s.includes('COMPLETE')) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  return 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300';
}

function ReportTable({
  language,
  total,
  count,
  rows,
  showDays,
  variant,
}: {
  language: string;
  total: number;
  count: number;
  rows: OutstandingReport['items'];
  showDays: boolean;
  variant: 'outstanding' | 'delayed';
}) {
  const columns = useMemo<DataTableColumn<CustomerTracking>[]>(() => {
    const cols: DataTableColumn<CustomerTracking>[] = [
      {
        id: 'name',
        header: language === 'MM' ? 'အမည်' : 'Name',
        accessor: (r) => r.customer_name,
        cell: (r) => (
          <span className="font-medium text-gray-900 dark:text-gray-100">{r.customer_name}</span>
        ),
      },
      {
        id: 'phone',
        header: language === 'MM' ? 'ဖုန်း' : 'Phone',
        accessor: (r) => r.customer_phone,
        cell: (r) => (
          <span className="font-mono text-[#996515] dark:text-amber-300/90">{r.customer_phone}</span>
        ),
      },
      {
        id: 'ref',
        header: language === 'MM' ? 'ကိုးကား' : 'Ref',
        accessor: (r) => r.reference_no,
        cell: (r) => (
          <span className="font-mono text-[11px] text-sky-800 dark:text-sky-300">{r.reference_no}</span>
        ),
      },
      {
        id: 'due',
        header: language === 'MM' ? 'သတ်မှတ်ရက်' : 'Due',
        accessor: (r) => String(r.due_date),
        cell: (r) => (
          <span className="font-mono text-gray-700 dark:text-gray-300">
            {String(r.due_date).slice(0, 10)}
          </span>
        ),
      },
    ];
    if (showDays) {
      cols.push({
        id: 'days',
        header: language === 'MM' ? 'ရက်ကျော်' : 'Days',
        accessor: (r) => r.days_overdue || 0,
        align: 'center',
        cell: (r) => {
          const d = r.days_overdue || 0;
          return (
            <span className={`inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded border text-[11px] font-bold ${daysTone(d)}`}>
              {d}
            </span>
          );
        },
      });
    }
    cols.push(
      {
        id: 'amount',
        header: language === 'MM' ? 'ကျန်ငွေ' : 'Due Amt',
        accessor: (r) => r.amount_due,
        align: 'right',
        cell: (r) => (
          <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
            {formatMMK(r.amount_due)}
          </span>
        ),
      },
      {
        id: 'status',
        header: language === 'MM' ? 'အခြေအနေ' : 'Status',
        accessor: (r) => r.status,
        cell: (r) => (
          <span
            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${statusTone(r.status)}`}
          >
            {r.status}
          </span>
        ),
      }
    );
    return cols;
  }, [language, showDays]);

  const banner =
    variant === 'delayed'
      ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
      : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300';

  return (
    <div className="space-y-3">
      <div
        className={`flex justify-between items-center text-xs font-semibold px-3 py-2 rounded-lg border ${banner}`}
      >
        <span>
          {count} {language === 'MM' ? 'ဦး' : 'records'}
        </span>
        <span className="font-mono font-bold">{formatMMK(total)}</span>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        language={language}
        searchable
        resetDeps={[count, showDays, variant]}
        emptyMessage={language === 'MM' ? 'စာရင်းမရှိပါ' : 'No records'}
        className="!shadow-none !rounded-xl"
      />
    </div>
  );
}
