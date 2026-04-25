import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  ExerciseCreateInputSchema,
  ExerciseStatusTransitionSchema,
  ExerciseNotFoundError,
  SlugConflictError,
  StatusTransitionError,
} from './types.js';
import type { ExerciseService } from './service.js';
import type { ActorContext } from './service.js';

const DEV_ACTOR_HEADER_TENANT = 'x-dev-tenant-id';
const DEV_ACTOR_HEADER_USER = 'x-dev-user-id';

/**
 * Plockar ut tenant + user ur request. I dev/test används headers
 * (T-016 byter ut detta mot OIDC + ABAC). Saknade headers ger 401.
 */
class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor() {
    super('actor headers missing');
    this.name = 'UnauthorizedError';
  }
}

function actorFromRequest(req: FastifyRequest): ActorContext {
  const tenantId = req.headers[DEV_ACTOR_HEADER_TENANT];
  const userId = req.headers[DEV_ACTOR_HEADER_USER];
  if (typeof tenantId !== 'string' || typeof userId !== 'string') {
    throw new UnauthorizedError();
  }
  return { tenantId, userId };
}

export interface ExerciseRoutesDeps {
  service: ExerciseService;
}

// eslint-disable-next-line @typescript-eslint/require-await -- fastify plugin signature requires async
export async function exerciseRoutes(app: FastifyInstance, deps: ExerciseRoutesDeps): Promise<void> {
  const { service } = deps;

  app.post('/exercises', { schema: { tags: ['exercises'] } }, async (req, reply) => {
    const actor = actorFromRequest(req);
    const parsed = ExerciseCreateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }
    try {
      const ex = await service.create(actor, parsed.data);
      return reply.code(201).send(ex);
    } catch (err) {
      if (err instanceof SlugConflictError) {
        return reply.code(409).send({ error: 'slug_conflict', message: err.message });
      }
      throw err;
    }
  });

  app.get('/exercises', { schema: { tags: ['exercises'] } }, async (req, reply) => {
    const actor = actorFromRequest(req);
    const query = req.query as { status?: string; limit?: string; offset?: string };
    const limit = Math.min(Number(query.limit ?? 50), 100);
    const offset = Math.max(Number(query.offset ?? 0), 0);
    const result = await service.list(actor, {
      ...(query.status !== undefined
        ? { status: query.status as Parameters<typeof service.list>[1]['status'] }
        : {}),
      limit,
      offset,
    });
    return reply.send(result);
  });

  app.get('/exercises/:id', { schema: { tags: ['exercises'] } }, async (req, reply) => {
    const actor = actorFromRequest(req);
    const { id } = req.params as { id: string };
    try {
      const ex = await service.get(actor, id);
      return reply.send(ex);
    } catch (err) {
      if (err instanceof ExerciseNotFoundError) {
        return reply.code(404).send({ error: 'not_found' });
      }
      throw err;
    }
  });

  app.patch(
    '/exercises/:id/status',
    { schema: { tags: ['exercises'] } },
    async (req, reply) => {
      const actor = actorFromRequest(req);
      const { id } = req.params as { id: string };
      const parsed = ExerciseStatusTransitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'validation_error', issues: parsed.error.issues });
      }
      try {
        const ex = await service.transitionStatus(actor, id, parsed.data.status);
        return reply.send(ex);
      } catch (err) {
        if (err instanceof ExerciseNotFoundError) {
          return reply.code(404).send({ error: 'not_found' });
        }
        if (err instanceof StatusTransitionError) {
          return reply.code(409).send({
            error: 'invalid_transition',
            message: err.message,
            from: err.from,
            to: err.to,
          });
        }
        throw err;
      }
    },
  );

  app.delete('/exercises/:id', { schema: { tags: ['exercises'] } }, async (req, reply) => {
    const actor = actorFromRequest(req);
    const { id } = req.params as { id: string };
    try {
      await service.delete(actor, id);
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof ExerciseNotFoundError) {
        return reply.code(404).send({ error: 'not_found' });
      }
      throw err;
    }
  });
}
