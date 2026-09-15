import { initializeDatabase } from '../config/bootstrap.js';
import { closePool } from '../config/db.js';

async function main() {
  await initializeDatabase();
  await closePool();
  console.log('Database initialized successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
