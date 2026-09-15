import { createApp } from './app.js';
import { env } from './config/env.js';
import { initializeDatabase } from './config/bootstrap.js';

async function start() {
  await initializeDatabase();

  const app = createApp();
  app.listen(env.BACKEND_PORT, '0.0.0.0', () => {
    console.log(`API listening on http://localhost:${env.BACKEND_PORT}`);
    if (env.NODE_ENV !== 'production') {
      console.log(`Frontend (Vite HMR) expected at http://localhost:${env.FRONTEND_PORT}`);
      console.log('Run both with: cd backend && npm run dev');
    }
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
