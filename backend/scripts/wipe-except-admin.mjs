/**
 * Wipe all business data; keep admin user + master setup
 * (prices, categories, permissions, shop_settings).
 *
 * Usage: node --env-file=.env scripts/wipe-except-admin.mjs
 *    or: cd backend && node --env-file=.env scripts/wipe-except-admin.mjs
 */
import mysql from 'mysql2/promise';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = '',
  DB_SSL = '',
} = process.env;

if (!DB_NAME) {
  console.error('DB_NAME missing — set backend/.env');
  process.exit(1);
}

const useSsl =
  String(DB_SSL).toLowerCase() === 'true' ||
  String(DB_SSL) === '1' ||
  DB_HOST.includes('tidbcloud.com') ||
  DB_HOST.includes('aivencloud.com');

/** Child / dependent tables first where TRUNCATE order matters with FK checks off. */
const BUSINESS_TABLES = [
  'customer_tracking',
  'financial_ledger',
  'credit_debt_payments',
  'credit_debts',
  'pawn_interest_payments',
  'pawn_records',
  'goldsmith_jobs',
  'old_gold_other_outflows',
  'old_gold_melts',
  'old_gold_shop_transfers',
  'old_gold_merchant_returns',
  'orders',
  'transaction_items',
  'transactions',
  'inventory_items',
  'customers',
];

async function main() {
  console.log(`Wiping business data on ${DB_NAME}@${DB_HOST}:${DB_PORT} (ssl=${useSsl})`);

  const pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    namedPlaceholders: true,
    ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of BUSINESS_TABLES) {
      try {
        await conn.query(`TRUNCATE TABLE \`${table}\``);
        console.log(`TRUNCATED ${table}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("doesn't exist")) {
          console.log(`SKIP (missing) ${table}`);
        } else {
          throw err;
        }
      }
    }

    const [del] = await conn.query(
      `DELETE FROM staff_users WHERE LOWER(username) <> 'admin'`
    );
    console.log(`DELETED non-admin staff: ${del.affectedRows ?? 0}`);

    const [admins] = await conn.query(
      `SELECT id, username, role, name_mm FROM staff_users`
    );
    console.log('Remaining staff:', admins);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    console.log('Done. Kept: admin, prices, categories, permissions, shop_settings.');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

await main();
