export function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function strId(value: unknown): string {
  return String(value ?? '');
}

export function optionalStrId(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}

export function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z').toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

export function parseId(id: string | number): number {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    throw Object.assign(new Error(`Invalid id: ${id}`), { status: 400 });
  }
  return n;
}

/** Returns null for empty / non-numeric / placeholder ids like cust-walkin */
export function parseOptionalId(id: unknown): number | null {
  if (id === null || id === undefined || id === '') return null;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export type PaginationParams = {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
};

/** Parse ?page=&pageSize= (or limit) from Express query */
export function parsePagination(
  query: Record<string, unknown> | undefined,
  defaultPageSize = 25
): PaginationParams {
  const page = Math.max(1, Math.floor(num(query?.page, 1)));
  const rawSize = num(query?.pageSize ?? query?.limit, defaultPageSize);
  const pageSize = Math.min(100, Math.max(1, Math.floor(rawSize)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset, limit: pageSize };
}

export function paginateSlice<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
