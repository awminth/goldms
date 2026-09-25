import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { TransactionItem, WeightKPY } from '../types/gold';
import {
  formatKPYMyanmar,
  kpyToGrams,
  kpyToYway,
  ywayToKpy,
  KYAT_TO_GRAMS,
  PURITY_LABELS,
} from '../utils/goldCalculations';
import { PackageOpen, Hammer, X } from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import { NumberInput } from './NumberInput';
import { DateInput } from './DateInput';

type OldGoldTab = 'THAI' | 'MYANMAR';

type OldGoldRow = {
  key: string;
  source: 'PURCHASE' | 'SHOP_OUT';
  invoice_no: string;
  created_at: string;
  customer_name: string;
  item: TransactionItem;
};

type SummaryNote = {
  category: string;
  categoryLabel: string;
  count: number;
  purityParts: string[];
};

const isThai = (i: TransactionItem) =>
  i.item_type === 'THAI_GOLD' || i.purity === 'THAI_GOLD';

function netGrams(i: TransactionItem, kyatToGrams: number): number {
  const unit = Number(i.thai_weight_unit || 0);
  if (isThai(i) && unit > 0) return unit;
  return kpyToGrams(i.net_weight || { kyat: 0, pae: 0, yway: 0 }, kyatToGrams);
}

function sumWeights(list: OldGoldRow[]): WeightKPY {
  const totalYway = list.reduce(
    (s, r) =>
      s +
      kpyToYway(
        r.item.net_weight?.kyat || 0,
        r.item.net_weight?.pae || 0,
        r.item.net_weight?.yway || 0
      ),
    0
  );
  return ywayToKpy(totalYway);
}

/** Build notes like: လက်စွပ် 3 ကွင်း (မီးလင်း 2, 15A 1) */
function buildMmSummaryNotes(
  list: OldGoldRow[],
  language: string,
  categoryLabel: (code: string) => string
): SummaryNote[] {
  const byCat = new Map<string, OldGoldRow[]>();
  for (const r of list) {
    const cat = String(r.item.category || 'OTHER').toUpperCase() || 'OTHER';
    const arr = byCat.get(cat) ?? [];
    arr.push(r);
    byCat.set(cat, arr);
  }

  const notes: SummaryNote[] = [];
  for (const [category, catRows] of byCat) {
    const byPurity = new Map<string, number>();
    for (const r of catRows) {
      const p = String(r.item.purity || 'UNKNOWN');
      byPurity.set(p, (byPurity.get(p) || 0) + 1);
    }
    const purityParts = [...byPurity.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([purity, n]) => {
        const labels = PURITY_LABELS[purity as keyof typeof PURITY_LABELS];
        const label = language === 'MM' ? labels?.mm || purity : labels?.en || purity;
        return `${label} ${n}`;
      });
    notes.push({
      category,
      categoryLabel: categoryLabel(category),
      count: catRows.length,
      purityParts,
    });
  }
  return notes.sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel, 'my'));
}

