import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { Transaction } from '../types/gold';
import { formatMMK } from '../utils/goldCalculations';
import { DataTable, DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Eye,
  ReceiptText,
  ShoppingBag,
  Trash2,
} from 'lucide-react';

type HistoryTab = 'SALE' | 'PURCHASE' | 'EXCHANGE';

export const PosHistoryView: React.FC = () => {
  const {
    transactions,
    language,
    setSelectedVoucher,
    deleteTransaction,
    can,
  } = useGoldShop();

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
  ];

  const handleDelete = async (t: Transaction) => {
    if (
      !window.confirm(
        language === 'MM'
          ? `${t.invoice_no} ဘောင်ချာကို ဖျက်မလား?`
          : `Delete voucher ${t.invoice_no}?`
      )
    ) {
      return;
    }
    setBusyId(t.id);
    try {
      await deleteTransaction(t.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed');
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
          value: (t) => new Date(t.created_at).toLocaleString(),
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
        accessor: (t) => t.invoice_no,
        cell: (t) => (
          <span className="font-mono font-bold text-gray-900 dark:text-white">{t.invoice_no}</span>
        ),
      },
      {
        id: 'date',
        header: language === 'MM' ? 'ရက်စွဲ' : 'Date',
        accessor: (t) => new Date(t.created_at).getTime(),
        cell: (t) => (
          <span className="text-gray-500 whitespace-nowrap">
            {new Date(t.created_at).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'customer',
        header: language === 'MM' ? 'ဖောက်သည်' : 'Customer',
        accessor: (t) => t.customer_name,
        cell: (t) => (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{t.customer_name}</div>
            {t.customer_phone && (
              <div className="text-[10px] font-mono text-gray-400">{t.customer_phone}</div>
            )}
          </div>
        ),
      },
      {
        id: 'items',
        header: language === 'MM' ? 'ပစ္စည်းများ' : 'Items',
        accessor: (t) => t.items.map((i) => i.item_name).join(', '),
        cell: (t) => (
          <span className="max-w-[220px] truncate block">
            {t.items.map((i) => i.item_name).join(', ')}
          </span>
        ),
      },
      {
        id: 'total',
        header: language === 'MM' ? 'ကျသင့်ငွေ' : 'Total',
        accessor: (t) => t.total_amount,
        align: 'right',
        cell: (t) => (
          <span className="font-mono font-bold text-gray-900 dark:text-amber-300">
            {formatMMK(t.total_amount)}
          </span>
        ),
      },
      {
        id: 'payment',
        header: language === 'MM' ? 'ငွေပေးချေမှု' : 'Payment',
        accessor: (t) => t.payment_method,
        align: 'center',
        cell: (t) => (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {t.payment_method}
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
                ? 'အရောင်း / အဝယ် / အလဲအလှယ် ဘောင်ချာများကို tab အလိုက် ကြည့်ရှုပါ'
                : 'Browse sales, purchase and exchange vouchers by tab'}
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
        />
      </div>
    </div>
  );
};
