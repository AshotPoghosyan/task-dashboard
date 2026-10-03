import { execSync } from 'node:child_process';

/** Resets the database to the large seed (10,000 MRs, 2,000 tasks) once per run. */
export default function globalSetup(): void {
  execSync('pnpm db:seed:large', { stdio: 'inherit' });
}
