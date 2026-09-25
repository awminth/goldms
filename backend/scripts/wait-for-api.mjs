/**
 * Wait until backend /api/health responds so Vite does not race DB boot.
 * Used by: npm run dev (concurrently backend + frontend)
 */
import 'dotenv/config';

const port = Number(process.env.BACKEND_PORT || process.env.PORT) || 7021;
const url = `http://127.0.0.1:${port}/api/health`;
const maxAttempts = 240; // ~120s
const delayMs = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  process.stdout.write(`Waiting for API ${url} …\n`);
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        process.stdout.write(`API ready (attempt ${i}).\n`);
        process.exit(0);
      }
    } catch {
      // ECONNREFUSED while DB init / listen not ready
    }
    await sleep(delayMs);
  }
  console.error(`Timed out after ${maxAttempts} attempts waiting for ${url}`);
  process.exit(1);
}

main();
