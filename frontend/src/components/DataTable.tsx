import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { useClientPagination } from '../hooks/useClientPagination';
import { PaginationBar } from './PaginationBar';

export type DataTableAlign = 'left' | 'center' | 'right';

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  /** Value used for sorting / default search */
  accessor: (row: T) => string | number | boolean | null | undefined;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: DataTableAlign;
  className?: string;
  headerClassName?: string;
  /** Exclude from global search */
  searchIgnore?: boolean;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  language?: 'MM' | 'EN' | string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Extra search text beyond column accessors */
  getSearchText?: (row: T) => string;
  emptyMessage?: string;
  toolbar?: React.ReactNode;
  /** Cap table body height (internal scroll). Pass "" or false to grow with page. */
  maxHeightClass?: string | false;
  selectable?: boolean;
  className?: string;
  /** Reset pagination / sort context when filters change */
  resetDeps?: unknown[];
  /** Optional expanded content rendered as a full-width row under each data row */
  renderRowExtra?: (row: T) => React.ReactNode;
};

type SortDir = 'asc' | 'desc';

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

const alignClass: Record<DataTableAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * Professional compact data table — sort, search, hover, selection, scroll, pagination.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  language = 'MM',
  searchable = true,
  searchPlaceholder,
  getSearchText,
  emptyMessage,
  toolbar,
  maxHeightClass = 'max-h-[60vh]',
  selectable = true,
  className = '',
  resetDeps = [],
  renderRowExtra,
}: DataTableProps<T>) {
  const useInternalScroll = Boolean(maxHeightClass);
  const scrollClass = useInternalScroll
    ? `overflow-auto ${maxHeightClass}`
    : 'overflow-x-auto';
  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      if (getSearchText?.(row)?.toLowerCase().includes(q)) return true;
      return columns.some((col) => {
        if (col.searchIgnore) return false;
        const v = col.accessor(row);
        return v != null && String(v).toLowerCase().includes(q);
      });
    });
  }, [rows, query, columns, getSearchText]);

  const sorted = useMemo(() => {
    if (!sortId) return filtered;
    const col = columns.find((c) => c.id === sortId);
    if (!col) return filtered;
    const copy = [...filtered];
    copy.sort((ra, rb) => {
      const cmp = compareValues(col.accessor(ra), col.accessor(rb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortId, sortDir, columns]);

  const pager = useClientPagination(sorted, [query, sortId, sortDir, rows.length, ...resetDeps]);

  const toggleSort = (col: DataTableColumn<T>) => {
    if (col.sortable === false) return;
    if (sortId !== col.id) {
      setSortId(col.id);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') setSortDir('desc');
    else {
      setSortId(null);
      setSortDir('asc');
    }
  };

  const placeholder =
    searchPlaceholder ||
    (language === 'MM' ? 'ဇယားထဲမှ ရှာဖွေရန်…' : 'Search in table…');

  const empty =
    emptyMessage || (language === 'MM' ? 'ဒေတာမရှိပါ' : 'No records found');

  return (
    <div
      className={`data-table-shell bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-xs overflow-hidden w-full min-w-0 max-w-full ${className}`}
    >
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2.5">
          {searchable && (
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37]/40"
              />
            </div>
          )}
          {toolbar}
          <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap">
            {sorted.length} {language === 'MM' ? 'ကြောင်း' : 'rows'}
          </span>
        </div>
      )}

      <div className={`px-3 sm:px-4 w-full max-w-full ${scrollClass}`}>
        <table className="data-table w-full min-w-max text-left text-xs text-gray-600 dark:text-gray-300">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((col) => {
                const sortable = col.sortable !== false;
                const active = sortId === col.id;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={`${alignClass[col.align || 'left']} ${col.headerClassName || ''} ${
                      sortable ? 'cursor-pointer select-none' : ''
                    }`}
                    onClick={() => sortable && toggleSort(col)}
                  >
                    <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-gray-500 dark:text-gray-400">
                      {col.header}
                      {sortable && (
                        <span className="text-gray-400 dark:text-gray-500">
                          {active ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#D4AF37]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="!text-center text-gray-400 py-10">
                  {empty}
                </td>
              </tr>
            ) : (
              pager.pageItems.map((row) => {
                const key = rowKey(row);
                const selected = selectable && selectedKey === key;
                const extra = renderRowExtra?.(row);
                return (
                  <React.Fragment key={key}>
                    <tr
                      onClick={() => selectable && setSelectedKey(selected ? null : key)}
                      className={selected ? 'is-selected' : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={`${alignClass[col.align || 'left']} ${col.className || ''}`}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                    {extra ? (
                      <tr className="!bg-transparent hover:!bg-transparent">
                        <td colSpan={columns.length} className="!p-0 !border-0">
                          {extra}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-3 sm:px-4 py-2">
        <PaginationBar
          language={language === 'MM' ? 'MM' : 'EN'}
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          from={pager.from}
          to={pager.to}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      </div>
    </div>
  );
}
