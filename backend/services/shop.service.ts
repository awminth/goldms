import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { num, optionalStrId, parseId, parseOptionalId, strId, toIso } from '../utils/helpers.js';
import {
  derivePriceFromMeelin,
  derivedPricesFromMeelin,
  calculateNetWeight,
  calculateNetFromParts,
  calculateGoldValuation,
  calculateThaiGoldPrice,
  calculateSaleLineBreakdown,
  estimateSellingPrice,
  generateBarcode,
  generateInvoiceNo,
  kpyToYway,
  type WeightKPY,
} from '../utils/goldCalculations.js';

function mapStaff(row: RowDataPacket) {
  return {
    id: strId(row.id),
    username: row.username,
    name: row.name,
    nameMM: row.name_mm,
    role: row.role as 'OWNER' | 'MANAGER' | 'CASHIER',
    phone: row.phone ?? undefined,
    avatarColor: row.avatar_color,
    is_active: row.is_active == null ? true : Boolean(Number(row.is_active)),
  };
}

function mapMasterCategory(row: RowDataPacket) {
  return {
    id: strId(row.id),
    code: row.code,
    name_mm: row.name_mm,
    name_en: row.name_en,
    category_group: (row.category_group as 'PRODUCT' | 'GOLD_CLASS' | 'OTHER') || 'PRODUCT',
    description: row.description ? String(row.description) : '',
    sort_order: Number(row.sort_order || 0),
    is_active: Boolean(Number(row.is_active)),
    usage_count: row.usage_count != null ? Number(row.usage_count) : undefined,
    created_at: toIso(row.created_at),
    updated_at: row.updated_at ? toIso(row.updated_at) : undefined,
  };
}

const CATEGORY_GROUPS = new Set(['PRODUCT', 'GOLD_CLASS', 'OTHER']);

function normalizeCategoryCode(raw: unknown) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function normalizeCategoryGroup(raw: unknown): 'PRODUCT' | 'GOLD_CLASS' | 'OTHER' {
  const g = String(raw || 'PRODUCT').toUpperCase();
  return CATEGORY_GROUPS.has(g) ? (g as 'PRODUCT' | 'GOLD_CLASS' | 'OTHER') : 'PRODUCT';
}

function mapPermissionModule(row: RowDataPacket) {
  return {
    id: strId(row.id),
    module_key: row.module_key,
    name_mm: row.name_mm,
    name_en: row.name_en,
    sort_order: Number(row.sort_order || 0),
  };
}

function mapRolePermission(row: RowDataPacket) {
  return {
    id: strId(row.id),
    role: row.role as 'OWNER' | 'MANAGER' | 'CASHIER',
    module_key: row.module_key,
    can_create: Boolean(Number(row.can_create)),
    can_read: Boolean(Number(row.can_read)),
    can_update: Boolean(Number(row.can_update)),
    can_delete: Boolean(Number(row.can_delete)),
    name_mm: row.name_mm ?? undefined,
    name_en: row.name_en ?? undefined,
  };
}

function mapPrice(row: RowDataPacket) {
  return {
    id: strId(row.id),
    gold_type: row.gold_type,
    name_mm: row.name_mm,
    name_en: row.name_en,
    price_per_kyat: num(row.price_per_kyat),
    buy_price_per_kyat: num(row.buy_price_per_kyat),
    updated_at: toIso(row.updated_at),
  };
}

function mapCustomer(row: RowDataPacket) {
  return {
    id: strId(row.id),
    name: row.name,
    phone: row.phone,
    address: row.address ?? '',
    created_at: toIso(row.created_at),
    outstanding_balance: num(row.outstanding_balance),
  };
}

function mapInventory(row: RowDataPacket) {
  return {
    id: strId(row.id),
    barcode: row.barcode,
    category: row.category,
    name: row.name,
    name_mm: row.name_mm,
    weight_kyat: num(row.weight_kyat),
    weight_pae: num(row.weight_pae),
    weight_yway: num(row.weight_yway),
    gemstone_weight_kyat: num(row.gemstone_weight_kyat),
    gemstone_weight_pae: num(row.gemstone_weight_pae),
    gemstone_weight_yway: num(row.gemstone_weight_yway),
    craft_deduction_pae: num(row.craft_deduction_pae),
    craft_deduction_yway: num(row.craft_deduction_yway),
    profit_deduction_pae: num(row.profit_deduction_pae),
    profit_deduction_yway: num(row.profit_deduction_yway),
    deduction_pae: num(row.deduction_pae),
    deduction_yway: num(row.deduction_yway),
    net_weight_kyat: num(row.net_weight_kyat),
    net_weight_pae: num(row.net_weight_pae),
    net_weight_yway: num(row.net_weight_yway),
    purity: row.purity,
    item_type: row.item_type,
    craftsmanship_fee: num(row.craftsmanship_fee),
    stone_price: num(row.stone_price),
    selling_price_estimated: num(row.selling_price_estimated),
    status: row.status,
    thai_weight_unit: row.thai_weight_unit != null ? num(row.thai_weight_unit) : undefined,
    created_at: toIso(row.created_at),
    image_url: row.image_url ?? undefined,
  };
}

function mapTxnItem(row: RowDataPacket) {
  return {
    id: strId(row.id),
    transaction_id: strId(row.transaction_id),
    item_id: optionalStrId(row.item_id),
    item_name: row.item_name,
    category: row.category,
    weight: {
      kyat: num(row.weight_kyat),
      pae: num(row.weight_pae),
      yway: num(row.weight_yway),
    },
    gemstone_weight: {
      kyat: num(row.gemstone_weight_kyat),
      pae: num(row.gemstone_weight_pae),
      yway: num(row.gemstone_weight_yway),
    },
    net_weight: {
      kyat: num(row.net_weight_kyat),
      pae: num(row.net_weight_pae),
      yway: num(row.net_weight_yway),
    },
    purity: row.purity,
    gold_price_snapshot: num(row.gold_price_snapshot),
    gold_amount: num(row.gold_amount),
    craftsmanship_fee: num(row.craftsmanship_fee),
    stone_price: num(row.stone_price),
    subtotal: num(row.subtotal),
    item_type: row.item_type,
  };
}

function mapTxn(row: RowDataPacket, items: ReturnType<typeof mapTxnItem>[] = []) {
  return {
    id: strId(row.id),
    invoice_no: row.invoice_no,
    customer_id: strId(row.customer_id ?? ''),
    customer_name: row.customer_name,
    customer_phone: row.customer_phone ?? '',
    transaction_type: row.transaction_type,
    items,
    gold_price_snapshot: num(row.gold_price_snapshot),
    craftsmanship_total: num(row.craftsmanship_total),
    stone_total: num(row.stone_total),
    discount_amount: num(row.discount_amount),
    tax_amount: num(row.tax_amount),
    total_amount: num(row.total_amount),
    paid_amount: num(row.paid_amount),
    remaining_amount: num(row.remaining_amount),
    interest_rate: num(row.interest_rate),
    credit_due_date: row.credit_due_date ? String(row.credit_due_date).slice(0, 10) : undefined,
    is_installment: Boolean(Number(row.is_installment || 0)),
    payment_method: row.payment_method,
    notes: row.notes ?? undefined,
    created_at: toIso(row.created_at),
  };
}

function mapOrder(row: RowDataPacket) {
  return {
    id: strId(row.id),
    order_no: row.order_no,
    customer_id: strId(row.customer_id ?? ''),
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    item_type: row.item_type,
    description: row.description,
    purity: row.purity,
    target_weight: {
      kyat: num(row.target_weight_kyat),
      pae: num(row.target_weight_pae),
      yway: num(row.target_weight_yway),
    },
    craftsmanship_fee: num(row.craftsmanship_fee),
    deposit_amount: num(row.deposit_amount),
    estimated_total_price: num(row.estimated_total_price),
    remaining_balance: num(row.remaining_balance),
    order_date: String(row.order_date).slice(0, 10),
    due_date: String(row.due_date).slice(0, 10),
    status: row.status,
    gold_rate_snapshot: num(row.gold_rate_snapshot),
    created_at: toIso(row.created_at),
  };
}

function mapPawn(row: RowDataPacket) {
  const start = String(row.start_date).slice(0, 10);
  const due = String(row.due_date).slice(0, 10);
  const rate = num(row.monthly_interest_rate);
  const principal = num(row.loan_amount);
  const storedAccrued = num(row.accrued_interest);
  // Accrue by full months elapsed since start (min 1 month while active)
  let months = 1;
  try {
    const s = new Date(start);
    const now = new Date();
    months = Math.max(
      1,
      (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth())
    );
  } catch {
    months = 1;
  }
  const liveAccrued =
    row.status === 'REDEEMED' || row.status === 'CONFISCATED'
      ? storedAccrued
      : Math.round((principal * rate * months) / 100);

  return {
    id: strId(row.id),
    pawn_ticket_no: row.pawn_ticket_no,
    vno: row.vno ?? undefined,
    customer_id: strId(row.customer_id ?? ''),
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    item_name: row.item_name,
    item_type: row.item_type ?? undefined,
    gold_kind: row.gold_kind ?? undefined,
    weight: {
      kyat: num(row.weight_kyat),
      pae: num(row.weight_pae),
      yway: num(row.weight_yway),
    },
    weight_grams: num(row.weight_grams),
    purity: row.purity,
    evaluated_value: num(row.evaluated_value),
    loan_amount: principal,
    loan_amount_baht: num(row.loan_amount_baht),
    monthly_interest_rate: rate,
    loss_months: num(row.loss_months, 3),
    start_date: start,
    due_date: due,
    last_interest_date: row.last_interest_date
      ? String(row.last_interest_date).slice(0, 10)
      : undefined,
    next_interest_date: row.next_interest_date
      ? String(row.next_interest_date).slice(0, 10)
      : undefined,
    status: row.status,
    accrued_interest: liveAccrued,
    interest_paid_kyat: num(row.interest_paid_kyat),
    interest_paid_baht: num(row.interest_paid_baht),
    redeem_date: row.redeem_date ? String(row.redeem_date).slice(0, 10) : undefined,
    redeem_months: row.redeem_months != null ? num(row.redeem_months) : undefined,
    redeem_interest_kyat: row.redeem_interest_kyat != null ? num(row.redeem_interest_kyat) : undefined,
    redeem_interest_baht: row.redeem_interest_baht != null ? num(row.redeem_interest_baht) : undefined,
    discount_kyat: row.discount_kyat != null ? num(row.discount_kyat) : undefined,
    discount_baht: row.discount_baht != null ? num(row.discount_baht) : undefined,
    redeem_total_kyat: row.redeem_total_kyat != null ? num(row.redeem_total_kyat) : undefined,
    redeem_total_baht: row.redeem_total_baht != null ? num(row.redeem_total_baht) : undefined,
    notes: row.notes ?? undefined,
    customer_signature: row.customer_signature ?? undefined,
    owner_signature: row.owner_signature ?? undefined,
  };
}

