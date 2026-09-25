import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import { Transaction, TransactionItem } from '../types/gold';
import { formatKPYMyanmar, formatMMK, kpyToGrams, KYAT_TO_GRAMS } from '../utils/goldCalculations';
import { formatDateTime } from '../utils/dateFormat';
import { DataTable, DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Eye,
  PackageMinus,
  ReceiptText,
  ShoppingBag,
  Trash2,
} from 'lucide-react';

type HistoryTab = 'SALE' | 'PURCHASE' | 'EXCHANGE' | 'SHOP_OUT';

const isThaiLine = (i: TransactionItem) =>
  i.item_type === 'THAI_GOLD' || i.purity === 'THAI_GOLD';

function thaiGramsOf(i: TransactionItem, kyatToGrams: number): number {
  const unit = Number(i.thai_weight_unit || 0);
  if (unit > 0) return unit;
  return kpyToGrams(i.net_weight || { kyat: 0, pae: 0, yway: 0 }, kyatToGrams);
}

/** Full-row text color by voucher / transaction type. */
function txnTypeRowClass(type: string | undefined | null): string {
  switch (String(type || '').toUpperCase()) {
    case 'SALE':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'PURCHASE':
      return 'text-amber-700 dark:text-amber-300';
    case 'EXCHANGE':
      return 'text-sky-700 dark:text-sky-300';
    case 'SHOP_OUT':
      return 'text-violet-700 dark:text-violet-300';
    case 'ORDER':
      return 'text-indigo-700 dark:text-indigo-300';
    case 'PAWN':
      return 'text-rose-700 dark:text-rose-300';
    default:
      return '';
  }
}

