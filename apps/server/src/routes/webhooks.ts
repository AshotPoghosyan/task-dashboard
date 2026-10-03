import type { Provider } from '@mrdash/shared';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { WebhookHandlers } from '../providers/webhooks.js';
import { ingestWebhook, type WebhookQueue } from '../services/webhookIngestService.js';

interface Options {
  handlers: WebhookHandlers;
  queue: WebhookQueue;
}

const BODY_LIMIT = 5 * 1024 * 1024;

export const webhookRoutes: FastifyPluginAsync<Options> = async (app, { handlers, queue }) => {
  // Signatures cover the exact bytes, so hand the handler the raw buffer instead of parsed JSON.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer', bodyLimit: BODY_LIMIT },
    (_request, body, done) => done(null, body),
  );

  const handle =
    (provider: Provider) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const result = await ingestWebhook(provider, request.headers, request.body as Buffer, {
        handlers,
        queue,
      });
      return reply.code(result === 'accepted' ? 202 : 200).send({ status: result });
    };

  // Provider retries are harmless (idempotent) and unverified requests cost no database work,
  // so the API rate limit does not apply here.
  const opts = { config: { rateLimit: false as const }, bodyLimit: BODY_LIMIT };
  app.post('/api/webhooks/gitlab', opts, handle('GITLAB'));
  app.post('/api/gitlab-webhook', opts, handle('GITLAB'));
  app.post('/api/webhooks/github', opts, handle('GITHUB'));
};
