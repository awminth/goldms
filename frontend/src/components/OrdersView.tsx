import React, { useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { CustomOrder, GoldPurity } from '../types/gold';
import {
  formatMMK,
  formatKPYMyanmar,
  formatKPYEnglish,
  calculateGoldValuation,
  PURITY_LABELS,
} from '../utils/goldCalculations';
import {
  Clock,
  Plus,
  CheckCircle,
  AlertTriangle,
  User,
  Phone,
  Calendar,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useClientPagination } from '../hooks/useClientPagination';
import { PaginationBar } from './PaginationBar';
import { ModalOverlay } from './ModalOverlay';

export const OrdersView: React.FC = () => {
  const {
    customOrders,
    addCustomOrder,
    updateOrderStatus,
    goldPrices,
    customers,
    language,
    masterCategories,
  } = useGoldShop();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderForSettle, setSelectedOrderForSettle] = useState<CustomOrder | null>(null);
  const [settleAmountInput, setSettleAmountInput] = useState('');

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCategory, setFormCategory] = useState<string>('RING');
  const [formDescription, setFormDescription] = useState('');
  const [formPurity, setFormPurity] = useState<GoldPurity>('MEELIN');
  const [formTargetKyat, setFormTargetKyat] = useState<number>(1);
  const [formTargetPae, setFormTargetPae] = useState<number>(0);
  const [formTargetYway, setFormTargetYway] = useState<number>(0);
  const [formCraftsmanship, setFormCraftsmanship] = useState<number>(150000);
  const [formDeposit, setFormDeposit] = useState<number>(2000000);
  const [formTotalAmount, setFormTotalAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });

  const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const specificPrice = goldPrices.find((p) => p.gold_type === formPurity)?.price_per_kyat;

  // Hint only — total is manual
  const targetKpy = { kyat: formTargetKyat, pae: formTargetPae, yway: formTargetYway };
  const val = calculateGoldValuation(targetKpy, formPurity, pure16Price, specificPrice);
  const suggestedTotal = val.goldAmount + Number(formCraftsmanship || 0);
  const estimatedTotalPrice = Number(formTotalAmount || 0);
  const calculatedRemainingBalance = Math.max(0, estimatedTotalPrice - Number(formDeposit || 0));

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName || !formDescription) return;

    const orderNo = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    await addCustomOrder({
      order_no: orderNo,
      customer_id: '',
      customer_name: formCustomerName,
      customer_phone: formCustomerPhone,
      item_type: formCategory,
      description: formDescription,
      purity: formPurity,
      target_weight: targetKpy,
      craftsmanship_fee: Number(formCraftsmanship || 0),
      deposit_amount: Number(formDeposit || 0),
      estimated_total_price: estimatedTotalPrice,
      remaining_balance: calculatedRemainingBalance,
      order_date: new Date().toISOString().slice(0, 10),
      due_date: formDueDate,
      status: 'PENDING',
      gold_rate_snapshot: specificPrice || pure16Price,
    });

    setIsModalOpen(false);
  };

  const handleSettleSubmit = async () => {
    if (!selectedOrderForSettle) return;
    const amount = Number(settleAmountInput) || selectedOrderForSettle.remaining_balance;
    await updateOrderStatus(selectedOrderForSettle.id, 'COMPLETED', amount);
    setSelectedOrderForSettle(null);
  };

  const today = new Date().toISOString().slice(0, 10);
  const pager = useClientPagination(customOrders, []);

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
          onClick={() => setIsModalOpen(true)}
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
                  ? 'border-rose-300 dark:border-rose-900/50 bg-rose-50/20'
                  : 'border-gray-200 dark:border-gray-800 hover:border-[#D4AF37]/50'
              }`}
            >
              <div>
                
                {/* Top status bar */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#B8860B] dark:text-[#E5C158]">
                    {order.order_no}
                  </span>
                  
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      order.status === 'COMPLETED'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : order.status === 'READY_FOR_PICKUP'
                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                        : order.status === 'IN_PRODUCTION'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Customer name & phone */}
                <div className="mt-3">
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    {order.customer_name}
                  </h3>
                  <div className="text-xs text-gray-500 flex items-center space-x-1 mt-0.5">
                    <Phone className="w-3 h-3 text-[#D4AF37]" />
                    <span>{order.customer_phone}</span>
                  </div>
                </div>

                {/* Order specs */}
                <p className="mt-3 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#141414] p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                  {order.description}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block">ရည်မှန်းအလေးချိန်:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatKPYMyanmar(order.target_weight)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">ရွှေရည်သတ်မှတ်ချက်:</span>
                    <span className="font-bold text-[#B8860B] dark:text-[#FFD700]">
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
                    {order.due_date} {isOverdue && '(ရက်လွန်)'}
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
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                {order.status !== 'COMPLETED' && (
                  <>
                    <select
                      value={order.status}
                      onChange={(e) => void updateOrderStatus(order.id, e.target.value as any)}
                      className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white font-medium"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PRODUCTION">IN PRODUCTION</option>
                      <option value="READY_FOR_PICKUP">READY FOR PICKUP</option>
                    </select>

                    <button
                      onClick={() => {
                        setSelectedOrderForSettle(order);
                        setSettleAmountInput(String(order.remaining_balance));
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center space-x-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{language === 'MM' ? 'ပစ္စည်းအပ် & ရှင်း' : 'Pickup & Settle'}</span>
                    </button>
                  </>
                )}

                {order.status === 'COMPLETED' && (
                  <div className="w-full py-1 text-center text-xs font-bold text-emerald-600 flex items-center justify-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>{language === 'MM' ? 'ပစ္စည်းလွှဲအပ် ငွေရှင်းပြီး' : 'Delivered & Fully Settled'}</span>
                  </div>
                )}
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

      {/* Settle Order Modal */}
      {selectedOrderForSettle && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                {language === 'MM' ? 'အော်ဒါလက်ကျန်ငွေ ရှင်းလင်းခြင်း' : 'Settle Order Balance'}
              </h3>
              <button
                onClick={() => setSelectedOrderForSettle(null)}
                className="p-1 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">ဖောက်သည်:</span>
                <span className="font-bold text-gray-900 dark:text-white">{selectedOrderForSettle.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ကျန်ရှိငွေ:</span>
                <span className="font-bold text-rose-600 font-mono">{formatMMK(selectedOrderForSettle.remaining_balance)}</span>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  {language === 'MM' ? 'ယခုလက်ခံရရှိငွေ (MMK):' : 'Amount Receiving Now:'}
                </label>
                <input
                  type="number"
                  value={settleAmountInput}
                  onChange={(e) => setSettleAmountInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold font-mono rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedOrderForSettle(null)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSettleSubmit}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                Confirm Settle
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* New Order Modal */}
      {isModalOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <span>{language === 'MM' ? 'အော်ဒါအသစ် စာရင်းသွင်းခြင်း' : 'Create Custom Jewelry Order'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="mt-4 space-y-4 text-xs">
              
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
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-mono"
                  />
              </div>

              {/* Target weight */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-2">
                <div className="font-bold text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'ရည်မှန်း အလေးချိန် (Target Weight):' : 'Target Weight:'}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="ကျပ်"
                    value={formTargetKyat}
                    onChange={(e) => setFormTargetKyat(Number(e.target.value))}
                    className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white font-bold"
                  />
                  <input
                    type="number"
                    min="0"
                    max="15"
                    placeholder="ပဲ"
                    value={formTargetPae}
                    onChange={(e) => setFormTargetPae(Number(e.target.value))}
                    className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white font-bold"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="ရွေး"
                    value={formTargetYway}
                    onChange={(e) => setFormTargetYway(Number(e.target.value))}
                    className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white font-bold"
                  />
                </div>
              </div>

              {/* Craftsmanship & Deposit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'လက်ခ (Craftsmanship):' : 'Craft Fee:'}
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={formCraftsmanship}
                    onChange={(e) => setFormCraftsmanship(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-mono"
                  />
                </div>
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
                    ? `အကြံပြု (ရွှေ+လက်ခ): ${formatMMK(suggestedTotal)} — လိုအင်အတိုင်း ပြင်ပါ`
                    : `Suggested (gold+craft): ${formatMMK(suggestedTotal)} — edit as needed`}
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
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] text-white font-bold hover:bg-[#C5A059]"
                >
                  Confirm Order
                </button>
              </div>

            </form>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
};
