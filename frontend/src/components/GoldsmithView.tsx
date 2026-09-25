import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import { GoldsmithJob } from '../types/gold';
import {
  formatKPYMyanmar,
  formatMMK,
  KYAT_TO_GRAMS,
  PURITY_LABELS,
} from '../utils/goldCalculations';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import {
  AlertTriangle,
  Hammer,
  PackageCheck,
  X,
  Ban,
  Tag,
} from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import { NumberInput } from './NumberInput';
import { DataTable, type DataTableColumn } from './DataTable';
import { InventoryItemFormFields } from './InventoryItemFormFields';
import { useInventoryItemForm } from '../hooks/useInventoryItemForm';

type FilterTab = 'SENT' | 'DONE';

function weightLabel(j: GoldsmithJob): string {
  if (j.item_type === 'THAI_GOLD' || j.purity === 'THAI_GOLD') {
    return `${Number(j.source_grams || j.thai_weight_unit || 0).toFixed(3)} g`;
  }
  if (j.source_type === 'OLD_GOLD' && Number(j.source_grams || 0) > 0) {
    return `${Number(j.source_grams).toFixed(3)} g`;
  }
  return formatKPYMyanmar(j.weight || { kyat: 0, pae: 0, yway: 0 });
}

function isReturnOverdue(j: GoldsmithJob, today: string): boolean {
  return j.status === 'SENT' && Boolean(j.return_due_date) && String(j.return_due_date) < today;
}

/** Full-row text color by goldsmith job status / overdue. */
function goldsmithJobRowClass(j: GoldsmithJob, today: string): string {
  if (isReturnOverdue(j, today)) return 'text-rose-700 dark:text-rose-300';
  switch (j.status) {
    case 'SENT':
      return 'text-sky-700 dark:text-sky-300';
    case 'RETURNED':
      return 'text-amber-700 dark:text-amber-300';
    case 'HANDED_OVER':
      return 'text-emerald-700 dark:text-emerald-300';
    default:
      return '';
  }
}

