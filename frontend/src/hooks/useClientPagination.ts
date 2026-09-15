import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  loadStoredPageSize,
  saveStoredPageSize,
  type PageSize,
  PAGE_SIZE_OPTIONS,
} from '../utils/listCache';

export type UsePaginationResult<T> = {
  page: number;
  pageSize: PageSize;
  setPage: (p: number) => void;
  setPageSize: (s: PageSize) => void;
  total: number;
  totalPages: number;
  pageItems: T[];
  from: number;
  to: number;
  pageSizeOptions: readonly PageSize[];
  resetPage: () => void;
};

/** Client-side pagination over an already-loaded/filtered array */
export function useClientPagination<T>(items: T[], resetDeps: unknown[] = []): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<PageSize>(() => loadStoredPageSize(10));

  const setPageSize = useCallback((s: PageSize) => {
    setPageSizeState(s);
    saveStoredPageSize(s);
    setPage(1);
  }, []);

  const resetPage = useCallback(() => setPage(1), []);

  // Reset to page 1 when filters / source change
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    total,
    totalPages,
    pageItems,
    from,
    to,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resetPage,
  };
}
