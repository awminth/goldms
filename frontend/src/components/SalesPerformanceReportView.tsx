import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  api,
  type SalesPerformanceMyanmarRow,
  type SalesPerformanceReport,
  type SalesPerformanceThaiRow,
} from '../services/api';
import { formatMMK, PURITY_LABELS } from '../utils/goldCalculations';
import { todayISO } from '../utils/dateFormat';
import { DataTable, type DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { BarChart2, Loader2, RefreshCw, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import type { GoldPurity } from '../types/gold';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function monthNow(): string {
  return todayISO().slice(0, 7);
}

function truncateLabel(s: string, max = 14): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type ChartPoint = { name: string; full: string; qty: number; amount: number };

function QtyBarChart({
  data,
  accent,
  language,
  emptyText,
  large = false,
}: {
  data: ChartPoint[];
  accent: string;
  language: string;
  emptyText: string;
  large?: boolean;
}) {
  if (data.length === 0) {
    return <p className="text-xs text-gray-400 py-10 text-center">{emptyText}</p>;
  }
  const height = Math.max(large ? 380 : 220, data.length * (large ? 44 : 36));
  return (
    <div style={{ width: '100%', height }} className={large ? 'min-h-[380px]' : 'min-h-[220px]'}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={large ? 128 : 108}
            tick={{ fontSize: large ? 11 : 10, fill: '#4b5563' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(212, 175, 55, 0.08)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as ChartPoint;
              return (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] px-3 py-2 text-[11px] shadow-lg">
                  <div className="font-bold text-gray-900 dark:text-white mb-1">{row.full}</div>
                  <div className="text-gray-600 dark:text-gray-300">
                    {language === 'MM' ? 'အရေအတွက်' : 'Qty'}:{' '}
                    <span className="font-mono font-bold">{row.qty}</span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-300">
                    {language === 'MM' ? 'ရောင်းငွေ' : 'Sales'}:{' '}
                    <span className="font-mono font-bold">{formatMMK(row.amount)}</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="qty" radius={[0, 6, 6, 0]} barSize={large ? 22 : 18}>
            {data.map((_, i) => (
              <Cell key={i} fill={accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const SalesPerformanceReportView: React.FC = () => {
  const { language, masterCategories } = useGoldShop();
  const [month, setMonth] = useState(monthNow);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SalesPerformanceReport | null>(null);
  const [panel, setPanel] = useState<'best' | 'least' | 'best-graph' | 'least-graph'>('best');

  const rank: 'best' | 'least' =
    panel === 'best' || panel === 'best-graph' ? 'best' : 'least';
  const showGraph = panel === 'best-graph' || panel === 'least-graph';

  const catLabel = useCallback(
    (code: string) => {
      const hit = masterCategories.find((c) => c.code === code);
      if (!hit) return code;
      return language === 'MM' ? hit.name_mm || hit.name_en || code : hit.name_en || hit.name_mm || code;
    },
    [masterCategories, language]
  );

  const purityLabel = useCallback(
    (p: string) => {
      const hit = PURITY_LABELS[p as GoldPurity];
      if (!hit) return p;
      return language === 'MM' ? hit.mm : hit.en;
    },
    [language]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.reportSalesPerformance(month);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report load failed');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const myanmarRows = useMemo(() => {
    const raw = rank === 'best' ? report?.myanmar.best ?? [] : report?.myanmar.least ?? [];
    return raw.map((r, i) => ({ ...r, _rank: i + 1 }));
  }, [rank, report]);

  const thaiRows = useMemo(() => {
    const raw = rank === 'best' ? report?.thai.best ?? [] : report?.thai.least ?? [];
    return raw.map((r, i) => ({ ...r, _rank: i + 1 }));
  }, [rank, report]);

  const mmChartData: ChartPoint[] = useMemo(
    () =>
      myanmarRows.map((r) => {
        const full = `${catLabel(r.category)} · ${purityLabel(r.purity)}`;
        return {
          name: truncateLabel(full),
          full,
          qty: r.qty,
          amount: r.total_amount,
        };
      }),
    [myanmarRows, catLabel, purityLabel]
  );

  const thaiChartData: ChartPoint[] = useMemo(
    () =>
      thaiRows.map((r) => {
        const full = `${Number(r.grams).toFixed(2)} g · ${catLabel(r.category)}`;
        return {
          name: truncateLabel(full),
          full,
          qty: r.qty,
          amount: r.total_amount,
        };
      }),
    [thaiRows, catLabel]
  );

  const barAccent = rank === 'best' ? '#059669' : '#e11d48';
  const emptyChart =
    language === 'MM' ? 'ဤလတွင် ရောင်းချမှု မရှိပါ' : 'No sales this month';

  type MmRow = SalesPerformanceMyanmarRow & { _rank: number };
  type ThaiRow = SalesPerformanceThaiRow & { _rank: number };

  const mmColumns: DataTableColumn<MmRow>[] = useMemo(
    () => [
      {
        id: 'rank',
        header: '#',
        accessor: (r) => r._rank,
        cell: (r) => String(r._rank),
        className: 'w-10',
      },
      {
        id: 'category',
        header: language === 'MM' ? 'အမျိုးအစား' : 'Category',
        accessor: (r) => catLabel(r.category),
        cell: (r) => catLabel(r.category),
      },
      {
        id: 'purity',
        header: language === 'MM' ? 'ရွှေရည်' : 'Purity',
        accessor: (r) => purityLabel(r.purity),
        cell: (r) => purityLabel(r.purity),
      },
      {
        id: 'qty',
        header: language === 'MM' ? 'အရေအတွက်' : 'Qty',
        accessor: (r) => r.qty,
        cell: (r) => <span className="font-mono font-bold">{r.qty}</span>,
      },
      {
        id: 'amount',
        header: language === 'MM' ? 'ရောင်းငွေ' : 'Sales',
        accessor: (r) => r.total_amount,
        cell: (r) => <span className="font-mono">{formatMMK(r.total_amount)}</span>,
      },
    ],
    [language, catLabel, purityLabel]
  );

  const thaiColumns: DataTableColumn<ThaiRow>[] = useMemo(
    () => [
      {
        id: 'rank',
        header: '#',
        accessor: (r) => r._rank,
        cell: (r) => String(r._rank),
        className: 'w-10',
      },
      {
        id: 'grams',
        header: 'Gram',
        accessor: (r) => r.grams,
        cell: (r) => <span className="font-mono font-bold">{Number(r.grams).toFixed(2)} g</span>,
      },
      {
        id: 'category',
        header: language === 'MM' ? 'အမျိုးအစား' : 'Category',
        accessor: (r) => catLabel(r.category),
        cell: (r) => catLabel(r.category),
      },
      {
        id: 'qty',
        header: language === 'MM' ? 'အရေအတွက်' : 'Qty',
        accessor: (r) => r.qty,
        cell: (r) => <span className="font-mono font-bold">{r.qty}</span>,
      },
      {
        id: 'amount',
        header: language === 'MM' ? 'ရောင်းငွေ' : 'Sales',
        accessor: (r) => r.total_amount,
        cell: (r) => <span className="font-mono">{formatMMK(r.total_amount)}</span>,
      },
    ],
    [language, catLabel]
  );

  const exportExcel = () => {
    if (!report) return;
    const title =
      language === 'MM'
        ? `ရောင်းအားအစီရင်ခံစာ (${report.month}) — ${rank === 'best' ? 'အကောင်းဆုံး' : 'အနည်းဆုံး'}`
        : `Sales performance (${report.month}) — ${rank === 'best' ? 'Best' : 'Least'}`;
    exportToExcel({
      filename: `sales_performance_${report.month}_${rank}`,
      sheetName: 'Sales',
      title,
      columns: [
        {
          header: language === 'MM' ? 'အုပ်စု' : 'Group',
          value: (r: { group: string }) => r.group,
          width: 14,
        },
        {
          header: language === 'MM' ? 'အမျိုးအစား' : 'Category',
          value: (r: { category: string }) => r.category,
          width: 16,
        },
        {
          header: language === 'MM' ? 'ရွှေရည် / Gram' : 'Purity / Gram',
          value: (r: { detail: string }) => r.detail,
          width: 16,
        },
        { header: language === 'MM' ? 'အရေအတွက်' : 'Qty', value: (r: { qty: number }) => r.qty, width: 10 },
        {
          header: language === 'MM' ? 'ရောင်းငွေ' : 'Amount',
          value: (r: { total_amount: number }) => r.total_amount,
          width: 14,
        },
      ],
      rows: [
        ...myanmarRows.map((r) => ({
          group: language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar',
          category: catLabel(r.category),
          detail: purityLabel(r.purity),
          qty: r.qty,
          total_amount: r.total_amount,
        })),
        ...thaiRows.map((r) => ({
          group: language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai',
          category: catLabel(r.category),
          detail: `${Number(r.grams).toFixed(2)} g`,
          qty: r.qty,
          total_amount: r.total_amount,
        })),
      ],
    });
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#D4AF37]" />
            {language === 'MM' ? 'ရောင်းအားအစီရင်ခံစာ (လချုပ်)' : 'Sales Performance (Monthly)'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {language === 'MM'
              ? 'မြန်မာရွှေ — အမျိုးအစား + ရွှေရည် · ထိုင်းရွှေ — Gram + အမျိုးအစား'
              : 'Myanmar — category + purity · Thai — gram + category'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">
              {language === 'MM' ? 'လ' : 'Month'}
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-8 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {language === 'MM' ? 'ပြန်တင်' : 'Refresh'}
          </button>
          <ExcelExportButton
            language={language}
            onClick={exportExcel}
            disabled={!report || (myanmarRows.length === 0 && thaiRows.length === 0)}
            className="!h-8 !py-0"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white dark:bg-[#1A1A1A] p-2 rounded-2xl border border-gray-200 dark:border-gray-800">
        {(
          [
            {
              id: 'best' as const,
              icon: TrendingUp,
              labelMM: 'အကောင်းဆုံး',
              labelEN: 'Best',
              active: 'bg-emerald-600 text-white shadow-xs',
            },
            {
              id: 'least' as const,
              icon: TrendingDown,
              labelMM: 'အနည်းဆုံး',
              labelEN: 'Least',
              active: 'bg-rose-600 text-white shadow-xs',
            },
            {
              id: 'best-graph' as const,
              icon: BarChart2,
              labelMM: 'Graph · အကောင်းဆုံး',
              labelEN: 'Graph · Best',
              active: 'bg-emerald-600 text-white shadow-xs',
            },
            {
              id: 'least-graph' as const,
              icon: BarChart2,
              labelMM: 'Graph · အနည်းဆုံး',
              labelEN: 'Graph · Least',
              active: 'bg-rose-600 text-white shadow-xs',
            },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = panel === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setPanel(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                active
                  ? t.active
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {language === 'MM' ? t.labelMM : t.labelEN}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading && !report ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          {language === 'MM' ? 'တင်နေသည်…' : 'Loading…'}
        </div>
      ) : showGraph ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-[#D4AF37]" />
                {language === 'MM' ? 'မြန်မာရွှေ Graph' : 'Myanmar Graph'}
              </h3>
              <span className="text-[11px] text-gray-500">
                {report?.myanmar.total_qty ?? 0}{' '}
                {language === 'MM' ? 'ခု ·' : 'pcs ·'} {formatMMK(report?.myanmar.total_amount ?? 0)}
              </span>
            </div>
            <QtyBarChart
              data={mmChartData}
              accent={barAccent}
              language={language}
              emptyText={emptyChart}
              large
            />
          </div>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-[#D4AF37]" />
                {language === 'MM' ? 'ထိုင်းရွှေ Graph' : 'Thai Graph'}
              </h3>
              <span className="text-[11px] text-gray-500">
                {report?.thai.total_qty ?? 0}{' '}
                {language === 'MM' ? 'ခု ·' : 'pcs ·'} {formatMMK(report?.thai.total_amount ?? 0)}
              </span>
            </div>
            <QtyBarChart
              data={thaiChartData}
              accent={barAccent}
              language={language}
              emptyText={emptyChart}
              large
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar Gold'}
              </h3>
              <span className="text-[11px] text-gray-500">
                {report?.myanmar.total_qty ?? 0}{' '}
                {language === 'MM' ? 'ခု ·' : 'pcs ·'} {formatMMK(report?.myanmar.total_amount ?? 0)}
              </span>
            </div>
            {myanmarRows.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">{emptyChart}</p>
            ) : (
              <DataTable
                rows={myanmarRows}
                columns={mmColumns}
                rowKey={(r) => `${r.category}-${r.purity}-${r._rank}`}
              />
            )}
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold'}
              </h3>
              <span className="text-[11px] text-gray-500">
                {report?.thai.total_qty ?? 0}{' '}
                {language === 'MM' ? 'ခု ·' : 'pcs ·'} {formatMMK(report?.thai.total_amount ?? 0)}
              </span>
            </div>
            {thaiRows.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">{emptyChart}</p>
            ) : (
              <DataTable
                rows={thaiRows}
                columns={thaiColumns}
                rowKey={(r) => `${r.category}-${r.grams}-${r._rank}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
