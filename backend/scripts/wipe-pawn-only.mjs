/**
 * Clear pawn / interest / redeem data only.
 * Does NOT touch inventory, POS, customers, old gold, orders, etc.
 *
 * Clears:
 *   - pawn_interest_payments
 *   - pawn_records (includes redeemed)
 *   - financial_ledger rows with category PAWN_LOAN / PAWN_INTEREST
 *
 * Usage: cd backend && node --env-file=.env scripts/wipe-pawn-only.mjs
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

async function main() {
  console.log(`Wipe pawn-only on ${DB_NAME}@${DB_HOST}:${DB_PORT} (ssl=${useSsl})`);

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

    const [led] = await conn.query(
      `DELETE FROM financial_ledger
       WHERE category IN ('PAWN_LOAN', 'PAWN_INTEREST')`
    );
    console.log(`DELETED financial_ledger PAWN_* rows: ${led.affectedRows ?? 0}`);

    try {
      const [trk] = await conn.query(
        `DELETE FROM customer_tracking WHERE reference_type = 'PAWN'`
      );
      console.log(`DELETED customer_tracking PAWN rows: ${trk.affectedRows ?? 0}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("doesn't exist")) {
        console.log('SKIP customer_tracking (missing)');
      } else {
        throw err;
      }
    }

    await conn.query('TRUNCATE TABLE `pawn_interest_payments`');
    console.log('TRUNCATED pawn_interest_payments');

    await conn.query('TRUNCATE TABLE `pawn_records`');
    console.log('TRUNCATED pawn_records');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    console.log('Done — other tables untouched.');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
