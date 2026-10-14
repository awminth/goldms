import mysql from 'mysql2/promise';

async function migrateData() {
  console.log('Connecting to Source (localhost:3306 mt_goldms)...');
  const src = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'mt_goldms',
    dateStrings: true,
  });

  console.log('Connecting to Destination (TiDB Cloud mt_goldms)...');
  const dst = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: 'dorVmh3vnSFWZXo.root',
    password: 'Ox5iBBZ5MLKUlB3U',
    database: 'mt_goldms',
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
