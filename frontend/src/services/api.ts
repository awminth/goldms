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
};

export const api = {
  health: () => fetch(`${API_BASE}/health`).then((r) => r.json()),

  bootstrap: () => request<BootstrapData>('/bootstrap'),

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

  updateOrderStatus: (id: string, status: CustomOrder['status'], remainingPaid?: number) =>
    request<CustomOrder>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remainingPaid }),
    }),

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

  payPawnInterest: (
    id: string,
    data: {
      payment_date?: string;
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

  resetToDemoData: () => request<BootstrapData>('/reset-demo', { method: 'POST' }),
};

export type ReportSummary = {
  generated_at: string;
  today_sales?: { count: number; total: number };
  today_purchases?: { count: number; total: number };
  stock?: { count: number; estimated_value: number };
  open_orders?: number;
  active_pawns?: number;
  customers_with_balance: number;
  customer_balance_total: number;
};
