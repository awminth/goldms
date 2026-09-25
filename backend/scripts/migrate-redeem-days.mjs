import { runMigrations } from '../db/tables.ts';
import { getPool } from '../config/db.ts';

const pool = getPool();
await runMigrations(pool);
const [cols] = await pool.query(
  `SHOW COLUMNS FROM pawn_records LIKE 'redeem_days'`
);
console.log('redeem_days column:', cols);
await pool.end();
