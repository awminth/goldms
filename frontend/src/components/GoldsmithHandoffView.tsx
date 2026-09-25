import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  calculateNetFromParts,
  calculateSaleLineBreakdown,
  formatMMK,
  generateInvoiceNo,
  KYAT_TO_GRAMS,
  kpyToGrams,
  PURITY_LABELS,
} from '../utils/goldCalculations';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { NumberInput } from './NumberInput';

interface Props {
  /** Goldsmith RETURNED job → handoff API */
  jobId?: string;
  /** Direct from Orders → SALE + complete order (resolves RETURNED job if any) */
  orderId?: string;
  onBack: () => void;
}

function isThaiGold(seed?: {
  item_type?: string;
  purity?: string;
} | null): boolean {
  return seed?.item_type === 'THAI_GOLD' || seed?.purity === 'THAI_GOLD';
}

export const GoldsmithHandoffView: React.FC<Props> = ({ jobId, orderId, onBack }) => {
  const {
    goldsmithJobs,
    customOrders,
    language,
    handoffGoldsmithJob,
    createTransaction,
    updateOrderStatus,
    setSelectedVoucher,
    getLivePriceForPurity,
    goldPrices,
    masterCategories,
    shopSettings,
  } = useGoldShop();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  // Prefer explicit jobId; from Orders path, find RETURNED job for this order
  const job = useMemo(() => {
    if (jobId) return goldsmithJobs.find((j) => j.id === jobId);
    if (orderId) {
      return goldsmithJobs.find(
        (j) => j.order_id === orderId && j.status === 'RETURNED'
      );
    }
    return undefined;
  }, [jobId, orderId, goldsmithJobs]);

  const order = useMemo(() => {
    if (orderId) return customOrders.find((o) => o.id === orderId);
    if (job?.order_id) return customOrders.find((o) => o.id === job.order_id);
    return undefined;
  }, [orderId, job, customOrders]);

  const productCategories = useMemo(
    () =>
      masterCategories.filter(
        (c) => (c.category_group || 'PRODUCT') === 'PRODUCT' || c.category_group === 'OTHER'
      ),
    [masterCategories]
  );

  // Locked from order / job — no MM/Thai re-pick
  const itemType: 'MYANMAR_GOLD' | 'THAI_GOLD' = isThaiGold(order) || isThaiGold(job)
    ? 'THAI_GOLD'
    : 'MYANMAR_GOLD';

  const lockedPurity = String(
    order?.purity || job?.purity || (itemType === 'THAI_GOLD' ? 'THAI_GOLD' : 'PE15A')
  );

  const seedGrams = () => {
    if (job?.source_grams) return Number(job.source_grams);
    if (job?.thai_weight_unit) return Number(job.thai_weight_unit);
    if (order?.target_weight && itemType === 'THAI_GOLD') {
      return kpyToGrams(order.target_weight, kyatToGrams);
    }
    return 0;
  };

  const [name, setName] = useState(
    () => order?.description || job?.item_name || ''
  );
  const [nameMm, setNameMm] = useState(
    () => order?.description || job?.item_name || ''
  );
  const [category, setCategory] = useState(
    () => order?.item_type || job?.category || 'NECKLACE'
  );
  const [grossKyat, setGrossKyat] = useState(order?.target_weight?.kyat || job?.weight?.kyat || 0);
  const [grossPae, setGrossPae] = useState(order?.target_weight?.pae || job?.weight?.pae || 0);
  const [grossYway, setGrossYway] = useState(order?.target_weight?.yway || job?.weight?.yway || 0);
  const [gemKyat, setGemKyat] = useState(0);
  const [gemPae, setGemPae] = useState(0);
  const [gemYway, setGemYway] = useState(0);
  const [craftDedPae, setCraftDedPae] = useState(0);
  const [craftDedYway, setCraftDedYway] = useState(0);
  const [profitDedPae, setProfitDedPae] = useState(0);
  const [profitDedYway, setProfitDedYway] = useState(0);
  const [grams, setGrams] = useState(seedGrams);
  const [craftFee, setCraftFee] = useState(order?.craftsmanship_fee || 0);
  const [craftProfit, setCraftProfit] = useState(0);
  const [stonePrice, setStonePrice] = useState(0);
  const [stoneProfit, setStoneProfit] = useState(0);
  const [paid, setPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'KPAY' | 'WAVEPAY' | 'BANK_TRANSFER' | 'CARD'
  >('CASH');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const purity = lockedPurity;
  const pure16 = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const craftTotal = Number(craftFee || 0) + Number(craftProfit || 0);
  const stoneTotal = Number(stonePrice || 0) + Number(stoneProfit || 0);
  const totalDedPae = craftDedPae + profitDedPae;
  const totalDedYway = craftDedYway + profitDedYway;

  const net =
    itemType === 'THAI_GOLD'
      ? { kyat: 0, pae: 0, yway: 0 }
      : calculateNetFromParts(
          { kyat: grossKyat, pae: grossPae, yway: grossYway },
          { kyat: gemKyat, pae: gemPae, yway: gemYway },
          totalDedPae,
          totalDedYway
        );

  const snapshot = getLivePriceForPurity(purity as any);
  const breakdown = calculateSaleLineBreakdown({
    purity,
    itemType,
    netWeight: net,
    thaiWeightUnit: itemType === 'THAI_GOLD' ? grams : null,
    craftsmanshipFee: craftTotal,
    stonePrice: stoneTotal,
    pricePerKyat16Pe: pure16,
    specificSellPrice: snapshot,
    thaiRatePerKyat: getLivePriceForPurity('THAI_GOLD'),
  });

  const deposit = order?.deposit_amount || 0;
  const saleTotal = breakdown.lineSubtotal;
  const afterDeposit = Math.max(0, saleTotal - deposit);
  const paidNum = paid !== '' ? Number(paid) : afterDeposit;

  if (!order && !job) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        {language === 'MM' ? 'အော်ဒါ / Job မတွေ့ပါ' : 'Order / job not found'}.{' '}
        <button type="button" className="text-[#D4AF37] font-bold" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  const purityLabel =
    PURITY_LABELS[purity as keyof typeof PURITY_LABELS] ||
    ({ mm: purity, en: purity } as { mm: string; en: string });

  const buildSalePayload = () => ({
    invoice_no: generateInvoiceNo('INV'),
    customer_id: order?.customer_id || '',
    customer_name: order?.customer_name || 'ဧည့်သည်',
    customer_phone: order?.customer_phone || '',
    transaction_type: 'SALE' as const,
    items: [
      {
        item_name: nameMm || name,
        category: itemType === 'THAI_GOLD' ? 'THAI_GOLD' : category,
        weight: { kyat: grossKyat, pae: grossPae, yway: grossYway },
        gemstone_weight: { kyat: gemKyat, pae: gemPae, yway: gemYway },
        net_weight: net,
        purity,
        gold_price_snapshot: snapshot,
        craftsmanship_fee: craftTotal,
        stone_price: stoneTotal,
        subtotal: saleTotal,
        item_type: itemType,
        thai_weight_unit: itemType === 'THAI_GOLD' ? grams : undefined,
      },
    ],
    gold_price_snapshot: pure16,
    craftsmanship_total: craftTotal,
    stone_total: stoneTotal,
    discount_amount: deposit,
    tax_amount: 0,
    total_amount: afterDeposit,
    paid_amount: paidNum,
    remaining_amount: Math.max(0, afterDeposit - paidNum),
    payment_method: paymentMethod,
    notes: order
      ? `ပစ္စည်းအပ်ရှင်း — Order ${order.order_no} (စရံ ${deposit} နှုတ်ပြီး)`
      : `ပစ္စည်းအပ်ရှင်း — ${job?.job_no || ''}`,
    use_client_total: true,
    deposit_credit: deposit,
    remaining_paid: order?.remaining_balance ?? 0,
  });

  const handleConfirm = async () => {
    setSaving(true);
    setErr('');
    try {
      const payload = buildSalePayload();
      // Prefer job handoff when RETURNED job exists (incl. resolved from orderId)
      if (job) {
        const result = await handoffGoldsmithJob(job.id, payload);
        setSelectedVoucher(result.transaction);
      } else if (order) {
        const txn = await createTransaction(payload as any);
        await updateOrderStatus(order.id, 'COMPLETED', undefined, { via_sale: true });
        setSelectedVoucher(txn);
      } else {
        throw new Error('Missing order / job');
      }
      onBack();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Handoff failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]';

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {language === 'MM' ? 'ပစ္စည်းအပ်ရှင်း' : 'Handoff & sale'}
          </h2>
          <p className="text-xs text-gray-500">
            {job?.job_no ? `${job.job_no} · ` : ''}
            {order ? `${order.order_no} · ${order.customer_name}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left — inventory intake (type locked from order) */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
            {language === 'MM' ? 'ဘယ် — Inventory သွင်းအချက်' : 'Left — Inventory intake'}
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex px-3 py-1.5 rounded-xl text-xs font-bold ${
                itemType === 'THAI_GOLD'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-[#D4AF37]/20 text-[#996515] dark:bg-[#D4AF37]/25 dark:text-[#E8C96A]'
              }`}
            >
              {itemType === 'THAI_GOLD' ? 'ထိုင်းရွှေ' : 'မြန်မာရွှေ'}
            </span>
            <span className="inline-flex px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              {language === 'MM' ? purityLabel.mm : purityLabel.en}
            </span>
            {order?.description ? (
              <span className="text-[10px] text-gray-500 truncate max-w-full">
                {order.description}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'အမည် (EN)' : 'Name (EN)'}
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'အမည် (မြန်မာ)' : 'Name (MM)'}
              </label>
              <input
                value={nameMm}
                onChange={(e) => setNameMm(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {itemType !== 'THAI_GOLD' && (
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'အမျိုးအစား' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputCls}
              >
                {productCategories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {language === 'MM' ? c.name_mm : c.name_en || c.name_mm}
                  </option>
                ))}
              </select>
            </div>
          )}

          {itemType === 'THAI_GOLD' ? (
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'အလေးချိန် (Gram)' : 'Weight (Gram)'}
              </label>
              <NumberInput value={grams} onChange={setGrams} className={inputCls} />
            </div>
          ) : (
            <>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 mb-1">
                  {language === 'MM' ? 'အထည်ချိန် (Gross)' : 'Gross weight'}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumberInput
                    value={grossKyat}
                    onChange={setGrossKyat}
                    className={inputCls}
                    placeholder="ကျပ်"
                  />
                  <NumberInput
                    value={grossPae}
                    onChange={setGrossPae}
                    className={inputCls}
                    placeholder="ပဲ"
                  />
                  <NumberInput
                    value={grossYway}
                    onChange={setGrossYway}
                    className={inputCls}
                    placeholder="ရွေး"
                  />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 mb-1">
                  {language === 'MM' ? 'ကျောက်ချိန်' : 'Gem weight'}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumberInput value={gemKyat} onChange={setGemKyat} className={inputCls} />
                  <NumberInput value={gemPae} onChange={setGemPae} className={inputCls} />
                  <NumberInput value={gemYway} onChange={setGemYway} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 mb-1">
                    {language === 'MM' ? 'ပန်းထိန်း (ပဲ/ရွေး)' : 'Craft ded'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput value={craftDedPae} onChange={setCraftDedPae} className={inputCls} />
                    <NumberInput
                      value={craftDedYway}
                      onChange={setCraftDedYway}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 mb-1">
                    {language === 'MM' ? 'အမြတ်နှုတ် (ပဲ/ရွေး)' : 'Profit ded'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput
                      value={profitDedPae}
                      onChange={setProfitDedPae}
                      className={inputCls}
                    />
                    <NumberInput
                      value={profitDedYway}
                      onChange={setProfitDedYway}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                {language === 'MM' ? 'ရွှေချိန်စင်' : 'Net'}: {net.kyat} ကျပ် {net.pae} ပဲ{' '}
                {net.yway} ရွေး
              </p>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'လက်ခ' : 'Craft fee'}
              </label>
              <NumberInput value={craftFee} onChange={setCraftFee} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'အမြတ်လက်ခ' : 'Craft profit'}
              </label>
              <NumberInput value={craftProfit} onChange={setCraftProfit} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'ကျောက်ဖိုး' : 'Stone'}
              </label>
              <NumberInput value={stonePrice} onChange={setStonePrice} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'ကျောက်အမြတ်' : 'Stone profit'}
              </label>
              <NumberInput value={stoneProfit} onChange={setStoneProfit} className={inputCls} />
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            1 kyat ≈ {kyatToGrams} g
          </p>
        </div>

        {/* Right — sale */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
            {language === 'MM' ? 'ညာ — အရောင်းအချက်' : 'Right — Sale'}
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">{language === 'MM' ? 'ဖောက်သည်' : 'Customer'}</span>
              <span className="font-bold text-right">
                {order?.customer_name || '—'}
                {order?.customer_phone ? (
                  <span className="block text-[10px] font-mono text-gray-400 font-normal">
                    {order.customer_phone}
                  </span>
                ) : null}
              </span>
            </div>
            {order && (
              <div className="flex justify-between">
                <span className="text-gray-500">Order</span>
                <span className="font-mono font-bold text-[#996515]">{order.order_no}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">{language === 'MM' ? 'ရွှေဖိုး' : 'Gold'}</span>
              <span className="font-mono">{formatMMK(breakdown.goldAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{language === 'MM' ? 'လက်ခစု' : 'Craft total'}</span>
              <span className="font-mono">{formatMMK(craftTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{language === 'MM' ? 'ကျောက်စု' : 'Stone total'}</span>
              <span className="font-mono">{formatMMK(stoneTotal)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-gray-600">{language === 'MM' ? 'ရောင်းဈေး စု' : 'Sale total'}</span>
              <span className="font-mono">{formatMMK(saleTotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <span>{language === 'MM' ? 'စရံ (နှုတ်)' : 'Deposit credit'}</span>
              <span className="font-mono">−{formatMMK(deposit)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-bold text-rose-600">
              <span>{language === 'MM' ? 'ကျန်ပေးရန်' : 'Balance due'}</span>
              <span className="font-mono">{formatMMK(afterDeposit)}</span>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'ငွေပေးချေမှု' : 'Payment method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                className={inputCls}
              >
                <option value="CASH">CASH</option>
                <option value="KPAY">KPAY</option>
                <option value="WAVEPAY">WAVEPAY</option>
                <option value="BANK_TRANSFER">BANK</option>
                <option value="CARD">CARD</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">
                {language === 'MM' ? 'ယနေ့ပေးငွေ' : 'Paid now'}
              </label>
              <input
                type="number"
                min={0}
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                placeholder={String(afterDeposit)}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          {err && <p className="text-xs text-rose-600">{err}</p>}

          <button
            type="button"
            disabled={saving || !(nameMm || name)}
            onClick={() => void handleConfirm()}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {saving
              ? '...'
              : language === 'MM'
                ? 'ရောင်းပြီး အရောင်းမှတ်တမ်းသွင်းမည်'
                : 'Complete sale → sales history'}
          </button>
        </div>
      </div>
    </div>
  );
};
