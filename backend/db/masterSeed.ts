import type { Pool } from 'mysql2/promise';

export const PERMISSION_MODULES = [
  { key: 'dashboard', name_mm: 'ပင်မစာမျက်နှာ', name_en: 'Dashboard', sort: 10 },
  { key: 'pos', name_mm: 'အရောင်း / အဝယ် / အလဲ', name_en: 'Sale / Buy / Exchange', sort: 20 },
  { key: 'pos_history', name_mm: 'ဘောင်ချာမှတ်တမ်း', name_en: 'Voucher History', sort: 25 },
  { key: 'inventory', name_mm: 'အထည်စတော့ & ဘားကုဒ်', name_en: 'Inventory & Barcodes', sort: 30 },
  { key: 'orders', name_mm: 'Order တင်ခြင်း & စရံ', name_en: 'Orders & Deposits', sort: 35 },
  { key: 'goldsmith', name_mm: 'ပန်းထိမ်အပ်', name_en: 'Goldsmith Workshop', sort: 40 },
  { key: 'pawn', name_mm: 'အပေါင် / အတိုး / ရွေး', name_en: 'Pawn / Interest / Redeem', sort: 50 },
  { key: 'ledger', name_mm: 'ဝင်ငွေ / ထွက်ငွေ', name_en: 'Income & Expenses', sort: 60 },
  { key: 'reports', name_mm: 'အစီရင်ခံစာများ', name_en: 'Reports', sort: 70 },
  { key: 'prices', name_mm: 'နေ့စဉ်ရွှေဈေး', name_en: 'Daily Gold Prices', sort: 80 },
  { key: 'customers', name_mm: 'ဖောက်သည်', name_en: 'Customers', sort: 90 },
  { key: 'staff', name_mm: 'အသုံးပြုသူအကောင့်', name_en: 'User Accounts', sort: 110 },
  { key: 'master', name_mm: 'Categories / ပစ္စည်းအမျိုးအစား', name_en: 'Categories & Item Types', sort: 120 },
  { key: 'unit_conversion', name_mm: 'ယူနစ်ပြောင်းလဲမှု', name_en: 'Unit Conversion', sort: 125 },
  { key: 'permissions', name_mm: 'ခွင့်ပြုချက်များ', name_en: 'Permissions', sort: 130 },
] as const;

export type CategoryGroup = 'PRODUCT' | 'GOLD_CLASS' | 'OTHER';

