import Fastify, { type FastifyInstance } from 'fastify';
import { buildLoggerOptions } from './logger.js';
import { registerOpenApi } from './openapi.js';

export interface AppOptions {
  /** Sätts till true av readyz-handlers när alla beroenden är klara. */
  readinessProbe?: () => boolean;
  /** Sätt false i tester som inte vill registrera OpenAPI-dokumentationen. */
  enableOpenApi?: boolean;
}

const HEALTHZ_SCHEMA = {
  schema: {
    tags: ['system'],
    summary: 'Liveness probe',
    response: {
      200: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['ok'] } },
        required: ['status'],
      },
    },
  },
} as const;

const READYZ_SCHEMA = {
  schema: {
    tags: ['system'],
    summary: 'Readiness probe',
    response: {
      200: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['ready'] } },
        required: ['status'],
      },
      503: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['not_ready'] } },
        required: ['status'],
      },
    },
  },
} as const;

/**
 * Bygger en Fastify-instans med strukturerad pino-logg, hälsoslut och
 * OpenAPI-dokumentation.
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: buildLoggerOptions(),
    disableRequestLogging: false,
    trustProxy: true,
  });

  if (options.enableOpenApi !== false) {
    await registerOpenApi(app);
  }

  app.get('/healthz', HEALTHZ_SCHEMA, async () => ({ status: 'ok' }));

  app.get('/readyz', READYZ_SCHEMA, async (_req, reply) => {
    const ready = options.readinessProbe ? options.readinessProbe() : true;
    if (!ready) {
      return reply.code(503).send({ status: 'not_ready' });
    }
    return { status: 'ready' };
  });

  return app;
}

