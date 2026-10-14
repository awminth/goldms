/**
 * One-shot: backfill Thai inventory Baht/MMK fields for existing stock.
 * Usage: node --import tsx scripts/backfill-thai-inventory-baht.mjs
 * (or: npx tsx scripts/backfill-thai-inventory-baht.ts)
 */
import { initializeDatabase } from '../config/bootstrap.js';
import { getPool } from '../config/db.js';
import { backfillThaiInventoryBahtFields } from '../db/masterSeed.js';

await initializeDatabase();
const n = await backfillThaiInventoryBahtFields(getPool());
console.log(`Backfilled ${n} Thai inventory row(s).`);
process.exit(0);
