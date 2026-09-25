import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import { CustomOrder, GoldPurity } from '../types/gold';
import {
  formatMMK,
  formatKPYMyanmar,
  calculateGoldValuation,
  PURITY_LABELS,
  gramsToKpy,
  kpyToGrams,
  KYAT_TO_GRAMS,
} from '../utils/goldCalculations';
import { formatDate } from '../utils/dateFormat';
import { DateInput } from './DateInput';
import {
  Clock,
  Plus,
  CheckCircle,
  Phone,
  Calendar,
  X,
  Hammer,
  Pencil,
  Ban,
} from 'lucide-react';
import { useClientPagination } from '../hooks/useClientPagination';
import { PaginationBar } from './PaginationBar';
import { ModalOverlay } from './ModalOverlay';
import { NumberInput } from './NumberInput';

interface Props {
  onHandoffOrder?: (orderId: string) => void;
}

export const OrdersView: React.FC<Props> = ({ onHandoffOrder }) => {
  const {
    customOrders,
    addCustomOrder,
    updateCustomOrder,
    updateOrderStatus,
    goldPrices,
    language,
    masterCategories,
    shopSettings,
    createGoldsmithJob,
    goldsmithJobs,
    can,
  } = useGoldShop();
  const dialog = useDialog();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [gsOrder, setGsOrder] = useState<CustomOrder | null>(null);
  const [gsReturnDue, setGsReturnDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [gsNote, setGsNote] = useState('');
  const [gsSaving, setGsSaving] = useState(false);
  const [gsErr, setGsErr] = useState('');

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCategory, setFormCategory] = useState<string>('RING');
  const [formDescription, setFormDescription] = useState('');
  const [formPurity, setFormPurity] = useState<GoldPurity>('MEELIN');
  const [formTargetKyat, setFormTargetKyat] = useState<number>(1);
  const [formTargetPae, setFormTargetPae] = useState<number>(0);
  const [formTargetYway, setFormTargetYway] = useState<number>(0);
  const [formTargetGrams, setFormTargetGrams] = useState<number>(KYAT_TO_GRAMS);
  const [formDeposit, setFormDeposit] = useState<number>(2000000);
  const [formTotalAmount, setFormTotalAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });

  const applyTargetFromGrams = (grams: number) => {
    setFormTargetGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setFormTargetKyat(kpy.kyat);
    setFormTargetPae(kpy.pae);
    setFormTargetYway(kpy.yway);
  };

  const applyTargetFromKpy = (kyat: number, pae: number, yway: number) => {
    setFormTargetKyat(kyat);
    setFormTargetPae(pae);
    setFormTargetYway(yway);
    setFormTargetGrams(kpyToGrams({ kyat, pae, yway }, kyatToGrams));
  };

  const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const specificPrice = goldPrices.find((p) => p.gold_type === formPurity)?.price_per_kyat;

  // Hint only — total is manual
  const targetKpy = { kyat: formTargetKyat, pae: formTargetPae, yway: formTargetYway };
  const val = calculateGoldValuation(targetKpy, formPurity, pure16Price, specificPrice);
  const suggestedTotal = val.goldAmount;
  const estimatedTotalPrice = Number(formTotalAmount || 0);
  const calculatedRemainingBalance = Math.max(0, estimatedTotalPrice - Number(formDeposit || 0));

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName || !formDescription) return;

    const payload = {
      customer_id: '',
      customer_name: formCustomerName,
      customer_phone: formCustomerPhone,
      item_type: formCategory,
      description: formDescription,
      purity: formPurity,
      target_weight: targetKpy,
      craftsmanship_fee: 0,
      deposit_amount: Number(formDeposit || 0),
      estimated_total_price: estimatedTotalPrice,
      remaining_balance: calculatedRemainingBalance,
      due_date: formDueDate,
      gold_rate_snapshot: specificPrice || pure16Price,
    };

    if (editingOrderId) {
      await updateCustomOrder(editingOrderId, payload);
    } else {
      const orderNo = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
      await addCustomOrder({
        ...payload,
        order_no: orderNo,
        order_date: new Date().toISOString().slice(0, 10),
        status: 'PENDING',
      });
    }

    setIsModalOpen(false);
    setEditingOrderId(null);
  };

  const openCreateModal = () => {
    setEditingOrderId(null);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCategory('RING');
    setFormDescription('');
    setFormPurity('MEELIN');
    setFormTargetKyat(1);
    setFormTargetPae(0);
    setFormTargetYway(0);
    setFormTargetGrams(kyatToGrams);
    setFormDeposit(2000000);
    setFormTotalAmount(0);
    const d = new Date();
    d.setDate(d.getDate() + 10);
    setFormDueDate(d.toISOString().slice(0, 10));
    setIsModalOpen(true);
  };

  const openEditModal = (order: CustomOrder) => {
    setEditingOrderId(order.id);
    setFormCustomerName(order.customer_name);
    setFormCustomerPhone(order.customer_phone || '');
    setFormCategory(order.item_type || 'RING');
    setFormDescription(order.description);
    setFormPurity(order.purity as GoldPurity);
    setFormTargetKyat(order.target_weight?.kyat || 0);
    setFormTargetPae(order.target_weight?.pae || 0);
    setFormTargetYway(order.target_weight?.yway || 0);
    setFormTargetGrams(kpyToGrams(order.target_weight || { kyat: 0, pae: 0, yway: 0 }, kyatToGrams));
    setFormDeposit(order.deposit_amount || 0);
    setFormTotalAmount(order.estimated_total_price || 0);
    setFormDueDate(order.due_date);
    setIsModalOpen(true);
  };

  const handleCancelOrder = async (order: CustomOrder) => {
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'Order ပယ်ဖျက်မည်' : 'Cancel order',
      message:
        language === 'MM'
          ? `${order.order_no} ကို ပယ်ဖျက်မလား?`
          : `Cancel order ${order.order_no}?`,
      confirmLabel: language === 'MM' ? 'ပယ်ဖျက်မည်' : 'Cancel order',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Keep',
      danger: true,
    });
    if (!ok) return;
    try {
      await updateOrderStatus(order.id, 'CANCELLED');
    } catch (e) {
      await dialog.alert({
        title: language === 'MM' ? 'မအောင်မြင်ပါ' : 'Failed',
        message: e instanceof Error ? e.message : 'Cancel failed',
      });
    }
  };

  const openHandoff = (order: CustomOrder) => {
    // Always stay under Orders nav (order-handoff tab); view resolves RETURNED job if any
    onHandoffOrder?.(order.id);
  };

  const jobForOrder = (orderId: string) =>
    goldsmithJobs.find(
      (j) => j.order_id === orderId && (j.status === 'SENT' || j.status === 'RETURNED')
    );

  const today = new Date().toISOString().slice(0, 10);
  // Handoff/completed & cancelled orders leave this list
  const activeOrders = useMemo(
    () =>
      customOrders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'),
    [customOrders]
  );
  const pager = useClientPagination(activeOrders, [activeOrders.length]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#D4AF37]" />
            <span>{language === 'MM' ? 'အော်ဒါမှာယူမှု စီမံခန့်ခွဲခြင်း (Custom Orders)' : 'Custom Jewelry Orders & Deposits'}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {language === 'MM'
              ? 'စရန်ငွေ၊ ကျန်ငွေ၊ အော်ဒါဒီဇိုင်းနှင့် ပစ္စည်းအပ်ရက် စောင့်ကြည့်ခြင်း'
              : 'Track deposits, remaining balances, design specifications, and pickup due dates'}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white text-xs font-bold hover:opacity-95 transition shadow-xs flex items-center space-x-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'MM' ? 'အော်ဒါအသစ် တင်မည်' : 'Create Custom Order'}</span>
        </button>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pager.pageItems.map((order) => {
          const isOverdue = order.due_date < today && order.status !== 'COMPLETED' && order.status !== 'CANCELLED';

          return (
            <div
              key={order.id}
              className={`p-5 rounded-2xl bg-white dark:bg-[#1A1A1A] border transition shadow-xs flex flex-col justify-between ${
                isOverdue
                  ? 'border-rose-300 dark:border-rose-900/50 bg-rose-50/20 text-rose-700 dark:text-rose-300'
                  : order.status === 'COMPLETED'
                    ? 'border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : order.status === 'CANCELLED'
                      ? 'border-gray-200 dark:border-gray-800 text-slate-500 dark:text-slate-400'
                      : 'border-gray-200 dark:border-gray-800 hover:border-[#D4AF37]/50 text-sky-700 dark:text-sky-300'
              }`}
            >
              <div>
                
                {/* Top status bar */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">
                    {order.order_no}
                  </span>
                  
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      order.status === 'COMPLETED'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {order.status === 'COMPLETED'
                      ? language === 'MM'
                        ? 'ပြီး'
                        : 'Completed'
                      : language === 'MM'
                        ? 'လုပ်ဆောင်ဆဲ'
                        : 'Open'}
                  </span>
                </div>

                {/* Customer name & phone */}
                <div className="mt-3">
                  <h3 className="font-bold text-base">{order.customer_name}</h3>
                  <div className="text-xs opacity-70 flex items-center space-x-1 mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span>{order.customer_phone}</span>
                  </div>
                </div>

                {/* Order specs */}
                <p className="mt-3 text-xs bg-black/5 dark:bg-white/5 p-2.5 rounded-xl border border-current/10">
                  {order.description}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] opacity-60 block">ရည်မှန်းအလေးချိန်:</span>
                    <span className="font-bold">{formatKPYMyanmar(order.target_weight)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] opacity-60 block">ရွှေရည်သတ်မှတ်ချက်:</span>
                    <span className="font-bold">
                      {PURITY_LABELS[order.purity]?.mm || order.purity}
                    </span>
                  </div>
                </div>

                {/* Due Date Indicator */}
                <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{language === 'MM' ? 'ထုတ်ယူမည့်ရက်:' : 'Due Date:'}</span>
                  </span>
                  <span className={`font-bold font-mono ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                    {formatDate(order.due_date)} {isOverdue && '(ရက်လွန်)'}
                  </span>
                </div>

                {/* Financials: Deposit vs Balance */}
                <div className="mt-3 p-3 rounded-xl bg-[#FAF8F2] dark:bg-[#1E1B15] border border-[#D4AF37]/20 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{language === 'MM' ? 'ခန့်မှန်းစုစုပေါင်း:' : 'Est. Total:'}</span>
                    <span className="font-bold font-mono text-gray-900 dark:text-white">
                      {formatMMK(order.estimated_total_price)}
                    </span>
                  </div>

                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>{language === 'MM' ? 'စရန်ငွေ (Deposit):' : 'Deposit Paid:'}</span>
                    <span className="font-bold font-mono">{formatMMK(order.deposit_amount)}</span>
                  </div>

                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold border-t border-gray-200 dark:border-gray-700 pt-1">
                    <span>{language === 'MM' ? 'ကျန်ငွေ (Remaining):' : 'Remaining Due:'}</span>
                    <span className="font-mono">{formatMMK(order.remaining_balance)}</span>
                  </div>
                </div>

              </div>

              {/* Status Action Buttons */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap justify-end w-full">
                  {(() => {
                    const job = jobForOrder(order.id);
                    // After ပန်းထိမ်အပ် — no Edit / Cancel Order (cancel goldsmith job separately if needed)
                    const canEditOrCancelOrder = !job;
                    return (
                      <>
                        {can('orders', 'update') && canEditOrCancelOrder && (
                          <button
                            type="button"
                            onClick={() => openEditModal(order)}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition flex items-center space-x-1 hover:border-[#D4AF37]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{language === 'MM' ? 'Edit' : 'Edit'}</span>
                          </button>
                        )}
                        {can('orders', 'update') && canEditOrCancelOrder && (
                          <button
                            type="button"
                            onClick={() => void handleCancelOrder(order)}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-bold transition flex items-center space-x-1 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>{language === 'MM' ? 'Cancel Order' : 'Cancel Order'}</span>
                          </button>
                        )}
                        {can('goldsmith', 'create') && !job && (
                          <button
                            type="button"
                            onClick={() => {
                              setGsOrder(order);
                              const d = new Date();
                              d.setDate(d.getDate() + 7);
                              setGsReturnDue(d.toISOString().slice(0, 10));
                              setGsNote('');
                              setGsErr('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition flex items-center space-x-1"
                          >
                            <Hammer className="w-3.5 h-3.5" />
                            <span>{language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Goldsmith'}</span>
                          </button>
                        )}
                        {job?.status === 'SENT' && (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                            {language === 'MM'
                              ? `ပန်းထိမ်အပ်ထား${job.return_due_date ? ` · ပြန်လာရက် ${formatDate(job.return_due_date)}` : ''} — ပြန်လာမှ အပ်ရှင်း`
                              : `At goldsmith${job.return_due_date ? ` · due ${formatDate(job.return_due_date)}` : ''} — handoff after return`}
                          </span>
                        )}
                        {job?.status === 'RETURNED' && (
                          <button
                            type="button"
                            onClick={() => openHandoff(order)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center space-x-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>
                              {language === 'MM' ? 'ပစ္စည်းအပ် & ရှင်း' : 'Handoff & sell'}
                            </span>
                          </button>
                        )}
                        {!job && (
                          <span className="text-[10px] text-gray-500">
                            {language === 'MM'
                              ? 'အရင် ပန်းထိမ်အပ် လုပ်ပါ'
                              : 'Send to goldsmith first'}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>
          );
        })}
      </div>
      <PaginationBar
        language={language}
        page={pager.page}
        totalPages={pager.totalPages}
        total={pager.total}
        from={pager.from}
        to={pager.to}
        pageSize={pager.pageSize}
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
      />

      {/* New Order Modal */}
      {isModalOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <span>
                  {editingOrderId
                    ? language === 'MM'
                      ? 'အော်ဒါ ပြင်ဆင်ခြင်း'
                      : 'Edit Custom Order'
                    : language === 'MM'
                      ? 'အော်ဒါအသစ် စာရင်းသွင်းခြင်း'
                      : 'Create Custom Jewelry Order'}
                </span>
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingOrderId(null);
                }}
                className="p-1 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="mt-4 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'ဖောက်သည် အမည်:' : 'Customer Name:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'ဖုန်းနံပါတ်:' : 'Phone:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'အော်ဒါ ပစ္စည်းဒီဇိုင်း ဖော်ပြချက်:' : 'Design Description:'}
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="ပန်းထွင်း ဒီဇိုင်း၊ ကျောက်စီ အနုစိပ် စသည်..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'Category:' : 'Category:'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-bold"
                  >
                    {(['PRODUCT', 'GOLD_CLASS', 'OTHER'] as const).map((g) => {
                      const opts = (
                        masterCategories.filter((c) => c.is_active).length
                          ? masterCategories.filter((c) => c.is_active)
                          : [
                              {
                                code: 'RING',
                                name_mm: 'လက်စွပ်',
                                name_en: 'Ring',
                                category_group: 'PRODUCT' as const,
                              },
                              {
                                code: 'NECKLACE',
                                name_mm: 'ဆွဲကြိုး',
                                name_en: 'Necklace',
                                category_group: 'PRODUCT' as const,
                              },
                            ]
                      ).filter((c) => (c.category_group || 'PRODUCT') === g);
                      if (!opts.length) return null;
                      const label =
                        g === 'PRODUCT'
                          ? language === 'MM'
                            ? 'ပစ္စည်းအမျိုးအစား'
                            : 'Item Types'
                          : g === 'GOLD_CLASS'
                            ? language === 'MM'
                              ? 'Categories (ပဲရည်)'
                              : 'Categories (Purity)'
                            : language === 'MM'
                              ? 'အခြား'
                              : 'Other';
                      return (
                        <optgroup key={g} label={label}>
                          {opts.map((c) => (
                            <option key={c.code} value={c.code}>
                              {language === 'MM' ? c.name_mm : c.name_en}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'ရွှေရည် (Purity):' : 'Purity:'}
                  </label>
                  <select
                    value={formPurity}
                    onChange={(e) => setFormPurity(e.target.value as GoldPurity)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-bold"
                  >
                    {Object.entries(PURITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {language === 'MM' ? v.mm : v.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'ပစ္စည်းအပ်မည့်ရက် (Due Date):' : 'Due Date:'}
                  </label>
                  <DateInput
                    required
                    value={formDueDate}
                    onChange={setFormDueDate}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-mono"
                  />
              </div>

              {/* Target weight */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-2">
                <div className="font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between gap-2">
                  <span>
                    {language === 'MM' ? 'ရည်မှန်း အလေးချိန် (Target Weight):' : 'Target Weight:'}
                  </span>
                  <span className="text-[11px] text-gray-400 font-normal">
                    Gram · ကျပ် / ပဲ / ရွေး
                  </span>
                </div>
                <div className="flex flex-wrap items-end gap-y-2">
                  <div className="w-[7.5rem]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                    <NumberInput
                      min={0}
                      step={0.001}
                      value={formTargetGrams}
                      onChange={applyTargetFromGrams}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A] dark:text-white"
                    />
                  </div>
                  <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                  <div className="hidden sm:block w-px self-stretch bg-gray-300 dark:bg-gray-600 my-1" />
                  <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                  <div className="flex flex-wrap gap-1.5">
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ကျပ်</label>
                      <NumberInput
                        min={0}
                        value={formTargetKyat}
                        onChange={(v) => applyTargetFromKpy(v, formTargetPae, formTargetYway)}
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white"
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                      <NumberInput
                        min={0}
                        max={15}
                        value={formTargetPae}
                        onChange={(v) => applyTargetFromKpy(formTargetKyat, v, formTargetYway)}
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white"
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                      <NumberInput
                        min={0}
                        step={0.1}
                        value={formTargetYway}
                        onChange={(v) => applyTargetFromKpy(formTargetKyat, formTargetPae, v)}
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Deposit */}
              <div>
                <label className="block font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  {language === 'MM' ? 'စရန်ငွေ (Deposit Amount):' : 'Deposit Paid:'}
                </label>
                <input
                  type="number"
                  step="50000"
                  value={formDeposit}
                  onChange={(e) => setFormDeposit(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-mono font-bold"
                />
              </div>

              {/* Manual total */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'စုစုပေါင်း ငွေပမာဏ (manual):' : 'Total amount (manual):'}
                </label>
                <input
                  type="number"
                  step="1000"
                  min={0}
                  value={formTotalAmount}
                  onChange={(e) => setFormTotalAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50 bg-white dark:bg-[#121212] dark:text-white font-mono font-bold text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {language === 'MM'
                    ? `အကြံပြု (ရွှေဖိုး): ${formatMMK(suggestedTotal)} — လိုအင်အတိုင်း ပြင်ပါ · လက်ခကို ပန်းထိမ်ပြန်လာမှ ထည့်ပါ`
                    : `Suggested (gold): ${formatMMK(suggestedTotal)} — edit as needed · craft fee on goldsmith return`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/30 space-y-1">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{language === 'MM' ? 'သတ်မှတ်စုစုပေါင်း:' : 'Agreed total:'}</span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">{formatMMK(estimatedTotalPrice)}</span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                  <span>{language === 'MM' ? 'ပစ္စည်းထုတ်ချိန် ပေးရန်ကျန်ငွေ:' : 'Remaining Balance on Pickup:'}</span>
                  <span className="font-mono">{formatMMK(calculatedRemainingBalance)}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingOrderId(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] text-white font-bold hover:bg-[#C5A059]"
                >
                  {editingOrderId
                    ? language === 'MM'
                      ? 'သိမ်းမည်'
                      : 'Save'
                    : language === 'MM'
                      ? 'အော်ဒါတင်မည်'
                      : 'Confirm Order'}
                </button>
              </div>

            </form>
          </div>
        </ModalOverlay>
      )}

      {gsOrder && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Hammer className="w-4 h-4 text-violet-600" />
                {language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Send to goldsmith'}
              </h3>
              <button type="button" onClick={() => setGsOrder(null)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-3 text-xs">
              <p className="font-bold">{gsOrder.order_no}</p>
              <p className="text-gray-500">{gsOrder.description}</p>
              <div>
                <label className="block font-semibold mb-1">
                  {language === 'MM'
                    ? 'ပြန်လာအပ်ရမည့်ရက်'
                    : 'Expected return date'}
                </label>
                <DateInput
                  required
                  value={gsReturnDue}
                  onChange={setGsReturnDue}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {language === 'MM'
                    ? 'ဤရက်ကျော်သေးပြီး ပြန်မလာသေးရင် ပန်းထိမ်အပ်မှာ အကြောင်းကြားပါမည် · လက်ခကို ပြန်လာမှ ထည့်ပါ'
                    : 'Overdue SENT jobs notify on Goldsmith · craft fee on return'}
                </p>
              </div>
              <input
                value={gsNote}
                onChange={(e) => setGsNote(e.target.value)}
                placeholder={language === 'MM' ? 'မှတ်ချက်' : 'Note'}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
              />
              {gsErr && <p className="text-rose-600">{gsErr}</p>}
              <button
                type="button"
                disabled={gsSaving || !gsReturnDue}
                onClick={async () => {
                  setGsSaving(true);
                  setGsErr('');
                  try {
                    await createGoldsmithJob({
                      source_type: 'ORDER',
                      order_id: gsOrder.id,
                      craft_fee: 0,
                      return_due_date: gsReturnDue,
                      notes: gsNote || undefined,
                    });
                    setGsOrder(null);
                  } catch (e) {
                    setGsErr(e instanceof Error ? e.message : 'Failed');
                  } finally {
                    setGsSaving(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold disabled:opacity-50"
              >
                {gsSaving ? '...' : language === 'MM' ? 'အပ်မည်' : 'Send'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
};
