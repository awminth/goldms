import React, { useCallback, useEffect, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { api, type ReportSummary } from '../services/api';
import { formatMMK } from '../utils/goldCalculations';
import { FileBarChart2, RefreshCw, Loader2 } from 'lucide-react';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';

export const ReportsView: React.FC = () => {
  const { language, transactions, inventory, customOrders, pawnRecords, customers } =
    useGoldShop();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.reportSummary();
      setSummary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todaySales = transactions.filter(
    (t) => t.transaction_type === 'SALE' && String(t.created_at).slice(0, 10) === today
  );
  const inStock = inventory.filter((i) => i.status === 'IN_STOCK');
  const openOrders = customOrders.filter(
    (o) => o.status === 'PENDING' || o.status === 'IN_PRODUCTION'
  );
  const overduePawns = pawnRecords.filter((p) => p.status === 'OVERDUE' || p.due_date < today);

  const rows = [
    {
      label: language === 'MM' ? 'ယနေ့ အရောင်း' : 'Today sales',
      value: formatMMK(summary?.today_sales?.total ?? todaySales.reduce((s, t) => s + t.paid_amount, 0)),
      hint: `${summary?.today_sales?.count ?? todaySales.length} ${language === 'MM' ? 'ဘောင်ချာ' : 'vouchers'}`,
    },
    {
      label: language === 'MM' ? 'ယနေ့ အဝယ်' : 'Today purchases',
      value: formatMMK(summary?.today_purchases?.total ?? 0),
      hint: `${summary?.today_purchases?.count ?? 0}`,
    },
    {
      label: language === 'MM' ? 'စတော့လက်ကျန်' : 'Stock on hand',
      value: String(summary?.stock?.count ?? inStock.length),
      hint: formatMMK(summary?.stock?.estimated_value ?? 0),
    },
    {
      label: language === 'MM' ? 'Order လက်ကျန်' : 'Open orders',
      value: String(summary?.open_orders ?? openOrders.length),
      hint: '',
    },
    {
      label: language === 'MM' ? 'အပေါင် လက်ရှိ' : 'Active pawns',
      value: String(summary?.active_pawns ?? pawnRecords.filter((p) => p.status === 'ACTIVE' || p.status === 'OVERDUE').length),
      hint: `${overduePawns.length} ${language === 'MM' ? 'ရက်လွန်' : 'overdue'}`,
    },
    {
      label: language === 'MM' ? 'ဖောက်သည် လက်ကျန်ငွေ' : 'Customer balances',
      value: formatMMK(summary?.customer_balance_total ?? 0),
      hint: `${summary?.customers_with_balance ?? customers.filter((c) => c.outstanding_balance > 0).length} ${language === 'MM' ? 'ဦး' : 'cust.'}`,
    },
  ];

  const exportSummary = () => {
    exportToExcel({
      filename: 'reports_summary',
      sheetName: 'Summary',
      title: language === 'MM' ? 'အစီရင်ခံစာ အနှစ်ချုပ်' : 'Reports Summary',
      columns: [
        { header: language === 'MM' ? 'အချက်' : 'Metric', value: (r) => r.label, width: 28 },
        { header: language === 'MM' ? 'တန်ဖိုး' : 'Value', value: (r) => r.value, width: 18 },
        { header: language === 'MM' ? 'မှတ်ချက်' : 'Hint', value: (r) => r.hint, width: 22 },
      ],
      rows,
    });
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileBarChart2 className="w-5 h-5 text-[#D4AF37]" />
            {language === 'MM' ? 'အစီရင်ခံစာ အနှစ်ချုပ်' : 'Reports Summary'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {language === 'MM'
              ? 'နေ့စဉ် အရောင်း / စတော့ / Order / အပေါင် အကျဉ်းချုပ်'
              : 'Daily sales, stock, orders, and pawn overview'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelExportButton language={language} onClick={exportSummary} disabled={rows.length === 0} />
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {language === 'MM' ? 'ပြန်တင်' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs px-4 py-3">
          {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          {language === 'MM' ? 'တင်နေသည်…' : 'Loading…'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] p-4"
            >
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{r.label}</p>
              <p className="mt-2 text-xl font-extrabold text-gray-900 dark:text-amber-300 font-mono">
                {r.value}
              </p>
              {r.hint ? <p className="mt-1 text-[11px] text-gray-400">{r.hint}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
