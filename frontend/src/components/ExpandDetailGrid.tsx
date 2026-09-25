import React from 'react';

export type ExpandDetailItem = {
  label: React.ReactNode;
  value: React.ReactNode;
};

type Props = {
  items: ExpandDetailItem[];
  className?: string;
};

/** Bordered detail chips for expandable table rows. */
export function ExpandDetailGrid({ items, className = '' }: Props) {
  if (!items.length) return null;
  return (
    <div
      className={`mx-1 sm:mx-2 mb-2 mt-1 p-2 rounded-xl bg-[#FAF8F2]/70 dark:bg-[#16140F] border border-[#D4AF37]/20 ${className}`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 text-[11px]">
        {items.map((box, i) => (
          <div
            key={`${String(box.label)}-${i}`}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] px-2.5 py-2 shadow-xs min-h-[3rem]"
          >
            <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1">
              {box.label}
            </div>
            <div className="text-gray-900 dark:text-gray-100 break-words">{box.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
