import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, Search, X } from 'lucide-react';
import type { InventoryItem } from '../types/gold';
import { formatMMK, PURITY_LABELS } from '../utils/goldCalculations';

type Props = {
  items: InventoryItem[];
  value: InventoryItem | null;
  onChange: (item: InventoryItem | null) => void;
  language: string;
  placeholder?: string;
  /** Extra ids to hide (e.g. item being returned) */
  excludeIds?: string[];
};

/** Searchable in-stock inventory picker (name / barcode). */
export const InventorySearchSelect: React.FC<Props> = ({
  items,
  value,
  onChange,
  language,
  placeholder,
  excludeIds = [],
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  const pool = useMemo(
    () => items.filter((i) => i.status === 'IN_STOCK' && !exclude.has(i.id)),
    [items, exclude]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((i) => {
      const blob = [
        i.barcode,
        i.name,
        i.name_mm,
        i.category,
        PURITY_LABELS[i.purity]?.mm || i.purity,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [pool, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const displayName = value
    ? language === 'MM'
      ? value.name_mm || value.name
      : value.name || value.name_mm
    : '';
  const label = value
    ? `${displayName} · ${value.barcode}`
    : placeholder ||
      (language === 'MM' ? 'ပစ္စည်းအမည် ရွေးရန် / ရှာရန်…' : 'Select / search item name…');

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-[#121212] font-medium text-left"
      >
        <span className={`truncate ${value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
          {label}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="p-0.5 rounded text-gray-400 hover:text-rose-500"
              title={language === 'MM' ? 'ရှင်းမည်' : 'Clear'}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] shadow-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-gray-100 dark:border-gray-800">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                language === 'MM'
                  ? 'အမည် / Item Code / ရွှေရည် ရှာရန်…'
                  : 'Search name / code / purity…'
              }
              className="w-full bg-transparent text-xs outline-none text-gray-900 dark:text-white"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[11px] text-gray-400">
                {language === 'MM' ? 'စတော့ပစ္စည်း မတွေ့ပါ' : 'No in-stock items found'}
              </li>
            ) : (
              filtered.map((i) => {
                const name = language === 'MM' ? i.name_mm || i.name : i.name || i.name_mm;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(i);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${
                        value?.id === i.id ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold' : ''
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-gray-900 dark:text-white truncate">{name}</span>
                          <span className="block text-[10px] text-gray-500 font-mono mt-0.5">
                            {i.barcode}
                            {' · '}
                            {PURITY_LABELS[i.purity]?.mm || i.purity}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-300 shrink-0">
                          {formatMMK(Number(i.selling_price_estimated || 0))}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