export const DEFAULT_CATEGORIES: Array<{
  code: string;
  name_mm: string;
  name_en: string;
  category_group: CategoryGroup;
  description: string;
  sort: number;
}> = [
    // —— Product / jewelry item types (Setup → ပစ္စည်းအမျိုးအစား) ——
    {
      code: 'NECKLACE',
      name_mm: 'ဆွဲကြိုး',
      name_en: 'Necklace',
      category_group: 'PRODUCT',
      description: 'Necklace / chain jewelry',
      sort: 10,
    },
    {
      code: 'RING',
      name_mm: 'လက်စွပ်',
      name_en: 'Ring',
      category_group: 'PRODUCT',
      description: 'Finger rings',
      sort: 20,
    },
    {
      code: 'BRACELET',
      name_mm: 'လက်ကောက်',
      name_en: 'Bracelet',
      category_group: 'PRODUCT',
      description: 'Bracelets',
      sort: 30,
    },
    {
      code: 'EARRING',
      name_mm: 'နားကပ်',
      name_en: 'Earring',
      category_group: 'PRODUCT',
      description: 'Earrings',
      sort: 40,
    },
    {
      code: 'PENDANT',
      name_mm: 'ဆွဲသီး',
      name_en: 'Pendant',
      category_group: 'PRODUCT',
      description: 'Pendants',
      sort: 50,
    },
    {
      code: 'BANGLE',
      name_mm: 'ဘယက် / ဟန်းချိန်း',
      name_en: 'Bangle',
      category_group: 'PRODUCT',
      description: 'Bangles / hand chains',
      sort: 60,
    },
    {
      code: 'GOLD_BAR',
      name_mm: 'ရွှေတုံး / ဒင်္ဂါး',
      name_en: 'Gold Bar',
      category_group: 'PRODUCT',
      description: 'Bars and coins',
      sort: 70,
    },
    {
      code: 'ANKLET',
      name_mm: 'ခြေချင်း',
      name_en: 'Anklet',
      category_group: 'PRODUCT',
      description: 'Anklets',
      sort: 80,
    },
    {
      code: 'OLD_GOLD',
      name_mm: 'ရွှေဟောင်း',
      name_en: 'Old Gold',
      category_group: 'PRODUCT',
      description: 'Buyback / scrap old gold',
      sort: 90,
    },
    {
      code: 'MIXED',
      name_mm: 'အမယ်စုံ',
      name_en: 'Mixed items',
      category_group: 'PRODUCT',
      description: 'Multiple pawn items (comma-separated names)',
      sort: 95,
    },
    // —— Categories = shop gold classes (Setup → Categories) ——
    {
      code: 'MEELIN',
      name_mm: 'မီးလင်း',
      name_en: 'Meelin',
      category_group: 'GOLD_CLASS',
      description: '',
      sort: 10,
    },
    {
      code: 'K24',
      name_mm: '24K',
      name_en: '24K',
      category_group: 'GOLD_CLASS',
      description: 'မီးလင်း နှင့် တူညီ',
      sort: 20,
    },
    {
      code: 'PE15A',
      name_mm: '15A',
      name_en: '15A',
      category_group: 'GOLD_CLASS',
      description: '(မီးလင်း × 16) / 17',
      sort: 30,
    },
    {
      code: 'PE15B',
      name_mm: '15B',
      name_en: '15B',
      category_group: 'GOLD_CLASS',
      description: '(မီးလင်း × 16) / 17.5',
      sort: 40,
    },
    {
      code: 'PE14A',
      name_mm: '14A',
      name_en: '14A',
      category_group: 'GOLD_CLASS',
      description: '(မီးလင်း × 14) / 16',
      sort: 50,
    },
    {
      code: 'PE13A',
      name_mm: '13A',
      name_en: '13A',
      category_group: 'GOLD_CLASS',
      description: '(မီးလင်း × 13) / 16',
      sort: 60,
    },
    {
      code: 'PE12A',
      name_mm: '12A',
      name_en: '12A',
      category_group: 'GOLD_CLASS',
      description: '(မီးလင်း × 12) / 16',
      sort: 70,
    },
    {
      code: 'K18',
      name_mm: '18K',
      name_en: '18K',
      category_group: 'GOLD_CLASS',
      description: '12A နှင့် တူညီ — (မီးလင်း × 12) / 16',
      sort: 80,
    },
    {
      code: 'THAI_GOLD',
      name_mm: 'ထိုင်းရွှေ',
      name_en: 'Thai Gold',
      category_group: 'GOLD_CLASS',
      description: '',
      sort: 90,
    },
  ];

const GOLD_CLASS_CODES = DEFAULT_CATEGORIES.filter((c) => c.category_group === 'GOLD_CLASS').map(
  (c) => c.code
);

/** Map legacy purity / category codes → new GOLD_CLASS codes */
const PURITY_REMAP: Record<string, string> = {
  '16_PE_AUNG': 'MEELIN',
  PE16_AUNG: 'MEELIN',
  '15_PE_AUNG': 'PE15A',
  PE15_AUNG: 'PE15A',
  '15_PE_THIT': 'PE15B',
  PE15_THIT: 'PE15B',
  PE15: 'PE15A',
  '1_PHO': 'PE15A',
  '1_2_PHO': 'PE15B',
  PE14: 'PE14A',
  '14K': 'PE14A',
  K14: 'PE14A',
  PE13: 'PE13A',
  PE12: 'PE12A',
  '18K': 'K18',
  DEPOSIT_GOLD: 'MEELIN',
  THAI_GOLD_CLASS: 'THAI_GOLD',
  WHITE_GOLD: 'K18',
  THAI_GOLD: 'THAI_GOLD',
  MEELIN: 'MEELIN',
  K24: 'K24',
  PE15A: 'PE15A',
  PE15B: 'PE15B',
  PE14A: 'PE14A',
  PE13A: 'PE13A',
  PE12A: 'PE12A',
  K18: 'K18',
};

type Crud = [boolean, boolean, boolean, boolean]; // C R U D

