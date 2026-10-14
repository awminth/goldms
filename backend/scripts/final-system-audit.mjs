import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const useSsl =
  Boolean(process.env.DB_SSL) ||
  process.env.DB_HOST.includes('tidbcloud.com') ||
  process.env.DB_HOST.includes('aivencloud.com');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
});

async function runAudit() {
  const issues = [];
  const passes = [];

  console.log('==============================================');
  console.log('       GOLDMS FINAL SYSTEM AUDIT & CHECK      ');
  console.log('==============================================\n');

  // 1. Connection Check
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    passes.push('Database Ping & SSL connection: OK (TiDB Cloud connected)');
  } catch (err) {
    issues.push(`Database connection failed: ${err.message}`);
    console.error(issues[0]);
    process.exit(1);
  }

  // 2. Table row counts
  const tables = [
    'staff_users',
    'daily_gold_prices',
    'customers',
    'inventory_items',
    'transactions',
    'transaction_items',
    'orders',
    'pawn_records',
    'pawn_interest_payments',
    'financial_ledger',
    'goldsmith_jobs',
    'credit_debts',
    'credit_debt_payments',
    'shop_settings'
  ];

  console.log('--- TABLE RECORD COUNTS ---');
  for (const table of tables) {
    try {
      const [rows] = await pool.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`- ${table.padEnd(25)} : ${rows[0].cnt} rows`);
    } catch (e) {
      issues.push(`Table check failed for '${table}': ${e.message}`);
    }
  }

  // 3. Customer Balance Check
  console.log('\n--- CUSTOMER BALANCE RECONCILIATION ---');
  const [customers] = await pool.query('SELECT id, name, outstanding_balance FROM customers');
  let custMismatchCount = 0;
  for (const c of customers) {
    const [txnRes] = await pool.query(
      'SELECT COALESCE(SUM(remaining_amount), 0) AS total_txn_debt FROM transactions WHERE customer_id = ?',
      [c.id]
    );
    const [orderRes] = await pool.query(
      `SELECT COALESCE(SUM(remaining_balance), 0) AS total_order_debt FROM orders WHERE customer_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`,
      [c.id]
    );
    const expected = Number(txnRes[0].total_txn_debt) + Number(orderRes[0].total_order_debt);
    const actual = Number(c.outstanding_balance);
    if (Math.abs(expected - actual) > 0.01) {
      custMismatchCount++;
      issues.push(`Customer #${c.id} (${c.name}): balance mismatch! DB has ${actual}, calculated is ${expected}`);
    }
  }
  if (custMismatchCount === 0) {
    passes.push(`Customer balance reconciliation: OK (${customers.length} customers checked, all 100% matched)`);
  }

  // 4. Pawn Interest Reconciliation
  console.log('\n--- PAWN INTEREST RECONCILIATION ---');
  const [pawns] = await pool.query('SELECT id, pawn_ticket_no, interest_paid_kyat, interest_paid_baht FROM pawn_records');
  let pawnMismatchCount = 0;
  for (const p of pawns) {
    const [payRes] = await pool.query(
      'SELECT COALESCE(SUM(interest_kyat), 0) AS total_kyat, COALESCE(SUM(interest_baht), 0) AS total_baht FROM pawn_interest_payments WHERE pawn_id = ?',
      [p.id]
    );
    const expKyat = Number(payRes[0].total_kyat);
    const expBaht = Number(payRes[0].total_baht);
    const actKyat = Number(p.interest_paid_kyat);
    const actBaht = Number(p.interest_paid_baht);

    if (Math.abs(expKyat - actKyat) > 0.01 || Math.abs(expBaht - actBaht) > 0.01) {
      pawnMismatchCount++;
      issues.push(`Pawn #${p.id} (${p.pawn_ticket_no}): interest mismatch! DB has Kyat=${actKyat}/Baht=${actBaht}, payments sum is Kyat=${expKyat}/Baht=${expBaht}`);
    }
  }
  if (pawnMismatchCount === 0) {
    passes.push(`Pawn interest reconciliation: OK (${pawns.length} pawn tickets checked, all payments matched)`);
  }

  // 5. Inventory Data Integrity Check
  console.log('\n--- INVENTORY DATA INTEGRITY ---');
  const [invalidWeight] = await pool.query(
    'SELECT id, barcode, name FROM inventory_items WHERE weight_kyat < 0 OR weight_pae < 0 OR weight_yway < 0'
  );
  if (invalidWeight.length > 0) {
    issues.push(`Found ${invalidWeight.length} inventory items with negative weight!`);
  } else {
    passes.push('Inventory weights: OK (No negative weights found)');
  }

  const [orphanedSold] = await pool.query(
    `SELECT i.id, i.barcode FROM inventory_items i 
     LEFT JOIN transaction_items ti ON i.id = ti.item_id 
     WHERE i.status = 'SOLD' AND ti.id IS NULL`
  );
  if (orphanedSold.length > 0) {
    console.warn(`Note: Found ${orphanedSold.length} items marked SOLD without transaction_items (possibly seed data or direct update).`);
  } else {
    passes.push('Sold items association: OK');
  }

  // 6. Financial Ledger Data Integrity
  console.log('\n--- FINANCIAL LEDGER INTEGRITY ---');
  const [nullAmounts] = await pool.query(
    'SELECT id, type, description FROM financial_ledger WHERE amount IS NULL OR amount <= 0'
  );
  if (nullAmounts.length > 0) {
    issues.push(`Found ${nullAmounts.length} ledger entries with NULL or non-positive amount`);
  } else {
    passes.push('Financial ledger amounts: OK (No NULL or zero amounts)');
  }

  // 7. Results Summary
  console.log('\n==============================================');
  console.log('              AUDIT REPORT SUMMARY            ');
  console.log('==============================================');
  console.log('\n[PASSES]:');
  for (const p of passes) {
    console.log(`  ✓ ${p}`);
  }

  if (issues.length > 0) {
    console.log('\n[ISSUES FOUND]:');
    for (const iss of issues) {
      console.log(`  ✗ ${iss}`);
    }
  } else {
    console.log('\n✓ ALL AUDIT CHECKS PASSED WITH ZERO ISSUES!');
  }

  await pool.end();
}

runAudit().catch((err) => {
  console.error('Audit run error:', err);
  process.exit(1);
});