function mapPawnInterest(row: RowDataPacket) {
  return {
    id: strId(row.id),
    pawn_id: strId(row.pawn_id),
    voucher_no: row.voucher_no,
    payment_date: String(row.payment_date).slice(0, 10),
    months_paid: num(row.months_paid, 1),
    interest_kyat: num(row.interest_kyat),
    interest_baht: num(row.interest_baht),
    interest_rate: num(row.interest_rate),
    notes: row.notes ?? undefined,
    customer_name: row.customer_name ?? undefined,
    customer_phone: row.customer_phone ?? undefined,
    item_name: row.item_name ?? undefined,
    item_type: row.item_type ?? undefined,
    gold_kind: row.gold_kind ?? undefined,
    purity: row.purity ?? undefined,
    weight: row.weight_kyat != null
      ? {
          kyat: num(row.weight_kyat),
          pae: num(row.weight_pae),
          yway: num(row.weight_yway),
        }
      : undefined,
    weight_grams: row.weight_grams != null ? num(row.weight_grams) : undefined,
    loan_amount: row.loan_amount != null ? num(row.loan_amount) : undefined,
    loan_amount_baht: row.loan_amount_baht != null ? num(row.loan_amount_baht) : undefined,
    last_interest_date: row.last_interest_date
      ? String(row.last_interest_date).slice(0, 10)
      : undefined,
    next_interest_date: row.next_interest_date
      ? String(row.next_interest_date).slice(0, 10)
      : undefined,
    created_at: toIso(row.created_at),
  };
}

function mapLedger(row: RowDataPacket) {
  return {
    id: strId(row.id),
    type: row.type,
    category: row.category,
    amount: num(row.amount),
    description: row.description,
    reference_no: row.reference_no ?? undefined,
    date: String(row.date).slice(0, 10),
  };
}

function mapTracking(row: RowDataPacket) {
  return {
    id: strId(row.id),
    customer_id: strId(row.customer_id ?? ''),
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    reference_type: row.reference_type,
    reference_id: strId(row.reference_id),
    reference_no: row.reference_no,
    tracking_type: row.tracking_type,
    amount_due: num(row.amount_due),
    due_date: String(row.due_date).slice(0, 10),
    days_overdue: num(row.days_overdue),
    interest_rate: num(row.interest_rate),
    monthly_interest: num(row.monthly_interest),
    status: row.status,
    notes: row.notes ?? '',
    created_at: toIso(row.created_at),
  };
}

async function insertLedger(
  conn: Awaited<ReturnType<ReturnType<typeof getPool>['getConnection']>>,
  entry: {
    type: 'INCOME' | 'EXPENSE';
    category: string;
    amount: number;
    description: string;
    reference_no?: string;
    date: string;
  }
) {
  await conn.query(
    `INSERT INTO financial_ledger (type, category, amount, description, reference_no, date)
     VALUES (:type, :category, :amount, :description, :reference_no, :date)`,
    {
      type: entry.type,
      category: entry.category,
      amount: entry.amount,
      description: entry.description,
      reference_no: entry.reference_no ?? null,
      date: entry.date,
    }
  );
}

