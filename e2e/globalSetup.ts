import { execSync } from 'node:child_process';
import { E2E_DATABASE_URL } from '../playwright.config';

/** Resets the test database to the large seed (10,000 MRs, 2,000 tasks) once per run. */
export default function globalSetup(): void {
  if (!E2E_DATABASE_URL) throw new Error('Set DATABASE_URL_TEST (or DATABASE_URL) for E2E.');
  execSync('pnpm db:seed:large', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });
}
