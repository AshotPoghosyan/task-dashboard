import { createHash } from 'node:crypto';
import fp from 'fastify-plugin';

/**
 * Adds a weak ETag to successful JSON GET responses and answers matching
 * `If-None-Match` requests with 304. Must be registered before compression so the
 * tag is computed over the uncompressed body.
 */
export const etagPlugin = fp(async (app) => {
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.method !== 'GET' || reply.statusCode !== 200 || typeof payload !== 'string') {
      return payload;
    }
    const etag = `W/"${createHash('sha1').update(payload).digest('base64url')}"`;
    void reply.header('etag', etag);
    if (request.headers['if-none-match'] === etag) {
      void reply.code(304);
      return '';
    }
    return payload;
  });
});
