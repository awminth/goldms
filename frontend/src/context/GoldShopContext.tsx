import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  DailyGoldPrice,
  InventoryItem,
  Customer,
  Transaction,
  CustomOrder,
  PawnRecord,
  PawnInterestPayment,
  FinancialLedger,
  GoldPurity,
  StaffUser,
  MasterCategory,
  PermissionModule,
  RolePermission,
  PermissionAction,
  UserRole,
  ShopSettings,
  GoldsmithJob,
} from '../types/gold';
import { derivePriceFromMeelin, PURITY_MULTIPLIERS, KYAT_TO_GRAMS } from '../utils/goldCalculations';
import { api, BootstrapData } from '../services/api';
import { cacheGet, cacheSet, cacheInvalidate, cacheKey } from '../utils/listCache';

interface GoldShopContextType {
  goldPrices: DailyGoldPrice[];
  inventory: InventoryItem[];
  customers: Customer[];
  transactions: Transaction[];
  customOrders: CustomOrder[];
  goldsmithJobs: GoldsmithJob[];
  pawnRecords: PawnRecord[];
  pawnInterestPayments: PawnInterestPayment[];
  ledger: FinancialLedger[];
  staffUsers: StaffUser[];
  masterCategories: MasterCategory[];
  permissionModules: PermissionModule[];
  rolePermissions: RolePermission[];
  shopSettings: ShopSettings;
  darkMode: boolean;
  language: 'MM' | 'EN';
  selectedVoucher: Transaction | null;
  currentUser: StaffUser | null;
  loading: boolean;
  apiError: string | null;

  setDarkMode: (val: boolean) => void;
  toggleDarkMode: () => void;
  setLanguage: (lang: 'MM' | 'EN') => void;
  toggleLanguage: () => void;
  setSelectedVoucher: (txn: Transaction | null) => void;
  login: (username: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  loginAsUser: (user: StaffUser) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
  can: (moduleKey: string, action: PermissionAction) => boolean;

  updateGoldPrice: (type: GoldPurity, sellPrice: number, buyPrice?: number) => Promise<void>;
  updateShopSettings: (data: Partial<ShopSettings>) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'created_at'>) => Promise<InventoryItem>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  createTransaction: (txnData: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  addCustomOrder: (order: Omit<CustomOrder, 'id' | 'created_at'>) => Promise<CustomOrder>;
  updateCustomOrder: (
    id: string,
    data: Partial<CustomOrder> | Record<string, unknown>
  ) => Promise<CustomOrder>;
  updateOrderStatus: (
    id: string,
    status: CustomOrder['status'],
    remainingPaid?: number,
    opts?: { via_sale?: boolean }
  ) => Promise<void>;
  createGoldsmithJob: (data: Record<string, unknown>) => Promise<GoldsmithJob>;
  returnGoldsmithJob: (id: string, data?: Record<string, unknown>) => Promise<GoldsmithJob>;
  cancelGoldsmithJob: (id: string) => Promise<void>;
  handoffGoldsmithJob: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<{ job: GoldsmithJob; transaction: Transaction }>;
  addPawnRecord: (pawn: Omit<PawnRecord, 'id'>) => Promise<PawnRecord>;
  updatePawnRecord: (id: string, updates: Partial<PawnRecord> | Record<string, unknown>) => Promise<PawnRecord>;
  deletePawnRecord: (id: string) => Promise<void>;
  deletePawnInterestPayment: (id: string) => Promise<void>;
  deletePawnRedeem: (id: string) => Promise<void>;
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
  ) => Promise<PawnInterestPayment>;
  redeemPawnRecord: (
    id: string,
    settlementAmount: number,
    extra?: Record<string, unknown>
  ) => Promise<void>;
  addLedgerEntry: (entry: Omit<FinancialLedger, 'id'>) => Promise<FinancialLedger>;
  updateLedgerEntry: (id: string, entry: Partial<FinancialLedger>) => Promise<FinancialLedger>;
  deleteLedgerEntry: (id: string) => Promise<void>;
  addCustomer: (name: string, phone: string, address: string, nrc?: string) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
  getLivePriceForPurity: (purity: GoldPurity) => number;
  getBuyPriceForPurity: (purity: GoldPurity) => number;
  resetToDemoData: () => Promise<void>;

