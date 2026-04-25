import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { scanForRestrictedMarkings, type DlpMatch } from './dlp.js';

export interface DlpPluginOptions {
  /**
   * Routes som ska skippas helt — t.ex. `/healthz`, `/readyz`, `/openapi.json`
   * och OPTIONS-anrop. Andra routes scannar ALLA strängfält i body.
   */
  skipRoutes?: string[];
}

export interface DlpRejectionPayload {
  error: 'classification_violation';
  message: string;
  matches: { field: string; label: string; value: string }[];
  guidance: string;
}

const DEFAULT_SKIP = new Set(['/healthz', '/readyz', '/docs', '/openapi.json']);

/**
 * Walk genom ett godtyckligt JSON-strukturobjekt och returnera alla
 * strängvärden tillsammans med deras dot-notation-path.
 */
export function* iterStringFields(
  value: unknown,
  prefix = '',
): Generator<{ path: string; value: string }> {
  if (typeof value === 'string') {
    yield { path: prefix || '$', value };
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      yield* iterStringFields(value[i], `${prefix}[${i}]`);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const nextPath = prefix ? `${prefix}.${k}` : k;
      yield* iterStringFields(v, nextPath);
    }
  }
}

interface FieldMatch {
  field: string;
  match: DlpMatch;
}

function scanRequestBody(body: unknown): FieldMatch[] {
  const found: FieldMatch[] = [];
  for (const { path, value } of iterStringFields(body)) {
    const result = scanForRestrictedMarkings(value);
    if (result.flagged) {
      for (const match of result.matches) {
        found.push({ field: path, match });
      }
    }
  }
  return found;
}

// eslint-disable-next-line @typescript-eslint/require-await -- fastify plugin signature requires async
const dlpPlugin: FastifyPluginAsync<DlpPluginOptions> = async (app, opts) => {
  const skipRoutes = new Set([...DEFAULT_SKIP, ...(opts.skipRoutes ?? [])]);

  app.addHook('preHandler', async (request: FastifyRequest, reply) => {
    if (skipRoutes.has(request.routeOptions.url ?? request.url)) {
      return;
    }
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      return;
    }
    if (!request.body) {
      return;
    }

    const matches = scanRequestBody(request.body);
    if (matches.length === 0) {
      return;
    }

    request.log.warn(
      {
        event: 'dlp.classification_violation',
        method: request.method,
        url: request.url,
        matches: matches.map((m) => ({ field: m.field, label: m.match.label })),
      },
      'request blocked: säkerhetsskyddsmarkering hittad i request body',
    );

    const payload: DlpRejectionPayload = {
      error: 'classification_violation',
      message:
        'Förfrågan blockerades eftersom innehållet ser ut att innehålla ' +
        'säkerhetsskyddsklassificerad information.',
      matches: matches.map((m) => ({
        field: m.field,
        label: m.match.label,
        value: m.match.value,
      })),
      guidance:
        'Plattformen hanterar endast information klassad som "open" eller "internal" ' +
        '(säkerhetsskyddslagen 2018:585). Använd ett säkerhetsskyddsklassat verktyg ' +
        'för material klassat som Begränsat hemlig eller högre.',
    };
    return reply.code(422).send(payload);
  });
};

/**
 * Plugin wrapad med fastify-plugin för att hooken ska gälla i hela
 * app-skopet (inte enbart plugin-scopet). Använd antingen default-export
 * direkt med `app.register(...)` eller helper-funktionen nedan.
 */
const wrapped = fp(dlpPlugin, {
  fastify: '5.x',
  name: 'ovh-dlp',
});

export function registerDlpPlugin(app: FastifyInstance, options: DlpPluginOptions = {}): void {
  void app.register(wrapped, options);
}

export default wrapped;