const ALL: Crud = [true, true, true, true];
const READ: Crud = [false, true, false, false];
const CR: Crud = [true, true, false, false];
const CRU: Crud = [true, true, true, false];
const RU: Crud = [false, true, true, false];
const NONE: Crud = [false, false, false, false];

/** Default CRUD matrix per role × module */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, Crud>> = {
  OWNER: Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, ALL])),
  MANAGER: {
    dashboard: READ,
    pos: ALL,
    pos_history: ALL,
    inventory: ALL,
    goldsmith: ALL,
    orders: ALL,
    pawn: ALL,
    ledger: CRU,
    reports: READ,
    prices: RU,
    customers: ALL,
    staff: CRU,
    master: ALL,
    unit_conversion: RU,
    permissions: READ,
  },
  CASHIER: {
    dashboard: READ,
    pos: CR,
    pos_history: READ,
    inventory: READ,
    goldsmith: CRU,
    orders: CRU,
    pawn: CRU,
    ledger: READ,
    reports: READ,
    prices: READ,
    customers: CRU,
    staff: NONE,
    master: NONE,
    unit_conversion: READ,
    permissions: NONE,
  },
};

/** Replace GOLD_CLASS list, migrate purity fields, refresh daily prices */
export async function ensureDefaultCategories(pool: Pool): Promise<void> {
  // Remove old gold-class categories not in the new set
  const placeholders = GOLD_CLASS_CODES.map(() => '?').join(',');
  await pool.query(
    `DELETE FROM master_categories
     WHERE category_group = 'GOLD_CLASS' AND code NOT IN (${placeholders})`,
    GOLD_CLASS_CODES
  );

  for (const c of DEFAULT_CATEGORIES) {
    await pool.query(
      `INSERT INTO master_categories
         (code, name_mm, name_en, category_group, description, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         name_mm = VALUES(name_mm),
         name_en = VALUES(name_en),
         category_group = VALUES(category_group),
         description = VALUES(description),
         sort_order = VALUES(sort_order),
         is_active = 1`,
      [c.code, c.name_mm, c.name_en, c.category_group, c.description, c.sort]
    );
  }

  // Remap legacy purity codes on live data only once (flagged in shop_settings)
  try {
    const [remapFlag] = await pool.query<RowDataPacket[]>(
      `SELECT setting_value FROM shop_settings WHERE setting_key = 'purity_remapped_v1'`
    );
    if (!remapFlag[0]?.setting_value) {
      for (const [from, to] of Object.entries(PURITY_REMAP)) {
        if (from === to) continue;
        await pool.query(`UPDATE inventory_items SET purity = ? WHERE purity = ?`, [to, from]);
        await pool.query(`UPDATE transaction_items SET purity = ? WHERE purity = ?`, [to, from]);
        await pool.query(`UPDATE orders SET purity = ? WHERE purity = ?`, [to, from]);
        await pool.query(`UPDATE pawn_records SET purity = ? WHERE purity = ?`, [to, from]);
      }
      await pool.query(
        `INSERT INTO shop_settings (setting_key, setting_value) VALUES ('purity_remapped_v1', '1') ON DUPLICATE KEY UPDATE setting_value = '1'`
      );
    }
  } catch {
    /* ignore if settings table not ready */
  }

  // Sync daily_gold_prices — derive Myanmar grades from မီးလင်း base
  const meelinSell = 5750000;
  const meelinBuy = 5700000;
  const priceSeed: Array<{
    code: string;
    mm: string;
    en: string;
    sell: number;
    buy: number;
  }> = [
      {
        code: 'MEELIN',
        mm: 'မီးလင်း',
        en: 'Meelin',
        sell: meelinSell,
        buy: meelinBuy,
      },
      {
        code: 'K24',
        mm: '24K',
        en: '24K',
        sell: meelinSell,
        buy: meelinBuy,
      },
      {
        code: 'PE15A',
        mm: '15A',
        en: '15A',
        sell: Math.round((meelinSell * 16) / 17),
        buy: Math.round((meelinBuy * 16) / 17),
      },
      {
        code: 'PE15B',
        mm: '15B',
        en: '15B',
        sell: Math.round((meelinSell * 16) / 17.5),
        buy: Math.round((meelinBuy * 16) / 17.5),
      },
      {
        code: 'PE14A',
        mm: '14A',
        en: '14A',
        sell: Math.round((meelinSell * 14) / 16),
        buy: Math.round((meelinBuy * 14) / 16),
      },
      {
        code: 'PE13A',
        mm: '13A',
        en: '13A',
        sell: Math.round((meelinSell * 13) / 16),
        buy: Math.round((meelinBuy * 13) / 16),
      },
      {
        code: 'PE12A',
        mm: '12A',
        en: '12A',
        sell: Math.round((meelinSell * 12) / 16),
        buy: Math.round((meelinBuy * 12) / 16),
      },
      {
        code: 'K18',
        mm: '18K',
        en: '18K',
        sell: Math.round((meelinSell * 12) / 16),
        buy: Math.round((meelinBuy * 12) / 16),
      },
      {
        code: 'THAI_GOLD',
        mm: 'ထိုင်းရွှေ',
        en: 'Thai Gold',
        sell: 5520000,
        buy: 5460000,
      },
    ];

  await pool.query(
    `DELETE FROM daily_gold_prices WHERE gold_type NOT IN (${placeholders})`,
    GOLD_CLASS_CODES
  );

  for (const p of priceSeed) {
    await pool.query(
      `INSERT INTO daily_gold_prices (gold_type, name_mm, name_en, price_per_kyat, buy_price_per_kyat)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name_mm = VALUES(name_mm),
         name_en = VALUES(name_en)`,
      [p.code, p.mm, p.en, p.sell, p.buy]
    );
  }
}

