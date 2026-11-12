import React, { useMemo, useState } from 'react';
import { CalendarDays, RotateCcw, BookOpen } from 'lucide-react';
import { useGoldShop } from '../context/GoldShopContext';
import { formatDate, todayISO } from '../utils/dateFormat';
import { formatKPYMyanmar, formatKPYEnglish, PURITY_LABELS } from '../utils/goldCalculations';
import { inventoryProductKey } from '../utils/inventoryGrouping';
import { DateInput } from './DateInput';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';

function toDayISO(value?: string | null): string {
  if (!value) return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function eachDayInclusive(from: string, to: string): string[] {
  if (!from || !to || from > to) return from ? [from] : [];
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 62) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
    guard += 1;
  }
  return out;
}

/**
 * Daily stock-on-hand ledger (paper notebook style).
 * From–To date columns; default both = today (last date).
 * No day-diff columns, no group subtotals.
 */
export const InventoryStockLedgerView: React.FC = () => {
  const { inventory, transactions, goldsmithJobs, language } = useGoldShop();
  const lastDate = todayISO();
  const [from, setFrom] = useState(lastDate);
  const [to, setTo] = useState(lastDate);

  const outflowByItemId = useMemo(() => {
    const map = new Map<string, string>();

    const mark = (itemId: string | undefined | null, day: string) => {
      const id = String(itemId || '').trim();
      if (!id || !day) return;
      const prev = map.get(id);
      if (!prev || day < prev) map.set(id, day);
    };

    for (const t of transactions) {
      const type = String(t.transaction_type || '').toUpperCase();
      if (type !== 'SALE' && type !== 'SHOP_OUT' && type !== 'EXCHANGE') continue;
      const day = toDayISO(t.created_at);
      if (!day) continue;
      for (const line of t.items || []) {
        if (type === 'EXCHANGE' && String(line.line_role || '').toUpperCase() === 'TRADE_IN') {
          continue;
        }
        mark(line.item_id, day);
      }
    }

    for (const j of goldsmithJobs) {
      if (!j.inventory_item_id) continue;
      const day = toDayISO(j.sent_at || j.created_at);
      mark(j.inventory_item_id, day);
    }

    return map;
  }, [transactions, goldsmithJobs]);

  const dateCols = useMemo(() => {
    let f = from || lastDate;
    let t = to || lastDate;
    if (f > t) {
      const tmp = f;
      f = t;
      t = tmp;
    }
    return eachDayInclusive(f, t);
  }, [from, to, lastDate]);

  const rows = useMemo(() => {
    type UnitMeta = {
      id: string;
      created: string;
      outflow: string | null;
      sample: (typeof inventory)[number];
    };

    const groups = new Map<string, UnitMeta[]>();

    for (const item of inventory) {
      const created = toDayISO(item.created_at);
      if (!created) continue;

      let outflow = outflowByItemId.get(item.id) || null;
      const status = String(item.status || '').toUpperCase();
      if (
        !outflow &&
        (status === 'SOLD' || status === 'SHOP_OUT' || status === 'WITH_GOLDSMITH')
      ) {
        // No linked txn date — treat as out before any report day (exclude from ledger)
        outflow = created;
      }

      const key = inventoryProductKey(item);
      const list = groups.get(key) || [];
      list.push({ id: item.id, created, outflow, sample: item });
      groups.set(key, list);
    }

    const result = Array.from(groups.entries()).map(([key, units]) => {
      const sample = units[0].sample;
      const isThai = sample.item_type === 'THAI_GOLD' || sample.purity === 'THAI_GOLD';
      const purityLabel =
        PURITY_LABELS[sample.purity as keyof typeof PURITY_LABELS] ||
        ({ mm: sample.purity, en: sample.purity } as { mm: string; en: string });

      const weightLabel =
        language === 'MM'
          ? isThai && sample.thai_weight_unit
            ? `${sample.thai_weight_unit} g`
            : formatKPYMyanmar({
                kyat: Number(sample.net_weight_kyat || 0),
                pae: Number(sample.net_weight_pae || 0),
                yway: Number(sample.net_weight_yway || 0),
              })
          : isThai && sample.thai_weight_unit
            ? `${sample.thai_weight_unit} g`
            : formatKPYEnglish({
                kyat: Number(sample.net_weight_kyat || 0),
                pae: Number(sample.net_weight_pae || 0),
                yway: Number(sample.net_weight_yway || 0),
              });

      const name = (language === 'MM' ? sample.name_mm || sample.name : sample.name || sample.name_mm) || '—';
      const label = `${language === 'MM' ? purityLabel.mm : purityLabel.en} · ${name}${
        weightLabel ? ` (${weightLabel})` : ''
      }`;

      const qtyByDay: Record<string, number> = {};
      for (const day of dateCols) {
        let qty = 0;
        for (const u of units) {
          if (u.created > day) continue;
          if (u.outflow && u.outflow <= day) continue;
          qty += 1;
        }
        qtyByDay[day] = qty;
      }

      const anyStock = dateCols.some((d) => (qtyByDay[d] || 0) > 0);
      return {
        key,
        label,
        category: sample.category || '',
        purity: sample.purity || '',
        nameMm: sample.name_mm || '',
        nameEn: sample.name || '',
        qtyByDay,
        anyStock,
        sortPurity: String(sample.purity || ''),
        sortName: name,
      };
    });

    return result
      .filter((r) => r.anyStock)
      .sort(
        (a, b) =>
          a.sortPurity.localeCompare(b.sortPurity) ||
          a.category.localeCompare(b.category) ||
          a.sortName.localeCompare(b.sortName)
      );
  }, [inventory, outflowByItemId, dateCols, language]);

  const exportExcel = () => {
    type ExportRow = (typeof rows)[number] & { idx: number };
    const exportRows: ExportRow[] = rows.map((r, i) => ({ ...r, idx: i + 1 }));
    exportToExcel({
      sheetName: language === 'MM' ? 'လက်ကျန်စာရင်း' : 'Stock Ledger',
      title:
        language === 'MM'
          ? `နေ့စဉ်လက်ကျန် (${formatDate(dateCols[0])} → ${formatDate(dateCols[dateCols.length - 1])})`
          : `Daily stock (${formatDate(dateCols[0])} → ${formatDate(dateCols[dateCols.length - 1])})`,
      filename: `stock_ledger_${dateCols[0] || lastDate}_${dateCols[dateCols.length - 1] || lastDate}`,
      columns: [
        { header: language === 'MM' ? 'စဉ်' : '#', value: (r) => r.idx, width: 6 },
        { header: language === 'MM' ? 'ပစ္စည်း' : 'Item', value: (r) => r.label, width: 40 },
        ...dateCols.map((d) => ({
          header: formatDate(d),
          value: (r: ExportRow) => {
            const q = r.qtyByDay[d] || 0;
            return q > 0 ? q : '—';
          },
          width: 12,
        })),
      ],
      rows: exportRows,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-extrabold tracking-wide">
              {language === 'MM' ? 'စာရင်းချုပ်' : 'SUMMARY'}
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-[#D4AF37]" />
              <span>{language === 'MM' ? 'နေ့စဉ်လက်ကျန်စာရင်း' : 'Daily Stock Ledger'}</span>
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {language === 'MM'
              ? 'ရွေးချယ်ရက်အပိုင်းအတွက် ပစ္စည်းအလိုက် နေ့စဉ် လက်ကျန်အရေအတွက် (စာအုပ်ပုံစံ)'
              : 'Stock on hand by item for each day in the selected range (notebook style)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">
            <span>{language === 'MM' ? 'မှ' : 'From'}</span>
            <DateInput
              value={from}
              onChange={setFrom}
              className="w-36 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">
            <span>{language === 'MM' ? 'ထိ' : 'To'}</span>
            <DateInput
              value={to}
              onChange={setTo}
              className="w-36 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-mono text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const t = todayISO();
              setFrom(t);
              setTo(t);
            }}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'MM' ? 'Reset' : 'Reset'}</span>
          </button>
          <ExcelExportButton
            language={language}
            onClick={exportExcel}
            disabled={rows.length === 0}
            className="!py-1.5 !rounded-xl"
          />
        </div>
      </div>

      <div className="rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-[11px] bg-amber-50/80 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span className="font-bold text-gray-900 dark:text-amber-100">
              {language === 'MM' ? 'လက်ကျန်ဇယား' : 'Stock table'}
            </span>
            <span className="font-mono text-amber-700/70 dark:text-amber-300/70">
              ({formatDate(dateCols[0])}
              {dateCols.length > 1 ? ` → ${formatDate(dateCols[dateCols.length - 1])}` : ''})
            </span>
          </div>
          <div className="font-mono text-gray-600 dark:text-gray-300">
            {rows.length} {language === 'MM' ? 'မျိုး' : 'SKUs'} · {dateCols.length}{' '}
            {language === 'MM' ? 'ရက်' : 'days'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left border-collapse min-w-[480px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800">
                <th className="px-3 py-2.5 font-bold w-10 sticky left-0 bg-gray-50 dark:bg-[#121212] z-10">
                  စဉ်
                </th>
                <th className="px-3 py-2.5 font-bold min-w-[220px] sticky left-10 bg-gray-50 dark:bg-[#121212] z-10">
                  {language === 'MM' ? 'ပစ္စည်း' : 'Item'}
                </th>
                {dateCols.map((d) => (
                  <th key={d} className="px-3 py-2.5 font-bold text-center font-mono whitespace-nowrap">
                    {formatDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + dateCols.length}
                    className="px-3 py-10 text-center text-gray-400 dark:text-gray-500"
                  >
                    {language === 'MM'
                      ? 'ရွေးချယ်ရက်အတွက် လက်ကျန် မရှိပါ'
                      : 'No stock on hand for the selected dates'}
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r.key}
                    className="border-b border-gray-100 dark:border-gray-800/80 hover:bg-amber-50/40 dark:hover:bg-amber-950/10"
                  >
                    <td className="px-3 py-2 font-mono text-gray-400 sticky left-0 bg-white dark:bg-[#1A1A1A] z-10">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 sticky left-10 bg-white dark:bg-[#1A1A1A] z-10">
                      {r.label}
                    </td>
                    {dateCols.map((d) => {
                      const q = r.qtyByDay[d] || 0;
                      return (
                        <td
                          key={d}
                          className="px-3 py-2 text-center font-mono text-gray-800 dark:text-gray-200"
                        >
                          {q > 0 ? q : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
