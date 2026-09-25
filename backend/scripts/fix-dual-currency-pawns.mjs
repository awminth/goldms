import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const apply = process.argv.includes('--apply');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/**
 * Keep one currency only:
 * - THAI gold_kind → keep Baht, clear MMK
 * - otherwise → keep MMK, clear Baht
 * Also zero the inactive interest fields when both interest currencies exist on payments/redeems.
 */
async function main() {
  const [rows] = await pool.query(
    `SELECT id, pawn_ticket_no, vno, customer_name, gold_kind,
            loan_amount, loan_amount_baht, status
     FROM pawn_records
     WHERE COALESCE(loan_amount, 0) > 0 AND COALESCE(loan_amount_baht, 0) > 0
     ORDER BY id`
  );

  console.log(`Found ${rows.length} pawn(s) with both MMK and Baht loan amounts`);
  for (const r of rows) {
    const keepBaht = String(r.gold_kind || '').toUpperCase() === 'THAI';
    console.log(
      `#${r.id} ${r.vno || r.pawn_ticket_no} | ${r.customer_name} | gold=${r.gold_kind || '-'} | ` +
        `MMK=${r.loan_amount} Baht=${r.loan_amount_baht} → keep ${keepBaht ? 'BAHT' : 'MMK'}`
    );
  }

  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to update.');
    await pool.end();
    return;
  }

  let updated = 0;
  for (const r of rows) {
    const keepBaht = String(r.gold_kind || '').toUpperCase() === 'THAI';
    if (keepBaht) {
      await pool.query(
        `UPDATE pawn_records SET
           loan_amount = 0,
           redeem_interest_kyat = CASE WHEN redeem_interest_baht > 0 THEN 0 ELSE redeem_interest_kyat END,
           discount_kyat = CASE WHEN discount_baht > 0 THEN 0 ELSE discount_kyat END,
           redeem_total_kyat = CASE WHEN redeem_total_baht > 0 THEN 0 ELSE redeem_total_kyat END
         WHERE id = ?`,
        [r.id]
      );
    } else {
      await pool.query(
        `UPDATE pawn_records SET
           loan_amount_baht = 0,
           redeem_interest_baht = CASE WHEN redeem_interest_kyat > 0 THEN 0 ELSE redeem_interest_baht END,
           discount_baht = CASE WHEN discount_kyat > 0 THEN 0 ELSE discount_baht END,
           redeem_total_baht = CASE WHEN redeem_total_kyat > 0 THEN 0 ELSE redeem_total_baht END
         WHERE id = ?`,
        [r.id]
      );
    }
    updated += 1;
  }

  // Interest payments that have both currencies for pawns we touched (or any dual)
  const [payRows] = await pool.query(
    `SELECT id, pawn_id, interest_kyat, interest_baht
     FROM pawn_interest_payments
     WHERE COALESCE(interest_kyat, 0) > 0 AND COALESCE(interest_baht, 0) > 0`
  );
  for (const p of payRows) {
    const [[pawn]] = await pool.query(
      `SELECT gold_kind, loan_amount, loan_amount_baht FROM pawn_records WHERE id = ?`,
      [p.pawn_id]
    );
    const keepBaht =
      pawn &&
      (Number(pawn.loan_amount_baht || 0) > 0 ||
        String(pawn.gold_kind || '').toUpperCase() === 'THAI');
    if (keepBaht) {
      await pool.query(`UPDATE pawn_interest_payments SET interest_kyat = 0 WHERE id = ?`, [p.id]);
    } else {
      await pool.query(`UPDATE pawn_interest_payments SET interest_baht = 0 WHERE id = ?`, [p.id]);
    }
  }

  console.log(`\nUpdated ${updated} pawn record(s), ${payRows.length} dual interest payment(s).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