export const OldGoldView: React.FC = () => {
  const {
    transactions,
    language,
    shopSettings,
    masterCategories,
    goldsmithJobs,
    createGoldsmithJob,
    can,
  } = useGoldShop();
  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;
  const [tab, setTab] = useState<OldGoldTab>('THAI');
  const [gsOpen, setGsOpen] = useState(false);
  const [gsGrams, setGsGrams] = useState(0);
  const [gsReturnDue, setGsReturnDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [gsName, setGsName] = useState('');
  const [gsSaving, setGsSaving] = useState(false);
  const [gsErr, setGsErr] = useState('');

  const meltUsedGrams = useMemo(() => {
    return goldsmithJobs
      .filter((j) => j.source_type === 'OLD_GOLD')
      .reduce((s, j) => s + Number(j.source_grams || 0), 0);
  }, [goldsmithJobs]);

  const categoryLabel = (code: string) => {
    const found = masterCategories.find(
      (c) => c.code === code || c.code?.toUpperCase() === code.toUpperCase()
    );
    if (found) return language === 'MM' ? found.name_mm : found.name_en || found.name_mm;
    if (code === 'OLD_GOLD')
      return language === 'MM' ? 'အဟောင်းရွှေ (အမျိုးအစားမသတ်)' : 'Old gold (uncategorized)';
    return code;
  };

  const rows = useMemo(() => {
    const list: OldGoldRow[] = [];
    for (const t of transactions) {
      if (t.transaction_type !== 'PURCHASE' && t.transaction_type !== 'SHOP_OUT') continue;
      for (const item of t.items) {
        list.push({
          key: `${t.id}-${item.id}`,
          source: t.transaction_type as 'PURCHASE' | 'SHOP_OUT',
          invoice_no: t.invoice_no,
          created_at: t.created_at,
          customer_name: t.customer_name,
          item,
        });
      }
    }
    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [transactions]);

  const thaiRows = useMemo(() => rows.filter((r) => isThai(r.item)), [rows]);
  const mmRows = useMemo(() => rows.filter((r) => !isThai(r.item)), [rows]);

  const thaiInboundGrams = useMemo(
    () => thaiRows.reduce((s, r) => s + netGrams(r.item, kyatToGrams), 0),
    [thaiRows, kyatToGrams]
  );
  const mmInboundGrams = useMemo(
    () => mmRows.reduce((s, r) => s + netGrams(r.item, kyatToGrams), 0),
    [mmRows, kyatToGrams]
  );
  const totalInboundGrams = thaiInboundGrams + mmInboundGrams;
  const availableGrams = Math.max(0, Number((totalInboundGrams - meltUsedGrams).toFixed(3)));

  /** Remaining grams after goldsmith melt — proportional by inbound share. */
  const remainingByShare = (inbound: number) => {
    if (totalInboundGrams <= 0) return 0;
    return Number(((inbound / totalInboundGrams) * availableGrams).toFixed(3));
  };

  const thaiRemainingGrams = remainingByShare(thaiInboundGrams);
  const mmRemainingGrams = remainingByShare(mmInboundGrams);
  const mmWeight = useMemo(() => sumWeights(mmRows), [mmRows]);

  const mmNotes = useMemo(
    () => buildMmSummaryNotes(mmRows, language, categoryLabel),
    [mmRows, language, masterCategories]
  );

  const unitWord = (cat: string) => {
    if (language !== 'MM') return 'pcs';
    const c = cat.toUpperCase();
    if (c.includes('RING')) return 'ကွင်း';
    if (c.includes('EAR')) return 'စုံ';
    return 'ခု';
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="bg-white dark:bg-[#1A1A1A] p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <PackageOpen className="w-5 h-5 text-[#D4AF37]" />
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {language === 'MM' ? 'အဟောင်းထည်' : 'Old / Used Gold'}
            </h2>
            <p className="text-[11px] text-gray-500">
              {language === 'MM'
                ? 'အဝယ် / ဆိုင်ထုတ် ပေါင်းစု — ကျန်ဂရမ် (ပန်းထိမ်နှုတ်ပြီး)'
                : 'Purchase + shop-out combined — remaining grams after goldsmith'}
            </p>
            <p className="text-[11px] font-mono text-violet-700 dark:text-violet-300 mt-0.5">
              {language === 'MM' ? 'စုစုပေါင်း ကျန်ရှိ' : 'Total available'}{' '}
              {availableGrams.toFixed(3)} g
              {meltUsedGrams > 0 && (
                <span className="text-gray-400">
                  {' '}
                  (−{meltUsedGrams.toFixed(3)} g)
                </span>
              )}
            </p>
          </div>
          {can('goldsmith', 'create') && (
            <button
              type="button"
              onClick={() => {
                setGsOpen(true);
                setGsErr('');
                setGsGrams(0);
                const d = new Date();
                d.setDate(d.getDate() + 7);
                setGsReturnDue(d.toISOString().slice(0, 10));
                setGsName('');
              }}
              className="ml-auto px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Hammer className="w-3.5 h-3.5" />
              {language === 'MM' ? 'ပန်းထိမ်အပ်' : 'Send to goldsmith'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white dark:bg-[#1A1A1A] p-2 rounded-2xl border border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setTab('THAI')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            tab === 'THAI'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <span>{language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold'}</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              tab === 'THAI' ? 'bg-black/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            {thaiRows.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('MYANMAR')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            tab === 'MYANMAR'
              ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <span>{language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar Gold'}</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              tab === 'MYANMAR'
                ? 'bg-black/20 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            {mmRows.length}
          </span>
        </button>
      </div>

      {tab === 'THAI' ? (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-amber-200/70 dark:border-amber-900/50 shadow-xs overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
                <th className="text-left px-4 py-3 font-bold text-xs">
                  {language === 'MM' ? 'စာရင်း' : 'Summary'}
                </th>
                <th className="text-right px-4 py-3 font-bold text-xs">
                  {language === 'MM' ? 'စုစုပေါင်း အရေအတွက်' : 'Total Qty'}
                </th>
                <th className="text-right px-4 py-3 font-bold text-xs">
                  {language === 'MM' ? 'စုစုပေါင်း Gram' : 'Total Grams'}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-amber-100 dark:border-amber-900/40">
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <PackageOpen className="w-3.5 h-3.5" />
                    {language === 'MM' ? 'အဟောင်းထည် (ထိုင်း)' : 'Old gold (Thai)'}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                  {thaiRows.length}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-extrabold text-amber-800 dark:text-amber-300">
                  {thaiRemainingGrams.toFixed(2)} g
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-slate-200/70 dark:border-slate-700/50 shadow-xs overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200">
                <th className="text-left px-4 py-3 font-bold text-xs">
                  {language === 'MM' ? 'စာရင်း' : 'Summary'}
                </th>
                <th className="text-right px-4 py-3 font-bold text-xs">
                  {language === 'MM' ? 'စုစုပေါင်း အရေအတွက်' : 'Total Qty'}
                </th>
                <th className="text-right px-4 py-3 font-bold text-xs">
                  {language === 'MM' ? 'စုစုပေါင်း Gram' : 'Total Grams'}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    <PackageOpen className="w-3.5 h-3.5" />
                    {language === 'MM' ? 'အဟောင်းထည် (မြန်မာ)' : 'Old gold (Myanmar)'}
                  </span>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    {formatKPYMyanmar(mmWeight)}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                  {mmRows.length}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-extrabold text-slate-800 dark:text-slate-200">
                  {mmRemainingGrams.toFixed(2)} g
                </td>
              </tr>
            </tbody>
          </table>

          {mmNotes.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {language === 'MM' ? 'မှတ်ချက် (အမျိုးအစား / ရွှေရည်)' : 'Notes (category / purity)'}
              </div>
              <ul className="space-y-1">
                {mmNotes.map((n) => (
                  <li
                    key={n.category}
                    className="text-xs text-slate-700 dark:text-slate-200 flex flex-wrap gap-x-1"
                  >
                    <span className="font-bold">
                      {n.categoryLabel} {n.count} {unitWord(n.category)}
                    </span>
                    <span className="text-slate-500">
                      ({n.purityParts.join(language === 'MM' ? '၊ ' : ', ')})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {gsOpen && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Hammer className="w-4 h-4 text-violet-600" />
                {language === 'MM' ? 'အဟောင်းထည် → ပန်းထိမ်အပ်' : 'Old gold → goldsmith'}
              </h3>
              <button type="button" onClick={() => setGsOpen(false)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-3 text-xs">
              <p className="text-violet-700 dark:text-violet-300 font-mono">
                {language === 'MM' ? 'ကျန်ရှိ' : 'Available'} {availableGrams.toFixed(3)} g
              </p>
              <input
                value={gsName}
                onChange={(e) => setGsName(e.target.value)}
                placeholder={language === 'MM' ? 'ဖော်ပြချက် (optional)' : 'Description (optional)'}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
              />
              <div>
                <label className="block font-semibold mb-1">Gram</label>
                <NumberInput
                  value={gsGrams}
                  onChange={setGsGrams}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {language === 'MM' ? 'ပြန်လာအပ်ရမည့်ရက်' : 'Expected return date'}
                </label>
                <DateInput
                  required
                  value={gsReturnDue}
                  onChange={setGsReturnDue}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono"
                />
              </div>
              {gsErr && <p className="text-rose-600">{gsErr}</p>}
              <button
                type="button"
                disabled={gsSaving || gsGrams <= 0 || !gsReturnDue || gsGrams > availableGrams + 0.001}
                onClick={async () => {
                  setGsSaving(true);
                  setGsErr('');
                  try {
                    await createGoldsmithJob({
                      source_type: 'OLD_GOLD',
                      source_grams: gsGrams,
                      item_name: gsName || undefined,
                      craft_fee: 0,
                      return_due_date: gsReturnDue,
                    });
                    setGsOpen(false);
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
