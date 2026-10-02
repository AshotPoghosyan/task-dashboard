/* Benchmarks list endpoints against the large seed: `pnpm bench` (run `pnpm db:seed:large` first). */
import { performance } from 'node:perf_hooks';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { disconnectPrisma } from '../db/prisma.js';

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 100);
const P95_BUDGET_MS = 100;

const SCENARIOS: Record<string, string> = {
  'mrs: default page': '/api/merge-requests?limit=50',
  'mrs: max page': '/api/merge-requests?limit=200',
  'mrs: status filter': '/api/merge-requests?status=OPEN,IN_REVIEW&limit=50',
  'mrs: search': '/api/merge-requests?q=fix&limit=50',
  'mrs: status + search': '/api/merge-requests?status=MERGED&q=add&limit=50',
  'mrs: sort by title': '/api/merge-requests?sort=title&order=asc&limit=50',
  'tasks: default page': '/api/tasks?limit=50',
  'tasks: max page': '/api/tasks?limit=200',
  'tasks: status filter': '/api/tasks?status=OPEN,IN_REVIEW&limit=50',
  'tasks: search': '/api/tasks?q=fix&limit=50',
  'tasks: type filter': '/api/tasks?type=BUG&limit=50',
};

const p95 = (xs: number[]): number =>
  [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1] ?? 0;

const env = loadEnv({ ...process.env, LOG_LEVEL: 'silent', RATE_LIMIT_MAX: '1000000' });
const app = await buildApp(env);
let failed = false;

for (const [name, url] of Object.entries(SCENARIOS)) {
  // Warm up connection pool and query plans.
  for (let i = 0; i < 5; i++) await app.inject({ method: 'GET', url });
  const times: number[] = [];
  let status = 200;
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    const res = await app.inject({ method: 'GET', url });
    times.push(performance.now() - start);
    status = res.statusCode;
  }
  const value = p95(times);
  const ok = status === 200 && value < P95_BUDGET_MS;
  failed ||= !ok;
  process.stdout.write(
    `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(24)} p95=${value.toFixed(1)}ms status=${status}\n`,
  );
}

await app.close();
await disconnectPrisma();
process.exit(failed ? 1 : 0);
