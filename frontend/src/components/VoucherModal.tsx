import React, { useMemo } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  formatMMK,
  formatBaht,
  formatKPYMyanmar,
  kpyToGrams,
  kpyToYway,
  ywayToKpy,
  KYAT_TO_GRAMS,
  PURITY_LABELS,
  calculateGoldValuation,
  mmkToBaht,
  resolveBahtMmkRate,
} from '../utils/goldCalculations';
import { formatDate } from '../utils/dateFormat';
import type { GoldPurity, TransactionItem, WeightKPY } from '../types/gold';
import { Printer, X, FileCheck } from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';

const emptyKpy: WeightKPY = { kyat: 0, pae: 0, yway: 0 };

function kpyOrEmpty(w?: WeightKPY | null): WeightKPY {
  if (!w) return emptyKpy;
  return {
    kyat: Number(w.kyat || 0),
    pae: Number(w.pae || 0),
    yway: Number(w.yway || 0),
  };
}

function addKpy(a: WeightKPY, b: WeightKPY): WeightKPY {
  return ywayToKpy(
    kpyToYway(a.kyat, a.pae, a.yway) + kpyToYway(b.kyat, b.pae, b.yway)
  );
}

function subKpy(a: WeightKPY, b: WeightKPY): WeightKPY {
  return ywayToKpy(
    Math.max(0, kpyToYway(a.kyat, a.pae, a.yway) - kpyToYway(b.kyat, b.pae, b.yway))
  );
}

function fmtUnit(n: number, digits = 0): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return digits > 0 ? n.toFixed(digits) : String(n);
}

function WeightCells({
  grams,
  kpy,
}: {
  grams: number;
  kpy: WeightKPY;
}) {
  return (
    <>
      <td className="voucher-cell voucher-nowrap text-center font-mono whitespace-nowrap">{fmtUnit(grams, 3)}</td>
      <td className="voucher-cell voucher-nowrap text-center font-mono whitespace-nowrap">{fmtUnit(kpy.kyat)}</td>
      <td className="voucher-cell voucher-nowrap text-center font-mono whitespace-nowrap">{fmtUnit(kpy.pae)}</td>
      <td className="voucher-cell voucher-nowrap text-center font-mono whitespace-nowrap">{fmtUnit(kpy.yway, 1)}</td>
    </>
  );
}

function mmGoldComponentAmounts(item: TransactionItem, goldPure: WeightKPY, waste: WeightKPY) {
  const price = Number(item.gold_price_snapshot || 0);
  const purity = item.purity as GoldPurity;
  const goldPureAmount = calculateGoldValuation(goldPure, purity, price, price).goldAmount;
  const wasteYway = kpyToYway(waste.kyat, waste.pae, waste.yway);
  const wastageValue =
    wasteYway > 0
      ? calculateGoldValuation(waste, purity, price, price).goldAmount
      : 0;
  return { goldPureAmount, wastageValue };
}

