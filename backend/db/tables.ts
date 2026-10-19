import type { Pool, RowDataPacket } from 'mysql2/promise';

export const TABLE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS staff_users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    name_mm VARCHAR(200) NOT NULL,
    role ENUM('OWNER', 'MANAGER', 'CASHIER') NOT NULL DEFAULT 'CASHIER',
    phone VARCHAR(50) NULL,
    password VARCHAR(100) NOT NULL,
    avatar_color VARCHAR(100) NOT NULL DEFAULT 'from-amber-500 to-yellow-600',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_staff_username (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS daily_gold_prices (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    gold_type VARCHAR(50) NOT NULL,
    name_mm VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    price_per_kyat DECIMAL(15,2) NOT NULL,
    buy_price_per_kyat DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_gold_type (gold_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS customers (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    nrc VARCHAR(100) NULL,
    address TEXT NULL,
    outstanding_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_customers_phone (phone)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS inventory_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    barcode VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    name_mm VARCHAR(200) NOT NULL,
    weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    gemstone_weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    gemstone_weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    gemstone_weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    craft_deduction_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    craft_deduction_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    profit_deduction_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    profit_deduction_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    deduction_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    deduction_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    net_weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    net_weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    net_weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    purity VARCHAR(50) NOT NULL,
    item_type ENUM('MYANMAR_GOLD', 'THAI_GOLD', 'WHITE_GOLD', 'GEMS_JEWELRY') NOT NULL DEFAULT 'MYANMAR_GOLD',
    thai_weight_unit DECIMAL(8,2) NULL,
    craftsmanship_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    craftsmanship_profit_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    stone_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    stone_profit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    selling_price_estimated DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    craftsmanship_fee_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    craftsmanship_profit_fee_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    selling_price_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    baht_mmk_rate DECIMAL(15,4) NULL,
    thai_gold_baht_snapshot DECIMAL(15,2) NULL,
    status ENUM('IN_STOCK', 'SOLD', 'RESERVED', 'UNDER_PAWN', 'SHOP_OUT', 'WITH_GOLDSMITH') NOT NULL DEFAULT 'IN_STOCK',
    image_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_inventory_barcode (barcode),
    KEY idx_inventory_category (category),
    KEY idx_inventory_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_no VARCHAR(100) NOT NULL,
    customer_id INT UNSIGNED NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50) NULL,
    transaction_type ENUM('SALE', 'PURCHASE', 'ORDER', 'EXCHANGE', 'PAWN', 'SHOP_OUT', 'OTHER_IN') NOT NULL,
    gold_price_snapshot DECIMAL(15,2) NOT NULL,
    craftsmanship_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    stone_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) NOT NULL,
    remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    interest_rate DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    credit_due_date DATE NULL,
    is_installment TINYINT(1) NOT NULL DEFAULT 0,
    payment_method ENUM('CASH', 'KPAY', 'WAVEPAY', 'BANK_TRANSFER', 'CARD') NOT NULL DEFAULT 'CASH',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_transactions_invoice (invoice_no),
    KEY idx_transactions_customer (customer_id),
    KEY idx_transactions_type (transaction_type),
    CONSTRAINT fk_transactions_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS transaction_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    transaction_id INT UNSIGNED NOT NULL,
    item_id INT UNSIGNED NULL,
    item_name VARCHAR(200) NOT NULL,
    item_barcode VARCHAR(100) NULL,
    category VARCHAR(50) NOT NULL,
    weight_kyat DECIMAL(8,2) NOT NULL,
    weight_pae DECIMAL(8,2) NOT NULL,
    weight_yway DECIMAL(8,3) NOT NULL,
    gemstone_weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    gemstone_weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    gemstone_weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    net_weight_kyat DECIMAL(8,2) NOT NULL,
    net_weight_pae DECIMAL(8,2) NOT NULL,
    net_weight_yway DECIMAL(8,3) NOT NULL,
    purity VARCHAR(50) NOT NULL,
    gold_price_snapshot DECIMAL(15,2) NOT NULL,
    gold_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    craftsmanship_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    stone_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    wastage_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(15,2) NOT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'MYANMAR_GOLD',
    thai_weight_unit DECIMAL(8,2) NULL,
    line_role VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_items_transaction (transaction_id),
    CONSTRAINT fk_items_transaction FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
    CONSTRAINT fk_items_inventory FOREIGN KEY (item_id) REFERENCES inventory_items (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_no VARCHAR(100) NOT NULL,
    customer_id INT UNSIGNED NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    purity VARCHAR(50) NOT NULL,
    target_weight_kyat DECIMAL(8,2) NOT NULL,
    target_weight_pae DECIMAL(8,2) NOT NULL,
    target_weight_yway DECIMAL(8,3) NOT NULL,
    craftsmanship_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    deposit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    estimated_total_price DECIMAL(15,2) NOT NULL,
    remaining_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    order_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('PENDING', 'IN_PRODUCTION', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    gold_rate_snapshot DECIMAL(15,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_orders_no (order_no),
    KEY idx_orders_status (status),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS goldsmith_jobs (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_no VARCHAR(100) NOT NULL,
    source_type ENUM('INVENTORY', 'ORDER', 'OLD_GOLD') NOT NULL,
    status ENUM('SENT', 'RETURNED', 'HANDED_OVER') NOT NULL DEFAULT 'SENT',
    inventory_item_id INT UNSIGNED NULL,
    order_id INT UNSIGNED NULL,
    sale_transaction_id INT UNSIGNED NULL,
    returned_inventory_id INT UNSIGNED NULL,
    item_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT '',
    purity VARCHAR(50) NOT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'MYANMAR_GOLD',
    weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    thai_weight_unit DECIMAL(8,3) NULL,
    source_grams DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    source_purity VARCHAR(50) NULL,
    source_category VARCHAR(50) NULL,
    craft_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    fee_paid TINYINT(1) NOT NULL DEFAULT 0,
    fee_paid_at DATETIME NULL,
    return_due_date DATE NULL,
    notes TEXT NULL,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    returned_at DATETIME NULL,
    handed_over_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_goldsmith_job_no (job_no),
    KEY idx_goldsmith_status (status),
    KEY idx_goldsmith_source (source_type),
    KEY idx_goldsmith_return_due (return_due_date),
    CONSTRAINT fk_goldsmith_inventory FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id) ON DELETE SET NULL,
    CONSTRAINT fk_goldsmith_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
    CONSTRAINT fk_goldsmith_sale FOREIGN KEY (sale_transaction_id) REFERENCES transactions (id) ON DELETE SET NULL,
    CONSTRAINT fk_goldsmith_returned_inv FOREIGN KEY (returned_inventory_id) REFERENCES inventory_items (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS pawn_records (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    pawn_ticket_no VARCHAR(100) NOT NULL,
    vno VARCHAR(100) NULL,
    customer_id INT UNSIGNED NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    item_type VARCHAR(50) NULL,
    gold_kind VARCHAR(50) NULL,
    weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    weight_grams DECIMAL(12,6) NOT NULL DEFAULT 0.000000,
    purity VARCHAR(50) NOT NULL,
    evaluated_value DECIMAL(15,2) NOT NULL,
    loan_amount DECIMAL(15,2) NOT NULL,
    loan_amount_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    monthly_interest_rate DECIMAL(8,2) NOT NULL DEFAULT 5.00,
    loss_months INT NOT NULL DEFAULT 3,
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    last_interest_date DATE NULL,
    next_interest_date DATE NULL,
    status ENUM('ACTIVE', 'REDEEMED', 'OVERDUE', 'CONFISCATED') NOT NULL DEFAULT 'ACTIVE',
    accrued_interest DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    interest_paid_kyat DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    interest_paid_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    redeem_date DATE NULL,
    redeem_months INT NULL,
    redeem_days INT NULL,
    redeem_interest_kyat DECIMAL(15,2) NULL,
    redeem_interest_baht DECIMAL(15,2) NULL,
    discount_kyat DECIMAL(15,2) NULL,
    discount_baht DECIMAL(15,2) NULL,
    redeem_total_kyat DECIMAL(15,2) NULL,
    redeem_total_baht DECIMAL(15,2) NULL,
    notes TEXT NULL,
    customer_signature VARCHAR(255) NULL,
    owner_signature VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pawn_ticket (pawn_ticket_no),
    KEY idx_pawn_status (status),
    CONSTRAINT fk_pawn_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS pawn_interest_payments (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    pawn_id INT UNSIGNED NOT NULL,
    voucher_no VARCHAR(50) NOT NULL,
    payment_date DATE NOT NULL,
    months_paid INT NOT NULL DEFAULT 1,
    days_paid INT NOT NULL DEFAULT 30,
    interest_kyat DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    interest_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    interest_rate DECIMAL(8,2) NOT NULL DEFAULT 5.00,
    covered_until_date DATE NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pawn_interest_pawn (pawn_id),
    KEY idx_pawn_interest_date (payment_date),
    CONSTRAINT fk_pawn_interest_pawn FOREIGN KEY (pawn_id) REFERENCES pawn_records (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS financial_ledger (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    type ENUM('INCOME', 'EXPENSE') NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    reference_no VARCHAR(100) NULL,
    date DATE NOT NULL,
    entry_source VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ledger_type_date (type, date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS customer_tracking (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id INT UNSIGNED NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    reference_type ENUM('TRANSACTION', 'CUSTOM_ORDER', 'PAWN') NOT NULL,
    reference_id VARCHAR(100) NOT NULL,
    reference_no VARCHAR(100) NOT NULL,
    tracking_type ENUM('OUTSTANDING_CREDIT', 'DELAYED_PAYMENT') NOT NULL,
    amount_due DECIMAL(15,2) NOT NULL,
    due_date DATE NOT NULL,
    days_overdue INT NOT NULL DEFAULT 0,
    interest_rate DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    monthly_interest DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status ENUM('UNPAID', 'PARTIAL', 'SETTLED') NOT NULL DEFAULT 'UNPAID',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tracking_type_status (tracking_type, status),
    CONSTRAINT fk_tracking_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS master_categories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    name_mm VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    category_group ENUM('PRODUCT', 'GOLD_CLASS', 'OTHER') NOT NULL DEFAULT 'PRODUCT',
    description VARCHAR(500) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_master_category_code (code),
    KEY idx_master_category_group (category_group),
    KEY idx_master_category_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS permission_modules (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    module_key VARCHAR(50) NOT NULL,
    name_mm VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_permission_module_key (module_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS role_permissions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    role ENUM('OWNER', 'MANAGER', 'CASHIER') NOT NULL,
    module_key VARCHAR(50) NOT NULL,
    can_create TINYINT(1) NOT NULL DEFAULT 0,
    can_read TINYINT(1) NOT NULL DEFAULT 0,
    can_update TINYINT(1) NOT NULL DEFAULT 0,
    can_delete TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_role_module (role, module_key),
    KEY idx_role_permissions_module (module_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS shop_settings (
    setting_key VARCHAR(100) NOT NULL,
    setting_value VARCHAR(255) NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS old_gold_merchant_returns (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    return_no VARCHAR(100) NOT NULL,
    merchant_name VARCHAR(150) NOT NULL,
    merchant_phone VARCHAR(50) NULL,
    description VARCHAR(255) NULL,
    return_date DATE NOT NULL,
    gold_category ENUM('THAI_GOLD', 'PAE_16', 'PAE_15', 'PAE_14') NOT NULL,
    purity VARCHAR(50) NOT NULL,
    grams DECIMAL(12,3) NOT NULL,
    weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_return_no (return_no),
    KEY idx_return_date (return_date),
    KEY idx_gold_category (gold_category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS old_gold_shop_transfers (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    transfer_no VARCHAR(100) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    description VARCHAR(255) NULL,
    transfer_date DATE NOT NULL,
    gold_category ENUM('THAI_GOLD', 'PAE_16', 'PAE_15', 'PAE_14') NOT NULL,
    purity VARCHAR(50) NOT NULL,
    grams DECIMAL(12,3) NOT NULL,
    weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_transfer_no (transfer_no),
    KEY idx_transfer_date (transfer_date),
    KEY idx_transfer_gold_category (gold_category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS old_gold_melts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    melt_no VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(255) NULL,
    melt_date DATE NOT NULL,
    gold_category ENUM('THAI_GOLD', 'PAE_16', 'PAE_15', 'PAE_14') NOT NULL,
    purity VARCHAR(50) NOT NULL,
    grams DECIMAL(12,3) NOT NULL,
    weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    craft_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_melt_no (melt_no),
    KEY idx_melt_date (melt_date),
    KEY idx_melt_gold_category (gold_category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS old_gold_other_outflows (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    outflow_no VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(255) NULL,
    outflow_date DATE NOT NULL,
    gold_category ENUM('THAI_GOLD', 'PAE_16', 'PAE_15', 'PAE_14') NOT NULL,
    purity VARCHAR(50) NOT NULL,
    grams DECIMAL(12,3) NOT NULL,
    weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    received_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_other_outflow_no (outflow_no),
    KEY idx_other_outflow_date (outflow_date),
    KEY idx_other_outflow_gold_category (gold_category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS credit_debts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    debt_no VARCHAR(100) NOT NULL,
    type ENUM('PAYABLE', 'RECEIVABLE') NOT NULL,
    asset_type ENUM('MONEY', 'GOLD') NOT NULL,
    person_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NULL,
    customer_id INT UNSIGNED NULL,
    address TEXT NULL,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_gold_k DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    total_gold_p DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    total_gold_y DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    paid_gold_k DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    paid_gold_p DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    paid_gold_y DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    remaining_gold_k DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    remaining_gold_p DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    remaining_gold_y DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    gold_quality VARCHAR(100) NULL,
    date DATE NOT NULL,
    due_date DATE NULL,
    status ENUM('PENDING', 'PARTIAL', 'SETTLED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_credit_debts_no (debt_no),
    KEY idx_credit_debts_type (type),
    KEY idx_credit_debts_asset (asset_type),
    KEY idx_credit_debts_status (status),
    KEY idx_credit_debts_date (date),
    KEY idx_credit_debts_customer (customer_id),
    CONSTRAINT fk_credit_debts_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS credit_debt_payments (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    credit_debt_id INT UNSIGNED NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    gold_k DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    gold_p DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    gold_y DECIMAL(8,3) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
    notes VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cdp_debt_id (credit_debt_id),
    CONSTRAINT fk_cdp_debt FOREIGN KEY (credit_debt_id) REFERENCES credit_debts (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export async function runColumnMigrations(pool: Pool): Promise<void> {
  const [cols] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
  );
  
  const tableCols = new Map<string, Set<string>>();
  for (const row of cols) {
    const table = String(row.TABLE_NAME);
    const col = String(row.COLUMN_NAME);
    if (!tableCols.has(table)) tableCols.set(table, new Set());
    tableCols.get(table)!.add(col);
  }

  const getCols = (table: string) => tableCols.get(table) || new Set<string>();

  // 1. staff_users
  const staffNames = getCols('staff_users');
  if (staffNames.has('pin_hash') && !staffNames.has('password')) {
    await pool.query(`ALTER TABLE staff_users ADD COLUMN password VARCHAR(100) NOT NULL DEFAULT '1234'`);
    await pool.query(`UPDATE staff_users SET password = '1234'`);
    await pool.query(`ALTER TABLE staff_users DROP COLUMN pin_hash`);
  } else if (staffNames.has('pin_hash') && staffNames.has('password')) {
    await pool.query(`UPDATE staff_users SET password = '1234'`);
    await pool.query(`ALTER TABLE staff_users DROP COLUMN pin_hash`);
  } else if (!staffNames.has('password') && staffNames.size > 0) {
    await pool.query(`ALTER TABLE staff_users ADD COLUMN password VARCHAR(100) NOT NULL DEFAULT '1234'`);
  }

  // 2. master_categories
  const catNames = getCols('master_categories');
  if (catNames.size > 0) {
    if (!catNames.has('category_group')) {
      await pool.query(`ALTER TABLE master_categories ADD COLUMN category_group ENUM('PRODUCT', 'GOLD_CLASS', 'OTHER') NOT NULL DEFAULT 'PRODUCT' AFTER name_en`);
    }
    if (!catNames.has('description')) {
      await pool.query(`ALTER TABLE master_categories ADD COLUMN description VARCHAR(500) NULL AFTER category_group`);
    }
    if (!catNames.has('updated_at')) {
      await pool.query(`ALTER TABLE master_categories ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
    }
    try { await pool.query(`ALTER TABLE master_categories ADD KEY idx_master_category_group (category_group)`); } catch {}
    try { await pool.query(`ALTER TABLE master_categories ADD KEY idx_master_category_active (is_active)`); } catch {}
  }

  // Auto-mark overdue / restore still-within-contract pawns
  await pool.query(
    `UPDATE pawn_records SET status = 'OVERDUE' WHERE status = 'ACTIVE' AND due_date < CURDATE()`
  );
  await pool.query(
    `UPDATE pawn_records SET status = 'ACTIVE' WHERE status = 'OVERDUE' AND (due_date IS NULL OR due_date >= CURDATE())`
  );

  // 3. pawn_records extra columns
  const pawnNames = getCols('pawn_records');
  if (pawnNames.size > 0) {
    const addPawnCol = async (col: string, ddl: string) => {
      if (!pawnNames.has(col)) await pool.query(`ALTER TABLE pawn_records ADD COLUMN ${ddl}`);
    };
    await addPawnCol('vno', 'vno VARCHAR(100) NULL AFTER pawn_ticket_no');
    await addPawnCol('item_type', 'item_type VARCHAR(50) NULL AFTER item_name');
    await addPawnCol('gold_kind', 'gold_kind VARCHAR(50) NULL AFTER item_type');
    await addPawnCol('weight_grams', 'weight_grams DECIMAL(12,6) NOT NULL DEFAULT 0.000000 AFTER weight_yway');
    await addPawnCol('loan_amount_baht', 'loan_amount_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER loan_amount');
    await addPawnCol('loss_months', 'loss_months INT NOT NULL DEFAULT 3 AFTER monthly_interest_rate');
    await addPawnCol('last_interest_date', 'last_interest_date DATE NULL AFTER due_date');
    await addPawnCol('next_interest_date', 'next_interest_date DATE NULL AFTER last_interest_date');
    await addPawnCol('notes', 'notes TEXT NULL AFTER accrued_interest');
    await addPawnCol('interest_paid_kyat', 'interest_paid_kyat DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER accrued_interest');
    await addPawnCol('interest_paid_baht', 'interest_paid_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER interest_paid_kyat');
    await addPawnCol('redeem_date', 'redeem_date DATE NULL AFTER interest_paid_baht');
    await addPawnCol('redeem_months', 'redeem_months INT NULL AFTER redeem_date');
    await addPawnCol('redeem_days', 'redeem_days INT NULL AFTER redeem_months');
    await addPawnCol('redeem_interest_kyat', 'redeem_interest_kyat DECIMAL(15,2) NULL AFTER redeem_days');
    await addPawnCol('redeem_interest_baht', 'redeem_interest_baht DECIMAL(15,2) NULL AFTER redeem_interest_kyat');
    await addPawnCol('discount_kyat', 'discount_kyat DECIMAL(15,2) NULL AFTER redeem_interest_baht');
    await addPawnCol('discount_baht', 'discount_baht DECIMAL(15,2) NULL AFTER discount_kyat');
    await addPawnCol('redeem_total_kyat', 'redeem_total_kyat DECIMAL(15,2) NULL AFTER discount_baht');
    await addPawnCol('redeem_total_baht', 'redeem_total_baht DECIMAL(15,2) NULL AFTER redeem_total_kyat');
    await addPawnCol('customer_signature', 'customer_signature VARCHAR(255) NULL AFTER notes');
    await addPawnCol('owner_signature', 'owner_signature VARCHAR(255) NULL AFTER customer_signature');
  }

  // pawn_interest_payments — days covered by a payment
  const pipNames = getCols('pawn_interest_payments');
  if (pipNames.size > 0 && !pipNames.has('days_paid')) {
    await pool.query(
      `ALTER TABLE pawn_interest_payments ADD COLUMN days_paid INT NOT NULL DEFAULT 30 AFTER months_paid`
    );
    await pool.query(
      `UPDATE pawn_interest_payments SET days_paid = GREATEST(1, COALESCE(months_paid, 1) * 30)`
    );
  }
  // Per-payment snapshot of last interest date (not overwritten by later payments)
  const pipColsNow = getCols('pawn_interest_payments');
  if (pipColsNow.size > 0 && !pipColsNow.has('covered_until_date')) {
    await pool.query(
      `ALTER TABLE pawn_interest_payments ADD COLUMN covered_until_date DATE NULL AFTER interest_rate`
    );
  }
  // Backfill any NULL covered_until_date from start_date + cumulative months
  if (getCols('pawn_interest_payments').has('covered_until_date')) {
    const [nullCountRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM pawn_interest_payments WHERE covered_until_date IS NULL`
    );
    if (Number(nullCountRows[0]?.c || 0) > 0) {
      const [pawnStarts] = await pool.query<RowDataPacket[]>(
        `SELECT id, start_date FROM pawn_records`
      );
      for (const pawn of pawnStarts) {
        const [pays] = await pool.query<RowDataPacket[]>(
          `SELECT id, months_paid, days_paid, covered_until_date FROM pawn_interest_payments
           WHERE pawn_id = ? ORDER BY payment_date ASC, id ASC`,
          [pawn.id]
        );
        let cursor = String(pawn.start_date).slice(0, 10);
        for (const pay of pays) {
          if (pay.covered_until_date) {
            cursor = String(pay.covered_until_date).slice(0, 10);
            continue;
          }
          const months = Math.max(
            1,
            Number(pay.months_paid || Math.round(Number(pay.days_paid || 30) / 30) || 1)
          );
          const d = new Date(
            Number(cursor.slice(0, 4)),
            Number(cursor.slice(5, 7)) - 1,
            Number(cursor.slice(8, 10))
          );
          d.setMonth(d.getMonth() + months);
          const yy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          cursor = `${yy}-${mm}-${dd}`;
          await pool.query(
            `UPDATE pawn_interest_payments SET covered_until_date = ? WHERE id = ?`,
            [cursor, pay.id]
          );
        }
      }
    }
  }

  // Refresh overdue day counters on open tracking rows
  await pool.query(`UPDATE customer_tracking SET days_overdue = GREATEST(0, DATEDIFF(CURDATE(), due_date)) WHERE status <> 'SETTLED'`);
  await pool.query(`UPDATE customer_tracking SET tracking_type = 'DELAYED_PAYMENT' WHERE status <> 'SETTLED' AND tracking_type = 'OUTSTANDING_CREDIT' AND due_date < CURDATE()`);

  // 4. inventory_items
  const invNames = getCols('inventory_items');
  if (invNames.size > 0) {
    const addInv = async (col: string, ddl: string) => {
      if (!invNames.has(col)) await pool.query(`ALTER TABLE inventory_items ADD COLUMN ${ddl}`);
    };
    await addInv('gemstone_weight_kyat', 'gemstone_weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER weight_yway');
    await addInv('gemstone_weight_pae', 'gemstone_weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER gemstone_weight_kyat');
    await addInv('gemstone_weight_yway', 'gemstone_weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00 AFTER gemstone_weight_pae');
    await addInv('craft_deduction_pae', 'craft_deduction_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER gemstone_weight_yway');
    await addInv('craft_deduction_yway', 'craft_deduction_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00 AFTER craft_deduction_pae');
    await addInv('profit_deduction_pae', 'profit_deduction_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER craft_deduction_yway');
    await addInv('profit_deduction_yway', 'profit_deduction_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00 AFTER profit_deduction_pae');
    await addInv('stone_price', 'stone_price DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER craftsmanship_fee');
    await addInv('craftsmanship_profit_fee', 'craftsmanship_profit_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER craftsmanship_fee');
    await addInv('stone_profit_price', 'stone_profit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER stone_price');
    await addInv('craftsmanship_fee_baht', 'craftsmanship_fee_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER selling_price_estimated');
    await addInv('craftsmanship_profit_fee_baht', 'craftsmanship_profit_fee_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER craftsmanship_fee_baht');
    await addInv('selling_price_baht', 'selling_price_baht DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER craftsmanship_profit_fee_baht');
    await addInv('baht_mmk_rate', 'baht_mmk_rate DECIMAL(15,4) NULL AFTER selling_price_baht');
    await addInv('thai_gold_baht_snapshot', 'thai_gold_baht_snapshot DECIMAL(15,2) NULL AFTER baht_mmk_rate');
  }

  // 5. transactions
  const txnNames = getCols('transactions');
  if (txnNames.size > 0) {
    const addTxn = async (col: string, ddl: string) => {
      if (!txnNames.has(col)) await pool.query(`ALTER TABLE transactions ADD COLUMN ${ddl}`);
    };
    await addTxn('stone_total', 'stone_total DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER craftsmanship_total');
    await addTxn('interest_rate', 'interest_rate DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER remaining_amount');
    await addTxn('credit_due_date', 'credit_due_date DATE NULL AFTER interest_rate');
    await addTxn('is_installment', 'is_installment TINYINT(1) NOT NULL DEFAULT 0 AFTER credit_due_date');
    try {
      await pool.query(
        `ALTER TABLE transactions MODIFY COLUMN transaction_type ENUM('SALE', 'PURCHASE', 'ORDER', 'EXCHANGE', 'PAWN', 'SHOP_OUT', 'OTHER_IN') NOT NULL`
      );
    } catch {}
  }

  // 6. transaction_items
  const tiNames = getCols('transaction_items');
  if (tiNames.size > 0) {
    const addTi = async (col: string, ddl: string) => {
      if (!tiNames.has(col)) await pool.query(`ALTER TABLE transaction_items ADD COLUMN ${ddl}`);
    };
    await addTi('gemstone_weight_kyat', 'gemstone_weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER weight_yway');
    await addTi('gemstone_weight_pae', 'gemstone_weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER gemstone_weight_kyat');
    await addTi('gemstone_weight_yway', 'gemstone_weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00 AFTER gemstone_weight_pae');
    await addTi('gold_amount', 'gold_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER gold_price_snapshot');
    await addTi('stone_price', 'stone_price DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER craftsmanship_fee');
    await addTi('thai_weight_unit', 'thai_weight_unit DECIMAL(8,2) NULL AFTER item_type');
    await addTi('line_role', 'line_role VARCHAR(255) NULL AFTER thai_weight_unit');
    await addTi('item_barcode', 'item_barcode VARCHAR(100) NULL AFTER item_name');
    await addTi('wastage_amount', 'wastage_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER stone_price');
  }

  // 7. customer_tracking
  const trNames = getCols('customer_tracking');
  if (trNames.size > 0) {
    if (!trNames.has('interest_rate')) {
      await pool.query(`ALTER TABLE customer_tracking ADD COLUMN interest_rate DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER days_overdue`);
    }
    if (!trNames.has('monthly_interest')) {
      await pool.query(`ALTER TABLE customer_tracking ADD COLUMN monthly_interest DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER interest_rate`);
    }
  }

  // 8. goldsmith_jobs
  const gsNames = getCols('goldsmith_jobs');
  if (gsNames.size > 0) {
    if (!gsNames.has('return_due_date')) {
      await pool.query(`ALTER TABLE goldsmith_jobs ADD COLUMN return_due_date DATE NULL AFTER fee_paid_at`);
    }
  }

  // 9. customers.nrc
  const custNames = getCols('customers');
  if (custNames.size > 0 && !custNames.has('nrc')) {
    await pool.query(`ALTER TABLE customers ADD COLUMN nrc VARCHAR(100) NULL AFTER phone`);
  }

  // 10. financial_ledger.entry_source — MANUAL (Other Income/Expense UI) vs SYSTEM (auto)
  const ledNames = getCols('financial_ledger');
  if (ledNames.size > 0 && !ledNames.has('entry_source')) {
    await pool.query(
      `ALTER TABLE financial_ledger ADD COLUMN entry_source VARCHAR(20) NOT NULL DEFAULT 'SYSTEM' AFTER date`
    );
    // Heuristic: categories only used from the manual ledger form → MANUAL
    await pool.query(
      `UPDATE financial_ledger SET entry_source = 'MANUAL'
       WHERE category IN (
         'MELTING_PROFIT', 'OTHER_INCOME', 'STAFF_SALARY', 'SHOP_RENT', 'RENT',
         'UTILITIES', 'EQUIPMENT_ACID', 'TAX', 'OTHER_EXPENSE'
       )
       AND NOT (
         category = 'OTHER_EXPENSE'
         AND description LIKE 'ပေါင်နှံပစ္စည်း ချေးငွေ%'
       )`
    );
  }

  // 11. old_gold_merchant_returns.description (အကြောင်းအရာ)
  const mrNames = getCols('old_gold_merchant_returns');
  if (mrNames.size > 0 && !mrNames.has('description')) {
    await pool.query(
      `ALTER TABLE old_gold_merchant_returns ADD COLUMN description VARCHAR(255) NULL AFTER merchant_phone`
    );
  }

  // 12. old_gold_melts.craft_fee (အရည်ကျို လက်ခ)
  const meltNames = getCols('old_gold_melts');
  if (meltNames.size > 0 && !meltNames.has('craft_fee')) {
    await pool.query(
      `ALTER TABLE old_gold_melts ADD COLUMN craft_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER weight_yway`
    );
  }
}

export async function runMigrations(pool: Pool): Promise<void> {
  for (const sql of TABLE_STATEMENTS) {
    await pool.query(sql);
  }
  await runColumnMigrations(pool);
}

export async function tableHasRows(pool: Pool, table: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
  return Number(rows[0]?.cnt ?? 0) > 0;
}
