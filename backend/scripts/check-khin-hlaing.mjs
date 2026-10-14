import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [rows] = await pool.query(
  `SELECT id, vno, customer_name, item_name, loan_amount, status, start_date, due_date, redeem_date, notes
   FROM pawn_records
   WHERE vno IN ('VNO-8807', 'VNO-8805', 'VNO-8803')
      OR customer_name LIKE ?
   ORDER BY id`,
  ['%ခင်လှိုင်%']
);
console.log(JSON.stringify(rows, null, 2));
await pool.end();
