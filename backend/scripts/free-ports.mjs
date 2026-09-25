import { execSync } from 'child_process';
import process from 'process';
import dotenv from 'dotenv';

dotenv.config();

const ports = [
  Number(process.env.BACKEND_PORT || process.env.PORT) || 7021,
  Number(process.env.FRONTEND_PORT) || 7020,
];

function freePort(port) {
  if (process.platform === 'win32') {
    try {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);
      const pids = new Set();
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            pids.add(pid);
          }
        }
      }
      for (const pid of pids) {
        console.log(`[free-ports] Freeing port ${port} by terminating PID ${pid}...`);
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* netstat returned non-zero (port free) */
    }
  } else {
    try {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
  }
}

for (const p of ports) {
  freePort(p);
}
