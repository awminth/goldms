import type { Request, Response, NextFunction } from 'express';
import { shopService } from '../services/shop.service.js';
import { parsePagination, paginateSlice } from '../utils/helpers.js';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function maybePaginate<T>(req: Request, items: T[]) {
  if (req.query.page == null && req.query.pageSize == null && req.query.limit == null) {
    return items;
  }
  const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
  return paginateSlice(items, page, pageSize);
}

export const healthController = {
  check: asyncHandler(async (_req, res) => {
    res.json({ success: true, status: 'ok', service: 'goldms-api' });
  }),
};

export const authController = {
  login: asyncHandler(async (req, res) => {
    const { username, pin, password } = req.body as {
      username?: string;
      pin?: string;
      password?: string;
    };
    const secret = pin || password;
    if (!username || !secret) {
      res.status(400).json({ success: false, message: 'Username and PIN/password are required' });
      return;
    }
    const user = await shopService.login(username, secret);
    res.json({ success: true, data: user });
  }),

  listStaff: asyncHandler(async (req, res) => {
    const includeInactive = String(req.query.all || '') === '1';
    const staff = await shopService.listStaff(includeInactive);
    res.json({ success: true, data: staff });
  }),

  createStaff: asyncHandler(async (req, res) => {
    const data = await shopService.createStaff(req.body);
    res.status(201).json({ success: true, data });
  }),

  updateStaff: asyncHandler(async (req, res) => {
    const data = await shopService.updateStaff(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  deleteStaff: asyncHandler(async (req, res) => {
    await shopService.deleteStaff(req.params.id);
    res.json({ success: true });
  }),

  listPermissionsByRole: asyncHandler(async (req, res) => {
    const role = String(req.params.role || 'CASHIER');
    res.json({ success: true, data: await shopService.listPermissionsByRole(role) });
  }),

  listAllPermissions: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await shopService.listAllRolePermissions() });
  }),

  listModules: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await shopService.listPermissionModules() });
  }),

  updatePermissions: asyncHandler(async (req, res) => {
    const { role, rows, module_key, can_create, can_read, can_update, can_delete } = req.body as {
      role?: string;
      module_key?: string;
      can_create?: boolean;
      can_read?: boolean;
      can_update?: boolean;
      can_delete?: boolean;
      rows?: Array<{
        module_key: string;
        can_create: boolean;
        can_read: boolean;
        can_update: boolean;
        can_delete: boolean;
      }>;
    };
    if (!role) {
      res.status(400).json({ success: false, message: 'role required' });
      return;
    }
    if (Array.isArray(rows)) {
      const data = await shopService.bulkUpdateRolePermissions(role, rows);
      res.json({ success: true, data });
      return;
    }
    if (!module_key) {
      res.status(400).json({ success: false, message: 'module_key or rows required' });
      return;
    }
    const data = await shopService.updateRolePermission(role, module_key, {
      can_create,
      can_read,
      can_update,
      can_delete,
    });
    res.json({ success: true, data });
  }),
};

