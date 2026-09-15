import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '..', 'frontend');
const frontendDist = path.join(frontendRoot, 'dist');
const backendDist = path.join(backendRoot, 'dist');

console.log('Building frontend...');
execSync('npm run build', { cwd: frontendRoot, stdio: 'inherit' });

if (!fs.existsSync(frontendDist)) {
  throw new Error(`Frontend build output not found at ${frontendDist}`);
}

if (fs.existsSync(backendDist)) {
  fs.rmSync(backendDist, { recursive: true, force: true });
}

fs.cpSync(frontendDist, backendDist, { recursive: true });
console.log(`Copied frontend build to ${backendDist}`);