export const GoldsmithView: React.FC = () => {
  const {
    goldsmithJobs,
    language,
    returnGoldsmithJob,
    cancelGoldsmithJob,
    masterCategories,
    shopSettings,
    goldPrices,
    can,
  } = useGoldShop();
  const dialog = useDialog();
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<FilterTab>('SENT');
  const [returnJob, setReturnJob] = useState<GoldsmithJob | null>(null);
  const [feeInput, setFeeInput] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);

  const invForm = useInventoryItemForm({
    language,
    masterCategories,
    goldPrices,
    shopSettings,
  });

  const overdueJobs = useMemo(
    () => goldsmithJobs.filter((j) => isReturnOverdue(j, today)),
    [goldsmithJobs, today]
  );

  const counts = useMemo(
    () => ({
      SENT: goldsmithJobs.filter((j) => j.status === 'SENT').length,
      DONE: goldsmithJobs.filter(
        (j) => j.status === 'RETURNED' || j.status === 'HANDED_OVER'
      ).length,
    }),
    [goldsmithJobs]
  );

  const filtered = useMemo(() => {
    if (tab === 'SENT') return goldsmithJobs.filter((j) => j.status === 'SENT');
    return goldsmithJobs.filter((j) => j.status === 'RETURNED' || j.status === 'HANDED_OVER');
  }, [goldsmithJobs, tab]);

  const sourceLabel = (j: GoldsmithJob) => {
    if (j.source_type === 'INVENTORY')
      return language === 'MM' ? 'ဆိုင်ပစ္စည်း' : 'Shop stock';
    if (j.source_type === 'ORDER') return language === 'MM' ? 'အော်ဒါ' : 'Order';
    return language === 'MM' ? 'အဟောင်းထည်' : 'Old gold';
  };

  const sourceBadgeCls = (j: GoldsmithJob) => {
    if (j.source_type === 'INVENTORY')
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
    if (j.source_type === 'ORDER')
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
    return 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300';
  };

  const openReturn = (j: GoldsmithJob) => {
    setReturnJob(j);
    setFeeInput(j.craft_fee || 0);
    setErr('');
    if (j.source_type === 'OLD_GOLD') {
      const startThai = j.item_type === 'THAI_GOLD' || j.purity === 'THAI_GOLD';
      const grams = Number(j.source_grams || j.thai_weight_unit || 0);
      const fromKpy =
        grams <= 0
          ? ((j.weight?.kyat || 0) + (j.weight?.pae || 0) / 8 + (j.weight?.yway || 0) / 128) *
            (shopSettings?.kyat_to_grams || KYAT_TO_GRAMS)
          : grams;
      invForm.resetForKind(startThai ? 'THAI' : 'MYANMAR', {
        grams: fromKpy > 0 ? fromKpy : undefined,
        nameMM: j.item_name || '',
        nameEN: '',
        category: j.source_category || j.category || 'NECKLACE',
      });
      if (!startThai && j.purity && j.purity !== 'THAI_GOLD') {
        invForm.setFormPurity(j.purity);
      }
    }
  };

  const confirmReturn = async () => {
    if (!returnJob) return;
    setSaving(true);
    setErr('');
    try {
      const payload: Record<string, unknown> = {
        craft_fee: Number(feeInput || 0),
      };
      if (returnJob.source_type === 'OLD_GOLD') {
        const validationErr = invForm.validate();
        if (validationErr) {
          setErr(validationErr);
          setSaving(false);
          return;
        }
        payload.inventory = invForm.buildPayload('IN_STOCK');
      }
      await returnGoldsmithJob(returnJob.id, payload);
      setReturnJob(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Return failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelJob = async (j: GoldsmithJob) => {
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'ပန်းထိမ်အပ် ပယ်ဖျက်မည်' : 'Cancel goldsmith job',
      message:
        language === 'MM'
          ? `${j.job_no} ကို ပယ်ဖျက်ပြီး မူရင်းသို့ ပြန်ပေါင်းမလား?`
          : `Cancel ${j.job_no} and restore source?`,
      confirmLabel: language === 'MM' ? 'ပယ်ဖျက်မည်' : 'Cancel job',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Keep',
      danger: true,
    });
    if (!ok) return;
    setCancelId(j.id);
    try {
      await cancelGoldsmithJob(j.id);
    } catch (e) {
      await dialog.alert({
        title: language === 'MM' ? 'မအောင်မြင်ပါ' : 'Failed',
        message: e instanceof Error ? e.message : 'Cancel failed',
      });
    } finally {
      setCancelId(null);
    }
  };

  const columns: DataTableColumn<GoldsmithJob>[] = useMemo(() => {
    if (tab === 'DONE') {
      return [
        {
          id: 'job_no',
          header: 'Job No',
          slot: 'primary',
          accessor: (j) => j.job_no,
          cell: (j) => (
            <span className="font-mono font-bold whitespace-nowrap">{j.job_no}</span>
          ),
        },
        {
          id: 'item',
          header: language === 'MM' ? 'ပစ္စည်း' : 'Item',
          slot: 'primary',
          accessor: (j) => j.item_name,
          cell: (j) => (
            <span className="font-medium max-w-[200px] truncate block">{j.item_name}</span>
          ),
        },
        {
          id: 'status',
          header: language === 'MM' ? 'အခြေအနေ' : 'Status',
          slot: 'primary',
          accessor: (j) => j.status,
          cell: (j) => (
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                j.status === 'HANDED_OVER'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
              }`}
            >
              {j.status === 'HANDED_OVER'
                ? language === 'MM'
                  ? 'အပ်ရှင်းပြီး'
                  : 'Handed over'
                : j.source_type === 'ORDER'
                  ? language === 'MM'
                    ? 'ပြန်လာ · Orders မှာ အပ်ရှင်း'
                    : 'Returned · handoff on Orders'
                  : language === 'MM'
                    ? 'ပြန်လာ · Inventory'
                    : 'Returned · in stock'}
            </span>
          ),
        },
        {
          id: 'source',
          header: language === 'MM' ? 'ရင်းမြစ်' : 'Source',
          slot: 'detail',
          accessor: (j) => j.source_type,
          cell: (j) => (
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${sourceBadgeCls(j)}`}
            >
              {sourceLabel(j)}
            </span>
          ),
        },
        {
          id: 'fee',
          header: language === 'MM' ? 'လက်ခ' : 'Fee',
          slot: 'detail',
          accessor: (j) => j.craft_fee,
          align: 'right',
          cell: (j) => (
            <span className="font-mono font-bold whitespace-nowrap">
              {formatMMK(j.craft_fee)}
            </span>
          ),
        },
        {
          id: 'sent_at',
          header: language === 'MM' ? 'အပ်ရက်' : 'Sent',
          slot: 'detail',
          accessor: (j) => j.sent_at || j.created_at,
          cell: (j) => (
            <span className="font-mono font-semibold">
              {formatDateTime(j.sent_at || j.created_at)}
            </span>
          ),
        },
        {
          id: 'weight',
          header: language === 'MM' ? 'အလေးချိန်' : 'Weight',
          slot: 'detail',
          accessor: (j) => weightLabel(j),
          cell: (j) => <span className="font-mono font-semibold">{weightLabel(j)}</span>,
        },
      ];
    }

    // SENT
    return [
      {
        id: 'job_no',
        header: 'Job No',
        slot: 'primary',
        accessor: (j) => j.job_no,
        cell: (j) => (
          <span className="font-mono font-bold whitespace-nowrap">{j.job_no}</span>
        ),
      },
      {
        id: 'item',
        header: language === 'MM' ? 'ပစ္စည်း' : 'Item',
        slot: 'primary',
        accessor: (j) => j.item_name,
        cell: (j) => (
          <span className="font-medium max-w-[180px] truncate block">{j.item_name}</span>
        ),
      },
      {
        id: 'return_due',
        header: language === 'MM' ? 'ပြန်လာရက်' : 'Return due',
        slot: 'primary',
        accessor: (j) => j.return_due_date || '',
        cell: (j) => {
          if (!j.return_due_date) return <span className="opacity-50">—</span>;
          const overdue = isReturnOverdue(j, today);
          return (
            <span
              className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold whitespace-nowrap ${
                overdue ? 'underline' : ''
              }`}
            >
              {overdue && <AlertTriangle className="w-3 h-3 shrink-0" />}
              {formatDate(j.return_due_date)}
            </span>
          );
        },
      },
      {
        id: 'source',
        header: language === 'MM' ? 'ရင်းမြစ်' : 'Source',
        slot: 'detail',
        accessor: (j) => j.source_type,
        cell: (j) => (
          <span
            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${sourceBadgeCls(j)}`}
          >
            {sourceLabel(j)}
          </span>
        ),
      },
      {
        id: 'sent_at',
        header: language === 'MM' ? 'အပ်ရက်' : 'Sent',
        slot: 'detail',
        accessor: (j) => j.sent_at || j.created_at,
        cell: (j) => (
          <span className="font-mono font-semibold">
            {formatDateTime(j.sent_at || j.created_at)}
          </span>
        ),
      },
      {
        id: 'ref',
        header: language === 'MM' ? 'ကိုးကား' : 'Ref',
        slot: 'detail',
        accessor: (j) => j.order_no || j.inventory_barcode || '',
        cell: (j) => (
          <>
            <span className="font-mono font-semibold block">
              {j.order_no || j.inventory_barcode || '—'}
            </span>
            {j.customer_name ? (
              <span className="text-gray-500 dark:text-gray-400 truncate block mt-0.5">
                {j.customer_name}
              </span>
            ) : null}
          </>
        ),
      },
      {
        id: 'purity',
        header: language === 'MM' ? 'ရွှေရည်' : 'Purity',
        slot: 'detail',
        accessor: (j) => j.purity,
        cell: (j) => (
          <span className="font-bold">{PURITY_LABELS[j.purity as keyof typeof PURITY_LABELS]?.mm || j.purity}</span>
        ),
      },
      {
        id: 'weight',
        header: language === 'MM' ? 'အလေးချိန်' : 'Weight',
        slot: 'detail',
        accessor: (j) => weightLabel(j),
        cell: (j) => <span className="font-mono font-semibold">{weightLabel(j)}</span>,
      },
      {
        id: 'category',
        header: language === 'MM' ? 'အမျိုးအစား' : 'Category',
        slot: 'detail',
        accessor: (j) => j.category || '',
        cell: (j) => <span className="font-semibold">{j.category || '—'}</span>,
      },
      {
        id: 'notes',
        header: language === 'MM' ? 'မှတ်ချက်' : 'Notes',
        slot: 'detail',
        accessor: (j) => j.notes || '',
        cell: (j) => <span className="font-semibold break-words">{j.notes || '—'}</span>,
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
        slot: 'action',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (j) => (
          <div
            className="flex items-center justify-center gap-1.5 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => openReturn(j)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <PackageCheck className="w-3 h-3" />
              {language === 'MM' ? 'ပြန်လာ + လက်ခ' : 'Return & fee'}
            </button>
            {can('goldsmith', 'update') && (
              <button
                type="button"
                disabled={cancelId === j.id}
                onClick={() => void handleCancelJob(j)}
                className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
              >
                <Ban className="w-3 h-3" />
                {cancelId === j.id ? '...' : language === 'MM' ? 'Cancel' : 'Cancel'}
              </button>
            )}
          </div>
        ),
      },
    ];
  }, [tab, language, today, cancelId, can]);

  const tabs = [
    { key: 'SENT' as const, labelMM: 'အပ်ထား', labelEN: 'Sent', count: counts.SENT },
    { key: 'DONE' as const, labelMM: 'ပြီး', labelEN: 'Done', count: counts.DONE },
  ];

  return (
    <div className="space-y-4 pb-12">
      <div className="bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Hammer className="w-5 h-5 text-[#D4AF37]" />
          <span>{language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Goldsmith Workshop'}</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {language === 'MM'
            ? 'ဆိုင်ပစ္စည်း / အော်ဒါ / အဟောင်းထည် — ပို့၊ ပြန်လာရက် စောင့်၊ လက်ခချေ'
            : 'Send from stock, orders, or old gold — track return date, settle fee on return'}
        </p>

        {overdueJobs.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs space-y-1.5">
            <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {language === 'MM'
                ? `ပြန်လာရက်ကျော် — ${overdueJobs.length} ခု`
                : `${overdueJobs.length} overdue return(s)`}
            </div>
            <ul className="space-y-1 text-rose-700 dark:text-rose-300">
              {overdueJobs.slice(0, 5).map((j) => (
                <li key={j.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="font-mono font-bold">{j.job_no}</span>
                  <span className="truncate max-w-[160px]">{j.item_name}</span>
                  <span className="font-mono">
                    {language === 'MM' ? 'သတ်မှတ်' : 'due'} {formatDate(j.return_due_date)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 ${
                tab === t.key
                  ? 'bg-[#D4AF37] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {language === 'MM' ? t.labelMM : t.labelEN}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  tab === t.key ? 'bg-black/20 text-white' : 'bg-white dark:bg-gray-900 text-gray-500'
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(j) => j.id}
        language={language}
        searchable
        searchPlaceholder={
          language === 'MM'
            ? 'Job No / ပစ္စည်း / ဘားကုဒ် / Order ရှာရန်…'
            : 'Search job / item / barcode / order…'
        }
        getSearchText={(j) =>
          [
            j.job_no,
            j.item_name,
            j.order_no,
            j.inventory_barcode,
            j.customer_name,
            j.purity,
            j.return_due_date,
          ].join(' ')
        }
        resetDeps={[tab]}
        emptyMessage={language === 'MM' ? 'စာရင်းမရှိပါ' : 'No jobs'}
        maxHeightClass={false}
        rowClassName={(j) => goldsmithJobRowClass(j, today)}
      />

      {returnJob && (
        <ModalOverlay className="p-3 sm:p-5">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2">
                {returnJob.source_type === 'OLD_GOLD' ? (
                  <>
                    <Tag className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      {invForm.isThaiEntry
                        ? language === 'MM'
                          ? 'ထိုင်းရွှေ အသစ်ထည့်သွင်းခြင်း'
                          : 'Add Thai Gold Item'
                        : language === 'MM'
                          ? 'မြန်မာရွှေ အသစ်ထည့်သွင်းခြင်း'
                          : 'Add Myanmar Gold Item'}
                    </span>
                  </>
                ) : (
                  <span>
                    {language === 'MM' ? 'ပြန်လာအပ် + လက်ခချေ' : 'Return & settle craft fee'}
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setReturnJob(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-4 flex-1">
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  <span className="font-mono font-bold text-[#996515]">{returnJob.job_no}</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${sourceBadgeCls(returnJob)}`}
                  >
                    {sourceLabel(returnJob)}
                  </span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {returnJob.item_name}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/80 dark:bg-violet-950/20 space-y-1.5 max-w-md">
                  <label className="block text-xs font-bold text-violet-900 dark:text-violet-200">
                    {language === 'MM' ? 'ပန်းထိမ်လက်ခ (ချေမည့်ငွေ)' : 'Goldsmith fee (to pay)'}
                  </label>
                  <p className="text-[10px] text-violet-700/80 dark:text-violet-300/70">
                    {language === 'MM'
                      ? 'ပန်းထိမ်ကို ပေးချေမည့် လက်ခ — ကုန်ကျစာရင်း (Expense) သီးခြား။ အောက်က အရင်း/အမြတ်လက်ခ နဲ့ မရောပါ။'
                      : 'Paid to goldsmith as expense. Separate from inventory cost/profit craft fees below.'}
                  </p>
                  <NumberInput
                    value={feeInput}
                    onChange={setFeeInput}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-violet-300 dark:border-violet-800 bg-white dark:bg-[#121212]"
                  />
                </div>

                {returnJob.source_type === 'OLD_GOLD' && (
                  <>
                    <div className="grid grid-cols-2 gap-2 max-w-md">
                      <button
                        type="button"
                        onClick={() => {
                          const grams = Number(returnJob.source_grams || 0);
                          invForm.resetForKind('MYANMAR', {
                            grams: grams > 0 ? grams : undefined,
                            nameMM: invForm.formNameMM || returnJob.item_name || '',
                            nameEN: invForm.formName,
                            category: invForm.formCategory,
                          });
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                          !invForm.isThaiEntry
                            ? 'bg-[#D4AF37] text-white border-transparent'
                            : 'bg-white dark:bg-[#121212] border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {language === 'MM' ? 'မြန်မာရွှေ ပုံစံ' : 'Myanmar form'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const grams = Number(returnJob.source_grams || 0);
                          invForm.resetForKind('THAI', {
                            grams: grams > 0 ? grams : undefined,
                            nameMM: invForm.formNameMM || returnJob.item_name || '',
                            nameEN: invForm.formName,
                            category: invForm.formCategory,
                          });
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                          invForm.isThaiEntry
                            ? 'bg-blue-600 text-white border-transparent'
                            : 'bg-white dark:bg-[#121212] border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {language === 'MM' ? 'ထိုင်းရွှေ ပုံစံ' : 'Thai form'}
                      </button>
                    </div>

                    <div className="pt-1 border-t border-gray-200 dark:border-gray-800">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">
                        {language === 'MM'
                          ? 'အောက်ပါ အရင်းလက်ခ / အမြတ်လက်ခ / ကျောက်ဖိုး = Inventory စာရင်းသွင်းရန် (ရောင်းဈေးခန့်မှန်း) — ပန်းထိမ်လက်ခ မဟုတ်ပါ။'
                          : 'Cost/profit craft & stone below = inventory pricing only — not the goldsmith payment above.'}
                      </p>
                      <InventoryItemFormFields form={invForm} />
                    </div>
                  </>
                )}

                {err && <p className="text-rose-600 text-xs">{err}</p>}
              </div>

              <div className="px-5 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end space-x-2 shrink-0 bg-white dark:bg-[#1A1A1A]">
                <button
                  type="button"
                  onClick={() => setReturnJob(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void confirmReturn()}
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold hover:bg-[#C5A059] transition shadow-md disabled:opacity-50"
                >
                  {saving
                    ? '...'
                    : returnJob.source_type === 'OLD_GOLD'
                      ? language === 'MM'
                        ? 'စာရင်းသွင်းမည်'
                        : 'Save Item'
                      : language === 'MM'
                        ? 'အတည်ပြုမည်'
                        : 'Confirm return'}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};
