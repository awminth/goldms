import React from 'react';
import { Plus } from 'lucide-react';
import { GoldPurity } from '../types/gold';
import {
  formatMMK,
  formatKPYMyanmar,
  formatKPYEnglish,
  generateBarcode,
  PURITY_LABELS,
  THAI_GRAM_PRESETS,
} from '../utils/goldCalculations';
import { NumberInput } from './NumberInput';
import type { InventoryItemFormApi } from '../hooks/useInventoryItemForm';

type Props = {
  form: InventoryItemFormApi;
};

/** Exact inventory add/edit field body (Myanmar + Thai). Shared by InventoryView & Goldsmith OLD_GOLD return. */
export const InventoryItemFormFields: React.FC<Props> = ({ form }) => {
  const {
    language,
    isThaiEntry,
    CATEGORIES,
    categoryGroups,
    formBarcode,
    setFormBarcode,
    formName,
    setFormName,
    formNameMM,
    setFormNameMM,
    formCategory,
    setFormCategory,
    formPurity,
    setFormPurity,
    formGrossGrams,
    formGrossKyat,
    formGrossPae,
    formGrossYway,
    formGemGrams,
    formGemKyat,
    formGemPae,
    formGemYway,
    formCraftDedGrams,
    formCraftDedPae,
    formCraftDedYway,
    formProfitDedGrams,
    formProfitDedPae,
    formProfitDedYway,
    formThaiGrams,
    showCustomThaiGram,
    setShowCustomThaiGram,
    formCraftsmanship,
    setFormCraftsmanship,
    formCraftProfit,
    setFormCraftProfit,
    formStonePrice,
    setFormStonePrice,
    formStoneProfit,
    setFormStoneProfit,
    applyGrossFromGrams,
    applyGrossFromKpy,
    applyGemFromGrams,
    applyGemFromKpy,
    applyPaeYwayFromGrams,
    applyGramsFromPaeYway,
    applyThaiGrams,
    totalWasteKpy,
    totalWasteGrams,
    mmCraftTotal,
    mmStoneTotal,
    computedNet,
    thaiCraftTotalBaht,
    thaiBahtBreakdown,
    estimatedTotalSelling,
    valuation,
    fmtBaht,
    thaiBahtRate,
    setFormCraftDedGrams,
    setFormCraftDedPae,
    setFormCraftDedYway,
    setFormProfitDedGrams,
    setFormProfitDedPae,
    setFormProfitDedYway,
  } = form;

  return (
    <div className="space-y-4">
      {/* Row 1: Barcode & Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {language === 'MM' ? 'ဘားကုဒ်နံပါတ် (Barcode):' : 'Barcode ID:'}
          </label>
          <div className="flex space-x-1.5">
            <input
              type="text"
              required
              value={formBarcode}
              onChange={(e) => setFormBarcode(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => setFormBarcode(generateBarcode())}
              className="px-2.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl hover:bg-gray-200"
            >
              Gen
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {language === 'MM' ? 'အမျိုးအစား (Category):' : 'Category:'}
          </label>
          {isThaiEntry ? (
            <div className="px-3 py-2 text-xs font-bold rounded-xl border border-[#D4AF37]/40 bg-[#FAF8F2] dark:bg-[#201D17] text-[#996515] dark:text-amber-300">
              {language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold'}
            </div>
          ) : (
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
            >
              {categoryGroups.map((g) => {
                const opts = CATEGORIES.filter((c) => c.group === g);
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
                      <option key={c.id} value={c.id}>
                        {language === 'MM' ? c.mm : c.en}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* Row 2: Names */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {language === 'MM' ? 'မြန်မာအမည် (ဥပမာ- နဂါးလိမ်ဆွဲကြိုး):' : 'Item Name (Myanmar):'}
          </label>
          <input
            type="text"
            required
            placeholder="ရွှေဆွဲကြိုး"
            value={formNameMM}
            onChange={(e) => setFormNameMM(e.target.value)}
            className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {language === 'MM' ? 'အင်္ဂလိပ်အမည် (English Name):' : 'English Name:'}
          </label>
          <input
            type="text"
            placeholder="Gold Necklace"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
          />
        </div>
      </div>

      {/* Row 3: Gold type + Purity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {language === 'MM' ? 'ရွှေအမျိုးအစား:' : 'Gold type:'}
          </label>
          <div
            className={`px-3 py-2 rounded-xl text-xs font-bold border ${
              isThaiEntry
                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-[#FAF8F2] dark:bg-[#201D17] border-[#D4AF37]/40 text-[#996515] dark:text-amber-300'
            }`}
          >
            {isThaiEntry
              ? language === 'MM'
                ? 'ထိုင်းရွှေ'
                : 'Thai Gold'
              : language === 'MM'
                ? 'မြန်မာရွှေ'
                : 'Myanmar Gold'}
          </div>
        </div>
        {!isThaiEntry && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {language === 'MM' ? 'ရွှေရည် / အရည်အသွေး (Purity):' : 'Purity Standard:'}
            </label>
            <select
              value={formPurity}
              onChange={(e) => setFormPurity(e.target.value as GoldPurity)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
            >
              {Object.entries(PURITY_LABELS)
                .filter(([k]) => k !== 'THAI_GOLD')
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {language === 'MM' ? v.mm : v.en}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Weight Tracking */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-3">
        {isThaiEntry ? (
          <>
            <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
              {language === 'MM' ? 'ထိုင်းရွှေ Gram ယူနစ်' : 'Thai Gold — Gram units'}
            </div>
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {THAI_GRAM_PRESETS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setShowCustomThaiGram(false);
                        applyThaiGrams(g);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                        !showCustomThaiGram && formThaiGrams === g
                          ? 'bg-[#D4AF37] text-white border-transparent'
                          : 'bg-white dark:bg-[#1A1A1A] border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      {g} g
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCustomThaiGram(true)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-dashed border-[#D4AF37] text-[#996515] flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Gram
                  </button>
                </div>
                {(showCustomThaiGram ||
                  !(THAI_GRAM_PRESETS as readonly number[]).includes(formThaiGrams)) && (
                  <div className="max-w-[160px]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">Custom Gram</label>
                    <NumberInput
                      min={0}
                      step={0.001}
                      value={formThaiGrams}
                      onChange={applyThaiGrams}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                )}
                <div className="text-[11px] text-gray-500">
                  {language === 'MM'
                    ? `ရွေးချယ်ထား = ${formThaiGrams} g · ထိုင်းရွှေနှုန်း ${fmtBaht(thaiBahtRate)} / ကျပ်`
                    : `Selected = ${formThaiGrams} g · Thai rate ${fmtBaht(thaiBahtRate)} / kyat`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'အရင်းလက်ခ (ဘတ်)' : 'Cost craft (฿)'}
                  </label>
                  <NumberInput
                    min={0}
                    step={1}
                    value={formCraftsmanship}
                    onChange={setFormCraftsmanship}
                    className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'အမြတ်လက်ခ (ဘတ်)' : 'Profit craft (฿)'}
                  </label>
                  <NumberInput
                    min={0}
                    step={1}
                    value={formCraftProfit}
                    onChange={setFormCraftProfit}
                    className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'စုစုပေါင်းလက်ခ (ဘတ်)' : 'Total craft (฿)'}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={fmtBaht(thaiCraftTotalBaht)}
                    className="w-full px-3 py-2 text-sm font-extrabold rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {language === 'MM' ? 'ရွှေချိန် (Net)' : 'Net Weight'}
              </span>
              <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                {formThaiGrams} g
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
              <span>{language === 'MM' ? '၁။ အထည်ချိန် (Gross Weight)' : '1. Gross Weight'}</span>
              <span className="text-gray-400 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
            </div>
            <div className="flex flex-wrap items-end gap-y-2">
              <div className="w-[7.5rem]">
                <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                <NumberInput
                  min={0}
                  step={0.001}
                  value={formGrossGrams}
                  onChange={applyGrossFromGrams}
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
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
                    value={formGrossKyat}
                    onChange={(v) =>
                      applyGrossFromKpy({ kyat: v, pae: formGrossPae, yway: formGrossYway })
                    }
                    className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                  />
                </div>
                <div className="w-[4.5rem]">
                  <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                  <NumberInput
                    min={0}
                    max={15}
                    value={formGrossPae}
                    onChange={(v) =>
                      applyGrossFromKpy({ kyat: formGrossKyat, pae: v, yway: formGrossYway })
                    }
                    className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                  />
                </div>
                <div className="w-[4.5rem]">
                  <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                  <NumberInput
                    min={0}
                    step={0.1}
                    value={formGrossYway}
                    onChange={(v) =>
                      applyGrossFromKpy({ kyat: formGrossKyat, pae: formGrossPae, yway: v })
                    }
                    className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="text-xs font-bold text-sky-700 dark:text-sky-300 mb-2 flex items-center justify-between">
                <span>{language === 'MM' ? '၂။ ကျောက်ချိန်' : '2. Gemstone'}</span>
                <span className="text-gray-400 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
              </div>
              <div className="flex flex-wrap items-end gap-y-2">
                <div className="w-[7.5rem]">
                  <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                  <NumberInput
                    min={0}
                    step={0.001}
                    value={formGemGrams}
                    onChange={applyGemFromGrams}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
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
                      value={formGemKyat}
                      onChange={(v) =>
                        applyGemFromKpy({ kyat: v, pae: formGemPae, yway: formGemYway })
                      }
                      className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                  <div className="w-[4.5rem]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                    <NumberInput
                      min={0}
                      value={formGemPae}
                      onChange={(v) =>
                        applyGemFromKpy({ kyat: formGemKyat, pae: v, yway: formGemYway })
                      }
                      className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                  <div className="w-[4.5rem]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                    <NumberInput
                      min={0}
                      step={0.1}
                      value={formGemYway}
                      onChange={(v) =>
                        applyGemFromKpy({ kyat: formGemKyat, pae: formGemPae, yway: v })
                      }
                      className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                {language === 'MM' ? '၃။ အလျော့တွက်' : '3. Wastage'}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-lg border border-rose-200/70 dark:border-rose-900/40 p-2.5 space-y-1.5">
                  <div className="text-[11px] font-semibold text-rose-500">
                    {language === 'MM' ? 'ပန်းထိမ်အလျော့တွက်' : 'Craft wastage'}
                  </div>
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                    <div className="w-[6.5rem]">
                      <label className="text-[10px] text-gray-500 block mb-0.5">Gram</label>
                      <NumberInput
                        min={0}
                        step={0.001}
                        value={formCraftDedGrams}
                        onChange={(v) =>
                          applyPaeYwayFromGrams(
                            v,
                            setFormCraftDedGrams,
                            setFormCraftDedPae,
                            setFormCraftDedYway
                          )
                        }
                        className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="hidden sm:block w-px self-stretch bg-gray-200 dark:bg-gray-700" />
                    <div className="w-[4rem]">
                      <label className="text-[10px] text-gray-500 block mb-0.5">ပဲ</label>
                      <NumberInput
                        min={0}
                        value={formCraftDedPae}
                        onChange={(v) =>
                          applyGramsFromPaeYway(
                            v,
                            formCraftDedYway,
                            setFormCraftDedPae,
                            setFormCraftDedYway,
                            setFormCraftDedGrams
                          )
                        }
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="w-[4rem]">
                      <label className="text-[10px] text-gray-500 block mb-0.5">ရွေး</label>
                      <NumberInput
                        min={0}
                        step={0.1}
                        value={formCraftDedYway}
                        onChange={(v) =>
                          applyGramsFromPaeYway(
                            formCraftDedPae,
                            v,
                            setFormCraftDedPae,
                            setFormCraftDedYway,
                            setFormCraftDedGrams
                          )
                        }
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200/70 dark:border-rose-900/40 p-2.5 space-y-1.5">
                  <div className="text-[11px] font-semibold text-rose-500">
                    {language === 'MM' ? 'အမြတ်အလျော့တွက်' : 'Profit wastage'}
                  </div>
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                    <div className="w-[6.5rem]">
                      <label className="text-[10px] text-gray-500 block mb-0.5">Gram</label>
                      <NumberInput
                        min={0}
                        step={0.001}
                        value={formProfitDedGrams}
                        onChange={(v) =>
                          applyPaeYwayFromGrams(
                            v,
                            setFormProfitDedGrams,
                            setFormProfitDedPae,
                            setFormProfitDedYway
                          )
                        }
                        className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="hidden sm:block w-px self-stretch bg-gray-200 dark:bg-gray-700" />
                    <div className="w-[4rem]">
                      <label className="text-[10px] text-gray-500 block mb-0.5">ပဲ</label>
                      <NumberInput
                        min={0}
                        value={formProfitDedPae}
                        onChange={(v) =>
                          applyGramsFromPaeYway(
                            v,
                            formProfitDedYway,
                            setFormProfitDedPae,
                            setFormProfitDedYway,
                            setFormProfitDedGrams
                          )
                        }
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="w-[4rem]">
                      <label className="text-[10px] text-gray-500 block mb-0.5">ရွေး</label>
                      <NumberInput
                        min={0}
                        step={0.1}
                        value={formProfitDedYway}
                        onChange={(v) =>
                          applyGramsFromPaeYway(
                            formProfitDedPae,
                            v,
                            setFormProfitDedPae,
                            setFormProfitDedYway,
                            setFormProfitDedGrams
                          )
                        }
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
                  <span>{language === 'MM' ? 'စုစုပေါင်းအလျော့တွက်' : 'Total wastage'}</span>
                  <span className="text-rose-400/80 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
                </div>
                <div className="flex flex-wrap items-end gap-y-2">
                  <div className="w-[7.5rem]">
                    <label className="text-[11px] text-rose-500/80 block mb-0.5">Gram</label>
                    <input
                      type="text"
                      readOnly
                      value={totalWasteGrams}
                      className="w-full px-2.5 py-1.5 text-xs font-extrabold rounded-lg border border-rose-300 dark:border-rose-800 bg-white/80 dark:bg-[#1A1A1A] text-rose-800 dark:text-rose-200 font-mono"
                    />
                  </div>
                  <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                  <div className="hidden sm:block w-px self-stretch bg-rose-300 dark:bg-rose-700 my-1" />
                  <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                  <div className="flex flex-wrap gap-1.5">
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-rose-500/80 block mb-0.5">ကျပ်</label>
                      <input
                        type="text"
                        readOnly
                        value={totalWasteKpy.kyat}
                        className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-rose-300 dark:border-rose-800 bg-white/80 dark:bg-[#1A1A1A] text-rose-800 dark:text-rose-200 font-mono"
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-rose-500/80 block mb-0.5">ပဲ</label>
                      <input
                        type="text"
                        readOnly
                        value={totalWasteKpy.pae}
                        className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-rose-300 dark:border-rose-800 bg-white/80 dark:bg-[#1A1A1A] text-rose-800 dark:text-rose-200 font-mono"
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-rose-500/80 block mb-0.5">ရွေး</label>
                      <input
                        type="text"
                        readOnly
                        value={totalWasteKpy.yway}
                        className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-rose-300 dark:border-rose-800 bg-white/80 dark:bg-[#1A1A1A] text-rose-800 dark:text-rose-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'အရင်းလက်ခ' : 'Cost craft'}
                  </label>
                  <NumberInput
                    step={1000}
                    value={formCraftsmanship}
                    onChange={setFormCraftsmanship}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'အမြတ်လက်ခ' : 'Profit craft'}
                  </label>
                  <NumberInput
                    step={1000}
                    value={formCraftProfit}
                    onChange={setFormCraftProfit}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'စုစုပေါင်းလက်ခ' : 'Total craft'}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formatMMK(mmCraftTotal)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'ကျောက်ဖိုးအရင်း' : 'Stone cost'}
                  </label>
                  <NumberInput
                    step={500}
                    value={formStonePrice}
                    onChange={setFormStonePrice}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'ကျောက်ဖိုးအမြတ်' : 'Stone profit'}
                  </label>
                  <NumberInput
                    step={500}
                    value={formStoneProfit}
                    onChange={setFormStoneProfit}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                    {language === 'MM' ? 'ကျောက်ဖိုးစုစုပေါင်း' : 'Total stone'}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formatMMK(mmStoneTotal)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {language === 'MM'
                  ? '၄။ ရွှေချိန် (Net) = (အထည် − ကျောက်) + စုစုပေါင်းအလျော့တွက်'
                  : '4. Net = (Gross − Gem) + Total wastage'}
              </span>
              <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                {language === 'MM' ? formatKPYMyanmar(computedNet) : formatKPYEnglish(computedNet)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Total Summary Footer */}
      <div className="p-3 rounded-xl bg-[#FAF8F2] dark:bg-[#221F18] border border-[#D4AF37]/30 flex items-center justify-between">
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 block">
            {isThaiEntry
              ? language === 'MM'
                ? 'ထိုင်းရွှေပေါက်ဈေးဖြင့် ခန့်မှန်းရောင်းဈေး (ဘတ်):'
                : 'Estimated selling price (Baht):'
              : language === 'MM'
                ? 'ယနေ့ပေါက်ဈေးဖြင့် ခန့်မှန်းရောင်းဈေး:'
                : 'Estimated Selling Price:'}
          </span>
          <span className="text-xs text-gray-400">
            {isThaiEntry
              ? `(ရွှေတန်ဖိုး ${fmtBaht(valuation.goldAmount)} + အရင်းလက်ခ ${fmtBaht(formCraftsmanship)} + အမြတ်လက်ခ ${fmtBaht(formCraftProfit)})`
              : `(ရွှေတန်ဖိုး ${formatMMK(valuation.goldAmount)} + စုစုပေါင်းလက်ခ ${formatMMK(mmCraftTotal)} + ကျောက်ဖိုးစုစုပေါင်း ${formatMMK(mmStoneTotal)})`}
          </span>
        </div>
        <div className="text-lg font-extrabold text-[#996515] dark:text-amber-300 font-mono">
          {isThaiEntry
            ? fmtBaht(thaiBahtBreakdown?.totalPrice || 0)
            : formatMMK(estimatedTotalSelling)}
        </div>
      </div>
    </div>
  );
};