  createMasterCategory: (
    data: Omit<MasterCategory, 'id' | 'created_at' | 'updated_at' | 'usage_count'>
  ) => Promise<void>;
  updateMasterCategory: (id: string, data: Partial<MasterCategory>) => Promise<void>;
  deleteMasterCategory: (id: string) => Promise<void>;
  createStaffUser: (data: Record<string, unknown>) => Promise<void>;
  updateStaffUser: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteStaffUser: (id: string) => Promise<void>;
  saveRolePermissions: (
    role: UserRole,
    rows: Array<{
      module_key: string;
      can_create: boolean;
      can_read: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>
  ) => Promise<void>;
}

const GoldShopContext = createContext<GoldShopContextType | undefined>(undefined);

const STORAGE_KEYS = {
  DARK_MODE: 'shwe_gold_theme_v2',
  LANG: 'shwe_gold_lang_v1',
  AUTH_USER: 'shwe_gold_auth_user_v1',
};

function applyBootstrap(
  data: BootstrapData,
  setters: {
    setGoldPrices: (v: DailyGoldPrice[]) => void;
    setInventory: (v: InventoryItem[]) => void;
    setCustomers: (v: Customer[]) => void;
    setTransactions: (v: Transaction[]) => void;
    setCustomOrders: (v: CustomOrder[]) => void;
    setGoldsmithJobs: (v: GoldsmithJob[]) => void;
    setPawnRecords: (v: PawnRecord[]) => void;
    setPawnInterestPayments: (v: PawnInterestPayment[]) => void;
    setLedger: (v: FinancialLedger[]) => void;
    setStaffUsers: (v: StaffUser[]) => void;
    setMasterCategories: (v: MasterCategory[]) => void;
    setPermissionModules: (v: PermissionModule[]) => void;
    setRolePermissions: (v: RolePermission[]) => void;
    setShopSettings: (v: ShopSettings) => void;
  }
) {
  setters.setGoldPrices(data.prices);
  setters.setInventory(data.inventory);
  setters.setCustomers(data.customers);
  setters.setTransactions(data.transactions);
  setters.setCustomOrders(data.orders);
  setters.setGoldsmithJobs(data.goldsmithJobs || []);
  setters.setPawnRecords(data.pawns);
  setters.setPawnInterestPayments(data.interestPayments || []);
  setters.setLedger(data.ledger);
  setters.setStaffUsers(data.staff);
  setters.setMasterCategories(data.categories || []);
  setters.setPermissionModules(data.modules || []);
  setters.setRolePermissions(data.rolePermissions || []);
  setters.setShopSettings({
    kyat_to_grams: data.settings?.kyat_to_grams || KYAT_TO_GRAMS,
    baht_mmk_rate:
      data.settings?.baht_mmk_rate ||
      (data.settings?.baht_to_mmk_sell
        ? 100000 / Number(data.settings.baht_to_mmk_sell)
        : 100000 / 765),
    thai_gold_baht: data.settings?.thai_gold_baht || 65000,
  });
}

export const GoldShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'dark';
    } catch {
      return false;
    }
  });

  const [language, setLanguage] = useState<'MM' | 'EN'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    return (saved as 'MM' | 'EN') || 'MM';
  });

  const [selectedVoucher, setSelectedVoucher] = useState<Transaction | null>(null);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [goldPrices, setGoldPrices] = useState<DailyGoldPrice[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [goldsmithJobs, setGoldsmithJobs] = useState<GoldsmithJob[]>([]);
  const [pawnRecords, setPawnRecords] = useState<PawnRecord[]>([]);
  const [pawnInterestPayments, setPawnInterestPayments] = useState<PawnInterestPayment[]>([]);
  const [ledger, setLedger] = useState<FinancialLedger[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
  const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    kyat_to_grams: KYAT_TO_GRAMS,
    baht_mmk_rate: 100000 / 765,
    thai_gold_baht: 65000,
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const setters = {
    setGoldPrices,
    setInventory,
    setCustomers,
    setTransactions,
    setCustomOrders,
    setGoldsmithJobs,
    setPawnRecords,
    setPawnInterestPayments,
    setLedger,
    setStaffUsers,
    setMasterCategories,
    setPermissionModules,
    setRolePermissions,
    setShopSettings,
  };

  const refreshData = useCallback(async (force = false) => {
    const key = cacheKey(['bootstrap']);
    if (!force) {
      const cached = cacheGet<BootstrapData>(key);
      if (cached) {
        applyBootstrap(cached, setters);
        setApiError(null);
        return;
      }
    }
    const data = await api.bootstrap();
    cacheSet(key, data, 20_000);
    applyBootstrap(data, setters);
    setApiError(null);
  }, []);

  const invalidateAndRefresh = useCallback(async () => {
    cacheInvalidate('bootstrap');
    cacheInvalidate('reports');
    await refreshData(true);
  }, [refreshData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await refreshData(false);
      } catch (err) {
        if (!cancelled) {
          setApiError(err instanceof Error ? err.message : 'Failed to load data from API');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshData]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(STORAGE_KEYS.DARK_MODE, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(STORAGE_KEYS.DARK_MODE, 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LANG, language);
  }, [language]);

  // Refresh permissions on current user when rolePermissions load / role changes
  useEffect(() => {
    if (!currentUser) return;
    const perms =
      currentUser.permissions && currentUser.permissions.length
        ? currentUser.permissions
        : rolePermissions.filter((p) => p.role === currentUser.role);
    if (!currentUser.permissions?.length && perms.length) {
      const next = { ...currentUser, permissions: perms };
      setCurrentUser(next);
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(next));
    }
  }, [rolePermissions, currentUser?.role]);

  const login = async (username: string, pin: string) => {
    try {
      const user = await api.login(username, pin);
      const withPerms: StaffUser = {
        ...user,
        permissions:
          user.permissions ||
          rolePermissions.filter((p) => p.role === user.role) ||
          (await api.listPermissionsByRole(user.role)),
      };
      setCurrentUser(withPerms);
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(withPerms));
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : language === 'MM'
              ? 'အကောင့်ဝင်ရောက်မှု မအောင်မြင်ပါ'
              : 'Login failed',
      };
    }
  };

  const loginAsUser = async (user: StaffUser) => {
    await login(user.username, '1234');
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  };

  const can = (moduleKey: string, action: PermissionAction): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'OWNER') return true;
    const perms =
      currentUser.permissions ||
      rolePermissions.filter((p) => p.role === currentUser.role);
    const row = perms.find((p) => p.module_key === moduleKey);
    if (!row) return false;
    if (action === 'create') return !!row.can_create;
    if (action === 'read') return !!row.can_read;
    if (action === 'update') return !!row.can_update;
    if (action === 'delete') return !!row.can_delete;
    return false;
  };

  const getLivePriceForPurity = (purity: GoldPurity): number => {
    const specific = goldPrices.find((p) => p.gold_type === purity);
    if (specific && specific.price_per_kyat > 0) return specific.price_per_kyat;
    const meelin = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
    if (purity === 'THAI_GOLD') return Math.round(meelin * (PURITY_MULTIPLIERS.THAI_GOLD || 0.965));
    const derived = derivePriceFromMeelin(meelin, purity);
    return derived > 0 ? derived : meelin;
  };

  const getBuyPriceForPurity = (purity: GoldPurity): number => {
    const specific = goldPrices.find((p) => p.gold_type === purity);
    if (specific?.buy_price_per_kyat && specific.buy_price_per_kyat > 0) {
      return specific.buy_price_per_kyat;
    }
    const meelinBuy =
      goldPrices.find((p) => p.gold_type === 'MEELIN')?.buy_price_per_kyat || 5700000;
    if (purity === 'THAI_GOLD') return Math.round(meelinBuy * (PURITY_MULTIPLIERS.THAI_GOLD || 0.965));
    const derived = derivePriceFromMeelin(meelinBuy, purity);
    return derived > 0 ? derived : meelinBuy;
  };

  const toggleDarkMode = () => setDarkMode((prev) => !prev);
  const toggleLanguage = () => setLanguage((prev) => (prev === 'MM' ? 'EN' : 'MM'));

  const updateGoldPrice = async (type: GoldPurity, sellPrice: number, buyPrice?: number) => {
    await api.updateGoldPrice(type, sellPrice, buyPrice);
    await invalidateAndRefresh();
  };

  const updateShopSettings = async (data: Partial<ShopSettings>) => {
    const next = await api.updateSettings(data);
    setShopSettings(next);
    cacheInvalidate('bootstrap');
  };

  const addInventoryItem = async (itemData: Omit<InventoryItem, 'id' | 'created_at'>) => {
    const item = await api.addInventoryItem(itemData);
    await invalidateAndRefresh();
    return item;
  };

  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    await api.updateInventoryItem(id, updates);
    await invalidateAndRefresh();
  };

  const deleteInventoryItem = async (id: string) => {
    await api.deleteInventoryItem(id);
    await invalidateAndRefresh();
  };

  const addCustomer = async (name: string, phone: string, address: string, nrc?: string) => {
    const customer = await api.addCustomer(name, phone, address, nrc);
    await invalidateAndRefresh();
    return customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const customer = await api.updateCustomer(id, updates);
    await invalidateAndRefresh();
    return customer;
  };

  const deleteCustomer = async (id: string) => {
    await api.deleteCustomer(id);
    await invalidateAndRefresh();
  };

  const createTransaction = async (txnData: Omit<Transaction, 'id' | 'created_at'>) => {
    const txn = await api.createTransaction(txnData);
    await invalidateAndRefresh();
    return txn;
  };

  const deleteTransaction = async (id: string) => {
    await api.deleteTransaction(id);
    await invalidateAndRefresh();
  };

  const addCustomOrder = async (orderData: Omit<CustomOrder, 'id' | 'created_at'>) => {
    const order = await api.addCustomOrder(orderData);
    await invalidateAndRefresh();
    return order;
  };

  const updateCustomOrder = async (
    id: string,
    data: Partial<CustomOrder> | Record<string, unknown>
  ) => {
    const order = await api.updateCustomOrder(id, data as Record<string, unknown>);
    await invalidateAndRefresh();
    return order;
  };

  const updateOrderStatus = async (
    id: string,
    status: CustomOrder['status'],
    remainingPaid?: number,
    opts?: { via_sale?: boolean }
  ) => {
    await api.updateOrderStatus(id, status, remainingPaid, opts);
    await invalidateAndRefresh();
  };

  const createGoldsmithJob = async (data: Record<string, unknown>) => {
    const job = await api.createGoldsmithJob(data);
    await invalidateAndRefresh();
    return job;
  };

  const returnGoldsmithJob = async (id: string, data?: Record<string, unknown>) => {
    const job = await api.returnGoldsmithJob(id, data);
    await invalidateAndRefresh();
    return job;
  };

  const cancelGoldsmithJob = async (id: string) => {
    await api.cancelGoldsmithJob(id);
    await invalidateAndRefresh();
  };

  const handoffGoldsmithJob = async (id: string, data: Record<string, unknown>) => {
    const result = await api.handoffGoldsmithJob(id, data);
    await invalidateAndRefresh();
    return result;
  };

  const addPawnRecord = async (pawnData: Omit<PawnRecord, 'id'>) => {
    const pawn = await api.addPawnRecord(pawnData);
    await invalidateAndRefresh();
    return pawn;
  };

  const updatePawnRecord = async (
    id: string,
    updates: Partial<PawnRecord> | Record<string, unknown>
  ) => {
    const pawn = await api.updatePawnRecord(id, updates);
    await invalidateAndRefresh();
    return pawn;
  };

  const deletePawnRecord = async (id: string) => {
    await api.deletePawnRecord(id);
    await invalidateAndRefresh();
  };

  const deletePawnInterestPayment = async (id: string) => {
    await api.deletePawnInterestPayment(id);
    await invalidateAndRefresh();
  };

  const deletePawnRedeem = async (id: string) => {
    await api.deletePawnRedeem(id);
    await invalidateAndRefresh();
  };

  const payPawnInterest = async (
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
  ) => {
    const row = await api.payPawnInterest(id, data);
    await invalidateAndRefresh();
    return row;
  };

  const redeemPawnRecord = async (
    id: string,
    settlementAmount: number,
    extra?: Record<string, unknown>
  ) => {
    await api.redeemPawnRecord(id, settlementAmount, extra);
    await invalidateAndRefresh();
  };

  const addLedgerEntry = async (entry: Omit<FinancialLedger, 'id'>) => {
    const row = await api.addLedgerEntry(entry);
    await invalidateAndRefresh();
    return row;
  };

  const updateLedgerEntry = async (id: string, entry: Partial<FinancialLedger>) => {
    const row = await api.updateLedgerEntry(id, entry);
    await invalidateAndRefresh();
    return row;
  };

  const deleteLedgerEntry = async (id: string) => {
    await api.deleteLedgerEntry(id);
    await invalidateAndRefresh();
  };

  const createMasterCategory = async (
    data: Omit<MasterCategory, 'id' | 'created_at' | 'updated_at' | 'usage_count'>
  ) => {
    await api.createCategory(data);
    await invalidateAndRefresh();
  };

  const updateMasterCategory = async (id: string, data: Partial<MasterCategory>) => {
    await api.updateCategory(id, data);
    await invalidateAndRefresh();
  };

  const deleteMasterCategory = async (id: string) => {
    await api.deleteCategory(id);
    await invalidateAndRefresh();
  };

  const createStaffUser = async (data: Record<string, unknown>) => {
    await api.createStaff(data);
    await invalidateAndRefresh();
  };

  const updateStaffUser = async (id: string, data: Record<string, unknown>) => {
    await api.updateStaff(id, data);
    await invalidateAndRefresh();
  };

  const deleteStaffUser = async (id: string) => {
    await api.deleteStaff(id);
    await invalidateAndRefresh();
  };

  const saveRolePermissions = async (
    role: UserRole,
    rows: Array<{
      module_key: string;
      can_create: boolean;
      can_read: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>
  ) => {
    if (role === 'OWNER') return;
    await api.updatePermissions({ role, rows });
    await invalidateAndRefresh();
    if (currentUser?.role === role) {
      const perms = await api.listPermissionsByRole(role);
      const next = { ...currentUser, permissions: perms };
      setCurrentUser(next);
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(next));
    }
  };

  const resetToDemoData = async () => {
    cacheInvalidate();
    const data = await api.resetToDemoData();
    cacheSet(cacheKey(['bootstrap']), data, 20_000);
    applyBootstrap(data, setters);
  };

  return (
    <GoldShopContext.Provider
      value={{
        goldPrices,
        inventory,
        customers,
        transactions,
        customOrders,
        goldsmithJobs,
        pawnRecords,
        pawnInterestPayments,
        ledger,
        staffUsers,
        masterCategories,
        permissionModules,
        rolePermissions,
        shopSettings,
        darkMode,
        language,
        selectedVoucher,
        currentUser,
        loading,
        apiError,
        setDarkMode,
        toggleDarkMode,
        setLanguage,
        toggleLanguage,
        setSelectedVoucher,
        login,
        loginAsUser,
        logout,
        refreshData: invalidateAndRefresh,
        can,
        updateGoldPrice,
        updateShopSettings,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        createTransaction,
        deleteTransaction,
        addCustomOrder,
        updateCustomOrder,
        updateOrderStatus,
        createGoldsmithJob,
        returnGoldsmithJob,
        cancelGoldsmithJob,
        handoffGoldsmithJob,
        addPawnRecord,
        updatePawnRecord,
        deletePawnRecord,
        deletePawnInterestPayment,
        deletePawnRedeem,
        payPawnInterest,
        redeemPawnRecord,
        addLedgerEntry,
        updateLedgerEntry,
        deleteLedgerEntry,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        getLivePriceForPurity,
        getBuyPriceForPurity,
        resetToDemoData,
        createMasterCategory,
        updateMasterCategory,
        deleteMasterCategory,
        createStaffUser,
        updateStaffUser,
        deleteStaffUser,
        saveRolePermissions,
      }}
    >
      {children}
    </GoldShopContext.Provider>
  );
};

export const useGoldShop = () => {
  const ctx = useContext(GoldShopContext);
  if (!ctx) throw new Error('useGoldShop must be used within GoldShopProvider');
  return ctx;
};
