import Fastify, { type FastifyInstance } from 'fastify';
import { buildLoggerOptions } from './logger.js';

export interface AppOptions {
  /** Sätts till true av readyz-handlers när alla beroenden är klara. */
  readinessProbe?: () => boolean;
}

/**
 * Bygger en Fastify-instans med strukturerad pino-logg och hälsoslut.
 *
 * Hälsoslut:
 *  - GET /healthz   liveness — svarar 200 så länge processen lever
 *  - GET /readyz    readiness — svarar 503 om beroenden inte är redo
 */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: buildLoggerOptions(),
    disableRequestLogging: false,
    trustProxy: true,
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (_req, reply) => {
    const ready = options.readinessProbe ? options.readinessProbe() : true;
    if (!ready) {
      return reply.code(503).send({ status: 'not_ready' });
    }
    return { status: 'ready' };
  });

  return app;
}

