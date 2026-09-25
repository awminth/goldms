import { runMigrations } from '../db/tables.ts';
import { getPool } from '../config/db.ts';

const pool = getPool();
await runMigrations(pool);
const [cols] = await pool.query(
  `SHOW COLUMNS FROM pawn_interest_payments LIKE 'days_paid'`
);
console.log('days_paid column:', cols);
await pool.end();
