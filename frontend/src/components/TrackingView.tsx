import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { CustomerTracking } from '../types/gold';
import { formatMMK } from '../utils/goldCalculations';
import {
  AlertTriangle,
  Clock,
  Phone,
  CheckCircle,
  User,
  DollarSign,
  Send,
  MessageCircle,
  Filter,
  CreditCard,
  X,
  Sparkles,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { ModalOverlay } from './ModalOverlay';

export const TrackingView: React.FC = () => {
  const {
    customerTracking,
    settleCustomerTracking,
    language,
  } = useGoldShop();

  const [filterType, setFilterType] = useState<string>('ALL');
  const [selectedRecordForPayment, setSelectedRecordForPayment] = useState<CustomerTracking | null>(null);
  const [paymentInput, setPaymentInput] = useState<string>('');

  // Reminder message preview modal
  const [reminderRecord, setReminderRecord] = useState<CustomerTracking | null>(null);

  // Totals
  const totalOutstanding = customerTracking
    .filter((r) => r.status !== 'SETTLED')
    .reduce((sum, r) => sum + r.amount_due, 0);

  const overdueCount = customerTracking
    .filter((r) => r.status !== 'SETTLED' && (r.tracking_type === 'DELAYED_PAYMENT' || (r.days_overdue && r.days_overdue > 0))).length;

  const handleOpenSettle = (record: CustomerTracking) => {
    setSelectedRecordForPayment(record);
    setPaymentInput(String(record.amount_due));
  };

  const handleConfirmPayment = async () => {
    if (!selectedRecordForPayment || !paymentInput) return;
    const amount = Number(paymentInput);
    await settleCustomerTracking(selectedRecordForPayment.id, amount);
    setSelectedRecordForPayment(null);
  };

  const filteredRecords = customerTracking.filter((rec) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'OUTSTANDING_CREDIT') return rec.tracking_type === 'OUTSTANDING_CREDIT';
    if (filterType === 'DELAYED_PAYMENT') return rec.tracking_type === 'DELAYED_PAYMENT';
    if (filterType === 'SETTLED') return rec.status === 'SETTLED';
    return true;
  });

  const exportTrackingExcel = () => {
    exportToExcel({
      filename: 'customer_tracking',
      sheetName: 'Tracking',
      title:
        language === 'MM'
          ? 'အကြွေးကျန် / ရက်လွန် စောင့်ကြည့်စာရင်း'
          : 'Customer Credit & Delayed Tracking',
      columns: [
        { header: language === 'MM' ? 'ဖောက်သည်' : 'Customer', value: (r) => r.customer_name, width: 20 },
        { header: language === 'MM' ? 'ဖုန်း' : 'Phone', value: (r) => r.customer_phone, width: 14 },
        { header: language === 'MM' ? 'ကိုးကား' : 'Reference', value: (r) => r.reference_no, width: 16 },
        { header: language === 'MM' ? 'အမျိုးအစား' : 'Type', value: (r) => r.tracking_type, width: 18 },
        { header: language === 'MM' ? 'သတ်မှတ်ရက်' : 'Due Date', value: (r) => String(r.due_date).slice(0, 10), width: 12 },
        { header: language === 'MM' ? 'ရက်ကျော်' : 'Days Overdue', value: (r) => r.days_overdue || 0, width: 12 },
        { header: language === 'MM' ? 'အတိုး %' : 'Interest %', value: (r) => r.interest_rate || 0, width: 10 },
        { header: language === 'MM' ? 'လစဉ်အတိုး' : 'Monthly Interest', value: (r) => r.monthly_interest || 0, width: 14 },
        { header: language === 'MM' ? 'ကျန်ငွေ' : 'Amount Due', value: (r) => r.amount_due, width: 14 },
        { header: language === 'MM' ? 'အခြေအနေ' : 'Status', value: (r) => r.status, width: 12 },
      ],
      rows: filteredRecords,
    });
  };

  const trackingColumns = useMemo<DataTableColumn<CustomerTracking>[]>(
    () => [
      {
        id: 'customer',
        header: language === 'MM' ? 'ဘောင်ချာ / ဖောက်သည်' : 'Reference & Customer',
        accessor: (r) => r.customer_name,
        cell: (rec) => (
          <div>
            <div className="font-bold text-gray-900 dark:text-white">{rec.customer_name}</div>
            <span className="font-mono text-[11px] text-amber-600 font-semibold">{rec.reference_no}</span>
          </div>
        ),
      },
      {
        id: 'phone',
        header: language === 'MM' ? 'ဖုန်း' : 'Phone',
        accessor: (r) => r.customer_phone,
        cell: (rec) => <span className="font-mono text-gray-600 dark:text-gray-400">{rec.customer_phone}</span>,
      },
      {
        id: 'type',
        header: language === 'MM' ? 'ကဏ္ဍ' : 'Type',
        accessor: (r) => r.tracking_type,
        cell: (rec) => (
          <span
            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
              rec.tracking_type === 'OUTSTANDING_CREDIT'
                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                : 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
            }`}
          >
            {rec.tracking_type === 'OUTSTANDING_CREDIT'
              ? language === 'MM'
                ? 'ငွေထပ်လွှဲ'
                : 'Outstanding'
              : language === 'MM'
                ? 'အရစ်ကျ / ရက်လွှဲ'
                : 'Installment'}
          </span>
        ),
      },
      {
        id: 'amount',
        header: language === 'MM' ? 'ပေးရန်ကျန်ငွေ' : 'Amount Due',
        accessor: (r) => r.amount_due,
        align: 'right',
        cell: (rec) => (
          <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400">
            {formatMMK(rec.amount_due)}
          </span>
        ),
      },
      {
        id: 'interest',
        header: language === 'MM' ? 'အတိုး %' : 'Interest',
        accessor: (r) => r.interest_rate || 0,
        align: 'center',
        cell: (rec) =>
          Number(rec.interest_rate || 0) > 0 ? (
            <div className="text-[11px]">
              <div className="font-bold text-amber-700 dark:text-amber-300">{rec.interest_rate}%</div>
              <div className="font-mono text-gray-500">{formatMMK(rec.monthly_interest || 0)}/လ</div>
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
      {
        id: 'due',
        header: language === 'MM' ? 'သတ်မှတ်ရက်' : 'Due Date',
        accessor: (r) => r.due_date,
        align: 'center',
        cell: (rec) => (
          <div className="text-[11px]">
            <div className="font-mono text-gray-700 dark:text-gray-300">{rec.due_date}</div>
            {Number(rec.days_overdue || 0) > 0 && (
              <div className="font-bold text-rose-600">{rec.days_overdue} ရက်ကျော်</div>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: language === 'MM' ? 'အခြေအနေ' : 'Status',
        accessor: (r) => r.status,
        align: 'center',
        cell: (rec) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
              rec.status === 'SETTLED'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : rec.status === 'PARTIAL'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
            }`}
          >
            {rec.status}
          </span>
        ),
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Action',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (rec) => (
          <div className="flex items-center justify-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
            {rec.status !== 'SETTLED' && (
              <button
                type="button"
                onClick={() => setReminderRecord(rec)}
                className="p-1 rounded text-gray-400 hover:text-blue-600"
                title="Generate Payment Reminder"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {rec.status !== 'SETTLED' ? (
              <button
                type="button"
                onClick={() => handleOpenSettle(rec)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center space-x-1"
              >
                <CreditCard className="w-3 h-3" />
                <span>{language === 'MM' ? 'ငွေရှင်းမည်' : 'Settle'}</span>
              </button>
            ) : (
              <span className="text-xs text-emerald-600 font-bold">✓ ပြီးစီး</span>
            )}
          </div>
        ),
      },
    ],
    [language]
  );

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span>{language === 'MM' ? 'အကြွေးကျန် & ရက်လွန်ငွေပေးချေမှု စောင့်ကြည့်ခြင်း' : 'Outstanding Credit & Delayed Payments Tracking'}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {language === 'MM'
              ? 'အရောင်းဘောင်ချာများမှ ကျန်ငွေများ၊ ရက်လွန်စာရင်းများနှင့် ငွေတောင်းခံလွှာ ပေးပို့ခြင်း'
              : 'Monitor aging debts, overdue payment reminders, and customer credit recovery'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelExportButton
            language={language}
            onClick={exportTrackingExcel}
            disabled={filteredRecords.length === 0}
            className="!py-2 !rounded-xl"
          />
          <span className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-bold flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{overdueCount} {language === 'MM' ? 'ဦး သတိပေးရန်ရှိ' : 'Alert Accounts'}</span>
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold block">
              {language === 'MM' ? 'ဆိုင်မှ ကောက်ခံရန် စုစုပေါင်း အကြွေးကျန်ငွေ:' : 'Total Outstanding Receivables:'}
            </span>
            <div className="text-2xl font-mono font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              {formatMMK(totalOutstanding)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/30 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#996515] dark:text-[#E5C158] font-bold block">
              {language === 'MM' ? 'စာရင်းသွင်းထားသော စောင့်ကြည့်မှတ်တမ်းများ:' : 'Total Monitored Records:'}
            </span>
            <div className="text-2xl font-mono font-extrabold text-[#996515] dark:text-amber-300 mt-1">
              {customerTracking.length} {language === 'MM' ? 'ဦး' : 'records'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37]">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Filter Row */}
      <div className="flex items-center space-x-2 text-xs">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-lg font-bold border transition ${
            filterType === 'ALL'
              ? 'bg-[#D4AF37] text-white border-[#C5A059]'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {language === 'MM' ? 'အားလုံး' : 'All'}
        </button>

        <button
          onClick={() => setFilterType('OUTSTANDING_CREDIT')}
          className={`px-3 py-1.5 rounded-lg font-bold border transition ${
            filterType === 'OUTSTANDING_CREDIT'
              ? 'bg-amber-600 text-white border-amber-700'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {language === 'MM' ? 'အကြွေးကျန်များ (Credit)' : 'Credit Due'}
        </button>

        <button
          onClick={() => setFilterType('DELAYED_PAYMENT')}
          className={`px-3 py-1.5 rounded-lg font-bold border transition ${
            filterType === 'DELAYED_PAYMENT'
              ? 'bg-rose-600 text-white border-rose-700'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {language === 'MM' ? 'ရက်လွန်စာရင်းများ (Overdue)' : 'Delayed / Overdue'}
        </button>

        <button
          onClick={() => setFilterType('SETTLED')}
          className={`px-3 py-1.5 rounded-lg font-bold border transition ${
            filterType === 'SETTLED'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {language === 'MM' ? 'ရှင်းလင်းပြီး' : 'Settled'}
        </button>
      </div>

      <DataTable
        rows={filteredRecords}
        columns={trackingColumns}
        rowKey={(r) => r.id}
        language={language}
        searchable
        searchPlaceholder={language === 'MM' ? 'ဖောက်သည် / ဘောင်ချာ ရှာရန်…' : 'Search customer / reference…'}
        resetDeps={[filterType]}
        emptyMessage={language === 'MM' ? 'စာရင်းမရှိပါ' : 'No tracking records'}
      />

      {/* Settle Modal */}

      {/* Settle Credit Modal */}
      {selectedRecordForPayment && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                {language === 'MM' ? 'အကြွေးငွေ လက်ခံရှင်းလင်းခြင်း' : 'Settle Customer Debt'}
              </h3>
              <button
                onClick={() => setSelectedRecordForPayment(null)}
                className="p-1 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">ဖောက်သည်:</span>
                <span className="font-bold text-gray-900 dark:text-white">{selectedRecordForPayment.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ကိုးကားနံပါတ်:</span>
                <span className="font-mono font-bold text-amber-600">{selectedRecordForPayment.reference_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ပေးရန်ကျန်ငွေ:</span>
                <span className="font-bold font-mono text-rose-600">{formatMMK(selectedRecordForPayment.amount_due)}</span>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  {language === 'MM' ? 'ယခုပေးသွင်းငွေ ပမာဏ:' : 'Payment Amount:'}
                </label>
                <input
                  type="number"
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold font-mono rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedRecordForPayment(null)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Reminder Preview Modal */}
      {reminderRecord && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D4AF37]/30">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2">
                <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
                <span>{language === 'MM' ? 'ငွေပေးချေရန် သတိပေးစာ (Reminder)' : 'Payment Reminder Notice'}</span>
              </h3>
              <button
                onClick={() => setReminderRecord(null)}
                className="p-1 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 font-sans text-xs text-gray-800 dark:text-gray-200 space-y-2">
              <p>မင်္ဂလာပါရှင် <strong>{reminderRecord.customer_name}</strong> ရှင့် -</p>
              <p>
                ရွှေပြည့်လှိုင် ရွှေဆိုင်မှ ကိုးကားအမှတ် <strong>{reminderRecord.reference_no}</strong> အတွက် ကျန်ရှိငွေ <strong>{formatMMK(reminderRecord.amount_due)}</strong> အား လာမည့်ရက်ပိုင်းအတွင်း ရှင်းလင်းပေးပါရန် လေးစားစွာ သတိပေး အကြောင်းကြားအပ်ပါသည်ရှင့်။
              </p>
              <p className="text-[11px] text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
                မေးမြန်းရန်: 09-977889900 (ရွှေပြည့်လှိုင် ရွှေဆိုင်)
              </p>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setReminderRecord(null)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`မင်္ဂလာပါရှင် ${reminderRecord.customer_name} ရှင့် - ရွှေပြည့်လှိုင် ရွှေဆိုင်မှ ဘောင်ချာအမှတ် ${reminderRecord.reference_no} အတွက် ကျန်ရှိငွေ ${formatMMK(reminderRecord.amount_due)} အား ရှင်းလင်းပေးပါရန် သတိပေးအပ်ပါသည်။`);
                  alert(language === 'MM' ? 'သတိပေးစာသားအား ကော်ပီကူးယူပြီးပါပြီ (Viber / SMS သို့ ပေးပို့နိုင်ပါသည်)' : 'Reminder message copied to clipboard!');
                }}
                className="px-4 py-1.5 rounded-lg bg-[#D4AF37] text-white text-xs font-bold hover:bg-[#C5A059]"
              >
                Copy SMS / Viber Text
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
};