export const shopController = {
  bootstrap: asyncHandler(async (_req, res) => {
    const data = await shopService.getBootstrap();
    res.json({ success: true, data });
  }),

  listPrices: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await shopService.listPrices() });
  }),

  updatePrice: asyncHandler(async (req, res) => {
    const { gold_type, sellPrice, buyPrice, updates } = req.body as {
      gold_type?: string;
      sellPrice?: number;
      buyPrice?: number;
      updates?: Array<{ gold_type: string; sellPrice: number; buyPrice?: number }>;
    };

    if (Array.isArray(updates) && updates.length > 0) {
      const data = await shopService.updateGoldPricesBulk(updates);
      res.json({ success: true, data });
      return;
    }

    if (!gold_type || sellPrice === undefined) {
      res.status(400).json({ success: false, message: 'gold_type and sellPrice required' });
      return;
    }
    const data = await shopService.updateGoldPrice(
      gold_type,
      Number(sellPrice),
      buyPrice !== undefined ? Number(buyPrice) : undefined
    );
    res.json({ success: true, data });
  }),

  listCustomers: asyncHandler(async (req, res) => {
    const items = await shopService.listCustomers();
    res.json({ success: true, data: maybePaginate(req, items) });
  }),

  addCustomer: asyncHandler(async (req, res) => {
    const { name, phone, address, nrc } = req.body as {
      name?: string;
      phone?: string;
      address?: string;
      nrc?: string;
    };
    if (!name || !phone) {
      res.status(400).json({ success: false, message: 'name and phone required' });
      return;
    }
    const data = await shopService.addCustomer(name, phone, address ?? '', nrc ?? '');
    res.status(201).json({ success: true, data });
  }),

  updateCustomer: asyncHandler(async (req, res) => {
    const data = await shopService.updateCustomer(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  deleteCustomer: asyncHandler(async (req, res) => {
    await shopService.deleteCustomer(req.params.id);
    res.json({ success: true });
  }),

  listInventory: asyncHandler(async (req, res) => {
    const items = await shopService.listInventory();
    res.json({ success: true, data: maybePaginate(req, items) });
  }),

  addInventory: asyncHandler(async (req, res) => {
    const data = await shopService.addInventoryItem(req.body);
    res.status(201).json({ success: true, data });
  }),

  updateInventory: asyncHandler(async (req, res) => {
    const data = await shopService.updateInventoryItem(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  deleteInventory: asyncHandler(async (req, res) => {
    await shopService.deleteInventoryItem(req.params.id);
    res.json({ success: true });
  }),

  listTransactions: asyncHandler(async (req, res) => {
    const items = await shopService.listTransactions();
    res.json({ success: true, data: maybePaginate(req, items) });
  }),

  createTransaction: asyncHandler(async (req, res) => {
    const data = await shopService.createTransaction(req.body);
    res.status(201).json({ success: true, data });
  }),

  deleteTransaction: asyncHandler(async (req, res) => {
    await shopService.deleteTransaction(req.params.id);
    res.json({ success: true });
  }),

  listOrders: asyncHandler(async (req, res) => {
    const items = await shopService.listOrders();
    res.json({ success: true, data: maybePaginate(req, items) });
  }),

  addOrder: asyncHandler(async (req, res) => {
    const data = await shopService.addOrder(req.body);
    res.status(201).json({ success: true, data });
  }),

  updateOrder: asyncHandler(async (req, res) => {
    const data = await shopService.updateOrder(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  updateOrderStatus: asyncHandler(async (req, res) => {
    const { status, remainingPaid, via_sale } = req.body as {
      status?: string;
      remainingPaid?: number;
      via_sale?: boolean;
    };
    if (!status) {
      res.status(400).json({ success: false, message: 'status required' });
      return;
    }
    const data = await shopService.updateOrderStatus(
      req.params.id,
      status,
      remainingPaid !== undefined ? Number(remainingPaid) : undefined,
      { via_sale: Boolean(via_sale) }
    );
    res.json({ success: true, data });
  }),

  listGoldsmithJobs: asyncHandler(async (req, res) => {
    const items = await shopService.listGoldsmithJobs();
    res.json({ success: true, data: maybePaginate(req, items) });
  }),

  createGoldsmithJob: asyncHandler(async (req, res) => {
    const data = await shopService.createGoldsmithJob(req.body);
    res.status(201).json({ success: true, data });
  }),

  returnGoldsmithJob: asyncHandler(async (req, res) => {
    const data = await shopService.returnGoldsmithJob(req.params.id, req.body || {});
    res.json({ success: true, data });
  }),

  cancelGoldsmithJob: asyncHandler(async (req, res) => {
    await shopService.cancelGoldsmithJob(req.params.id);
    res.json({ success: true, data: null });
  }),

  handoffGoldsmithJob: asyncHandler(async (req, res) => {
    const data = await shopService.handoffGoldsmithJob(req.params.id, req.body || {});
    res.json({ success: true, data });
  }),

  oldGoldAvailable: asyncHandler(async (req, res) => {
    const purity = typeof req.query.purity === 'string' ? req.query.purity : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const available = await shopService.oldGoldAvailableGrams(purity, category);
    res.json({ success: true, data: { available } });
  }),

  listPawns: asyncHandler(async (req, res) => {
    const items = await shopService.listPawns();
    res.json({ success: true, data: maybePaginate(req, items) });
  }),

  listPawnInterestPayments: asyncHandler(async (req, res) => {
    const items = await shopService.listPawnInterestPayments();
    res.json({ success: true, data: maybePaginate(req, items) });
  }),

  addPawn: asyncHandler(async (req, res) => {
    const data = await shopService.addPawn(req.body);
    res.status(201).json({ success: true, data });
  }),

  updatePawn: asyncHandler(async (req, res) => {
    const data = await shopService.updatePawn(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  deletePawn: asyncHandler(async (req, res) => {
    const data = await shopService.deletePawn(req.params.id);
    res.json({ success: true, data });
  }),

  deletePawnInterestPayment: asyncHandler(async (req, res) => {
    const data = await shopService.deletePawnInterestPayment(req.params.id);
    res.json({ success: true, data });
  }),

  payPawnInterest: asyncHandler(async (req, res) => {
    const data = await shopService.payPawnInterest(req.params.id, req.body);
    res.status(201).json({ success: true, data });
  }),

  redeemPawn: asyncHandler(async (req, res) => {
    const body = req.body as {
      settlementAmount?: number;
      redeem_total_kyat?: number;
      [key: string]: unknown;
    };
    const settlement =
      body.settlementAmount !== undefined
        ? Number(body.settlementAmount)
        : Number(body.redeem_total_kyat ?? 0);
    if (!Number.isFinite(settlement)) {
      res.status(400).json({ success: false, message: 'settlementAmount required' });
      return;
    }
    const data = await shopService.redeemPawn(req.params.id, settlement, body);
    res.json({ success: true, data });
  }),

  deletePawnRedeem: asyncHandler(async (req, res) => {
    const data = await shopService.deletePawnRedeem(req.params.id);
    res.json({ success: true, data });
  }),

  listLedger: asyncHandler(async (req, res) => {
    const items = await shopService.listLedger();
    res.json({ success: true, data: maybePaginate(req, items) });
  }),

  addLedger: asyncHandler(async (req, res) => {
    const data = await shopService.addLedgerEntry(req.body);
    res.status(201).json({ success: true, data });
  }),

  updateLedger: asyncHandler(async (req, res) => {
    const data = await shopService.updateLedgerEntry(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  deleteLedger: asyncHandler(async (req, res) => {
    await shopService.deleteLedgerEntry(req.params.id);
    res.json({ success: true });
  }),

  resetDemo: asyncHandler(async (_req, res) => {
    const data = await shopService.resetDemoData();
    res.json({ success: true, data });
  }),

  calcValuation: asyncHandler(async (req, res) => {
    res.json({ success: true, data: shopService.calcValuation(req.body) });
  }),

  calcThai: asyncHandler(async (req, res) => {
    res.json({ success: true, data: shopService.calcThai(req.body) });
  }),

  allocateBarcode: asyncHandler(async (_req, res) => {
    const barcode = await shopService.allocateUniqueBarcode();
    res.json({ success: true, data: { barcode } });
  }),

  revalueInventory: asyncHandler(async (_req, res) => {
    const data = await shopService.revalueInStockInventory();
    res.json({ success: true, data });
  }),

  reportSummary: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await shopService.reportSummary() });
  }),

  reportFinancial: asyncHandler(async (req, res) => {
    const from = req.query.from != null ? String(req.query.from) : undefined;
    const to = req.query.to != null ? String(req.query.to) : undefined;
    res.json({ success: true, data: await shopService.reportFinancial(from, to) });
  }),

  reportSalesPerformance: asyncHandler(async (req, res) => {
    const month = req.query.month != null ? String(req.query.month) : undefined;
    res.json({ success: true, data: await shopService.reportSalesPerformance(month) });
  }),

  getSettings: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await shopService.getShopSettings() });
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const data = await shopService.updateShopSettings(req.body || {});
    res.json({ success: true, data });
  }),

  listCategories: asyncHandler(async (req, res) => {
    const all = String(req.query.all || '') === '1';
    res.json({ success: true, data: await shopService.listMasterCategories(!all) });
  }),

  addCategory: asyncHandler(async (req, res) => {
    const data = await shopService.createMasterCategory(req.body);
    res.status(201).json({ success: true, data });
  }),

  updateCategory: asyncHandler(async (req, res) => {
    const data = await shopService.updateMasterCategory(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  deleteCategory: asyncHandler(async (req, res) => {
    const data = await shopService.deleteMasterCategory(req.params.id);
    res.json({ success: true, data });
  }),
};
