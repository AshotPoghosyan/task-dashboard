import { buildApp } from './app.js';
import { getEnv } from './config/env.js';
import { disconnectPrisma } from './db/prisma.js';
import { createSyncScheduler } from './jobs/syncJobs.js';
import { createProviderRegistry } from './providers/registry.js';

const env = getEnv();
const providers = createProviderRegistry(env);
const scheduler = createSyncScheduler(env, providers);
const app = await buildApp(env, { providers, syncTrigger: scheduler });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await scheduler.stop();
  await disconnectPrisma();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  await scheduler.start(app.log);
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}
