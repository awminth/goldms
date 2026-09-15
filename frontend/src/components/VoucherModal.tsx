import React from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  formatMMK,
  formatKPYMyanmar,
  formatKPYEnglish,
  PURITY_LABELS,
} from '../utils/goldCalculations';
import {
  Printer,
  X,
  Sparkles,
  ShieldCheck,
  Phone,
  MapPin,
  FileCheck,
} from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';

export const VoucherModal: React.FC = () => {
  const { selectedVoucher, setSelectedVoucher, language } = useGoldShop();

  if (!selectedVoucher) return null;

  const isSale = selectedVoucher.transaction_type === 'SALE';

  const handlePrint = () => {
    window.print();
  };

  return (
    <ModalOverlay>
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-gray-200 dark:border-gray-800 my-6 max-h-[90vh] overflow-y-auto">
        
        {/* Top Action Header (Non-printable) */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#996515] dark:text-amber-300">
              <FileCheck className="w-4 h-4" />
            </span>
            <span className="font-bold text-gray-900 dark:text-white text-sm">
              {language === 'MM' ? 'တရားဝင် အရောင်း/အဝယ် ဘောင်ချာ' : 'Official Jewelry Invoice / Voucher'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white text-xs font-bold hover:opacity-95 transition shadow-xs flex items-center space-x-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'MM' ? 'ဘောင်ချာ ပရင့်ထုတ်မည်' : 'Print Voucher'}</span>
            </button>
            <button
              onClick={() => setSelectedVoucher(null)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE VOUCHER CONTAINER */}
        <div id="printable-voucher" className="mt-4 p-6 sm:p-8 bg-[#FAF8F2] border-2 border-[#D4AF37]/40 rounded-2xl text-gray-900 font-sans shadow-inner">
          
          {/* Shop Header */}
          <div className="text-center border-b-2 border-[#D4AF37]/30 pb-4">
            <div className="inline-block px-3 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#996515] text-[11px] font-bold tracking-widest uppercase mb-1">
              ရွှေပြည့်လှိုင် • SHWE PYAE HLAING
            </div>
            <h1 className="text-2xl font-extrabold text-[#996515] tracking-wide font-serif">
              ရွှေပြည့်လှိုင် အာမခံရတနာရွှေဆိုင်
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              အမှတ် (၁၂၈)၊ မဟာဗန္ဓုလလမ်း၊ ကျောက်တံတားမြို့နယ်၊ ရန်ကုန်မြို့။
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs font-mono text-gray-600 mt-1">
              <span>ဖုန်း: 09-977889900, 09-798887766</span>
              <span>•</span>
              <span>Viber: 09-977889900</span>
            </div>
          </div>

          {/* Invoice Metadata */}
          <div className="grid grid-cols-2 gap-4 my-4 text-xs border-b border-gray-300 pb-4">
            <div>
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">ဘောင်ချာအမှတ်:</span>
                <span className="font-mono font-bold text-gray-900 text-sm">{selectedVoucher.invoice_no}</span>
              </div>
              <div className="flex items-center space-x-1 mt-1">
                <span className="text-gray-500">ရက်စွဲ/အချိန်:</span>
                <span className="font-mono">{new Date(selectedVoucher.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1 mt-1">
                <span className="text-gray-500">အမျိုးအစား:</span>
                <span className="font-bold text-[#996515] uppercase">
                  {selectedVoucher.transaction_type === 'SALE' ? 'အရောင်းဘောင်ချာ (Sales)' : 'အဝယ်ပြေစာ (Buyback)'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="flex justify-end items-center space-x-1">
                <span className="text-gray-500">ဖောက်သည်:</span>
                <span className="font-bold text-gray-900 text-sm">{selectedVoucher.customer_name}</span>
              </div>
              <div className="flex justify-end items-center space-x-1 mt-1">
                <span className="text-gray-500">ဖုန်းနံပါတ်:</span>
                <span className="font-mono">{selectedVoucher.customer_phone || '-'}</span>
              </div>
              <div className="flex justify-end items-center space-x-1 mt-1">
                <span className="text-gray-500">ငွေပေးချေမှု:</span>
                <span className="font-mono font-bold text-emerald-800">{selectedVoucher.payment_method}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto my-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#D4AF37]/50 text-gray-700 uppercase font-bold text-[10px]">
                  <th className="py-2 px-2">စဉ်</th>
                  <th className="py-2 px-2">ရွှေထည်အမည် / ဖော်ပြချက်</th>
                  <th className="py-2 px-2">ရွှေရည်</th>
                  <th className="py-2 px-2">အထည်ချိန်</th>
                  <th className="py-2 px-2">ရွှေချိန်စင်</th>
                  <th className="py-2 px-2">လက်ခ</th>
                  <th className="py-2 px-2 text-right">ကျသင့်ငွေ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {selectedVoucher.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-2.5 px-2 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-2 font-bold text-gray-900">{item.item_name}</td>
                    <td className="py-2.5 px-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#996515] font-bold text-[10px]">
                        {PURITY_LABELS[item.purity]?.mm || item.purity}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono">{formatKPYMyanmar(item.weight)}</td>
                    <td className="py-2.5 px-2 font-mono font-bold text-emerald-800">
                      {formatKPYMyanmar(item.net_weight)}
                    </td>
                    <td className="py-2.5 px-2 font-mono">{formatMMK(item.craftsmanship_fee)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-gray-900">
                      {formatMMK(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-[#D4AF37]/30 text-xs">
            
            {/* Notes & Gold Rate Snapshot */}
            <div className="space-y-1 text-[11px] text-gray-600">
              <div className="flex items-center space-x-1">
                <span className="font-semibold">တွက်ချက်သည့် ရွှေပေါက်ဈေး:</span>
                <span className="font-mono font-bold text-gray-900">{formatMMK(selectedVoucher.gold_price_snapshot)} / ကျပ်</span>
              </div>
              {selectedVoucher.notes && (
                <div className="italic text-gray-500 pt-1">
                  မှတ်ချက်: {selectedVoucher.notes}
                </div>
              )}
            </div>

            {/* Subtotal / Discount / Grand Total / Balance */}
            <div className="space-y-1.5 text-right font-mono">
              {selectedVoucher.craftsmanship_total > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>လက်ခ စုစုပေါင်း:</span>
                  <span>{formatMMK(selectedVoucher.craftsmanship_total)}</span>
                </div>
              )}

              {selectedVoucher.discount_amount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>လျော့ပေါ့ငွေ:</span>
                  <span>-{formatMMK(selectedVoucher.discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-extrabold text-gray-900 border-t border-gray-300 pt-1">
                <span>ကျသင့်ငွေ စုစုပေါင်း:</span>
                <span className="text-[#996515]">{formatMMK(selectedVoucher.total_amount)}</span>
              </div>

              <div className="flex justify-between text-emerald-800 font-bold">
                <span>ပေးချေပြီးငွေ:</span>
                <span>{formatMMK(selectedVoucher.paid_amount)}</span>
              </div>

              {selectedVoucher.remaining_amount > 0 && (
                <div className="flex justify-between text-rose-600 font-bold border-t border-dashed border-gray-300 pt-1">
                  <span>ကျန်ငွေ (Credit Due):</span>
                  <span>{formatMMK(selectedVoucher.remaining_amount)}</span>
                </div>
              )}
            </div>

          </div>

          {/* Terms and Signatures */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-[10px] text-gray-600 space-y-2">
            <div className="text-center font-bold text-[#996515]">
              * ရွှေပြည့်လှိုင်မှ ဝယ်ယူသော ရွှေထည်များအား ရွှေချိန်စင်အလေးချိန်အတိုင်း နေ့စဉ်ပေါက်ဈေးဖြင့် ပြန်လည်ဝယ်ယူ/လဲလှယ်ပေးပါသည် *
            </div>

            <div className="grid grid-cols-2 pt-8 text-center text-xs">
              <div className="border-t border-dashed border-gray-400 mx-8 pt-1">
                ဝယ်ယူသူလက်မှတ် (Customer Signature)
              </div>
              <div className="border-t border-dashed border-gray-400 mx-8 pt-1 font-bold text-gray-900">
                တာဝန်ခံလက်မှတ် (Authorized Signature)
              </div>
            </div>
          </div>

        </div>

      </div>
    </ModalOverlay>
  );
};