/** Default shop unit conversion: 1 ကျပ် = N grams; Header Baht FX + Thai Baht price */
export async function ensureShopSettings(pool: Pool): Promise<void> {
  const defaults: Array<[string, string]> = [
    ['kyat_to_grams', '16.6'],
    ['baht_to_mmk_buy', '755'],
    ['baht_to_mmk_sell', '765'],
    ['thai_gold_baht', '65000'],
  ];
  for (const [key, value] of defaults) {
    await pool.query(
      `INSERT INTO shop_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_key = setting_key`,
      [key, value]
    );
  }
}

/** Upsert permission modules + fill missing role rows (safe for existing DBs; does not overwrite custom CRUD). */
export async function ensureMasterAndPermissions(pool: Pool): Promise<void> {
  await ensureShopSettings(pool);

  const modValues: any[] = [];
  const modSql = PERMISSION_MODULES.map((m) => {
    modValues.push(m.key, m.name_mm, m.name_en, m.sort);
    return '(?, ?, ?, ?)';
  }).join(', ');
  await pool.query(
    `INSERT INTO permission_modules (module_key, name_mm, name_en, sort_order)
     VALUES ${modSql}
     ON DUPLICATE KEY UPDATE
       name_mm = VALUES(name_mm),
       name_en = VALUES(name_en),
       sort_order = VALUES(sort_order)`,
    modValues
  );

  // Drop retired modules (e.g. tracking) from existing DBs
  const keepKeys = PERMISSION_MODULES.map((m) => m.key);
  const placeholders = keepKeys.map(() => '?').join(',');
  await pool.query(
    `DELETE FROM role_permissions WHERE module_key NOT IN (${placeholders})`,
    keepKeys
  );
  await pool.query(
    `DELETE FROM permission_modules WHERE module_key NOT IN (${placeholders})`,
    keepKeys
  );

  // Always upsert defaults so new GOLD_CLASS rows appear on existing installs
  await ensureDefaultCategories(pool);

  const roleValues: any[] = [];
  for (const role of ['OWNER', 'MANAGER', 'CASHIER'] as const) {
    const matrix = DEFAULT_ROLE_PERMISSIONS[role];
    for (const m of PERMISSION_MODULES) {
      const crud = matrix[m.key] || NONE;
      roleValues.push(role, m.key, crud[0] ? 1 : 0, crud[1] ? 1 : 0, crud[2] ? 1 : 0, crud[3] ? 1 : 0);
    }
  }
  const roleSql = Array(roleValues.length / 6).fill('(?, ?, ?, ?, ?, ?)').join(', ');
  await pool.query(
    `INSERT INTO role_permissions (role, module_key, can_create, can_read, can_update, can_delete)
     VALUES ${roleSql}
     ON DUPLICATE KEY UPDATE module_key = module_key`,
    roleValues
  );
}