export const PosHistoryView: React.FC = () => {
  const {
    transactions,
    language,
    setSelectedVoucher,
    deleteTransaction,
    can,
    shopSettings,
  } = useGoldShop();
  const dialog = useDialog();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;
  const [tab, setTab] = useState<HistoryTab>('SALE');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => transactions.filter((t) => t.transaction_type === tab),
    [transactions, tab]
  );

  const tabMeta: {
    id: HistoryTab;
    labelMM: string;
    labelEN: string;
    icon: typeof ShoppingBag;
    activeCls: string;
  }[] = [
    {
      id: 'SALE',
      labelMM: 'အရောင်းဘောင်ချာ',
      labelEN: 'Sales',
      icon: ShoppingBag,
      activeCls: 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white',
    },
    {
      id: 'PURCHASE',
      labelMM: 'အဝယ်ဘောင်ချာ',
      labelEN: 'Purchases',
      icon: ArrowDownLeft,
      activeCls: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
    },
    {
      id: 'EXCHANGE',
      labelMM: 'အလဲအလှယ်',
      labelEN: 'Exchange',
      icon: ArrowLeftRight,
      activeCls: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
    },
    {
      id: 'SHOP_OUT',
      labelMM: 'ဆိုင်ထုတ်',
      labelEN: 'Shop Out',
      icon: PackageMinus,
      activeCls: 'bg-gradient-to-r from-rose-600 to-orange-600 text-white',
    },
  ];

  const handleDelete = async (t: Transaction) => {
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'ဘောင်ချာ ဖျက်မည်' : 'Delete voucher',
      message:
        language === 'MM'
          ? `${t.invoice_no} ဘောင်ချာကို ဖျက်မလား?`
          : `Delete voucher ${t.invoice_no}?`,
      confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
      danger: true,
    });
    if (!ok) return;
    setBusyId(t.id);
    try {
      await deleteTransaction(t.id);
    } catch (err) {
      await dialog.alert({
        title: language === 'MM' ? 'မအောင်မြင်ပါ' : 'Failed',
        message: err instanceof Error ? err.message : 'Delete failed',
      });
    } finally {
      setBusyId(null);
    }
  };

  const exportExcel = () => {
    exportToExcel({
      filename: `voucher_${tab.toLowerCase()}`,
      sheetName: tab,
      title:
        language === 'MM'
          ? `ဘောင်ချာမှတ်တမ်း — ${tabMeta.find((x) => x.id === tab)?.labelMM}`
          : `Voucher History — ${tab}`,
      columns: [
        { header: language === 'MM' ? 'ဘောင်ချာ' : 'Invoice', value: (t) => t.invoice_no, width: 16 },
        {
          header: language === 'MM' ? 'ရက်စွဲ' : 'Date',
          value: (t) => formatDateTime(t.created_at),
          width: 18,
        },
        {
          header: language === 'MM' ? 'ဖောက်သည်' : 'Customer',
          value: (t) => t.customer_name,
          width: 20,
        },
        {
          header: language === 'MM' ? 'ဖုန်း' : 'Phone',
          value: (t) => t.customer_phone || '',
          width: 14,
        },
        {
          header: language === 'MM' ? 'ပစ္စည်းများ' : 'Items',
          value: (t) => t.items.map((i) => i.item_name).join(', '),
          width: 36,
        },
        {
          header: language === 'MM' ? 'ကျသင့်ငွေ' : 'Total',
          value: (t) => t.total_amount,
          width: 14,
        },
        {
          header: language === 'MM' ? 'ပေးပြီး' : 'Paid',
          value: (t) => t.paid_amount,
          width: 14,
        },
        {
          header: language === 'MM' ? 'ငွေပေးချေမှု' : 'Payment',
          value: (t) => t.payment_method,
          width: 12,
        },
        {
          header: language === 'MM' ? 'မှတ်ချက်' : 'Notes',
          value: (t) => t.notes || '',
          width: 24,
        },
      ],
      rows: filtered,
    });
  };

  const columns: DataTableColumn<Transaction>[] = useMemo(
    () => [
      {
        id: 'invoice',
        header: language === 'MM' ? 'ဘောင်ချာ' : 'Invoice',
        slot: 'primary',
        accessor: (t) => t.invoice_no,
        cell: (t) => (
          <span className="font-mono font-bold">{t.invoice_no}</span>
        ),
      },
      {
        id: 'date',
        header: language === 'MM' ? 'ရက်စွဲ' : 'Date',
        slot: 'primary',
        accessor: (t) => new Date(t.created_at).getTime(),
        cell: (t) => (
          <span className="whitespace-nowrap text-[11px] opacity-80">
            {formatDateTime(t.created_at)}
          </span>
        ),
      },
      {
        id: 'customer',
        header: language === 'MM' ? 'ဖောက်သည်' : 'Customer',
        slot: 'primary',
        accessor: (t) => t.customer_name,
        cell: (t) => (
          <span className="font-medium truncate block max-w-[140px]">{t.customer_name}</span>
        ),
      },
      {
        id: 'total',
        header: language === 'MM' ? 'ကျသင့်ငွေ' : 'Total',
        slot: 'primary',
        accessor: (t) => t.total_amount,
        align: 'right',
        cell: (t) => (
          <span className="font-mono font-bold whitespace-nowrap">{formatMMK(t.total_amount)}</span>
        ),
      },
      {
        id: 'type',
        header: language === 'MM' ? 'အမျိုးအစား' : 'Type',
        slot: 'detail',
        accessor: (t) => t.transaction_type,
        cell: (t) => t.transaction_type,
      },
      {
        id: 'phone',
        header: language === 'MM' ? 'ဖုန်း' : 'Phone',
        slot: 'detail',
        accessor: (t) => t.customer_phone || '',
        cell: (t) => <span className="font-mono">{t.customer_phone || '—'}</span>,
      },
      {
        id: 'items',
        header: language === 'MM' ? 'ပစ္စည်းများ' : 'Items',
        slot: 'detail',
        accessor: (t) => t.items.map((i) => i.item_name).join(', '),
        cell: (t) => (
          <span className="break-words">
            {t.items.length === 0
              ? '—'
              : t.items
                  .map((i) => {
                    const w =
                      i.item_type === 'THAI_GOLD' || i.purity === 'THAI_GOLD'
                        ? `${Number(i.thai_weight_unit || 0).toFixed(2)} g`
                        : formatKPYMyanmar(i.net_weight || { kyat: 0, pae: 0, yway: 0 });
                    return `${i.item_name} (${w})`;
                  })
                  .join(', ')}
          </span>
        ),
      },
      {
        id: 'item_count',
        header: language === 'MM' ? 'အရေအတွက်' : 'Qty',
        slot: 'detail',
        accessor: (t) => t.items.length,
        cell: (t) => t.items.length,
      },
      {
        id: 'gold_price',
        header: language === 'MM' ? 'ရွှေဈေး snapshot' : 'Gold price',
        slot: 'detail',
        accessor: (t) => t.gold_price_snapshot,
        cell: (t) => formatMMK(t.gold_price_snapshot),
      },
      {
        id: 'craft',
        header: language === 'MM' ? 'လက်ခစုစုပေါင်း' : 'Craft total',
        slot: 'detail',
        accessor: (t) => t.craftsmanship_total,
        cell: (t) => formatMMK(t.craftsmanship_total),
      },
      {
        id: 'stone',
        header: language === 'MM' ? 'ကျောက်ဖိုး' : 'Stone',
        slot: 'detail',
        accessor: (t) => t.stone_total || 0,
        cell: (t) => formatMMK(t.stone_total || 0),
      },
      {
        id: 'discount',
        header: language === 'MM' ? 'လျှော့ဈေး' : 'Discount',
        slot: 'detail',
        accessor: (t) => t.discount_amount,
        cell: (t) => formatMMK(t.discount_amount),
      },
      {
        id: 'tax',
        header: language === 'MM' ? 'အခွန်' : 'Tax',
        slot: 'detail',
        accessor: (t) => t.tax_amount,
        cell: (t) => formatMMK(t.tax_amount),
      },
      {
        id: 'paid',
        header: language === 'MM' ? 'ပေးငွေ' : 'Paid',
        slot: 'detail',
        accessor: (t) => t.paid_amount,
        cell: (t) => formatMMK(t.paid_amount),
      },
      {
        id: 'remaining',
        header: language === 'MM' ? 'လက်ကျန်' : 'Remaining',
        slot: 'detail',
        accessor: (t) => t.remaining_amount,
        cell: (t) => formatMMK(t.remaining_amount),
      },
      {
        id: 'payment',
        header: language === 'MM' ? 'ငွေပေးချေမှု' : 'Payment',
        slot: 'detail',
        accessor: (t) => t.payment_method,
        cell: (t) => (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {t.payment_method}
          </span>
        ),
      },
      {
        id: 'credit_due',
        header: language === 'MM' ? 'အကြွေးရက်' : 'Credit due',
        slot: 'detail',
        accessor: (t) => t.credit_due_date || '',
        cell: (t) => (t.credit_due_date ? formatDateTime(t.credit_due_date) : '—'),
      },
      {
        id: 'notes',
        header: language === 'MM' ? 'မှတ်ချက်' : 'Notes',
        slot: 'detail',
        accessor: (t) => t.notes || '',
        cell: (t) => t.notes || '—',
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
        slot: 'action',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (t) => (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedVoucher(t);
              }}
              className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-[10px] font-bold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
              title={language === 'MM' ? 'ဘောင်ချာကြည့်မည်' : 'View voucher'}
            >
              <Eye className="w-3.5 h-3.5" />
              {language === 'MM' ? 'ကြည့်' : 'View'}
            </button>
            {can('pos_history', 'delete') && (
              <button
                type="button"
                disabled={busyId === t.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(t);
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
    [language, setSelectedVoucher, can, busyId]
  );

  const renderShopOutCard = (t: Transaction) => {
    const thaiItems = t.items.filter(isThaiLine);
    const mmItems = t.items.filter((i) => !isThaiLine(i));
    const thaiGramsTotal = thaiItems.reduce(
      (s, i) => s + thaiGramsOf(i, kyatToGrams),
      0
    );

    const renderLine = (item: TransactionItem) => {
      const note =
        item.line_role && item.line_role !== 'NEW_ITEM' && item.line_role !== 'TRADE_IN'
          ? String(item.line_role)
          : '';
      const weight = isThaiLine(item)
        ? `${thaiGramsOf(item, kyatToGrams).toFixed(2)} g`
        : formatKPYMyanmar(item.net_weight);
      return (
        <li
          key={item.id}
          className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">{item.item_name}</div>
            {note && (
              <div className="text-[10px] italic mt-0.5 opacity-80">{note}</div>
            )}
          </div>
          <span className="text-[11px] font-mono shrink-0 opacity-80">{weight}</span>
        </li>
      );
    };

    return (
      <div
        key={t.id}
        className={`rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-white dark:bg-[#1A1A1A] shadow-xs overflow-hidden ${txnTypeRowClass('SHOP_OUT')}`}
      >
        <div className="px-4 py-3 border-b border-violet-100 dark:border-violet-900/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono font-bold text-sm">{t.invoice_no}</div>
            <div className="text-[11px] opacity-70">
              {formatDateTime(t.created_at)} · {t.items.length}{' '}
              {language === 'MM' ? 'ခု' : 'items'}
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedVoucher(t)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-[10px] font-bold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
            >
              <Eye className="w-3.5 h-3.5" />
              {language === 'MM' ? 'ကြည့်' : 'View'}
            </button>
            {can('pos_history', 'delete') && (
              <button
                type="button"
                disabled={busyId === t.id}
                onClick={() => void handleDelete(t)}
                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 mb-2">
              {language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold'}
              <span className="ml-1.5 font-mono font-normal text-[10px] text-amber-700/80">
                ({thaiItems.length})
              </span>
            </h4>
            {thaiItems.length === 0 ? (
              <p className="text-[11px] text-gray-400 py-2">—</p>
            ) : (
              <ul>{thaiItems.map(renderLine)}</ul>
            )}
            <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                {language === 'MM' ? 'စုစုပေါင်း gram' : 'Total grams'}
              </span>
              <span className="text-sm font-mono font-extrabold text-amber-800 dark:text-amber-200">
                {thaiGramsTotal.toFixed(2)} g
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              {language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar Gold'}
              <span className="ml-1.5 font-mono font-normal text-[10px] text-slate-500">
                ({mmItems.length})
              </span>
            </h4>
            {mmItems.length === 0 ? (
              <p className="text-[11px] text-gray-400 py-2">—</p>
            ) : (
              <ul>{mmItems.map(renderLine)}</ul>
            )}
          </div>
        </div>

        {t.notes && (
          <div className="px-4 pb-3 text-[11px] text-gray-500 italic">
            {language === 'MM' ? 'မှတ်ချက်' : 'Notes'}: {t.notes}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="bg-white dark:bg-[#1A1A1A] p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-5 h-5 text-[#D4AF37]" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {language === 'MM' ? 'ဘောင်ချာမှတ်တမ်းများ' : 'Voucher History'}
            </h2>
            <p className="text-[11px] text-gray-500">
              {language === 'MM'
                ? 'အရောင်း / အဝယ် / အလဲအလှယ် / ဆိုင်ထုတ် ဘောင်ချာများကို tab အလိုက် ကြည့်ရှုပါ'
                : 'Browse sales, purchase, exchange and shop-out vouchers by tab'}
            </p>
          </div>
        </div>
        <ExcelExportButton
          language={language}
          onClick={exportExcel}
          disabled={filtered.length === 0}
        />
      </div>

      <div className="flex flex-wrap gap-2 bg-white dark:bg-[#1A1A1A] p-2 rounded-2xl border border-gray-200 dark:border-gray-800">
        {tabMeta.map((t) => {
          const Icon = t.icon;
          const count = transactions.filter((x) => x.transaction_type === t.id).length;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                active
                  ? t.activeCls + ' shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{language === 'MM' ? t.labelMM : t.labelEN}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  active ? 'bg-black/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'SHOP_OUT' ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-10 text-center text-sm text-gray-400">
              {language === 'MM' ? 'ဆိုင်ထုတ် မှတ်တမ်း မရှိသေးပါ' : 'No shop-out records yet'}
            </div>
          ) : (
            filtered.map(renderShopOutCard)
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-xs overflow-hidden">
          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(t) => t.id}
            language={language}
            searchable
            resetDeps={[tab]}
            emptyMessage={language === 'MM' ? 'ဤအမျိုးအစားတွင် ဘောင်ချာ မရှိသေးပါ' : 'No vouchers in this tab'}
            searchPlaceholder={
              language === 'MM' ? 'ဘောင်ချာ / ဖောက်သည် ရှာရန်…' : 'Search invoice / customer…'
            }
            className="!shadow-none !rounded-xl"
            rowClassName={(t) => txnTypeRowClass(t.transaction_type)}
          />
        </div>
      )}
    </div>
  );
};
