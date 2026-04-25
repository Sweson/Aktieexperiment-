import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import dlpPlugin from '@ovh/classification/fastify';
import { AuditChain } from '@ovh/audit-log';
import { InMemoryExerciseRepository } from './repository.js';
import { ExerciseService } from './service.js';
import { exerciseRoutes } from './routes.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const HEADERS = {
  'x-dev-tenant-id': TENANT,
  'x-dev-user-id': USER,
  'content-type': 'application/json',
};

let app: FastifyInstance;
let chain: AuditChain;

beforeEach(async () => {
  app = Fastify({ logger: false });
  await app.register(dlpPlugin);
  chain = new AuditChain();
  const repo = new InMemoryExerciseRepository();
  const service = new ExerciseService(repo, chain);
  await app.register((scope) => exerciseRoutes(scope, { service }));
});

afterEach(async () => {
  await app.close();
});

const validExercise = {
  name: 'Skogsbrand 2026',
  slug: 'skogsbrand-2026',
  format: 'ttx',
  classification: 'internal',
  summary: 'Tabletop för Skåne kommun.',
};

describe('POST /exercises', () => {
  it('creates a draft exercise and writes to audit log', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: validExercise,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      tenantId: TENANT,
      slug: 'skogsbrand-2026',
      status: 'draft',
      classification: 'internal',
      createdById: USER,
    });
    expect(chain.entries).toHaveLength(1);
    expect(chain.entries[0]).toMatchObject({
      action: 'exercise.created',
      target: { id: body.id, kind: 'exercise' },
      classification: 'internal',
    });
  });

  it('rejects request without auth headers (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: { 'content-type': 'application/json' },
      payload: validExercise,
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 on invalid slug', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: { ...validExercise, slug: 'INVALID UPPER CASE' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when classification is "confidential"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: { ...validExercise, classification: 'confidential' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('blocks via DLP when summary contains BEGRÄNSAT HEMLIG', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: {
        ...validExercise,
        slug: 'skogsbrand-classified',
        summary: 'Klassning: BEGRÄNSAT HEMLIG enligt säkerhetsskyddslagen.',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('classification_violation');
  });

  it('returns 409 on slug conflict within tenant', async () => {
    await app.inject({ method: 'POST', url: '/exercises', headers: HEADERS, payload: validExercise });
    const res2 = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: validExercise,
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error).toBe('slug_conflict');
  });
});

describe('GET /exercises', () => {
  it('lists tenant-scoped exercises with pagination', async () => {
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/exercises',
        headers: HEADERS,
        payload: { ...validExercise, slug: `ex-${i}` },
      });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/exercises?limit=2',
      headers: HEADERS,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
  });

  it('does not leak across tenants', async () => {
    await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: validExercise,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/exercises',
      headers: { ...HEADERS, 'x-dev-tenant-id': 'other-tenant' },
    });
    expect(res.json().total).toBe(0);
  });
});

describe('PATCH /exercises/:id/status', () => {
  it('allows draft → planning and writes audit', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: validExercise,
    });
    const id = created.json().id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/exercises/${id}/status`,
      headers: HEADERS,
      payload: { status: 'planning' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('planning');
    expect(chain.entries.some((e) => e.action === 'exercise.status_changed')).toBe(true);
  });

  it('rejects invalid transition with 409', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: validExercise,
    });
    const id = created.json().id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/exercises/${id}/status`,
      headers: HEADERS,
      payload: { status: 'completed' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('invalid_transition');
  });

  it('returns 404 on unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/exercises/00000000-0000-0000-0000-000000000000/status',
      headers: HEADERS,
      payload: { status: 'planning' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /exercises/:id and DELETE', () => {
  it('returns 404 for unknown id and 200 for known', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: validExercise,
    });
    const id = created.json().id;
    const res = await app.inject({ method: 'GET', url: `/exercises/${id}`, headers: HEADERS });
    expect(res.statusCode).toBe(200);
    const missing = await app.inject({
      method: 'GET',
      url: '/exercises/00000000-0000-0000-0000-000000000000',
      headers: HEADERS,
    });
    expect(missing.statusCode).toBe(404);
  });

  it('soft-deletes and writes audit', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/exercises',
      headers: HEADERS,
      payload: validExercise,
    });
    const id = created.json().id;
    const del = await app.inject({
      method: 'DELETE',
      url: `/exercises/${id}`,
      headers: { 'x-dev-tenant-id': TENANT, 'x-dev-user-id': USER },
    });
    expect(del.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: `/exercises/${id}`, headers: HEADERS });
    expect(after.statusCode).toBe(404);
    expect(chain.entries.some((e) => e.action === 'exercise.deleted')).toBe(true);
  });
});
