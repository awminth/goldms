import mysql from 'mysql2/promise';
import { env } from './env.js';

let pool: mysql.Pool | null = null;

export function isDbConfigured(): boolean {
  return Boolean(env.DB_HOST && env.DB_NAME && env.DB_USER);
}

export function getPool(): mysql.Pool {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured. Set DB_HOST, DB_USER, and DB_NAME in backend/.env');
  }

  if (!pool) {
    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      dateStrings: true,
    });
  }

  return pool;
}

export async function testConnection(): Promise<void> {
  const connection = await getPool().getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
