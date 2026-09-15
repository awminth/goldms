import React, { useEffect, useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  formatMMK,
  kpyToYway,
  ywayToKpy,
  formatKPYMyanmar,
  formatKPYEnglish,
} from '../utils/goldCalculations';
import { api, type ReportSummary } from '../services/api';
import {
  TrendingUp,
  Coins,
  Gem,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileBarChart2,
  Eye,
} from 'lucide-react';

function isSameLocalDay(iso: string, ref = new Date()) {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isOverduePawn(r: { status: string; due_date: string }, today: string): boolean {
  if (r.status === 'REDEEMED' || r.status === 'CONFISCATED') return false;
  return r.status === 'OVERDUE' || r.due_date < today;
}

export const DashboardView: React.FC = () => {
  const { goldPrices, inventory, transactions, customers, pawnRecords, language, customOrders } =
    useGoldShop();

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    void api
      .reportSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        /* keep local fallbacks */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const todayTxns = useMemo(
    () => transactions.filter((t) => isSameLocalDay(t.created_at, today)),
    [transactions, today]
  );

  const todaySales = todayTxns.filter((t) => t.transaction_type === 'SALE');
  const todayBuybacks = todayTxns.filter((t) => t.transaction_type === 'PURCHASE');

  const todayStr = today.toISOString().slice(0, 10);

  const todaySalesTotal =
    summary?.today_sales?.total ?? todaySales.reduce((s, t) => s + t.paid_amount, 0);
  const todaySalesGross = todaySales.reduce((s, t) => s + t.total_amount, 0);
  const todaySalesCount = summary?.today_sales?.count ?? todaySales.length;
  const todayBuyTotal =
    summary?.today_purchases?.total ?? todayBuybacks.reduce((s, t) => s + t.paid_amount, 0);
  const todayBuyCount = summary?.today_purchases?.count ?? todayBuybacks.length;
  const todayCreditIssued = todaySales.reduce((s, t) => s + (t.remaining_amount || 0), 0);

  const totalStockItems = inventory.filter((i) => i.status === 'IN_STOCK');
  const totalStockKpy = ywayToKpy(
    totalStockItems.reduce(
      (sum, item) => sum + kpyToYway(item.weight_kyat, item.weight_pae, item.weight_yway),
      0
    )
  );
  const totalStockEstimatedValue =
    summary?.stock?.estimated_value ??
    totalStockItems.reduce((sum, item) => sum + (item.selling_price_estimated || 0), 0);
  const totalStockCount = summary?.stock?.count ?? totalStockItems.length;

  const customerBalanceTotal =
    summary?.customer_balance_total ??
    customers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);

  const customersWithBalance =
    summary?.customers_with_balance ??
    customers.filter((c) => c.outstanding_balance > 0).length;

  const overduePawns = useMemo(
    () => pawnRecords.filter((p) => isOverduePawn(p, todayStr)),
    [pawnRecords, todayStr]
  );
  const pawnOverdueCount = overduePawns.length;

  const pendingOrders =
    summary?.open_orders ??
    customOrders.filter((o) => o.status === 'PENDING' || o.status === 'IN_PRODUCTION').length;

  const dateLabel = today.toLocaleDateString(language === 'MM' ? 'my-MM' : 'en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const metrics = [
    {
      key: 'sales',
      label: language === 'MM' ? 'ယနေ့ အရောင်း' : 'Today Sales',
      value: formatMMK(todaySalesTotal),
      hint: `${todaySalesCount} ${language === 'MM' ? 'ဘောင်ချာ' : 'vouchers'} · ${formatMMK(todaySalesGross)}`,
      icon: ArrowUpRight,
    },
    {
      key: 'buy',
      label: language === 'MM' ? 'ယနေ့ အဝယ်' : 'Today Buyback',
      value: formatMMK(todayBuyTotal),
      hint: `${todayBuyCount} ${language === 'MM' ? 'စောင်' : 'txns'}`,
      icon: ArrowDownLeft,
    },
    {
      key: 'stock',
      label: language === 'MM' ? 'စတော့လက်ကျန်' : 'Stock on Hand',
      value: language === 'MM' ? formatKPYMyanmar(totalStockKpy) : formatKPYEnglish(totalStockKpy),
      hint: `${totalStockCount} ${language === 'MM' ? 'ခု' : 'pcs'} · ${formatMMK(totalStockEstimatedValue)}`,
      icon: Gem,
    },
    {
      key: 'customer-balance',
      label: language === 'MM' ? 'ဖောက်သည် လက်ကျန်ငွေ' : 'Customer Balances',
      value: formatMMK(customerBalanceTotal),
      hint: `${customersWithBalance} ${language === 'MM' ? 'ဦး' : 'cust.'}`,
      icon: Coins,
      accent: 'text-rose-600 dark:text-rose-400',
    },
    {
      key: 'pawn-overdue',
      label: language === 'MM' ? 'အပေါင် ရက်လွန်' : 'Pawn Overdue',
      value: String(pawnOverdueCount),
      hint:
        pawnOverdueCount > 0
          ? language === 'MM'
            ? 'စာရင်းကြည့်ရန် အပေါင်သို့'
            : 'view list in Pawn'
          : language === 'MM'
            ? 'ရက်လွန် မရှိ'
            : 'none overdue',
      icon: Clock,
      accent: 'text-amber-700 dark:text-amber-400',
    },
    {
      key: 'orders',
      label: language === 'MM' ? 'Order လက်ကျန်' : 'Open Orders',
      value: String(pendingOrders),
      hint: language === 'MM' ? 'စရံ / ထုတ်လုပ်ဆဲ' : 'pending / in production',
      icon: FileBarChart2,
    },
  ];

  const recentToday = todayTxns.slice(0, 8);
  const recentFallback = transactions.slice(0, 8);
  const activityList = recentToday.length > 0 ? recentToday : recentFallback;
  const activityIsToday = recentToday.length > 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Title — read-only signal */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {language === 'MM' ? 'ပင်မ ဒက်ရှ်ဘုတ်' : 'Dashboard Overview'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {dateLabel}
            <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
            {language === 'MM'
              ? 'နေ့စဉ်ကြည့်ရှုရန် အကျဉ်းချုပ် (ပြင်ဆင်ခြင်းမရှိ)'
              : 'Daily read-only snapshot — no actions'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-[#FAF8F2] dark:bg-[#201D17] text-[#996515] dark:text-[#E5C158] border border-[#D4AF37]/25">
          <Eye className="w-3 h-3" />
          READ-ONLY
        </span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.key}
              className="p-3.5 rounded-2xl bg-card dark:bg-[#1A1A1A] border border-line dark:border-gray-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {m.label}
                </span>
                <Icon className="w-3.5 h-3.5 text-[#D4AF37]" />
              </div>
              <div
                className={`text-base sm:text-lg font-bold font-mono leading-tight ${
                  m.accent || 'text-gray-900 dark:text-white'
                }`}
              >
                {m.value}
              </div>
              <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 truncate">{m.hint}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Daily gold prices — view only */}
        <section className="xl:col-span-5 rounded-2xl bg-card dark:bg-[#1A1A1A] border border-line dark:border-gray-800 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-line dark:border-gray-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              {language === 'MM' ? 'နေ့စဉ် ရွှေပေါက်ဈေး' : 'Daily Gold Prices'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 border-b border-line dark:border-gray-800 bg-[#FAF8F2]/60 dark:bg-[#141414]">
                  <th className="px-4 py-2.5 font-semibold">
                    {language === 'MM' ? 'အမျိုးအစား' : 'Type'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    {language === 'MM' ? 'အရောင်း' : 'Sell'}
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-right">
                    {language === 'MM' ? 'အဝယ်' : 'Buy'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                {goldPrices.map((price) => (
                  <tr
                    key={price.id}
                    className={
                      price.gold_type === 'MEELIN'
                        ? 'bg-amber-50/30 dark:bg-amber-950/10'
                        : undefined
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {language === 'MM' ? price.name_mm : price.name_en}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-gray-900 dark:text-amber-300">
                      {formatMMK(price.price_per_kyat)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {formatMMK(
                        price.buy_price_per_kyat || Math.round(price.price_per_kyat - 50000)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Today trade summary */}
        <section className="xl:col-span-7 rounded-2xl bg-card dark:bg-[#1A1A1A] border border-line dark:border-gray-800 p-4 sm:p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
            {language === 'MM' ? 'ယနေ့ အရောင်းအဝယ် အကျဉ်းချုပ်' : "Today's Trade Summary"}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/20 p-3">
              <div className="text-[10px] text-gray-500 font-semibold uppercase">
                {language === 'MM' ? 'အရောင်းရငွေ' : 'Sales cash-in'}
              </div>
              <div className="mt-1 font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                {formatMMK(todaySalesTotal)}
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/20 p-3">
              <div className="text-[10px] text-gray-500 font-semibold uppercase">
                {language === 'MM' ? 'အဝယ်ပေးငွေ' : 'Buyback out'}
              </div>
              <div className="mt-1 font-mono font-bold text-sm text-blue-700 dark:text-blue-400">
                {formatMMK(todayBuyTotal)}
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/20 p-3">
              <div className="text-[10px] text-gray-500 font-semibold uppercase">
                {language === 'MM' ? 'အသားတင်' : 'Net cash'}
              </div>
              <div className="mt-1 font-mono font-bold text-sm text-gray-900 dark:text-white">
                {formatMMK(todaySalesTotal - todayBuyTotal)}
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/20 p-3">
              <div className="text-[10px] text-gray-500 font-semibold uppercase">
                {language === 'MM' ? 'ယနေ့ အကြွေးထုတ်' : 'Credit issued'}
              </div>
              <div className="mt-1 font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                {formatMMK(todayCreditIssued)}
              </div>
            </div>
          </div>

          {/* Balances / pawn snapshot */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-line dark:border-gray-800 p-3">
              <div className="text-gray-500 font-semibold mb-1">
                {language === 'MM' ? 'ဖောက်သည် လက်ကျန်ငွေ' : 'Customer balance total'}
              </div>
              <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                {formatMMK(customerBalanceTotal)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {customersWithBalance} {language === 'MM' ? 'ဦး' : 'customers'}
              </div>
            </div>
            <div className="rounded-xl border border-line dark:border-gray-800 p-3">
              <div className="text-gray-500 font-semibold mb-1">
                {language === 'MM' ? 'အပေါင် ရက်လွန်' : 'Pawn overdue'}
              </div>
              <div className="font-mono font-bold text-amber-700 dark:text-amber-400">
                {pawnOverdueCount}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {language === 'MM' ? 'လက်ရှိ အပေါင်များ' : 'active pawn records'}
              </div>
            </div>
            <div className="rounded-xl border border-line dark:border-gray-800 p-3">
              <div className="text-gray-500 font-semibold mb-1">
                {language === 'MM' ? 'Order လက်ကျန်' : 'Open orders'}
              </div>
              <div className="font-mono font-bold text-gray-900 dark:text-white">
                {pendingOrders}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {language === 'MM' ? 'စရံ / ထုတ်လုပ်ဆဲ' : 'pending / in production'}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Activity list — display only */}
      <section className="rounded-2xl bg-card dark:bg-[#1A1A1A] border border-line dark:border-gray-800 overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-line dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            {activityIsToday
              ? language === 'MM'
                ? 'ယနေ့ လုပ်ငန်းမှတ်တမ်း'
                : "Today's activity"
              : language === 'MM'
                ? 'လတ်တလော ဘောင်ချာ'
                : 'Recent vouchers'}
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {language === 'MM'
              ? 'ကြည့်ရှုရန်သာ — ပြေစာဖွင့်ခြင်း / ပြင်ဆင်ခြင်း မရှိပါ'
              : 'View only — open/edit actions live in POS & Reports'}
          </p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-900">
          {activityList.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-gray-400">
              {language === 'MM' ? 'ယနေ့မှတ်တမ်း မရှိသေးပါ' : 'No transactions today'}
            </div>
          )}
          {activityList.map((txn) => (
            <div
              key={txn.id}
              className="px-4 sm:px-5 py-3 flex items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                    {txn.invoice_no}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      txn.transaction_type === 'SALE'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {txn.transaction_type}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(txn.created_at).toLocaleTimeString(
                      language === 'MM' ? 'my-MM' : 'en-GB',
                      { hour: '2-digit', minute: '2-digit' }
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {txn.customer_name}
                  {txn.items[0] ? ` · ${txn.items[0].item_name}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0 font-mono text-xs font-bold text-gray-900 dark:text-amber-300">
                {formatMMK(txn.total_amount)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
