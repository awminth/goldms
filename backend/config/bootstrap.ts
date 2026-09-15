import mysql from 'mysql2/promise';
import { env } from './env.js';
import { getPool, isDbConfigured, testConnection } from './db.js';
import { runMigrations } from '../db/tables.js';
import { seedDatabase } from '../db/seed.js';
import { ensureMasterAndPermissions } from '../db/masterSeed.js';

async function ensureDatabaseExists(): Promise<void> {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

export async function initializeDatabase(): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured. Set DB_* values in backend/.env');
  }

  await ensureDatabaseExists();
  await testConnection();
  const pool = getPool();
  await runMigrations(pool);
  await seedDatabase(pool);
  await ensureMasterAndPermissions(pool);
  console.log(`Database ready: ${env.DB_NAME}@${env.DB_HOST}:${env.DB_PORT}`);
}