export const shopService = {
  async login(username: string, pin: string) {
    const pool = getPool();
    const trimmed = username.trim().toLowerCase();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM staff_users WHERE is_active = 1 AND (LOWER(username) = :u OR LOWER(name) LIKE :like) LIMIT 1`,
      { u: trimmed, like: `%${trimmed}%` }
    );

    const user = rows[0];
    if (!user) {
      throw new HttpError(401, 'User not found. Use admin, manager, or cashier');
    }

    // Plain-text password comparison (no hashing)
    if (String(user.password) !== String(pin)) {
      throw new HttpError(401, 'Incorrect PIN code (Default: 1234)');
    }

    const staff = mapStaff(user);
    const permissions = await this.listPermissionsByRole(staff.role);
    return { ...staff, permissions };
  },

  async listStaff(includeInactive = false) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      includeInactive
        ? `SELECT * FROM staff_users ORDER BY id ASC`
        : `SELECT * FROM staff_users WHERE is_active = 1 ORDER BY id ASC`
    );
    return rows.map(mapStaff);
  },

  async createStaff(data: Record<string, unknown>) {
    const username = String(data.username || '').trim().toLowerCase();
    const password = String(data.password || data.pin || '1234');
    if (!username || !data.name) throw new HttpError(400, 'username and name required');

    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO staff_users (username, name, name_mm, role, phone, password, avatar_color, is_active)
       VALUES (:username, :name, :name_mm, :role, :phone, :password, :avatar_color, :is_active)`,
      {
        username,
        name: data.name,
        name_mm: data.name_mm || data.nameMM || data.name,
        role: data.role || 'CASHIER',
        phone: data.phone ?? null,
        password,
        avatar_color: data.avatar_color || data.avatarColor || 'from-amber-600 to-yellow-600',
        is_active: data.is_active === false || data.is_active === 0 ? 0 : 1,
      }
    );
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM staff_users WHERE id = :id`,
      { id: result.insertId }
    );
    return mapStaff(rows[0]);
  },

  async updateStaff(id: string, data: Record<string, unknown>) {
    const staffId = parseId(id);
    const allowed = ['name', 'name_mm', 'role', 'phone', 'password', 'avatar_color', 'is_active'] as const;
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: staffId };

    if (data.nameMM !== undefined) data.name_mm = data.nameMM;
    if (data.avatarColor !== undefined) data.avatar_color = data.avatarColor;
    if (data.pin !== undefined && data.password === undefined) data.password = data.pin;

    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`\`${key}\` = :${key}`);
        params[key] = data[key];
      }
    }
    if (data.username !== undefined) {
      sets.push('username = :username');
      params.username = String(data.username).trim().toLowerCase();
    }
    if (!sets.length) throw new HttpError(400, 'No fields to update');

    await getPool().query(`UPDATE staff_users SET ${sets.join(', ')} WHERE id = :id`, params);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM staff_users WHERE id = :id`,
      { id: staffId }
    );
    if (!rows[0]) throw new HttpError(404, 'Staff not found');
    return mapStaff(rows[0]);
  },

  async deleteStaff(id: string) {
    const staffId = parseId(id);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM staff_users WHERE id = :id`,
      { id: staffId }
    );
    if (!rows[0]) throw new HttpError(404, 'Staff not found');
    if (String(rows[0].role) === 'OWNER') {
      const [owners] = await getPool().query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM staff_users WHERE role = 'OWNER' AND is_active = 1`
      );
      if (Number(owners[0]?.c || 0) <= 1) {
        throw new HttpError(400, 'Cannot delete the last owner account');
      }
    }
    await getPool().query(`DELETE FROM staff_users WHERE id = :id`, { id: staffId });
  },

  async getShopSettings() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM shop_settings`
    );
    const map = new Map(rows.map((r) => [String(r.setting_key), String(r.setting_value)]));
    const pos = (key: string, fallback: number) => {
      const raw = Number(map.get(key));
      return Number.isFinite(raw) && raw > 0 ? raw : fallback;
    };
    return {
      kyat_to_grams: pos('kyat_to_grams', 16.6),
      baht_to_mmk_buy: pos('baht_to_mmk_buy', 85),
      baht_to_mmk_sell: pos('baht_to_mmk_sell', 88),
    };
  },

  async updateShopSettings(data: Record<string, unknown>) {
    const upsert = async (key: string, value: unknown) => {
      if (value == null) return;
      const v = Number(value);
      if (!Number.isFinite(v) || v <= 0) {
        throw new HttpError(400, `${key} must be a positive number`);
      }
      await getPool().query(
        `INSERT INTO shop_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, String(v)]
      );
    };
    await upsert('kyat_to_grams', data.kyat_to_grams);
    await upsert('baht_to_mmk_buy', data.baht_to_mmk_buy);
    await upsert('baht_to_mmk_sell', data.baht_to_mmk_sell);
    return this.getShopSettings();
  },

  async getBootstrap() {
    const [prices, inventory, customers, transactions, orders, pawns, interestPayments, ledger, tracking, staff, categories, modules, rolePermissions, settings] =
      await Promise.all([
        this.listPrices(),
        this.listInventory(),
        this.listCustomers(),
        this.listTransactions(),
        this.listOrders(),
        this.listPawns(),
        this.listPawnInterestPayments(),
        this.listLedger(),
        this.listTracking(),
        this.listStaff(true),
        this.listMasterCategories(false),
        this.listPermissionModules(),
        this.listAllRolePermissions(),
        this.getShopSettings(),
      ]);

    return {
      prices,
      inventory,
      customers,
      transactions,
      orders,
      pawns,
      interestPayments,
      ledger,
      tracking,
      staff,
      categories,
      modules,
      rolePermissions,
      settings,
    };
  },

  async listMasterCategories(activeOnly = true) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      activeOnly
        ? `SELECT c.*,
             (SELECT COUNT(*) FROM inventory_items i
               WHERE i.category = c.code OR i.purity = c.code) +
             (SELECT COUNT(*) FROM orders o
               WHERE o.item_type = c.code OR o.purity = c.code) AS usage_count
           FROM master_categories c
           WHERE c.is_active = 1
           ORDER BY c.category_group ASC, c.sort_order ASC, c.id ASC`
        : `SELECT c.*,
             (SELECT COUNT(*) FROM inventory_items i
               WHERE i.category = c.code OR i.purity = c.code) +
             (SELECT COUNT(*) FROM orders o
               WHERE o.item_type = c.code OR o.purity = c.code) AS usage_count
           FROM master_categories c
           ORDER BY c.category_group ASC, c.sort_order ASC, c.id ASC`
    );
    return rows.map(mapMasterCategory);
  },

  async assertActiveCategoryCode(codeRaw: unknown) {
    const code = normalizeCategoryCode(codeRaw);
    if (!code) throw new HttpError(400, 'category code required');
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, is_active FROM master_categories WHERE code = :code LIMIT 1`,
      { code }
    );
    if (!rows[0]) throw new HttpError(400, `Unknown master category: ${code}`);
    if (!Number(rows[0].is_active)) {
      throw new HttpError(400, `Category is inactive: ${code}`);
    }
    return code;
  },

  async createMasterCategory(data: Record<string, unknown>) {
    const code = normalizeCategoryCode(data.code);
    if (!code || !data.name_mm) throw new HttpError(400, 'code and name_mm required');
    const category_group = normalizeCategoryGroup(data.category_group);
    const name_mm = String(data.name_mm);
    const name_en = String(data.name_en || data.name_mm);
    const description =
      data.description != null && String(data.description).trim()
        ? String(data.description).slice(0, 500)
        : null;
    try {
      const [result] = await getPool().query<ResultSetHeader>(
        `INSERT INTO master_categories
           (code, name_mm, name_en, category_group, description, sort_order, is_active)
         VALUES (:code, :name_mm, :name_en, :category_group, :description, :sort_order, :is_active)`,
        {
          code,
          name_mm,
          name_en,
          category_group,
          description,
          sort_order: num(data.sort_order),
          is_active: data.is_active === false || data.is_active === 0 ? 0 : 1,
        }
      );
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT * FROM master_categories WHERE id = :id`,
        { id: result.insertId }
      );
      return mapMasterCategory(rows[0]);
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, `Category code already exists: ${code}`);
      throw err;
    }
  },

  async updateMasterCategory(id: string, data: Record<string, unknown>) {
    const catId = parseId(id);
    const [existing] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM master_categories WHERE id = :id`,
      { id: catId }
    );
    if (!existing[0]) throw new HttpError(404, 'Category not found');

    const allowed = [
      'code',
      'name_mm',
      'name_en',
      'category_group',
      'description',
      'sort_order',
      'is_active',
    ] as const;
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: catId };
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`\`${key}\` = :${key}`);
        if (key === 'is_active') {
          params[key] = data[key] === false || data[key] === 0 ? 0 : 1;
        } else if (key === 'code') {
          params[key] = normalizeCategoryCode(data[key]);
        } else if (key === 'category_group') {
          params[key] = normalizeCategoryGroup(data[key]);
        } else if (key === 'description') {
          params[key] = data[key] == null ? null : String(data[key]).slice(0, 500);
        } else {
          params[key] = data[key];
        }
      }
    }
    if (!sets.length) throw new HttpError(400, 'No fields to update');

    // If renaming code, cascade denormalized references
    const newCode = params.code != null ? String(params.code) : null;
    const oldCode = String(existing[0].code);
    if (newCode && newCode !== oldCode) {
      const [dup] = await getPool().query<RowDataPacket[]>(
        `SELECT id FROM master_categories WHERE code = :code AND id <> :id LIMIT 1`,
        { code: newCode, id: catId }
      );
      if (dup[0]) throw new HttpError(409, `Category code already exists: ${newCode}`);
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`UPDATE master_categories SET ${sets.join(', ')} WHERE id = :id`, params as Record<string, string | number | null>);
      if (newCode && newCode !== oldCode) {
        await conn.query(`UPDATE inventory_items SET category = :newCode WHERE category = :oldCode`, {
          newCode,
          oldCode,
        });
        await conn.query(`UPDATE orders SET item_type = :newCode WHERE item_type = :oldCode`, {
          newCode,
          oldCode,
        });
        await conn.query(
          `UPDATE transaction_items SET category = :newCode WHERE category = :oldCode`,
          { newCode, oldCode }
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM master_categories WHERE id = :id`,
      { id: catId }
    );
    if (!rows[0]) throw new HttpError(404, 'Category not found');
    return mapMasterCategory(rows[0]);
  },

  async deleteMasterCategory(id: string) {
    const catId = parseId(id);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM master_categories WHERE id = :id`,
      { id: catId }
    );
    if (!rows[0]) throw new HttpError(404, 'Category not found');
    const code = String(rows[0].code);

    const [inv] = await getPool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM inventory_items WHERE category = :code OR purity = :code`,
      { code }
    );
    const [ord] = await getPool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM orders WHERE item_type = :code OR purity = :code`,
      { code }
    );
    const usage = Number(inv[0]?.cnt || 0) + Number(ord[0]?.cnt || 0);
    if (usage > 0) {
      await getPool().query(`UPDATE master_categories SET is_active = 0 WHERE id = :id`, {
        id: catId,
      });
      const [updated] = await getPool().query<RowDataPacket[]>(
        `SELECT * FROM master_categories WHERE id = :id`,
        { id: catId }
      );
      return {
        mode: 'deactivated' as const,
        usage,
        category: mapMasterCategory(updated[0]),
        message: `Category is in use (${usage} records). Deactivated instead of deleted.`,
      };
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `DELETE FROM master_categories WHERE id = :id`,
      { id: catId }
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'Category not found');
    return { mode: 'deleted' as const, usage: 0, category: null, message: 'Deleted' };
  },

  async listPermissionModules() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM permission_modules ORDER BY sort_order ASC, id ASC`
    );
    return rows.map(mapPermissionModule);
  },

  async listPermissionsByRole(role: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT rp.*, pm.name_mm, pm.name_en
       FROM role_permissions rp
       LEFT JOIN permission_modules pm ON pm.module_key = rp.module_key
       WHERE rp.role = :role
       ORDER BY pm.sort_order ASC, rp.module_key ASC`,
      { role }
    );
    return rows.map(mapRolePermission);
  },

  async listAllRolePermissions() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT rp.*, pm.name_mm, pm.name_en
       FROM role_permissions rp
       LEFT JOIN permission_modules pm ON pm.module_key = rp.module_key
       ORDER BY rp.role ASC, pm.sort_order ASC`
    );
    return rows.map(mapRolePermission);
  },

  async updateRolePermission(
    role: string,
    moduleKey: string,
    flags: { can_create?: boolean; can_read?: boolean; can_update?: boolean; can_delete?: boolean }
  ) {
    const [existing] = await getPool().query<RowDataPacket[]>(
      `SELECT id FROM role_permissions WHERE role = :role AND module_key = :module LIMIT 1`,
      { role, module: moduleKey }
    );
    if (!existing[0]) {
      await getPool().query(
        `INSERT INTO role_permissions (role, module_key, can_create, can_read, can_update, can_delete)
         VALUES (:role, :module_key, :c, :r, :u, :d)`,
        {
          role,
          module_key: moduleKey,
          c: flags.can_create ? 1 : 0,
          r: flags.can_read ? 1 : 0,
          u: flags.can_update ? 1 : 0,
          d: flags.can_delete ? 1 : 0,
        }
      );
    } else {
      const sets: string[] = [];
      const params: Record<string, unknown> = { role, module: moduleKey };
      for (const key of ['can_create', 'can_read', 'can_update', 'can_delete'] as const) {
        if (flags[key] !== undefined) {
          sets.push(`${key} = :${key}`);
          params[key] = flags[key] ? 1 : 0;
        }
      }
      if (sets.length) {
        await getPool().query(
          `UPDATE role_permissions SET ${sets.join(', ')} WHERE role = :role AND module_key = :module`,
          params
        );
      }
    }
    return this.listPermissionsByRole(role);
  },

  async bulkUpdateRolePermissions(
    role: string,
    rows: Array<{
      module_key: string;
      can_create: boolean;
      can_read: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>
  ) {
    for (const row of rows) {
      await this.updateRolePermission(role, row.module_key, row);
    }
    return this.listPermissionsByRole(role);
  },

  async listPrices() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM daily_gold_prices ORDER BY id ASC`
    );
    return rows.map(mapPrice);
  },

  async updateGoldPrice(goldType: string, sellPrice: number, buyPrice?: number) {
    const pool = getPool();
    const updates =
      goldType === 'MEELIN'
        ? derivedPricesFromMeelin(sellPrice, buyPrice)
        : [
            {
              gold_type: goldType,
              sellPrice,
              buyPrice: buyPrice ?? Math.max(0, sellPrice - 50000),
            },
          ];

    for (const u of updates) {
      await pool.query(
        `UPDATE daily_gold_prices
         SET price_per_kyat = :sell,
             buy_price_per_kyat = :buy,
             updated_at = NOW()
         WHERE gold_type = :type`,
        { sell: u.sellPrice, buy: u.buyPrice, type: u.gold_type }
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM daily_gold_prices WHERE gold_type = :type LIMIT 1`,
      { type: goldType }
    );
    if (!rows[0]) throw new HttpError(404, 'Gold type not found');
    await this.revalueInStockInventory();
    return mapPrice(rows[0]);
  },

  async updateGoldPricesBulk(
    updates: Array<{ gold_type: string; sellPrice: number; buyPrice?: number }>
  ) {
    const expanded: Array<{ gold_type: string; sellPrice: number; buyPrice: number }> = [];
    for (const u of updates) {
      if (u.gold_type === 'MEELIN') {
        expanded.push(...derivedPricesFromMeelin(u.sellPrice, u.buyPrice));
      } else {
        expanded.push({
          gold_type: u.gold_type,
          sellPrice: u.sellPrice,
          buyPrice: u.buyPrice ?? Math.max(0, u.sellPrice - 50000),
        });
      }
    }
    // Dedupe by gold_type (last wins)
    const byType = new Map<string, { gold_type: string; sellPrice: number; buyPrice: number }>();
    for (const row of expanded) byType.set(row.gold_type, row);

    const results = [];
    for (const u of byType.values()) {
      const pool = getPool();
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE daily_gold_prices
         SET price_per_kyat = :sell,
             buy_price_per_kyat = :buy,
             updated_at = NOW()
         WHERE gold_type = :type`,
        { sell: u.sellPrice, buy: u.buyPrice, type: u.gold_type }
      );
      if (result.affectedRows === 0) throw new HttpError(404, `Gold type not found: ${u.gold_type}`);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM daily_gold_prices WHERE gold_type = :type LIMIT 1`,
        { type: u.gold_type }
      );
      results.push(mapPrice(rows[0]));
    }
    await this.revalueInStockInventory();
    return results;
  },

  getLivePriceForPurity(prices: ReturnType<typeof mapPrice>[], purity: string): number {
    const specific = prices.find((p) => p.gold_type === purity);
    if (specific && specific.price_per_kyat > 0) return specific.price_per_kyat;
    const meelin = prices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
    if (purity === 'THAI_GOLD') return Math.round(meelin * 0.965);
    const derived = derivePriceFromMeelin(meelin, purity);
    return derived > 0 ? derived : meelin;
  },

  getBuyPriceForPurity(prices: ReturnType<typeof mapPrice>[], purity: string): number {
    const specific = prices.find((p) => p.gold_type === purity);
    if (specific?.buy_price_per_kyat && specific.buy_price_per_kyat > 0) {
      return specific.buy_price_per_kyat;
    }
    const meelinBuy =
      prices.find((p) => p.gold_type === 'MEELIN')?.buy_price_per_kyat || 5700000;
    if (purity === 'THAI_GOLD') return Math.round(meelinBuy * 0.965);
    const derived = derivePriceFromMeelin(meelinBuy, purity);
    return derived > 0 ? derived : meelinBuy;
  },

  async allocateUniqueBarcode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = generateBarcode();
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT id FROM inventory_items WHERE barcode = :code LIMIT 1`,
        { code }
      );
      if (!rows[0]) return code;
    }
    return `STG-${Date.now().toString().slice(-8)}`;
  },

  /** Recalculate selling_price_estimated for all IN_STOCK items from live daily prices */
  async revalueInStockInventory() {
    const prices = await this.listPrices();
    const pure16 = prices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
    const thaiRate = this.getLivePriceForPurity(prices, 'THAI_GOLD');
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM inventory_items WHERE status = 'IN_STOCK'`
    );
    for (const row of rows) {
      const net: WeightKPY = {
        kyat: num(row.net_weight_kyat),
        pae: num(row.net_weight_pae),
        yway: num(row.net_weight_yway),
      };
      const specific = this.getLivePriceForPurity(prices, row.purity);
      const estimated = estimateSellingPrice({
        purity: row.purity,
        itemType: row.item_type,
        netWeight: net,
        thaiWeightUnit: row.thai_weight_unit != null ? num(row.thai_weight_unit) : null,
        craftsmanshipFee: num(row.craftsmanship_fee),
        stonePrice: num(row.stone_price),
        pricePerKyat16Pe: pure16,
        specificSellPrice: specific,
        thaiRatePerKyat: thaiRate,
      });
      await getPool().query(
        `UPDATE inventory_items SET selling_price_estimated = :price WHERE id = :id`,
        { price: estimated, id: row.id }
      );
    }
    return { updated: rows.length };
  },

  calcValuation(body: Record<string, unknown>) {
    const weight = (body.weight as WeightKPY) || { kyat: 0, pae: 0, yway: 0 };
    const deductionPae = num(body.deduction_pae);
    const deductionYway = num(body.deduction_yway);
    const net =
      deductionPae || deductionYway
        ? calculateNetWeight(weight, deductionPae, deductionYway)
        : ((body.net_weight as WeightKPY) || weight);
    const purity = String(body.purity || 'MEELIN');
    const price16 = num(body.price_per_kyat_16pe, 5750000);
    const specific = body.specific_price != null ? num(body.specific_price) : undefined;
    const craft = num(body.craftsmanship_fee);
    const val = calculateGoldValuation(net, purity, price16, specific);
    return {
      net_weight: net,
      ...val,
      craftsmanship_fee: craft,
      total_with_craft: val.goldAmount + craft,
    };
  },

  calcThai(body: Record<string, unknown>) {
    return calculateThaiGoldPrice(
      num(body.unit_selector, 1),
      num(body.thai_rate_per_kyat),
      num(body.craftsmanship_fee)
    );
  },

  async listCustomers() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM customers ORDER BY id DESC`
    );
    return rows.map(mapCustomer);
  },

  async addCustomer(name: string, phone: string, address: string) {
    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO customers (name, phone, address, outstanding_balance)
       VALUES (:name, :phone, :address, 0)`,
      { name, phone, address }
    );
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM customers WHERE id = :id`,
      { id: result.insertId }
    );
    return mapCustomer(rows[0]);
  },

  async updateCustomer(id: string, data: Record<string, unknown>) {
    const customerId = parseId(id);
    const allowed = ['name', 'phone', 'address', 'outstanding_balance'] as const;
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: customerId };
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`\`${key}\` = :${key}`);
        params[key] = data[key];
      }
    }
    if (!sets.length) throw new HttpError(400, 'No fields to update');
    await getPool().query(`UPDATE customers SET ${sets.join(', ')} WHERE id = :id`, params);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM customers WHERE id = :id`,
      { id: customerId }
    );
    if (!rows[0]) throw new HttpError(404, 'Customer not found');
    return mapCustomer(rows[0]);
  },

  async deleteCustomer(id: string) {
    const [result] = await getPool().query<ResultSetHeader>(
      `DELETE FROM customers WHERE id = :id`,
      { id: parseId(id) }
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'Customer not found');
  },

  async findOrCreateCustomer(name: string, phone: string, address = '') {
    if (phone) {
      const [existing] = await getPool().query<RowDataPacket[]>(
        `SELECT * FROM customers WHERE phone = :phone LIMIT 1`,
        { phone }
      );
      if (existing[0]) return mapCustomer(existing[0]);
    }
    return this.addCustomer(name, phone || 'N/A', address);
  },

  async listInventory() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM inventory_items ORDER BY id DESC`
    );
    return rows.map(mapInventory);
  },

  async addInventoryItem(data: Record<string, unknown>) {
    const gross: WeightKPY = {
      kyat: num(data.weight_kyat),
      pae: num(data.weight_pae),
      yway: num(data.weight_yway),
    };
    const gemstone: WeightKPY = {
      kyat: num(data.gemstone_weight_kyat),
      pae: num(data.gemstone_weight_pae),
      yway: num(data.gemstone_weight_yway),
    };
    const craftDedPae = num(data.craft_deduction_pae ?? data.deduction_pae);
    const craftDedYway = num(data.craft_deduction_yway ?? data.deduction_yway);
    const profitDedPae = num(data.profit_deduction_pae);
    const profitDedYway = num(data.profit_deduction_yway);
    const totalDedPae = craftDedPae + profitDedPae;
    const totalDedYway = craftDedYway + profitDedYway;
    const net =
      data.net_weight_kyat != null
        ? {
            kyat: num(data.net_weight_kyat),
            pae: num(data.net_weight_pae),
            yway: num(data.net_weight_yway),
          }
        : calculateNetFromParts(gross, gemstone, totalDedPae, totalDedYway);

    const prices = await this.listPrices();
    const pure16 = prices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
    const purity = String(data.purity || 'MEELIN');
    const itemType = String(data.item_type ?? 'MYANMAR_GOLD');
    const craft = num(data.craftsmanship_fee);
    const stonePrice = num(data.stone_price);
    const thaiUnit = data.thai_weight_unit != null ? num(data.thai_weight_unit) : null;
    const estimated =
      data.selling_price_estimated != null && num(data.selling_price_estimated) > 0
        ? num(data.selling_price_estimated)
        : estimateSellingPrice({
            purity,
            itemType,
            netWeight: net,
            thaiWeightUnit: thaiUnit,
            craftsmanshipFee: craft,
            stonePrice,
            pricePerKyat16Pe: pure16,
            specificSellPrice: this.getLivePriceForPurity(prices, purity),
            thaiRatePerKyat: this.getLivePriceForPurity(prices, 'THAI_GOLD'),
          });

    const barcode =
      data.barcode && String(data.barcode).trim()
        ? String(data.barcode).trim()
        : await this.allocateUniqueBarcode();

    const category = await this.assertActiveCategoryCode(data.category);

    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO inventory_items (
        barcode, category, name, name_mm,
        weight_kyat, weight_pae, weight_yway,
        gemstone_weight_kyat, gemstone_weight_pae, gemstone_weight_yway,
        craft_deduction_pae, craft_deduction_yway,
        profit_deduction_pae, profit_deduction_yway,
        deduction_pae, deduction_yway,
        net_weight_kyat, net_weight_pae, net_weight_yway,
        purity, item_type, thai_weight_unit, craftsmanship_fee, stone_price, selling_price_estimated, status, image_url
      ) VALUES (
        :barcode, :category, :name, :name_mm,
        :weight_kyat, :weight_pae, :weight_yway,
        :gemstone_weight_kyat, :gemstone_weight_pae, :gemstone_weight_yway,
        :craft_deduction_pae, :craft_deduction_yway,
        :profit_deduction_pae, :profit_deduction_yway,
        :deduction_pae, :deduction_yway,
        :net_weight_kyat, :net_weight_pae, :net_weight_yway,
        :purity, :item_type, :thai_weight_unit, :craftsmanship_fee, :stone_price, :selling_price_estimated, :status, :image_url
      )`,
      {
        barcode,
        category,
        name: data.name,
        name_mm: data.name_mm,
        weight_kyat: gross.kyat,
        weight_pae: gross.pae,
        weight_yway: gross.yway,
        gemstone_weight_kyat: gemstone.kyat,
        gemstone_weight_pae: gemstone.pae,
        gemstone_weight_yway: gemstone.yway,
        craft_deduction_pae: craftDedPae,
        craft_deduction_yway: craftDedYway,
        profit_deduction_pae: profitDedPae,
        profit_deduction_yway: profitDedYway,
        deduction_pae: totalDedPae,
        deduction_yway: totalDedYway,
        net_weight_kyat: net.kyat,
        net_weight_pae: net.pae,
        net_weight_yway: net.yway,
        purity,
        item_type: itemType,
        thai_weight_unit: thaiUnit,
        craftsmanship_fee: craft,
        stone_price: stonePrice,
        selling_price_estimated: estimated,
        status: data.status ?? 'IN_STOCK',
        image_url: data.image_url ?? null,
      }
    );
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM inventory_items WHERE id = :id`,
      { id: result.insertId }
    );
    return mapInventory(rows[0]);
  },

  async updateInventoryItem(id: string, updates: Record<string, unknown>) {
    const itemId = parseId(id);
    const allowed = [
      'barcode', 'category', 'name', 'name_mm',
      'weight_kyat', 'weight_pae', 'weight_yway',
      'gemstone_weight_kyat', 'gemstone_weight_pae', 'gemstone_weight_yway',
      'craft_deduction_pae', 'craft_deduction_yway',
      'profit_deduction_pae', 'profit_deduction_yway',
      'deduction_pae', 'deduction_yway',
      'net_weight_kyat', 'net_weight_pae', 'net_weight_yway',
      'purity', 'item_type', 'thai_weight_unit', 'craftsmanship_fee', 'stone_price',
      'selling_price_estimated', 'status', 'image_url',
    ] as const;

    if (updates.category !== undefined) {
      updates.category = await this.assertActiveCategoryCode(updates.category);
    }

    const sets: string[] = [];
    const params: Record<string, unknown> = { id: itemId };
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        sets.push(`\`${key}\` = :${key}`);
        params[key] = updates[key];
      }
    }
    if (!sets.length) throw new HttpError(400, 'No fields to update');

    await getPool().query(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = :id`, params);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM inventory_items WHERE id = :id`,
      { id: itemId }
    );
    if (!rows[0]) throw new HttpError(404, 'Inventory item not found');
    return mapInventory(rows[0]);
  },

  async deleteInventoryItem(id: string) {
    const [result] = await getPool().query<ResultSetHeader>(
      `DELETE FROM inventory_items WHERE id = :id`,
      { id: parseId(id) }
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'Inventory item not found');
  },

  async listTransactions() {
    const pool = getPool();
    const [txns] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM transactions ORDER BY id DESC`
    );
    if (!txns.length) return [];
    const ids = txns.map((t) => t.id);
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM transaction_items WHERE transaction_id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    const byTxn = new Map<number, ReturnType<typeof mapTxnItem>[]>();
    for (const item of items) {
      const list = byTxn.get(item.transaction_id) ?? [];
      list.push(mapTxnItem(item));
      byTxn.set(item.transaction_id, list);
    }
    return txns.map((t) => mapTxn(t, byTxn.get(t.id) ?? []));
  },

  async createTransaction(data: Record<string, unknown>) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const prices = await this.listPrices();
      const pure16 = prices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
      const txnType = String(data.transaction_type || 'SALE');
      const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];

      // Server-side recompute line items from live rates when possible
      let craftTotal = 0;
      let stoneTotal = 0;
      let itemsTotal = 0;
      const normalizedItems: Record<string, unknown>[] = [];

      for (const raw of items) {
        const weight = (raw.weight as WeightKPY) || { kyat: 0, pae: 0, yway: 0 };
        const gemstone = (raw.gemstone_weight as WeightKPY) || {
          kyat: num(raw.gemstone_weight_kyat),
          pae: num(raw.gemstone_weight_pae),
          yway: num(raw.gemstone_weight_yway),
        };
        const net =
          (raw.net_weight as WeightKPY) ||
          calculateNetFromParts(weight, gemstone, num(raw.deduction_pae), num(raw.deduction_yway));
        const purity = String(raw.purity || 'MEELIN');
        const craft = num(raw.craftsmanship_fee);
        const stonePrice = num(raw.stone_price);
        const itemType = String(raw.item_type ?? 'MYANMAR_GOLD');
        let snapshot = num(raw.gold_price_snapshot);
        let goldAmount = num(raw.gold_amount);
        let subtotal = num(raw.subtotal);

        if (txnType === 'PURCHASE' || (txnType === 'EXCHANGE' && raw.line_role === 'TRADE_IN')) {
          snapshot = snapshot > 0 ? snapshot : this.getBuyPriceForPurity(prices, purity);
          const netYway = kpyToYway(net.kyat, net.pae, net.yway);
          goldAmount = Math.round((netYway / 128) * snapshot);
          subtotal = goldAmount;
        } else if (txnType === 'SALE' || txnType === 'EXCHANGE') {
          const breakdown = calculateSaleLineBreakdown({
            purity,
            itemType,
            netWeight: net,
            thaiWeightUnit: raw.thai_weight_unit != null ? num(raw.thai_weight_unit) : null,
            craftsmanshipFee: craft,
            stonePrice,
            pricePerKyat16Pe: pure16,
            specificSellPrice:
              snapshot > 0 ? snapshot : this.getLivePriceForPurity(prices, purity),
            thaiRatePerKyat: this.getLivePriceForPurity(prices, 'THAI_GOLD'),
          });
          snapshot = breakdown.effectivePricePerKyat;
          goldAmount = breakdown.goldAmount;
          subtotal = breakdown.lineSubtotal;
        }

        craftTotal += craft;
        stoneTotal += stonePrice;
        itemsTotal += subtotal;
        normalizedItems.push({
          ...raw,
          weight,
          gemstone_weight: gemstone,
          net_weight: net,
          purity,
          craftsmanship_fee: craft,
          stone_price: stonePrice,
          gold_amount: goldAmount,
          gold_price_snapshot: snapshot,
          subtotal,
          item_type: itemType,
        });
      }

      const discount = num(data.discount_amount);
      const tax = num(data.tax_amount);
      let totalAmount = num(data.total_amount);
      if (txnType === 'SALE') {
        totalAmount = Math.max(0, itemsTotal - discount + tax);
      } else if (txnType === 'PURCHASE') {
        totalAmount = itemsTotal;
      } else if (txnType === 'EXCHANGE') {
        // Net: sale lines − trade-in lines (client may override with computed total)
        const saleSum = normalizedItems
          .filter((i) => i.line_role !== 'TRADE_IN')
          .reduce((s, i) => s + num(i.subtotal), 0);
        const tradeSum = normalizedItems
          .filter((i) => i.line_role === 'TRADE_IN')
          .reduce((s, i) => s + num(i.subtotal), 0);
        totalAmount = Math.max(0, saleSum - tradeSum - discount + tax);
        if (num(data.total_amount) > 0 && data.use_client_total === true) {
          totalAmount = num(data.total_amount);
        }
      }

      const paidAmount =
        data.paid_amount !== undefined ? num(data.paid_amount) : totalAmount;
      const remainingAmount = Math.max(0, totalAmount - paidAmount);
      const interestRate = num(data.interest_rate);
      const isInstallment = Boolean(data.is_installment) || interestRate > 0;
      let creditDueDate =
        data.credit_due_date && String(data.credit_due_date).slice(0, 10);
      if (!creditDueDate && remainingAmount > 0) {
        const due = new Date();
        due.setDate(due.getDate() + (isInstallment ? 30 : 7));
        creditDueDate = due.toISOString().slice(0, 10);
      }

      const customerId = parseOptionalId(data.customer_id);
      const invoiceNo =
        data.invoice_no && String(data.invoice_no).trim()
          ? String(data.invoice_no)
          : generateInvoiceNo(txnType === 'PURCHASE' ? 'PUR' : txnType === 'EXCHANGE' ? 'EXC' : 'INV');

      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO transactions (
          invoice_no, customer_id, customer_name, customer_phone, transaction_type,
          gold_price_snapshot, craftsmanship_total, stone_total, discount_amount, tax_amount,
          total_amount, paid_amount, remaining_amount, interest_rate, credit_due_date, is_installment,
          payment_method, notes
        ) VALUES (
          :invoice_no, :customer_id, :customer_name, :customer_phone, :transaction_type,
          :gold_price_snapshot, :craftsmanship_total, :stone_total, :discount_amount, :tax_amount,
          :total_amount, :paid_amount, :remaining_amount, :interest_rate, :credit_due_date, :is_installment,
          :payment_method, :notes
        )`,
        {
          invoice_no: invoiceNo,
          customer_id: customerId,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone ?? null,
          transaction_type: txnType,
          gold_price_snapshot: num(data.gold_price_snapshot) || pure16,
          craftsmanship_total: craftTotal || num(data.craftsmanship_total),
          stone_total: stoneTotal,
          discount_amount: discount,
          tax_amount: tax,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          interest_rate: interestRate,
          credit_due_date: creditDueDate || null,
          is_installment: isInstallment ? 1 : 0,
          payment_method: data.payment_method ?? 'CASH',
          notes: data.notes ?? null,
        }
      );

      const txnId = result.insertId;
      const addToStock = data.add_to_stock !== false; // default true for purchases

      for (const raw of normalizedItems) {
        const weight = (raw.weight as WeightKPY) || { kyat: 0, pae: 0, yway: 0 };
        const gemstone = (raw.gemstone_weight as WeightKPY) || { kyat: 0, pae: 0, yway: 0 };
        const net = (raw.net_weight as WeightKPY) || weight;
        const itemId = parseOptionalId(raw.item_id);
        await conn.query(
          `INSERT INTO transaction_items (
            transaction_id, item_id, item_name, category,
            weight_kyat, weight_pae, weight_yway,
            gemstone_weight_kyat, gemstone_weight_pae, gemstone_weight_yway,
            net_weight_kyat, net_weight_pae, net_weight_yway,
            purity, gold_price_snapshot, gold_amount, craftsmanship_fee, stone_price, subtotal, item_type
          ) VALUES (
            :transaction_id, :item_id, :item_name, :category,
            :weight_kyat, :weight_pae, :weight_yway,
            :gemstone_weight_kyat, :gemstone_weight_pae, :gemstone_weight_yway,
            :net_weight_kyat, :net_weight_pae, :net_weight_yway,
            :purity, :gold_price_snapshot, :gold_amount, :craftsmanship_fee, :stone_price, :subtotal, :item_type
          )`,
          {
            transaction_id: txnId,
            item_id: itemId,
            item_name: raw.item_name,
            category: raw.category,
            weight_kyat: num(weight.kyat),
            weight_pae: num(weight.pae),
            weight_yway: num(weight.yway),
            gemstone_weight_kyat: num(gemstone.kyat),
            gemstone_weight_pae: num(gemstone.pae),
            gemstone_weight_yway: num(gemstone.yway),
            net_weight_kyat: num(net.kyat),
            net_weight_pae: num(net.pae),
            net_weight_yway: num(net.yway),
            purity: raw.purity,
            gold_price_snapshot: num(raw.gold_price_snapshot),
            gold_amount: num(raw.gold_amount),
            craftsmanship_fee: num(raw.craftsmanship_fee),
            stone_price: num(raw.stone_price),
            subtotal: num(raw.subtotal),
            item_type: raw.item_type ?? 'MYANMAR_GOLD',
          }
        );

        if ((txnType === 'SALE' || txnType === 'EXCHANGE') && itemId && raw.line_role !== 'TRADE_IN') {
          await conn.query(`UPDATE inventory_items SET status = 'SOLD' WHERE id = :id`, { id: itemId });
        }

        // Purchase / trade-in → create stock item with barcode
        if (
          addToStock &&
          (txnType === 'PURCHASE' || (txnType === 'EXCHANGE' && raw.line_role === 'TRADE_IN'))
        ) {
          await this.insertPurchaseStock(conn, {
            item_name: String(raw.item_name || 'ရွှေဟောင်း'),
            category: String(raw.category || 'OLD_GOLD'),
            weight,
            net,
            purity: String(raw.purity),
            item_type: String(raw.item_type ?? 'MYANMAR_GOLD'),
            gold_price_snapshot: num(raw.gold_price_snapshot),
            invoice_no: invoiceNo,
          });
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      if (txnType === 'SALE' || txnType === 'EXCHANGE') {
        if (paidAmount > 0) {
          await insertLedger(conn, {
            type: 'INCOME',
            category: 'GOLD_SALE',
            amount: paidAmount,
            description:
              txnType === 'EXCHANGE'
                ? `အလဲအလှယ်ပြေစာ ${invoiceNo} (${data.customer_name})`
                : `အရောင်းပြေစာ ${invoiceNo} (${data.customer_name})`,
            reference_no: invoiceNo,
            date: today,
          });
        }

        if (remainingAmount > 0 && customerId) {
          const monthlyInterest = Math.round((remainingAmount * interestRate) / 100);
          const trackingType =
            isInstallment || interestRate > 0 ? 'DELAYED_PAYMENT' : 'OUTSTANDING_CREDIT';
          await conn.query(
            `INSERT INTO customer_tracking (
              customer_id, customer_name, customer_phone, reference_type, reference_id, reference_no,
              tracking_type, amount_due, due_date, interest_rate, monthly_interest, status, notes
            ) VALUES (
              :customer_id, :customer_name, :customer_phone, 'TRANSACTION', :reference_id, :reference_no,
              :tracking_type, :amount_due, :due_date, :interest_rate, :monthly_interest, 'UNPAID', :notes
            )`,
            {
              customer_id: customerId,
              customer_name: data.customer_name,
              customer_phone: data.customer_phone,
              reference_id: String(txnId),
              reference_no: invoiceNo,
              tracking_type: trackingType,
              amount_due: remainingAmount,
              due_date: creditDueDate,
              interest_rate: interestRate,
              monthly_interest: monthlyInterest,
              notes: isInstallment
                ? `အရစ်ကျ / အကြွေး — အတိုး ${interestRate}% (လစဉ် ≈ ${monthlyInterest.toLocaleString()} MMK)`
                : `လက်ကျန်ငွေ ပေးသွင်းရန်`,
            }
          );
          await conn.query(
            `UPDATE customers SET outstanding_balance = outstanding_balance + :amt WHERE id = :id`,
            { amt: remainingAmount, id: customerId }
          );
        }
      } else if (txnType === 'PURCHASE') {
        await insertLedger(conn, {
          type: 'EXPENSE',
          category: 'GOLD_PURCHASE',
          amount: paidAmount,
          description: `အဝယ်ဘောင်ချာ ${invoiceNo} (${data.customer_name} ထံမှ ရွှေဝယ်ယူငွေ)`,
          reference_no: invoiceNo,
          date: today,
        });
      }

      await conn.commit();
      const list = await this.listTransactions();
      const created = list.find((t) => t.id === strId(txnId));
      if (!created) throw new HttpError(500, 'Failed to load created transaction');
      return created;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async deleteTransaction(id: string) {
    const txnId = parseId(id);
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [txns] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM transactions WHERE id = :id`,
        { id: txnId }
      );
      if (!txns[0]) throw new HttpError(404, 'Transaction not found');
      const txn = txns[0];
      const invoiceNo = String(txn.invoice_no || '');
      const remaining = Number(txn.remaining_amount || 0);
      const customerId = txn.customer_id != null ? Number(txn.customer_id) : null;

      const [items] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM transaction_items WHERE transaction_id = :id`,
        { id: txnId }
      );

      // Restore sold inventory lines
      for (const item of items) {
        if (item.item_id && (txn.transaction_type === 'SALE' || txn.transaction_type === 'EXCHANGE')) {
          await conn.query(
            `UPDATE inventory_items SET status = 'IN_STOCK' WHERE id = :id AND status = 'SOLD'`,
            { id: item.item_id }
          );
        }
      }

      if (invoiceNo) {
        await conn.query(`DELETE FROM financial_ledger WHERE reference_no = :ref`, {
          ref: invoiceNo,
        });
      }

      await conn.query(
        `DELETE FROM customer_tracking WHERE reference_type = 'TRANSACTION' AND reference_id = :ref`,
        { ref: String(txnId) }
      );

      if (customerId && remaining > 0) {
        await conn.query(
          `UPDATE customers SET outstanding_balance = GREATEST(0, outstanding_balance - :amt) WHERE id = :id`,
          { amt: remaining, id: customerId }
        );
      }

      await conn.query(`DELETE FROM transaction_items WHERE transaction_id = :id`, { id: txnId });
      await conn.query(`DELETE FROM transactions WHERE id = :id`, { id: txnId });

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async insertPurchaseStock(
    conn: PoolConnection,
    opts: {
      item_name: string;
      category: string;
      weight: WeightKPY;
      net: WeightKPY;
      purity: string;
      item_type: string;
      gold_price_snapshot: number;
      invoice_no: string;
    }
  ) {
    let barcode = generateBarcode();
    for (let i = 0; i < 10; i++) {
      const [exists] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM inventory_items WHERE barcode = :code LIMIT 1`,
        { code: barcode }
      );
      if (!exists[0]) break;
      barcode = generateBarcode();
    }
    const prices = await this.listPrices();
    const pure16 = prices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
    const sellEst = estimateSellingPrice({
      purity: opts.purity,
      itemType: opts.item_type,
      netWeight: opts.net,
      craftsmanshipFee: 0,
      pricePerKyat16Pe: pure16,
      specificSellPrice: this.getLivePriceForPurity(prices, opts.purity),
      thaiRatePerKyat: this.getLivePriceForPurity(prices, 'THAI_GOLD'),
    });
    await conn.query(
      `INSERT INTO inventory_items (
        barcode, category, name, name_mm,
        weight_kyat, weight_pae, weight_yway, deduction_pae, deduction_yway,
        net_weight_kyat, net_weight_pae, net_weight_yway,
        purity, item_type, craftsmanship_fee, selling_price_estimated, status
      ) VALUES (
        :barcode, :category, :name, :name_mm,
        :weight_kyat, :weight_pae, :weight_yway, 0, 0,
        :net_weight_kyat, :net_weight_pae, :net_weight_yway,
        :purity, :item_type, 0, :selling_price_estimated, 'IN_STOCK'
      )`,
      {
        barcode,
        category: opts.category,
        name: `${opts.item_name} (${opts.invoice_no})`,
        name_mm: `${opts.item_name} (${opts.invoice_no})`,
        weight_kyat: opts.weight.kyat,
        weight_pae: opts.weight.pae,
        weight_yway: opts.weight.yway,
        net_weight_kyat: opts.net.kyat,
        net_weight_pae: opts.net.pae,
        net_weight_yway: opts.net.yway,
        purity: opts.purity,
        item_type: opts.item_type,
        selling_price_estimated: sellEst,
      }
    );
  },

  async listOrders() {
    const [rows] = await getPool().query<RowDataPacket[]>(`SELECT * FROM orders ORDER BY id DESC`);
    return rows.map(mapOrder);
  },

  async addOrder(data: Record<string, unknown>) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const customerId = parseOptionalId(data.customer_id);
      const tw = (data.target_weight as Record<string, number>) || {};
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO orders (
          order_no, customer_id, customer_name, customer_phone, item_type, description, purity,
          target_weight_kyat, target_weight_pae, target_weight_yway, craftsmanship_fee,
          deposit_amount, estimated_total_price, remaining_balance, order_date, due_date, status, gold_rate_snapshot
        ) VALUES (
          :order_no, :customer_id, :customer_name, :customer_phone, :item_type, :description, :purity,
          :target_weight_kyat, :target_weight_pae, :target_weight_yway, :craftsmanship_fee,
          :deposit_amount, :estimated_total_price, :remaining_balance, :order_date, :due_date, :status, :gold_rate_snapshot
        )`,
        {
          order_no: data.order_no,
          customer_id: customerId,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          item_type: data.item_type,
          description: data.description,
          purity: data.purity,
          target_weight_kyat: num(tw.kyat),
          target_weight_pae: num(tw.pae),
          target_weight_yway: num(tw.yway),
          craftsmanship_fee: num(data.craftsmanship_fee),
          deposit_amount: num(data.deposit_amount),
          estimated_total_price: num(data.estimated_total_price),
          remaining_balance: num(data.remaining_balance),
          order_date: data.order_date,
          due_date: data.due_date,
          status: data.status ?? 'PENDING',
          gold_rate_snapshot: num(data.gold_rate_snapshot),
        }
      );

      const orderId = result.insertId;
      const today = new Date().toISOString().slice(0, 10);
      if (num(data.deposit_amount) > 0) {
        await insertLedger(conn, {
          type: 'INCOME',
          category: 'CUSTOM_ORDER',
          amount: num(data.deposit_amount),
          description: `အော်ဒါစရန်ငွေ ${data.order_no} (${data.customer_name})`,
          reference_no: String(data.order_no),
          date: today,
        });
      }

      if (num(data.remaining_balance) > 0) {
        await conn.query(
          `INSERT INTO customer_tracking (
            customer_id, customer_name, customer_phone, reference_type, reference_id, reference_no,
            tracking_type, amount_due, due_date, status, notes
          ) VALUES (
            :customer_id, :customer_name, :customer_phone, 'CUSTOM_ORDER', :reference_id, :reference_no,
            'OUTSTANDING_CREDIT', :amount_due, :due_date, 'UNPAID', :notes
          )`,
          {
            customer_id: customerId,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            reference_id: String(orderId),
            reference_no: data.order_no,
            amount_due: num(data.remaining_balance),
            due_date: data.due_date,
            notes: `အော်ဒါလက်ကျန်ငွေ (${data.description})`,
          }
        );
      }

      await conn.commit();
      const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM orders WHERE id = :id`, {
        id: orderId,
      });
      return mapOrder(rows[0]);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async updateOrderStatus(id: string, status: string, remainingPaid?: number) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const orderId = parseId(id);
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT * FROM orders WHERE id = :id FOR UPDATE`, {
        id: orderId,
      });
      if (!rows[0]) throw new HttpError(404, 'Order not found');

      const paid = num(remainingPaid);
      const newBalance = paid > 0 ? Math.max(0, num(rows[0].remaining_balance) - paid) : num(rows[0].remaining_balance);

      await conn.query(
        `UPDATE orders SET status = :status, remaining_balance = :balance WHERE id = :id`,
        { status, balance: newBalance, id: orderId }
      );

      if (paid > 0) {
        await insertLedger(conn, {
          type: 'INCOME',
          category: 'CUSTOM_ORDER',
          amount: paid,
          description: `အော်ဒါလက်ကျန်ငွေ ပေးချေမှု (ID: ${id})`,
          date: new Date().toISOString().slice(0, 10),
        });

        await conn.query(
          `UPDATE customer_tracking
           SET amount_due = :due,
               status = CASE WHEN :due = 0 THEN 'SETTLED' ELSE 'PARTIAL' END
           WHERE reference_type = 'CUSTOM_ORDER' AND reference_id = :ref AND status <> 'SETTLED'`,
          { due: newBalance, ref: String(orderId) }
        );

        if (rows[0].customer_id) {
          await conn.query(
            `UPDATE customers
             SET outstanding_balance = GREATEST(0, outstanding_balance - :amt)
             WHERE id = :id`,
            { amt: paid, id: rows[0].customer_id }
          );
        }
      }

      if (status === 'COMPLETED' || status === 'CANCELLED') {
        await conn.query(
          `UPDATE customer_tracking
           SET status = 'SETTLED', amount_due = 0
           WHERE reference_type = 'CUSTOM_ORDER' AND reference_id = :ref AND status <> 'SETTLED'`,
          { ref: String(orderId) }
        );
      }

      await conn.commit();
      const [updated] = await pool.query<RowDataPacket[]>(`SELECT * FROM orders WHERE id = :id`, {
        id: orderId,
      });
      return mapOrder(updated[0]);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async listPawns() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM pawn_records ORDER BY id DESC`
    );
    return rows.map(mapPawn);
  },

  async listPawnInterestPayments() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT p.*,
              r.customer_name, r.customer_phone, r.item_name, r.item_type, r.gold_kind, r.purity,
              r.weight_kyat, r.weight_pae, r.weight_yway, r.weight_grams,
              r.loan_amount, r.loan_amount_baht, r.last_interest_date, r.next_interest_date
       FROM pawn_interest_payments p
       LEFT JOIN pawn_records r ON r.id = p.pawn_id
       ORDER BY p.id DESC`
    );
    return rows.map(mapPawnInterest);
  },

  async updatePawn(id: string, data: Record<string, unknown>) {
    const pawnId = parseId(id);
    const allowed = [
      'status',
      'accrued_interest',
      'loan_amount',
      'loan_amount_baht',
      'monthly_interest_rate',
      'loss_months',
      'start_date',
      'due_date',
      'item_name',
      'item_type',
      'gold_kind',
      'purity',
      'customer_name',
      'customer_phone',
      'notes',
      'last_interest_date',
      'next_interest_date',
      'vno',
      'weight_kyat',
      'weight_pae',
      'weight_yway',
      'weight_grams',
      'evaluated_value',
    ] as const;
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: pawnId };
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`\`${key}\` = :${key}`);
        params[key] = data[key];
      }
    }
    if (!sets.length) throw new HttpError(400, 'No fields to update');
    await getPool().query(`UPDATE pawn_records SET ${sets.join(', ')} WHERE id = :id`, params);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM pawn_records WHERE id = :id`,
      { id: pawnId }
    );
    if (!rows[0]) throw new HttpError(404, 'Pawn record not found');
    return mapPawn(rows[0]);
  },

  async deletePawn(id: string) {
    const pawnId = parseId(id);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id FROM pawn_records WHERE id = :id`,
      { id: pawnId }
    );
    if (!rows[0]) throw new HttpError(404, 'Pawn record not found');
    await getPool().query(`DELETE FROM customer_tracking WHERE reference_type = 'PAWN' AND reference_id = :ref`, {
      ref: String(pawnId),
    });
    await getPool().query(`DELETE FROM pawn_records WHERE id = :id`, { id: pawnId });
    return { id: String(pawnId) };
  },

  async addPawn(data: Record<string, unknown>) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const customerId = parseOptionalId(data.customer_id);
      const w = (data.weight as Record<string, number>) || {};
      const startDate = String(data.start_date);
      const lossMonths = num(data.loss_months, 3);
      let dueDate = data.due_date != null ? String(data.due_date) : '';
      if (!dueDate) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + lossMonths);
        dueDate = d.toISOString().slice(0, 10);
      }
      const nextInterest = (() => {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().slice(0, 10);
      })();

      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO pawn_records (
          pawn_ticket_no, vno, customer_id, customer_name, customer_phone, item_name, item_type, gold_kind,
          weight_kyat, weight_pae, weight_yway, weight_grams, purity, evaluated_value,
          loan_amount, loan_amount_baht, monthly_interest_rate, loss_months, start_date, due_date,
          last_interest_date, next_interest_date, status, accrued_interest,
          notes, customer_signature, owner_signature
        ) VALUES (
          :pawn_ticket_no, :vno, :customer_id, :customer_name, :customer_phone, :item_name, :item_type, :gold_kind,
          :weight_kyat, :weight_pae, :weight_yway, :weight_grams, :purity, :evaluated_value,
          :loan_amount, :loan_amount_baht, :monthly_interest_rate, :loss_months, :start_date, :due_date,
          :last_interest_date, :next_interest_date, :status, :accrued_interest,
          :notes, :customer_signature, :owner_signature
        )`,
        {
          pawn_ticket_no: data.pawn_ticket_no,
          vno: data.vno != null ? String(data.vno) : null,
          customer_id: customerId,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          item_name: data.item_name,
          item_type: data.item_type != null ? String(data.item_type) : null,
          gold_kind: data.gold_kind != null ? String(data.gold_kind) : null,
          weight_kyat: num(w.kyat),
          weight_pae: num(w.pae),
          weight_yway: num(w.yway),
          weight_grams: num(data.weight_grams),
          purity: data.purity,
          evaluated_value: num(data.evaluated_value),
          loan_amount: num(data.loan_amount),
          loan_amount_baht: num(data.loan_amount_baht),
          monthly_interest_rate: num(data.monthly_interest_rate, 5),
          loss_months: lossMonths,
          start_date: startDate,
          due_date: dueDate,
          last_interest_date: startDate,
          next_interest_date: nextInterest,
          status: data.status ?? 'ACTIVE',
          accrued_interest: num(data.accrued_interest),
          notes: data.notes != null ? String(data.notes) : null,
          customer_signature: data.customer_signature != null ? String(data.customer_signature) : null,
          owner_signature: data.owner_signature != null ? String(data.owner_signature) : null,
        }
      );

      await insertLedger(conn, {
        type: 'EXPENSE',
        category: 'OTHER_EXPENSE',
        amount: num(data.loan_amount),
        description: `ပေါင်နှံပစ္စည်း ချေးငွေထုတ်ပေးခြင်း (${data.pawn_ticket_no} - ${data.customer_name})`,
        reference_no: String(data.pawn_ticket_no),
        date: startDate,
      });

      const dueAmount = num(data.loan_amount) + num(data.accrued_interest);
      await conn.query(
        `INSERT INTO customer_tracking (
          customer_id, customer_name, customer_phone, reference_type, reference_id, reference_no,
          tracking_type, amount_due, due_date, days_overdue, status, notes
        ) VALUES (
          :customer_id, :customer_name, :customer_phone, 'PAWN', :reference_id, :reference_no,
          'DELAYED_PAYMENT', :amount_due, :due_date, GREATEST(0, DATEDIFF(CURDATE(), :due_date)), 'UNPAID', :notes
        )`,
        {
          customer_id: customerId,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          reference_id: String(result.insertId),
          reference_no: data.pawn_ticket_no,
          amount_due: dueAmount,
          due_date: dueDate,
          notes: `ပေါင်နှံစာချုပ် သက်တမ်းစောင့်ကြည့် (${data.item_name})`,
        }
      );

      await conn.commit();
      const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM pawn_records WHERE id = :id`, {
        id: result.insertId,
      });
      return mapPawn(rows[0]);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async payPawnInterest(id: string, data: Record<string, unknown>) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const pawnId = parseId(id);
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM pawn_records WHERE id = :id FOR UPDATE`,
        { id: pawnId }
      );
      if (!rows[0]) throw new HttpError(404, 'Pawn record not found');
      if (rows[0].status === 'REDEEMED' || rows[0].status === 'CONFISCATED') {
        throw new HttpError(400, 'Cannot pay interest on closed pawn');
      }

      const paymentDate = String(data.payment_date || new Date().toISOString().slice(0, 10));
      const monthsPaid = Math.max(1, num(data.months_paid, 1));
      const interestKyat = num(data.interest_kyat);
      const interestBaht = num(data.interest_baht);
      const rate = num(data.interest_rate, num(rows[0].monthly_interest_rate, 5));
      const voucherNo =
        data.voucher_no != null
          ? String(data.voucher_no)
          : `INT-${paymentDate.replace(/-/g, '')}-${pawnId}`;

      const nextDate = (() => {
        const base = new Date(paymentDate);
        base.setMonth(base.getMonth() + monthsPaid);
        return base.toISOString().slice(0, 10);
      })();

      await conn.query<ResultSetHeader>(
        `INSERT INTO pawn_interest_payments (
          pawn_id, voucher_no, payment_date, months_paid, interest_kyat, interest_baht, interest_rate, notes
        ) VALUES (
          :pawn_id, :voucher_no, :payment_date, :months_paid, :interest_kyat, :interest_baht, :interest_rate, :notes
        )`,
        {
          pawn_id: pawnId,
          voucher_no: voucherNo,
          payment_date: paymentDate,
          months_paid: monthsPaid,
          interest_kyat: interestKyat,
          interest_baht: interestBaht,
          interest_rate: rate,
          notes: data.notes != null ? String(data.notes) : null,
        }
      );

      await conn.query(
        `UPDATE pawn_records SET
           interest_paid_kyat = interest_paid_kyat + :kyat,
           interest_paid_baht = interest_paid_baht + :baht,
           last_interest_date = :payment_date,
           next_interest_date = :next_date,
           accrued_interest = GREATEST(0, accrued_interest - :kyat)
         WHERE id = :id`,
        {
          id: pawnId,
          kyat: interestKyat,
          baht: interestBaht,
          payment_date: paymentDate,
          next_date: nextDate,
        }
      );

      if (interestKyat > 0) {
        await insertLedger(conn, {
          type: 'INCOME',
          category: 'PAWN_INTEREST',
          amount: interestKyat,
          description: `အပေါင်အတိုးသွင်း (${rows[0].pawn_ticket_no} - ${rows[0].customer_name})`,
          reference_no: voucherNo,
          date: paymentDate,
        });
      }

      await conn.commit();
      const [payments] = await pool.query<RowDataPacket[]>(
        `SELECT p.*,
                r.customer_name, r.customer_phone, r.item_name, r.item_type, r.gold_kind, r.purity,
                r.weight_kyat, r.weight_pae, r.weight_yway, r.weight_grams,
                r.loan_amount, r.loan_amount_baht, r.last_interest_date, r.next_interest_date
         FROM pawn_interest_payments p
         LEFT JOIN pawn_records r ON r.id = p.pawn_id
         WHERE p.pawn_id = :id
         ORDER BY p.id DESC LIMIT 1`,
        { id: pawnId }
      );
      return mapPawnInterest(payments[0]);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async redeemPawn(id: string, settlementAmount: number, extra: Record<string, unknown> = {}) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const pawnId = parseId(id);
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM pawn_records WHERE id = :id FOR UPDATE`,
        { id: pawnId }
      );
      if (!rows[0]) throw new HttpError(404, 'Pawn record not found');

      const redeemDate = String(extra.redeem_date || new Date().toISOString().slice(0, 10));
      const totalKyat = num(extra.redeem_total_kyat, settlementAmount);
      const totalBaht = num(extra.redeem_total_baht);

      await conn.query(
        `UPDATE pawn_records SET
           status = 'REDEEMED',
           redeem_date = :redeem_date,
           redeem_months = :redeem_months,
           redeem_interest_kyat = :redeem_interest_kyat,
           redeem_interest_baht = :redeem_interest_baht,
           discount_kyat = :discount_kyat,
           discount_baht = :discount_baht,
           redeem_total_kyat = :redeem_total_kyat,
           redeem_total_baht = :redeem_total_baht,
           notes = COALESCE(:notes, notes),
           accrued_interest = :redeem_interest_kyat
         WHERE id = :id`,
        {
          id: pawnId,
          redeem_date: redeemDate,
          redeem_months: num(extra.redeem_months, 1),
          redeem_interest_kyat: num(extra.redeem_interest_kyat),
          redeem_interest_baht: num(extra.redeem_interest_baht),
          discount_kyat: num(extra.discount_kyat),
          discount_baht: num(extra.discount_baht),
          redeem_total_kyat: totalKyat,
          redeem_total_baht: totalBaht,
          notes: extra.notes != null ? String(extra.notes) : null,
        }
      );

      await insertLedger(conn, {
        type: 'INCOME',
        category: 'PAWN_INTEREST',
        amount: totalKyat,
        description: `ပေါင်နှံပစ္စည်း လာရောက်ရွေးယူငွေ (${rows[0].pawn_ticket_no} - ${rows[0].customer_name})`,
        reference_no: rows[0].pawn_ticket_no,
        date: redeemDate,
      });
      await conn.query(
        `UPDATE customer_tracking SET status = 'SETTLED', amount_due = 0
         WHERE reference_type = 'PAWN' AND reference_id = :ref`,
        { ref: String(pawnId) }
      );

      await conn.commit();
      const [updated] = await pool.query<RowDataPacket[]>(`SELECT * FROM pawn_records WHERE id = :id`, {
        id: pawnId,
      });
      return mapPawn(updated[0]);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async listLedger() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM financial_ledger ORDER BY id DESC`
    );
    return rows.map(mapLedger);
  },

  async addLedgerEntry(data: Record<string, unknown>) {
    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO financial_ledger (type, category, amount, description, reference_no, date)
       VALUES (:type, :category, :amount, :description, :reference_no, :date)`,
      {
        type: data.type,
        category: data.category,
        amount: num(data.amount),
        description: data.description,
        reference_no: data.reference_no ?? null,
        date: data.date,
      }
    );
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM financial_ledger WHERE id = :id`,
      { id: result.insertId }
    );
    return mapLedger(rows[0]);
  },

  async updateLedgerEntry(id: string, data: Record<string, unknown>) {
    const ledgerId = parseId(id);
    const [existing] = await getPool().query<RowDataPacket[]>(
      `SELECT id FROM financial_ledger WHERE id = :id`,
      { id: ledgerId }
    );
    if (!existing[0]) throw new HttpError(404, 'Ledger entry not found');

    const allowed = ['type', 'category', 'amount', 'description', 'reference_no', 'date'] as const;
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: ledgerId };
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`\`${key}\` = :${key}`);
        params[key] = key === 'amount' ? num(data[key]) : data[key];
      }
    }
    if (!sets.length) throw new HttpError(400, 'No fields to update');
    await getPool().query(`UPDATE financial_ledger SET ${sets.join(', ')} WHERE id = :id`, params);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM financial_ledger WHERE id = :id`,
      { id: ledgerId }
    );
    return mapLedger(rows[0]);
  },

  async deleteLedgerEntry(id: string) {
    const ledgerId = parseId(id);
    const [result] = await getPool().query<ResultSetHeader>(
      `DELETE FROM financial_ledger WHERE id = :id`,
      { id: ledgerId }
    );
    if (!result.affectedRows) throw new HttpError(404, 'Ledger entry not found');
  },

  async listTracking() {
    await getPool().query(
      `UPDATE customer_tracking
       SET days_overdue = GREATEST(0, DATEDIFF(CURDATE(), due_date))
       WHERE status <> 'SETTLED'`
    );
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM customer_tracking ORDER BY id DESC`
    );
    return rows.map(mapTracking);
  },

  async addTracking(data: Record<string, unknown>) {
    const customerId = parseOptionalId(data.customer_id);
    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO customer_tracking (
        customer_id, customer_name, customer_phone, reference_type, reference_id, reference_no,
        tracking_type, amount_due, due_date, days_overdue, status, notes
      ) VALUES (
        :customer_id, :customer_name, :customer_phone, :reference_type, :reference_id, :reference_no,
        :tracking_type, :amount_due, :due_date, GREATEST(0, DATEDIFF(CURDATE(), :due_date)), :status, :notes
      )`,
      {
        customer_id: customerId,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        reference_type: data.reference_type,
        reference_id: String(data.reference_id),
        reference_no: data.reference_no,
        tracking_type: data.tracking_type,
        amount_due: num(data.amount_due),
        due_date: data.due_date,
        status: data.status ?? 'UNPAID',
        notes: data.notes ?? '',
      }
    );
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM customer_tracking WHERE id = :id`,
      { id: result.insertId }
    );
    return mapTracking(rows[0]);
  },

  async settleTracking(id: string, amountPaid: number) {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const trackId = parseId(id);
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM customer_tracking WHERE id = :id FOR UPDATE`,
        { id: trackId }
      );
      if (!rows[0]) throw new HttpError(404, 'Tracking record not found');

      const newDue = Math.max(0, num(rows[0].amount_due) - amountPaid);
      const status = newDue === 0 ? 'SETTLED' : 'PARTIAL';
      await conn.query(
        `UPDATE customer_tracking SET amount_due = :due, status = :status WHERE id = :id`,
        { due: newDue, status, id: trackId }
      );

      if (rows[0].customer_id) {
        await conn.query(
          `UPDATE customers
           SET outstanding_balance = GREATEST(0, outstanding_balance - :amt)
           WHERE id = :id`,
          { amt: amountPaid, id: rows[0].customer_id }
        );
      }

      await insertLedger(conn, {
        type: 'INCOME',
        category: 'OTHER_INCOME',
        amount: amountPaid,
        description: `ဖောက်သည် ကျန်ငွေ/ရက်လွှဲ လာရောက်ရှင်းလင်းငွေ (Track ID: ${id})`,
        date: new Date().toISOString().slice(0, 10),
      });

      await conn.commit();
      const [updated] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM customer_tracking WHERE id = :id`,
        { id: trackId }
      );
      return mapTracking(updated[0]);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async reportOutstandingCredit() {
    await this.listTracking();
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT *
       FROM customer_tracking
       WHERE status <> 'SETTLED'
         AND tracking_type = 'OUTSTANDING_CREDIT'
       ORDER BY due_date ASC, amount_due DESC`
    );
    const items = rows.map(mapTracking);
    const totalDue = items.reduce((s, r) => s + r.amount_due, 0);
    return {
      report: 'outstanding_credit',
      generated_at: new Date().toISOString(),
      count: items.length,
      total_amount_due: totalDue,
      items,
    };
  },

  async reportDelayedPayments() {
    await this.listTracking();
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT *
       FROM customer_tracking
       WHERE status <> 'SETTLED'
         AND (
           tracking_type = 'DELAYED_PAYMENT'
           OR days_overdue > 0
         )
       ORDER BY days_overdue DESC, due_date ASC`
    );
    const items = rows.map(mapTracking);
    const totalDue = items.reduce((s, r) => s + r.amount_due, 0);
    const aging = {
      d0_7: items.filter((i) => (i.days_overdue || 0) <= 7).length,
      d8_30: items.filter((i) => (i.days_overdue || 0) > 7 && (i.days_overdue || 0) <= 30).length,
      d31_plus: items.filter((i) => (i.days_overdue || 0) > 30).length,
    };
    return {
      report: 'delayed_installment',
      generated_at: new Date().toISOString(),
      count: items.length,
      total_amount_due: totalDue,
      aging,
      items,
    };
  },

  async reportSummary() {
    const [outstanding, delayed, customers] = await Promise.all([
      this.reportOutstandingCredit(),
      this.reportDelayedPayments(),
      this.listCustomers(),
    ]);
    const customersWithBalance = customers.filter((c) => c.outstanding_balance > 0);
    return {
      generated_at: new Date().toISOString(),
      outstanding_credit: {
        count: outstanding.count,
        total: outstanding.total_amount_due,
      },
      delayed_payments: {
        count: delayed.count,
        total: delayed.total_amount_due,
        aging: delayed.aging,
      },
      customers_with_balance: customersWithBalance.length,
      customer_balance_total: customersWithBalance.reduce((s, c) => s + c.outstanding_balance, 0),
    };
  },

  async resetDemoData() {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of [
        'customer_tracking',
        'financial_ledger',
        'pawn_records',
        'orders',
        'transaction_items',
        'transactions',
        'inventory_items',
        'customers',
        'daily_gold_prices',
        'staff_users',
        'role_permissions',
        'permission_modules',
        'master_categories',
      ]) {
        await conn.query(`TRUNCATE TABLE \`${table}\``);
      }
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const { seedDatabase } = await import('../db/seed.js');
    const { ensureMasterAndPermissions } = await import('../db/masterSeed.js');
    await seedDatabase(pool);
    await ensureMasterAndPermissions(pool);
    return this.getBootstrap();
  },
};
