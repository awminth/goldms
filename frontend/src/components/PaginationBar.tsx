import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageSize } from '../utils/listCache';
import { PAGE_SIZE_OPTIONS } from '../utils/listCache';

type Props = {
  language?: 'MM' | 'EN';
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  pageSizeOptions?: readonly PageSize[];
  className?: string;
};

export const PaginationBar: React.FC<Props> = ({
  language = 'MM',
  page,
  totalPages,
  total,
  from,
  to,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className = '',
}) => {
  const mm = language === 'MM';

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-3 border-t border-gray-200 dark:border-gray-800 ${className}`}
    >
      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="font-semibold">
          {mm ? 'စာမျက်နှာအလိုက် အတန်း:' : 'Rows per page:'}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs font-bold text-gray-800 dark:text-gray-200"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="font-mono">
          {total === 0
            ? mm
              ? '၀ ခု'
              : '0 items'
            : mm
              ? `${from}–${to} / စုစုပေါင်း ${total}`
              : `${from}–${to} of ${total}`}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {mm ? 'ယခင်' : 'Prev'}
        </button>
        <span className="px-2 text-xs font-mono font-bold text-gray-700 dark:text-gray-300 min-w-[4.5rem] text-center">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1"
        >
          {mm ? 'ရှေ့' : 'Next'}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
