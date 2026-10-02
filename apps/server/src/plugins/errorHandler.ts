import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};

export const errorHandlerPlugin = fp(async (app) => {
  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      const field = first?.path.join('.');
      const message = first ? `Invalid ${field || 'request'}: ${first.message}` : 'Invalid request';
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message, details: error.issues },
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
    }
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;
    if (statusCode >= 500) request.log.error({ err: error }, 'unhandled error');
    const message = statusCode >= 500 ? 'Internal server error' : (error as Error).message;
    const code =
      statusCode >= 500 ? 'INTERNAL_ERROR' : (STATUS_CODES[statusCode] ?? 'REQUEST_ERROR');
    return reply.code(statusCode).send({ error: { code, message } });
  });
});
