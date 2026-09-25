import type {
  DailyGoldPrice,
  InventoryItem,
  Customer,
  Transaction,
  CustomOrder,
  PawnRecord,
  PawnInterestPayment,
  FinancialLedger,
  StaffUser,
  GoldPurity,
  MasterCategory,
  PermissionModule,
  RolePermission,
  UserRole,
  ShopSettings,
  GoldsmithJob,
} from '../types/gold';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || body.error || `Request failed (${res.status})`);
  }
  return body.data as T;
}

/** Retry when API is still booting (ECONNREFUSED / empty proxy response). */
async function requestWithRetry<T>(
  path: string,
  options?: RequestInit,
  retries = 12,
  delayMs = 500
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await request<T>(path, options);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('fetch') ||
        msg.includes('API starting') ||
        msg.includes('Request failed (502)') ||
        msg.includes('Request failed (503)') ||
        msg.includes('Request failed (504)');
      if (!retryable || i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export type BootstrapData = {
  prices: DailyGoldPrice[];
  inventory: InventoryItem[];
  customers: Customer[];
  transactions: Transaction[];
  orders: CustomOrder[];
  pawns: PawnRecord[];
  interestPayments?: PawnInterestPayment[];
  ledger: FinancialLedger[];
  staff: StaffUser[];
  categories?: MasterCategory[];
  modules?: PermissionModule[];
  rolePermissions?: RolePermission[];
  settings?: ShopSettings;
  goldsmithJobs?: GoldsmithJob[];
};

export const api = {
  health: () => fetch(`${API_BASE}/health`).then((r) => r.json()),

  bootstrap: () => requestWithRetry<BootstrapData>('/bootstrap'),

  login: (username: string, pin: string) =>
    request<StaffUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin }),
    }),

  listStaff: () => request<StaffUser[]>('/auth/staff?all=1'),

  createStaff: (data: Record<string, unknown>) =>
    request<StaffUser>('/auth/staff', { method: 'POST', body: JSON.stringify(data) }),

  updateStaff: (id: string, data: Record<string, unknown>) =>
    request<StaffUser>(`/auth/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteStaff: (id: string) =>
    request<void>(`/auth/staff/${id}`, { method: 'DELETE' }),

  listModules: () => request<PermissionModule[]>('/auth/modules'),

  listPermissions: () => request<RolePermission[]>('/auth/permissions'),

  listPermissionsByRole: (role: UserRole) =>
    request<RolePermission[]>(`/auth/permissions/${role}`),

  updatePermissions: (body: Record<string, unknown>) =>
    request<RolePermission[]>('/auth/permissions', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  listCategories: (all = true) =>
    request<MasterCategory[]>(`/master/categories${all ? '?all=1' : ''}`),

  getSettings: () => request<ShopSettings>('/settings'),

  updateSettings: (data: Partial<ShopSettings>) =>
    request<ShopSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  createCategory: (data: Record<string, unknown>) =>
    request<MasterCategory>('/master/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (id: string, data: Record<string, unknown>) =>
    request<MasterCategory>(`/master/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string) =>
    request<{
      mode: 'deleted' | 'deactivated';
      usage: number;
      message: string;
      category: MasterCategory | null;
    }>(`/master/categories/${id}`, { method: 'DELETE' }),

  updateGoldPrice: (gold_type: GoldPurity, sellPrice: number, buyPrice?: number) =>
    request<DailyGoldPrice>('/prices', {
      method: 'PUT',
      body: JSON.stringify({ gold_type, sellPrice, buyPrice }),
    }),

  updateGoldPricesBulk: (
    updates: Array<{ gold_type: GoldPurity; sellPrice: number; buyPrice?: number }>
  ) =>
    request<DailyGoldPrice[]>('/prices', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    }),

  addCustomer: (name: string, phone: string, address: string) =>
    request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify({ name, phone, address }),
    }),

  updateCustomer: (id: string, updates: Partial<Customer>) =>
    request<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteCustomer: (id: string) =>
    request<void>(`/customers/${id}`, { method: 'DELETE' }),

  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'created_at'>) =>
    request<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) =>
    request<InventoryItem>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteInventoryItem: (id: string) =>
    request<void>(`/inventory/${id}`, { method: 'DELETE' }),

  createTransaction: (txn: Omit<Transaction, 'id' | 'created_at'>) =>
    request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(txn),
    }),

  deleteTransaction: (id: string) =>
    request<void>(`/transactions/${id}`, { method: 'DELETE' }),

  addCustomOrder: (order: Omit<CustomOrder, 'id' | 'created_at'>) =>
    request<CustomOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    }),

  updateCustomOrder: (id: string, data: Record<string, unknown>) =>
    request<CustomOrder>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateOrderStatus: (
    id: string,
    status: CustomOrder['status'],
    remainingPaid?: number,
    opts?: { via_sale?: boolean }
  ) =>
    request<CustomOrder>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remainingPaid, via_sale: opts?.via_sale }),
    }),

  listGoldsmithJobs: () => request<GoldsmithJob[]>('/goldsmith-jobs'),

  createGoldsmithJob: (data: Record<string, unknown>) =>
    request<GoldsmithJob>('/goldsmith-jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  returnGoldsmithJob: (id: string, data?: Record<string, unknown>) =>
    request<GoldsmithJob>(`/goldsmith-jobs/${id}/return`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  cancelGoldsmithJob: (id: string) =>
    request<void>(`/goldsmith-jobs/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  handoffGoldsmithJob: (id: string, data: Record<string, unknown>) =>
    request<{ job: GoldsmithJob; transaction: Transaction }>(`/goldsmith-jobs/${id}/handoff`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  oldGoldAvailable: (purity?: string, category?: string) => {
    const qs = new URLSearchParams();
    if (purity) qs.set('purity', purity);
    if (category) qs.set('category', category);
    const q = qs.toString();
    return request<{ available: number }>(`/goldsmith-jobs/old-gold-available${q ? `?${q}` : ''}`);
  },

  addPawnRecord: (pawn: Omit<PawnRecord, 'id'>) =>
    request<PawnRecord>('/pawns', {
      method: 'POST',
      body: JSON.stringify(pawn),
    }),

  updatePawnRecord: (id: string, updates: Partial<PawnRecord> | Record<string, unknown>) =>
    request<PawnRecord>(`/pawns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deletePawnRecord: (id: string) =>
    request<{ id: string }>(`/pawns/${id}`, {
      method: 'DELETE',
    }),

  deletePawnInterestPayment: (id: string) =>
    request<{ id: string }>(`/pawns/interest-payments/${id}`, {
      method: 'DELETE',
    }),

  deletePawnRedeem: (id: string) =>
    request<{ id: string }>(`/pawns/${id}/redeem`, {
      method: 'DELETE',
    }),

  payPawnInterest: (
    id: string,
    data: {
      payment_date?: string;
      days_paid?: number;
      months_paid?: number;
      interest_kyat?: number;
      interest_baht?: number;
      interest_rate?: number;
      notes?: string;
      voucher_no?: string;
    }
  ) =>
    request<PawnInterestPayment>(`/pawns/${id}/interest`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  redeemPawnRecord: (
    id: string,
    settlementAmount: number,
    extra?: Record<string, unknown>
  ) =>
    request<PawnRecord>(`/pawns/${id}/redeem`, {
      method: 'POST',
      body: JSON.stringify({ settlementAmount, ...(extra || {}) }),
    }),

  addLedgerEntry: (entry: Omit<FinancialLedger, 'id'>) =>
    request<FinancialLedger>('/ledger', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  updateLedgerEntry: (id: string, entry: Partial<FinancialLedger>) =>
    request<FinancialLedger>(`/ledger/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    }),

  deleteLedgerEntry: (id: string) =>
    request<void>(`/ledger/${id}`, { method: 'DELETE' }),

  calcValuation: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>('/calc/valuation', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  calcThai: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>('/calc/thai', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  allocateBarcode: () =>
    request<{ barcode: string }>('/inventory/barcode', { method: 'POST' }),

  revalueInventory: () =>
    request<{ updated: number }>('/inventory/revalue', { method: 'POST' }),

  reportSummary: () => request<ReportSummary>('/reports/summary'),

  reportFinancial: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return request<FinancialReport>(`/reports/financial${qs ? `?${qs}` : ''}`);
  },

  resetToDemoData: () => request<BootstrapData>('/reset-demo', { method: 'POST' }),
};

export type ReportSummary = {
  generated_at: string;
  today_sales?: { count: number; total: number };
  today_purchases?: { count: number; total: number };
  stock?: { count: number; estimated_value: number };
  open_orders?: number;
  active_pawns?: number;
  /** Active + overdue pawn loan principal sum (MMK) */
  pawn_loan_total_mmk?: number;
  customers_with_balance: number;
  customer_balance_total: number;
};

export type FinancialReport = {
  from: string;
  to: string;
  entries: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE' | string;
    category: string;
    amount: number;
    description: string;
    reference_no?: string;
    date: string;
  }>;
  by_category: Array<{
    category: string;
    type: string;
    count: number;
    total: number;
  }>;
  totals: {
    income: number;
    expense: number;
    net: number;
  };
};
