import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

type Props = {
  language?: string;
  onClick: () => void;
  disabled?: boolean;
  labelMm?: string;
  labelEn?: string;
  className?: string;
};

/** Compact gold-themed Excel export trigger */
export function ExcelExportButton({
  language = 'MM',
  onClick,
  disabled,
  labelMm = 'Excel ထုတ်မည်',
  labelEn = 'Export Excel',
  className = '',
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950/50 disabled:opacity-40 transition print:hidden ${className}`}
    >
      <FileSpreadsheet className="w-3.5 h-3.5" />
      {language === 'MM' ? labelMm : labelEn}
    </button>
  );
}
