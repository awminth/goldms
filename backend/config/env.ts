import dotenv from 'dotenv';

dotenv.config();

/** Required env: BACKEND_PORT, FRONTEND_PORT, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME */
export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  BACKEND_PORT: Number(process.env.PORT || process.env.BACKEND_PORT) || 7021,
  FRONTEND_PORT: Number(process.env.FRONTEND_PORT) || 7020,
  DB_HOST: process.env.DB_HOST ?? '',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER ?? '',
  DB_PASSWORD: process.env.DB_PASSWORD ?? '',
  DB_NAME: process.env.DB_NAME ?? '',
};
