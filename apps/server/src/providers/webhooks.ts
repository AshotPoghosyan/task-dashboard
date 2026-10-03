import type { Provider } from '@mrdash/shared';
import type { Env } from '../config/env.js';
import { createGitHubWebhookHandler } from './github/webhook.js';
import { createGitLabWebhookHandler } from './gitlab/webhook.js';
import type { WebhookHandler } from './types.js';

export type WebhookHandlers = Record<Provider, WebhookHandler>;

export function createWebhookHandlers(
  env: Pick<Env, 'GITLAB_WEBHOOK_SECRET' | 'GITHUB_WEBHOOK_SECRET'>,
): WebhookHandlers {
  return {
    GITLAB: createGitLabWebhookHandler(env.GITLAB_WEBHOOK_SECRET),
    GITHUB: createGitHubWebhookHandler(env.GITHUB_WEBHOOK_SECRET),
  };
}
