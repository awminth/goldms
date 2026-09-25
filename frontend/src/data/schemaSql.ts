/** Production MySQL schema matching backend/db/tables.ts (mt_goldms) */
export const MYSQL_DATABASE_SCHEMA_SQL = `-- =========================================================================
-- SHWE THARAPHU GOLD SHOP MANAGEMENT SYSTEM
-- MySQL 8.0+ / MariaDB 10.5+ — matches live backend migrations
-- Database: mt_goldms
-- =========================================================================

CREATE DATABASE IF NOT EXISTS \`mt_goldms\`
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE \`mt_goldms\`;

CREATE TABLE IF NOT EXISTS staff_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  name_mm VARCHAR(200) NOT NULL,
  role ENUM('OWNER', 'MANAGER', 'CASHIER') NOT NULL DEFAULT 'CASHIER',
  phone VARCHAR(50) NULL,
  password VARCHAR(100) NOT NULL COMMENT 'Plain-text PIN/password (e.g. 1234)',
  avatar_color VARCHAR(100) NOT NULL DEFAULT 'from-amber-500 to-yellow-600',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_staff_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_gold_prices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  gold_type VARCHAR(50) NOT NULL,
  name_mm VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  price_per_kyat DECIMAL(15,2) NOT NULL,
  buy_price_per_kyat DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_gold_type (gold_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT NULL,
  outstanding_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  barcode VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  name_mm VARCHAR(200) NOT NULL,
  weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
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
  selling_price_estimated DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status ENUM('IN_STOCK', 'SOLD', 'RESERVED', 'UNDER_PAWN', 'SHOP_OUT', 'WITH_GOLDSMITH') NOT NULL DEFAULT 'IN_STOCK',
  image_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventory_barcode (barcode),
  KEY idx_inventory_category (category),
  KEY idx_inventory_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_no VARCHAR(100) NOT NULL,
  customer_id INT UNSIGNED NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(50) NULL,
  transaction_type ENUM('SALE', 'PURCHASE', 'ORDER', 'EXCHANGE', 'PAWN', 'SHOP_OUT') NOT NULL,
  gold_price_snapshot DECIMAL(15,2) NOT NULL,
  craftsmanship_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) NOT NULL,
  remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('CASH', 'KPAY', 'WAVEPAY', 'BANK_TRANSFER', 'CARD') NOT NULL DEFAULT 'CASH',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_transactions_invoice (invoice_no),
  KEY idx_transactions_customer (customer_id),
  KEY idx_transactions_type (transaction_type),
  CONSTRAINT fk_transactions_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transaction_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NULL,
  item_name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  weight_kyat DECIMAL(8,2) NOT NULL,
  weight_pae DECIMAL(8,2) NOT NULL,
  weight_yway DECIMAL(8,3) NOT NULL,
  net_weight_kyat DECIMAL(8,2) NOT NULL,
  net_weight_pae DECIMAL(8,2) NOT NULL,
  net_weight_yway DECIMAL(8,3) NOT NULL,
  purity VARCHAR(50) NOT NULL,
  gold_price_snapshot DECIMAL(15,2) NOT NULL,
  craftsmanship_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(15,2) NOT NULL,
  item_type VARCHAR(50) NOT NULL DEFAULT 'MYANMAR_GOLD',
  thai_weight_unit DECIMAL(8,2) NULL,
  line_role VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_items_transaction (transaction_id),
  CONSTRAINT fk_items_transaction FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
  CONSTRAINT fk_items_inventory FOREIGN KEY (item_id) REFERENCES inventory_items (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goldsmith_jobs (
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
  CONSTRAINT fk_goldsmith_inventory FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id) ON DELETE SET NULL,
  CONSTRAINT fk_goldsmith_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
  CONSTRAINT fk_goldsmith_sale FOREIGN KEY (sale_transaction_id) REFERENCES transactions (id) ON DELETE SET NULL,
  CONSTRAINT fk_goldsmith_returned_inv FOREIGN KEY (returned_inventory_id) REFERENCES inventory_items (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pawn_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pawn_ticket_no VARCHAR(100) NOT NULL,
  customer_id INT UNSIGNED NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  weight_kyat DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  weight_pae DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  weight_yway DECIMAL(8,3) NOT NULL DEFAULT 0.00,
  purity VARCHAR(50) NOT NULL,
  evaluated_value DECIMAL(15,2) NOT NULL,
  loan_amount DECIMAL(15,2) NOT NULL,
  monthly_interest_rate DECIMAL(8,2) NOT NULL DEFAULT 3.00,
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('ACTIVE', 'REDEEMED', 'OVERDUE', 'CONFISCATED') NOT NULL DEFAULT 'ACTIVE',
  accrued_interest DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pawn_ticket (pawn_ticket_no),
  KEY idx_pawn_status (status),
  CONSTRAINT fk_pawn_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS financial_ledger (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('INCOME', 'EXPENSE') NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  reference_no VARCHAR(100) NULL,
  date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ledger_type_date (type, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_tracking (
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
  status ENUM('UNPAID', 'PARTIAL', 'SETTLED') NOT NULL DEFAULT 'UNPAID',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tracking_type_status (tracking_type, status),
  CONSTRAINT fk_tracking_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;
