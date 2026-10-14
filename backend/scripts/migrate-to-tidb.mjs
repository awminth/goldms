import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrateData() {
  const srcHost = process.env.MIGRATE_SRC_HOST || '127.0.0.1';
  const srcPort = Number(process.env.MIGRATE_SRC_PORT) || 3306;
  const srcUser = process.env.MIGRATE_SRC_USER || 'root';
  const srcPassword = process.env.MIGRATE_SRC_PASSWORD || '';
  const srcDb = process.env.MIGRATE_SRC_DB || process.env.DB_NAME || 'mt_goldms';

  const dstHost = process.env.DB_HOST;
  const dstPort = Number(process.env.DB_PORT) || 4000;
  const dstUser = process.env.DB_USER;
  const dstPassword = process.env.DB_PASSWORD || '';
  const dstDb = process.env.DB_NAME || 'mt_goldms';

  if (!dstHost || !dstUser || !dstDb) {
    throw new Error('Set DB_HOST, DB_USER, and DB_NAME in backend/.env for the TiDB destination.');
  }

  console.log(`Connecting to Source (${srcHost}:${srcPort} ${srcDb})...`);
  const src = await mysql.createConnection({
    host: srcHost,
    port: srcPort,
    user: srcUser,
    password: srcPassword,
    database: srcDb,
    dateStrings: true,
  });

  console.log(`Connecting to Destination (${dstHost}:${dstPort} ${dstDb})...`);
  const dst = await mysql.createConnection({
    host: dstHost,
    port: dstPort,
    user: dstUser,
    password: dstPassword,
    database: dstDb,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    dateStrings: true,
  });

  await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  const [tables] = await src.query('SHOW TABLES');
  const tableNames = tables.map((t) => Object.values(t)[0]);
  console.log(`Found ${tableNames.length} tables in source database.`);

  const summary = [];

  for (const table of tableNames) {
    const [rows] = await src.query(`SELECT * FROM \`${table}\``);
    console.log(`Migrating table '${table}' (${rows.length} rows)...`);

    // Clear destination table first
    await dst.query(`DELETE FROM \`${table}\``);

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map((c) => row[c]);
        await dst.execute(sql, values);
      }
    }

    const [destCount] = await dst.query(`SELECT COUNT(*) as c FROM \`${table}\``);
    const countMatch = rows.length === destCount[0].c;
    summary.push({
      table,
      sourceRows: rows.length,
      destRows: destCount[0].c,
      status: countMatch ? 'MATCH' : 'MISMATCH',
    });
  }

  await dst.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n--- Migration Summary ---');
  console.table(summary);

  await src.end();
  await dst.end();
  console.log('\nMigration completed successfully!');
}

migrateData().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
