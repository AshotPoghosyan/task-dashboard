import fp from 'fastify-plugin';
import { ZodError } from 'zod';

export const errorHandlerPlugin = fp(async (app) => {
  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues },
      });
    }
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;
    if (statusCode >= 500) request.log.error({ err: error }, 'unhandled error');
    const message = statusCode >= 500 ? 'Internal server error' : (error as Error).message;
    return reply.code(statusCode).send({
      error: { code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message },
    });
  });
});
