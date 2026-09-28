import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, Search, X } from 'lucide-react';
import type { Customer } from '../types/gold';

type Props = {
  customers: Customer[];
  value: Customer | null;
  onChange: (c: Customer | null) => void;
  language: string;
  placeholder?: string;
};

/** Searchable customer picker (Select2-style). */
export const CustomerSearchSelect: React.FC<Props> = ({
  customers,
  value,
  onChange,
  language,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const blob = [c.name, c.phone, c.nrc || '', c.address || ''].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [customers, query]);

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

  const label = value
    ? `${value.name}${value.phone ? ` (${value.phone})` : ''}`
    : placeholder ||
      (language === 'MM' ? 'ဖောက်သည် ရွေးရန် / ရှာရန်…' : 'Select / search customer…');

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-medium text-left"
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
              placeholder={language === 'MM' ? 'အမည် / ဖုန်း / NRC ရှာရန်…' : 'Search name / phone / NRC…'}
              className="w-full bg-transparent text-xs outline-none text-gray-900 dark:text-white"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[11px] text-gray-400">
                {language === 'MM' ? 'မတွေ့ပါ — အောက်က အကွက်များဖြင့် အသစ်ထည့်ပါ' : 'No match — use fields below for new'}
              </li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[#FAF8F2] dark:hover:bg-[#221F18] ${
                      value?.id === c.id ? 'bg-[#D4AF37]/15 font-bold' : ''
                    }`}
                  >
                    <span className="block text-gray-900 dark:text-white">{c.name}</span>
                    <span className="block text-[10px] text-gray-500 font-mono">
                      {[c.phone, c.nrc].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
