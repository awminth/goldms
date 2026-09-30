import React from 'react';
import { DateInput } from './DateInput';
import { todayISO } from '../utils/dateFormat';

type DateRangeFilterProps = {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  language: string;
  className?: string;
};

const labelCls = 'block text-[10px] font-bold text-gray-500 mb-0.5 leading-none';
const inputCls =
  'h-8 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white min-w-[9.5rem]';

/** From / To date search — defaults typically today via parent state. */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  from,
  to,
  onFromChange,
  onToChange,
  language,
  className = '',
}) => {
  return (
    <div className={`inline-flex flex-wrap items-end gap-2 ${className}`.trim()}>
      <div className="flex flex-col shrink-0">
        <label className={labelCls}>{language === 'MM' ? 'မှ' : 'From'}</label>
        <DateInput value={from} onChange={onFromChange} className={inputCls} />
      </div>
      <div className="flex flex-col shrink-0">
        <label className={labelCls}>{language === 'MM' ? 'ထိ' : 'To'}</label>
        <DateInput value={to} onChange={onToChange} className={inputCls} />
      </div>
      <div className="flex flex-col shrink-0">
        {/* Spacer so Today aligns with date inputs, not labels */}
        <span className={`${labelCls} select-none opacity-0`} aria-hidden>
          .
        </span>
        <button
          type="button"
          onClick={() => {
            const t = todayISO();
            onFromChange(t);
            onToChange(t);
          }}
          className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
        >
          {language === 'MM' ? 'ယနေ့' : 'Today'}
        </button>
      </div>
    </div>
  );
};
