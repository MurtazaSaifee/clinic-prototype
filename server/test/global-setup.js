import { execFileSync } from 'node:child_process';

// Rebuild the test database once per run with the same script developers use.
export default function () {
  execFileSync('node', ['db/reset.ts'], { stdio: 'inherit', env: process.env });
}