function ItemWeightBlock({
  item,
  index,
  kyatToGrams,
  itemCode,
  formatAmount,
}: {
  item: TransactionItem;
  index: number;
  kyatToGrams: number;
  itemCode?: string;
  /** MMK for Myanmar lines; Baht for Thai lines */
  formatAmount: (n: number) => string;
}) {
  const isThai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
  const gross = kpyOrEmpty(item.weight);
  const gem = kpyOrEmpty(item.gemstone_weight);
  const net = kpyOrEmpty(item.net_weight);

  // ရွှေချိန် (no wastage) = အလေးချိန် − ကျောက်ချိန်
  const goldPure = subKpy(gross, gem);
  // အလျော့တွက် = Net − ရွှေချိန်  (Net = (Gross − Gem) + Wastage)
  const waste = subKpy(net, goldPure);
  // စုစုပေါင်းအလေးချိန် = အလေးချိန် + အလျော့တွက်
  const totalWeight = addKpy(gross, waste);

  const grossG = kpyToGrams(gross, kyatToGrams);
  const gemG = kpyToGrams(gem, kyatToGrams);
  const goldPureG = kpyToGrams(goldPure, kyatToGrams);
  const wasteG = kpyToGrams(waste, kyatToGrams);
  const totalG = kpyToGrams(totalWeight, kyatToGrams);
  const thaiG =
    item.thai_weight_unit != null && Number(item.thai_weight_unit) > 0
      ? Number(item.thai_weight_unit)
      : goldPureG || totalG;

  const { goldPureAmount, wastageValue } = isThai
    ? { goldPureAmount: 0, wastageValue: 0 }
    : mmGoldComponentAmounts(item, goldPure, waste);

  type RowKind = 'gross' | 'gem' | 'gold' | 'waste' | 'total' | 'thai';
  const rows: { kind: RowKind; label: string; grams: number; kpy: WeightKPY }[] = isThai
    ? [{ kind: 'thai', label: 'ရွှေချိန်', grams: thaiG, kpy: goldPure }]
    : [
        { kind: 'gross', label: 'အလေးချိန်', grams: grossG, kpy: gross },
        { kind: 'gem', label: 'ကျောက်ချိန်', grams: gemG, kpy: gem },
        { kind: 'gold', label: 'ရွှေချိန်', grams: goldPureG, kpy: goldPure },
        { kind: 'waste', label: 'အလျော့တွက်', grams: wasteG, kpy: waste },
        { kind: 'total', label: 'စုစုပေါင်းအလေးချိန်', grams: totalG, kpy: totalWeight },
      ];

  const code = (itemCode || item.barcode || '').trim();

  const amountForRow = (kind: RowKind) => {
    if (isThai && kind === 'thai') {
      return (
        <div className="voucher-money font-bold text-[12px] font-mono whitespace-nowrap">
          {formatAmount(item.subtotal)}
        </div>
      );
    }
    if (kind === 'gold') {
      return (
        <div className="voucher-money font-mono font-semibold text-[11px] whitespace-nowrap">
          {formatAmount(goldPureAmount)}
        </div>
      );
    }
    if (kind === 'waste') {
      return (
        <div className="voucher-money font-mono font-semibold text-[11px] whitespace-nowrap">
          {formatAmount(wastageValue)}
        </div>
      );
    }
    if (kind === 'total') {
      return (
        <div className="voucher-money font-bold text-[12px] font-mono text-gray-900 whitespace-nowrap">
          {formatAmount(item.subtotal)}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {rows.map((row, ri) => (
        <tr key={`${item.id}-${row.label}`} className="voucher-item-row">
          {ri === 0 && (
            <>
              <td
                rowSpan={rows.length}
                className="voucher-cell text-center font-mono font-bold align-middle"
              >
                {index + 1}
              </td>
              <td
                rowSpan={rows.length}
                className="voucher-cell text-center font-mono text-[10px] text-[#996515] align-middle px-1.5 whitespace-nowrap"
              >
                {code || '—'}
              </td>
              <td rowSpan={rows.length} className="voucher-cell align-middle px-2">
                <div className="voucher-nowrap font-bold text-[12px] leading-snug text-gray-900 whitespace-nowrap">
                  {item.line_role === 'NEW_ITEM' && (
                    <span className="text-emerald-700 font-extrabold">[အသစ်] </span>
                  )}
                  {item.line_role === 'TRADE_IN' && (
                    <span className="text-sky-700 font-extrabold">[ပြန်သွင်း] </span>
                  )}
                  {item.item_name}
                  <span className="font-semibold text-gray-500">
                    {' '}
                    · {PURITY_LABELS[item.purity]?.mm || item.purity}
                    {isThai ? ' · ထိုင်းရွှေ' : ''}
                  </span>
                  {isThai && (
                    <span className="font-mono font-normal text-[#996515]">
                      {' '}
                      ({thaiG.toFixed(3)} g)
                    </span>
                  )}
                </div>
              </td>
            </>
          )}
          <td className="voucher-cell voucher-nowrap text-[10px] text-gray-600 whitespace-nowrap px-1.5">
            {row.label}
          </td>
          <WeightCells grams={row.grams} kpy={row.kpy} />
          <td className="voucher-cell voucher-money text-right align-middle px-1.5 py-1 whitespace-nowrap">
            {amountForRow(row.kind)}
          </td>
        </tr>
      ))}
    </>
  );
}

export const VoucherModal: React.FC = () => {
  const {
    selectedVoucher,
    setSelectedVoucher,
    language,
    goldPrices,
    shopSettings,
    inventory,
    customers,
  } = useGoldShop();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  const customerExtra = useMemo(() => {
    if (!selectedVoucher) return { nrc: '', address: '' };
    const byId = selectedVoucher.customer_id
      ? customers.find((c) => c.id === selectedVoucher.customer_id)
      : undefined;
    if (byId) {
      return { nrc: byId.nrc || '', address: byId.address || '' };
    }
    const phone = String(selectedVoucher.customer_phone || '').trim();
    const name = String(selectedVoucher.customer_name || '').trim().toLowerCase();
    const byPhone = phone
      ? customers.find((c) => String(c.phone || '').trim() === phone)
      : undefined;
    if (byPhone) return { nrc: byPhone.nrc || '', address: byPhone.address || '' };
    const byName = name
      ? customers.find((c) => String(c.name || '').trim().toLowerCase() === name)
      : undefined;
    return { nrc: byName?.nrc || '', address: byName?.address || '' };
  }, [selectedVoucher, customers]);

  const purityDisplay = useMemo(() => {
    if (!selectedVoucher?.items?.length) return '—';
    const labels = Array.from(
      new Set(
        selectedVoucher.items.map(
          (i) => PURITY_LABELS[i.purity]?.mm || i.purity
        )
      )
    );
    return labels.join('၊ ');
  }, [selectedVoucher]);

  /** Per-purity gold prices on this voucher (for header summary). */
  const soldGoldPriceRows = useMemo(() => {
    if (!selectedVoucher?.items?.length) {
      const fallback = Number(selectedVoucher?.gold_price_snapshot || 0);
      return [{ label: 'ရွှေဈေး', price: fallback }];
    }
    const byPurity = new Map<string, number>();
    for (const item of selectedVoucher.items) {
      const key = String(item.purity || '');
      const label = PURITY_LABELS[item.purity as GoldPurity]?.mm || key || 'ရွှေ';
      let price = Number(item.gold_price_snapshot || 0);
      if (price <= 0) {
        price =
          goldPrices.find((p) => p.gold_type === item.purity)?.price_per_kyat ||
          Number(selectedVoucher.gold_price_snapshot || 0) ||
          0;
      }
      if (!byPurity.has(label)) byPurity.set(label, price);
    }
    return Array.from(byPurity.entries()).map(([label, price]) => ({
      label: `${label} ရွှေဈေး`,
      price,
    }));
  }, [selectedVoucher, goldPrices]);

  const resolveItemCode = (item: TransactionItem): string => {
    const fromItem = (item.barcode || '').trim();
    if (fromItem) return fromItem;
    if (!item.item_id) return '';
    const inv = inventory.find((i) => i.id === item.item_id);
    return (inv?.barcode || '').trim();
  };

  if (!selectedVoucher) return null;

  const isSale = selectedVoucher.transaction_type === 'SALE';
  const isPurchase = selectedVoucher.transaction_type === 'PURCHASE';
  const isShopOut = selectedVoucher.transaction_type === 'SHOP_OUT';
  const isOtherIn = selectedVoucher.transaction_type === 'OTHER_IN';
  const isExchange = selectedVoucher.transaction_type === 'EXCHANGE';
  const itemsSubtotal = selectedVoucher.items.reduce(
    (s, i) => s + Number(i.subtotal || 0),
    0
  );
  /** Exchange: new item vs trade-in — never sum both as "total due". */
  const exchangeNewSum = selectedVoucher.items
    .filter((i) => i.line_role !== 'TRADE_IN')
    .reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const exchangeTradeSum = selectedVoucher.items
    .filter((i) => i.line_role === 'TRADE_IN')
    .reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const exchangeBalance = exchangeNewSum - exchangeTradeSum;
  const exchangeCustomerPays = Math.max(0, Number(selectedVoucher.total_amount || 0) || Math.max(0, exchangeBalance));
  const exchangeRefund = Math.max(
    0,
    Number((selectedVoucher as { refund_amount?: number }).refund_amount || 0) ||
      Math.max(0, -exchangeBalance)
  );
  const isThaiSale =
    selectedVoucher.items.length > 0 &&
    selectedVoucher.items.every(
      (i) => i.item_type === 'THAI_GOLD' || i.purity === 'THAI_GOLD'
    );
  /** Thai txn may store BAHT (snapshot ~65k) or MMK (snapshot in millions). */
  const thaiSnapMax = selectedVoucher.items.reduce(
    (m, i) => Math.max(m, Number(i.gold_price_snapshot || 0)),
    0
  );
  const thaiAmountsInBaht = isThaiSale && thaiSnapMax > 0 && thaiSnapMax < 500_000;
  /** Per-item craft / stone for footer (0 when missing). Prefer line values, else inventory. */
  const itemFeeRows = (isExchange
    ? selectedVoucher.items.filter((i) => i.line_role !== 'TRADE_IN')
    : selectedVoucher.items
  ).map((item, idx) => {
    const inv = item.item_id ? inventory.find((i) => i.id === item.item_id) : undefined;
    const thai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
    const craftFromInvMmk = inv
      ? Number(inv.craftsmanship_fee || 0) + Number(inv.craftsmanship_profit_fee || 0)
      : 0;
    const craftFromInvBaht = inv
      ? Number(inv.craftsmanship_fee_baht || 0) +
        Number(inv.craftsmanship_profit_fee_baht || 0)
      : 0;
    const stoneFromInv = inv
      ? Number(inv.stone_price || 0) + Number(inv.stone_profit_price || 0)
      : 0;
    const lineCraft = Number(item.craftsmanship_fee || 0);
    const craft =
      lineCraft ||
      (thai && isThaiSale && thaiAmountsInBaht && craftFromInvBaht > 0
        ? craftFromInvBaht
        : craftFromInvMmk) ||
      0;
    const stone = Number(item.stone_price || 0) || stoneFromInv || 0;
    const label =
      String(item.item_name || '').trim() ||
      `ပစ္စည်း ${idx + 1}`;
    return { id: item.id, label, craft, stone };
  });
  const craftTotalDisplay =
    itemFeeRows.reduce((s, r) => s + r.craft, 0) ||
    Number(selectedVoucher.craftsmanship_total || 0) ||
    0;
  const stoneTotalDisplay =
    itemFeeRows.reduce((s, r) => s + r.stone, 0) ||
    Number(selectedVoucher.stone_total || 0) ||
    0;
  const bahtMmkRate = (() => {
    for (const item of selectedVoucher.items) {
      const inv = item.item_id ? inventory.find((i) => i.id === item.item_id) : undefined;
      const r = Number(inv?.baht_mmk_rate || 0);
      if (r > 0) return r;
    }
    return resolveBahtMmkRate(shopSettings);
  })();
  /** Voucher money: Thai gold → ฿ only; Myanmar → MMK only. */
  const formatVoucherMoney = (amount: number) => {
    if (isThaiSale) {
      const baht = thaiAmountsInBaht
        ? Number(amount || 0)
        : mmkToBaht(Number(amount || 0), bahtMmkRate);
      return formatBaht(baht);
    }
    return formatMMK(amount);
  };
  const formatItemMoney = (item: TransactionItem, amount: number) => {
    const thai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
    if (thai) {
      const snap = Number(item.gold_price_snapshot || 0);
      const inBaht = snap > 0 && snap < 500_000;
      const inv = item.item_id ? inventory.find((i) => i.id === item.item_id) : undefined;
      const rate =
        Number(inv?.baht_mmk_rate || 0) > 0
          ? Number(inv?.baht_mmk_rate)
          : bahtMmkRate;
      const baht = inBaht ? Number(amount || 0) : mmkToBaht(Number(amount || 0), rate);
      return formatBaht(baht);
    }
    return formatMMK(amount);
  };
  const shopOutThai = selectedVoucher.items.filter(
    (i) => i.item_type === 'THAI_GOLD' || i.purity === 'THAI_GOLD'
  );
  const shopOutMm = selectedVoucher.items.filter(
    (i) => !(i.item_type === 'THAI_GOLD' || i.purity === 'THAI_GOLD')
  );
  const shopOutThaiGrams = shopOutThai.reduce((s, i) => {
    const unit = Number(i.thai_weight_unit || 0);
    if (unit > 0) return s + unit;
    return s + kpyToGrams(i.net_weight || emptyKpy, kyatToGrams);
  }, 0);
  const totalBeforeDiscount = isExchange
    ? exchangeNewSum
    : Math.max(
        itemsSubtotal,
        Number(selectedVoucher.total_amount || 0) + Number(selectedVoucher.discount_amount || 0)
      );
  const dateStr = formatDate(selectedVoucher.created_at);

  const handlePrint = () => {
    window.print();
  };

  return (
    <ModalOverlay>
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-[1100px] w-full p-4 sm:p-7 shadow-2xl border border-gray-200 dark:border-gray-800 my-4 max-h-[94vh] overflow-y-auto print:max-w-none print:w-full print:p-0 print:m-0 print:max-h-none print:overflow-visible print:shadow-none print:border-0 print:rounded-none print:bg-white">
        {/* Top Action Header (Non-printable) */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#996515] dark:text-amber-300">
              <FileCheck className="w-4 h-4" />
            </span>
            <span className="font-bold text-gray-900 dark:text-white text-sm">
              {language === 'MM' ? 'အရောင်း / အဝယ် ဘောင်ချာ' : 'Sales / Buyback Voucher'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white text-xs font-bold hover:opacity-95 transition shadow-xs flex items-center space-x-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'MM' ? 'ပရင့်ထုတ်မည်' : 'Print'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedVoucher(null)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE VOUCHER — print: same layout, larger scale (~¾ A4) */}
        <div
          id="printable-voucher"
          className="printable-doc voucher-print-sheet mt-3 bg-[#FFFEF9] text-gray-900 border border-[#D4AF37]/50 shadow-inner overflow-hidden print:mt-0 print:border-0 print:shadow-none print:overflow-visible"
        >
          {/* Invoice meta only — no shop name / logo */}
          <div className="voucher-print-head px-5 py-3 border-b border-[#D4AF37]/50 bg-[#FAF3E0]/30 flex items-center justify-between gap-3 text-[11px]">
            <span className="font-bold text-gray-800">
              {isSale
                ? 'အရောင်းဘောင်ချာ'
                : isPurchase
                  ? 'အဝယ်ပြေစာ'
                  : isShopOut
                    ? 'ဆိုင်ထုတ်'
                    : isOtherIn
                      ? 'အခြားရွှေအဝင် ပြေစာ'
                      : selectedVoucher.transaction_type}
            </span>
            <span className="font-mono font-semibold text-gray-600">{selectedVoucher.invoice_no}</span>
          </div>

          <div className="voucher-print-body px-4 sm:px-5 py-4">
            <div className="voucher-print-main space-y-3">
            {isOtherIn ? (
              <>
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-end gap-2">
                    <span className="shrink-0 font-semibold text-gray-700 w-16">နေ့စွဲ</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 font-mono">
                      {dateStr}
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="shrink-0 font-semibold text-gray-700 w-16">ပေးသွင်းသူ</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 font-bold">
                      {selectedVoucher.customer_name || 'အခြားရွှေအဝင်'}
                    </span>
                  </div>
                </div>

                <div className="border border-amber-300 rounded-lg overflow-hidden mt-3">
                  <div className="bg-amber-900 text-amber-100 px-3 py-1.5 text-[11px] font-bold">
                    အခြားရွှေအဝင် ပစ္စည်းစာရင်း
                  </div>
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-amber-50">
                        <th className="border border-amber-200 px-2.5 py-1.5 text-left font-bold">ပစ္စည်းဖော်ပြချက်</th>
                        <th className="border border-amber-200 px-2.5 py-1.5 text-left font-bold">ရွှေအမျိုးအစား</th>
                        <th className="border border-amber-200 px-2.5 py-1.5 text-right font-bold">Gram ချိန်</th>
                        <th className="border border-amber-200 px-2.5 py-1.5 text-right font-bold">ကျပ်-ပဲ-ရွေး</th>
                        <th className="border border-amber-200 px-2.5 py-1.5 text-left font-bold">မှတ်ချက်</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVoucher.items.map((item) => {
                        const nw = item.net_weight || emptyKpy;
                        const g =
                          item.thai_weight_unit && Number(item.thai_weight_unit) > 0
                            ? Number(item.thai_weight_unit)
                            : kpyToGrams(nw, kyatToGrams);
                        const purityLbl = PURITY_LABELS[item.purity as GoldPurity]?.mm || item.purity;
                        return (
                          <tr key={item.id} className="border-b border-amber-100 last:border-0">
                            <td className="border border-amber-200 px-2.5 py-2 font-bold text-gray-900">
                              {item.item_name}
                            </td>
                            <td className="border border-amber-200 px-2.5 py-2 font-semibold text-amber-900">
                              {purityLbl}
                            </td>
                            <td className="border border-amber-200 px-2.5 py-2 text-right font-mono font-bold text-amber-800">
                              {g.toFixed(3)} g
                            </td>
                            <td className="border border-amber-200 px-2.5 py-2 text-right font-mono font-bold">
                              {formatKPYMyanmar(nw)}
                            </td>
                            <td className="border border-amber-200 px-2.5 py-2 italic text-gray-600">
                              {item.line_role || selectedVoucher.notes || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedVoucher.notes && (
                  <p className="italic text-gray-600 text-[11px] mt-2">
                    မှတ်ချက်: {selectedVoucher.notes}
                  </p>
                )}
              </>
            ) : isShopOut ? (
              <>
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-end gap-2">
                    <span className="shrink-0 font-semibold text-gray-700 w-14">နေ့စွဲ</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 font-mono">
                      {dateStr}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 pt-1">
                    ဆိုင်ရှိ ပစ္စည်းများကို မရောင်းဘဲ ဆိုင်ထုတ်အဖြစ် မှတ်တမ်းတင်ခြင်း
                  </p>
                </div>

                <div className="voucher-print-split grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-[#D4AF37]/50 rounded-lg overflow-hidden">
                    <div className="bg-[#1A1208] text-[#F5E6C8] px-3 py-1.5 text-[11px] font-bold">
                      ထိုင်းရွှေ ({shopOutThai.length})
                    </div>
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-[#FAF3E0]">
                          <th className="border border-[#D4AF37]/30 px-2 py-1 text-left">ပစ္စည်း</th>
                          <th className="border border-[#D4AF37]/30 px-2 py-1 text-left">မှတ်ချက်</th>
                          <th className="border border-[#D4AF37]/30 px-2 py-1 text-right">gram</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopOutThai.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-2 py-3 text-center text-gray-400">
                              —
                            </td>
                          </tr>
                        ) : (
                          shopOutThai.map((item) => {
                            const g =
                              Number(item.thai_weight_unit || 0) > 0
                                ? Number(item.thai_weight_unit)
                                : kpyToGrams(item.net_weight || emptyKpy, kyatToGrams);
                            const note =
                              item.line_role &&
                              item.line_role !== 'NEW_ITEM' &&
                              item.line_role !== 'TRADE_IN'
                                ? String(item.line_role)
                                : '—';
                            return (
                              <tr key={item.id}>
                                <td className="border border-[#D4AF37]/25 px-2 py-1.5 font-semibold">
                                  {item.item_name}
                                </td>
                                <td className="border border-[#D4AF37]/25 px-2 py-1.5 italic text-gray-600">
                                  {note}
                                </td>
                                <td className="border border-[#D4AF37]/25 px-2 py-1.5 text-right font-mono">
                                  {g.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        <tr className="bg-[#FFF8E7]">
                          <td
                            colSpan={2}
                            className="border border-[#D4AF37]/35 px-2 py-1.5 font-bold text-[#996515]"
                          >
                            စုစုပေါင်း gram
                          </td>
                          <td className="border border-[#D4AF37]/35 px-2 py-1.5 text-right font-mono font-extrabold text-[#996515]">
                            {shopOutThaiGrams.toFixed(2)} g
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="bg-slate-800 text-slate-100 px-3 py-1.5 text-[11px] font-bold">
                      မြန်မာရွှေ ({shopOutMm.length})
                    </div>
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-200 px-2 py-1 text-left">ပစ္စည်း</th>
                          <th className="border border-slate-200 px-2 py-1 text-left">မှတ်ချက်</th>
                          <th className="border border-slate-200 px-2 py-1 text-right">ချိန်</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopOutMm.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-2 py-3 text-center text-gray-400">
                              —
                            </td>
                          </tr>
                        ) : (
                          shopOutMm.map((item) => {
                            const note =
                              item.line_role &&
                              item.line_role !== 'NEW_ITEM' &&
                              item.line_role !== 'TRADE_IN'
                                ? String(item.line_role)
                                : '—';
                            const nw = item.net_weight || emptyKpy;
                            return (
                              <tr key={item.id}>
                                <td className="border border-slate-200 px-2 py-1.5 font-semibold">
                                  {item.item_name}
                                </td>
                                <td className="border border-slate-200 px-2 py-1.5 italic text-gray-600">
                                  {note}
                                </td>
                                <td className="border border-slate-200 px-2 py-1.5 text-right font-mono">
                                  {nw.kyat}က {nw.pae}ပ {nw.yway}ရ
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedVoucher.notes && (
                  <p className="italic text-gray-500 text-[11px]">မှတ်ချက်: {selectedVoucher.notes}</p>
                )}
              </>
            ) : (
              <>
            {/* Customer + Gold price */}
            <div className="voucher-print-split grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
              <div className="space-y-2 text-[13px]">
                <div className="flex items-end gap-2">
                  <span className="voucher-nowrap shrink-0 font-semibold text-gray-700 w-16 whitespace-nowrap">နေ့စွဲ</span>
                  <span className="voucher-nowrap flex-1 border-b border-dotted border-gray-400 pb-0.5 font-mono whitespace-nowrap">
                    {dateStr}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="voucher-nowrap shrink-0 font-semibold text-gray-700 w-16 whitespace-nowrap">အမည်</span>
                  <span className="voucher-nowrap flex-1 border-b border-dotted border-gray-400 pb-0.5 font-bold whitespace-nowrap">
                    {selectedVoucher.customer_name || '—'}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="voucher-nowrap shrink-0 font-semibold text-gray-700 w-16 whitespace-nowrap">မှတ်ပုံတင်</span>
                  <span className="voucher-nowrap flex-1 border-b border-dotted border-gray-400 pb-0.5 font-mono whitespace-nowrap">
                    {customerExtra.nrc || '—'}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="voucher-nowrap shrink-0 font-semibold text-gray-700 w-16 whitespace-nowrap">ဖုန်း</span>
                  <span className="voucher-nowrap flex-1 border-b border-dotted border-gray-400 pb-0.5 font-mono whitespace-nowrap">
                    {selectedVoucher.customer_phone || '—'}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="voucher-nowrap shrink-0 font-semibold text-gray-700 w-16 whitespace-nowrap">နေရပ်</span>
                  <span className="voucher-wrap flex-1 border-b border-dotted border-gray-400 pb-0.5">
                    {customerExtra.address || '—'}
                  </span>
                </div>
              </div>

              <table className="text-[11px] border border-[#D4AF37]/60 border-collapse min-w-[200px] self-start print:min-w-0 print:w-full">
                <tbody>
                  <tr>
                    <td className="voucher-nowrap border border-[#D4AF37]/40 px-2 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                      ရွှေရည်
                    </td>
                    <td className="voucher-nowrap border border-[#D4AF37]/40 px-2 py-1.5 font-bold text-right text-[#996515] whitespace-nowrap">
                      {purityDisplay}
                    </td>
                  </tr>
                  {soldGoldPriceRows.map((row) => (
                    <tr key={row.label}>
                      <td className="voucher-nowrap border border-[#D4AF37]/40 px-2 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                        {row.label}
                      </td>
                      <td className="voucher-money border border-[#D4AF37]/40 px-2 py-1.5 font-mono font-bold text-right whitespace-nowrap">
                        {isThaiSale
                          ? formatBaht(
                              thaiAmountsInBaht
                                ? Number(row.price || 0)
                                : mmkToBaht(Number(row.price || 0), bahtMmkRate)
                            )
                          : formatMMK(row.price || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Main items table */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse text-[12px] voucher-main-table">
                <thead>
                  <tr className="bg-[#1A1208] text-[#F5E6C8]">
                    <th className="voucher-th voucher-nowrap w-8 whitespace-nowrap">No.</th>
                    <th className="voucher-th voucher-nowrap text-center whitespace-nowrap">
                      Item Code
                    </th>
                    <th className="voucher-th voucher-nowrap text-left whitespace-nowrap">ပစ္စည်းအမျိုးအစား</th>
                    <th className="voucher-th voucher-nowrap text-left whitespace-nowrap">အကြောင်းအရာ</th>
                    <th className="voucher-th voucher-nowrap w-14 whitespace-nowrap">ဂရမ်</th>
                    <th className="voucher-th voucher-nowrap w-12 whitespace-nowrap">ကျပ်</th>
                    <th className="voucher-th voucher-nowrap w-12 whitespace-nowrap">ပဲ</th>
                    <th className="voucher-th voucher-nowrap w-12 whitespace-nowrap">ရွေး</th>
                    <th className="voucher-th voucher-money text-right whitespace-nowrap">သင့်ငွေ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVoucher.items.map((item, idx) => (
                    <ItemWeightBlock
                      key={item.id}
                      item={item}
                      index={idx}
                      kyatToGrams={kyatToGrams}
                      itemCode={resolveItemCode(item)}
                      formatAmount={(n) => formatItemMoney(item, n)}
                    />
                  ))}
                  {/* pad empty look if few items */}
                  {selectedVoucher.items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="voucher-cell text-center text-gray-400 py-6">
                        ပစ္စည်းမရှိပါ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom: terms + totals */}
            <div className="voucher-print-split grid grid-cols-1 sm:grid-cols-[1.2fr_0.9fr] gap-4 pt-1">
              <div className="voucher-wrap text-[10px] text-gray-600 space-y-2 leading-relaxed">
                <p>
                  * ဈေးနှုန်း၊ အလေးချိန် မှန်ကန်ပါကြောင်း အာမခံသည်။
                </p>
                <p>
                  * ပြန်လည်ရောင်းချလိုပါက အလျော့တွက်၊ လက်ခ၊ ကျောက်ဖိုး နှုတ်ပြီး
                  ပေါက်ဈေးအတိုင်း ပြန်လည်ဝယ်ယူပါသည်။
                </p>
                <p className="pt-2 font-semibold text-[#996515] text-[11px]">
                  မိတ်ဟောင်း၊ မိတ်သစ်များအား လှိုက်လှဲစွာ ကျေးဇူးတင်ပါသည်။
                </p>
                {selectedVoucher.notes && (
                  <p className="italic text-gray-500 pt-1">မှတ်ချက်: {selectedVoucher.notes}</p>
                )}
              </div>

              <table className="voucher-totals-table w-full text-[11px] border border-[#D4AF37]/50 border-collapse self-start">
                <tbody>
                  {isExchange ? (
                    <>
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                          အသစ်ပစ္စည်း တန်ဖိုး
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                          {formatVoucherMoney(exchangeNewSum)}
                        </td>
                      </tr>
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold text-sky-800 whitespace-nowrap">
                          ပြန်သွင်းပစ္စည်း (လဲခ)
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold text-sky-800 whitespace-nowrap">
                          −{formatVoucherMoney(exchangeTradeSum)}
                        </td>
                      </tr>
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                          ခြားနားချက်
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                          {exchangeBalance >= 0
                            ? formatVoucherMoney(exchangeBalance)
                            : `−${formatVoucherMoney(Math.abs(exchangeBalance))}`}
                        </td>
                      </tr>
                      {Number(selectedVoucher.discount_amount || 0) > 0 && (
                        <tr>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold text-rose-700 whitespace-nowrap">
                            လျော့ငွေ
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                            −{formatVoucherMoney(selectedVoucher.discount_amount)}
                          </td>
                        </tr>
                      )}
                      {exchangeRefund > 0 ? (
                        <tr>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-emerald-900 text-emerald-50 font-bold whitespace-nowrap">
                            ဧည့်သည်ပြန်ရမည်
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50 whitespace-nowrap">
                            {formatVoucherMoney(exchangeRefund)}
                          </td>
                        </tr>
                      ) : exchangeCustomerPays > 0 ? (
                        <tr>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#1A1208] text-[#F5E6C8] font-bold whitespace-nowrap">
                            ဧည့်သည်ပေးရမည်
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-extrabold text-[#996515] bg-[#FFF8E7] whitespace-nowrap">
                            {formatVoucherMoney(exchangeCustomerPays)}
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#1A1208] text-[#F5E6C8] font-bold whitespace-nowrap">
                            ငွေပေးရန် / ပြန်ရန်
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-extrabold text-[#996515] bg-[#FFF8E7] whitespace-nowrap">
                            {formatVoucherMoney(0)} (တူညီ)
                          </td>
                        </tr>
                      )}
                    </>
                  ) : isThaiSale ? (
                    <>
                      {itemFeeRows.map((row) => (
                        <tr key={`craft-${row.id}`}>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                            လက်ခ · {row.label}
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                            {formatVoucherMoney(row.craft)}
                          </td>
                        </tr>
                      ))}
                      {itemFeeRows.length > 1 && (
                        <tr>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                            လက်ခ စုစုပေါင်း
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                            {formatVoucherMoney(craftTotalDisplay)}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                          စုစုပေါင်းကျငွေ
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                          {formatVoucherMoney(totalBeforeDiscount)}
                        </td>
                      </tr>
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold text-rose-700 whitespace-nowrap">
                          လျော့ငွေ
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          {Number(selectedVoucher.discount_amount || 0) > 0
                            ? `−${formatVoucherMoney(selectedVoucher.discount_amount)}`
                            : formatVoucherMoney(0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#1A1208] text-[#F5E6C8] font-bold whitespace-nowrap">
                          ကျသင့်ငွေ
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-extrabold text-[#996515] bg-[#FFF8E7] whitespace-nowrap">
                          {formatVoucherMoney(selectedVoucher.total_amount)}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <>
                      {itemFeeRows.map((row) => (
                        <tr key={`craft-${row.id}`}>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                            လက်ခ · {row.label}
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                            {formatMMK(row.craft)}
                          </td>
                        </tr>
                      ))}
                      {itemFeeRows.length > 1 && (
                        <tr>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                            လက်ခ စုစုပေါင်း
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                            {formatMMK(craftTotalDisplay)}
                          </td>
                        </tr>
                      )}
                      {itemFeeRows.map((row) => (
                        <tr key={`stone-${row.id}`}>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                            ကျောက်ဖိုး · {row.label}
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                            {formatMMK(row.stone)}
                          </td>
                        </tr>
                      ))}
                      {itemFeeRows.length > 1 && (
                        <tr>
                          <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                            ကျောက်ဖိုး စုစုပေါင်း
                          </td>
                          <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                            {formatMMK(stoneTotalDisplay)}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold whitespace-nowrap">
                          စုစုပေါင်းကျငွေ
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                          {formatMMK(totalBeforeDiscount)}
                        </td>
                      </tr>
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#FAF3E0] font-semibold text-rose-700 whitespace-nowrap">
                          လျော့ငွေ
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          {Number(selectedVoucher.discount_amount || 0) > 0
                            ? `−${formatMMK(selectedVoucher.discount_amount)}`
                            : formatMMK(0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="voucher-nowrap border border-[#D4AF37]/35 px-2.5 py-1.5 bg-[#1A1208] text-[#F5E6C8] font-bold whitespace-nowrap">
                          ကျသင့်ငွေ
                        </td>
                        <td className="voucher-money border border-[#D4AF37]/35 px-2.5 py-1.5 text-right font-mono font-extrabold text-[#996515] bg-[#FFF8E7] whitespace-nowrap">
                          {formatMMK(selectedVoucher.total_amount)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
              </>
            )}
            </div>

            {!isShopOut && (
            <div className="voucher-print-foot grid grid-cols-2 gap-4 sm:gap-8 pt-8 pb-2 text-center text-[11px] print:gap-6 print:pt-8">
              <div>
                <div className="h-10 print:h-12" />
                <div className="border-t border-dotted border-gray-500 mx-2 sm:mx-4 pt-1.5 font-semibold text-gray-800">
                  ဝယ်သူလက်မှတ်
                </div>
              </div>
              <div>
                <div className="h-10 print:h-12" />
                <div className="border-t border-dotted border-gray-500 mx-2 sm:mx-4 pt-1.5 font-semibold text-gray-800">
                  အရောင်းဌာန
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};
