import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import dlpPlugin, { iterStringFields, registerDlpPlugin } from './fastify-plugin.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

async function buildAppWithPlugin(skipRoutes: string[] = []): Promise<FastifyInstance> {
  const a = Fastify({ logger: false });
  await a.register(dlpPlugin, { skipRoutes });
  a.post('/exercises', async (req) => ({ ok: true, body: req.body }));
  a.put('/exercises/:id', async (req) => ({ ok: true, id: (req.params as { id: string }).id }));
  a.get('/exercises', async () => ({ ok: true }));
  a.get('/healthz', async () => ({ status: 'ok' }));
  return a;
}

describe('iterStringFields', () => {
  it('yields top-level string', () => {
    const fields = [...iterStringFields('hello')];
    expect(fields).toEqual([{ path: '$', value: 'hello' }]);
  });

  it('yields fields from a flat object', () => {
    const fields = [...iterStringFields({ name: 'Anna', age: 30 })];
    expect(fields).toEqual([{ path: 'name', value: 'Anna' }]);
  });

  it('walks nested objects with dot notation', () => {
    const fields = [...iterStringFields({ a: { b: { c: 'deep' } } })];
    expect(fields).toEqual([{ path: 'a.b.c', value: 'deep' }]);
  });

  it('walks arrays with bracket notation', () => {
    const fields = [...iterStringFields({ tags: ['x', 'y'] })];
    expect(fields).toEqual([
      { path: 'tags[0]', value: 'x' },
      { path: 'tags[1]', value: 'y' },
    ]);
  });
});

describe('dlp plugin · happy path', () => {
  it('lets clean POST through', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      payload: { name: 'Skogsbrand 2026', summary: 'En öppen TTX för Skåne.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it('skips GET requests entirely', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({ method: 'GET', url: '/exercises' });
    expect(res.statusCode).toBe(200);
  });

  it('skips configured routes', async () => {
    app = await buildAppWithPlugin(['/exercises']);
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      payload: { description: 'Klassning: HEMLIG' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('skips healthz by default', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('skips OPTIONS preflight requests', async () => {
    app = await buildAppWithPlugin();
    app.options('/exercises', async () => ({ allowed: 'POST' }));
    const res = await app.inject({ method: 'OPTIONS', url: '/exercises' });
    expect(res.statusCode).toBe(200);
  });

  it('skips HEAD requests', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({ method: 'HEAD', url: '/exercises' });
    expect(res.statusCode).toBe(200);
  });

  it('registers via helper function', async () => {
    app = Fastify({ logger: false });
    registerDlpPlugin(app);
    app.post('/x', async (req) => ({ body: req.body }));
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/x',
      payload: { description: 'BEGRÄNSAT HEMLIG' },
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('dlp plugin · rejects classified content', () => {
  it('returns 422 with classification_violation when body contains HEMLIG', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      payload: { description: 'Klassning: HEMLIG' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error).toBe('classification_violation');
    expect(body.guidance).toMatch(/2018:585/);
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]).toMatchObject({ field: 'description', label: 'hemlig' });
  });

  it('detects markings in nested fields', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      payload: {
        meta: {
          notes: ['ok', 'BEGRÄNSAT HEMLIG enligt säkerhetsskyddslagen'],
        },
      },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.matches[0].field).toBe('meta.notes[1]');
  });

  it('reports multiple matches across fields', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      payload: { a: 'KONFIDENTIELL', b: 'TOP SECRET' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.matches.length).toBeGreaterThanOrEqual(2);
    const labels = body.matches.map((m: { label: string }) => m.label);
    expect(labels).toEqual(expect.arrayContaining(['konfidentiell', 'top-secret']));
  });

  it('rejects PUT bodies the same way', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({
      method: 'PUT',
      url: '/exercises/abc',
      payload: { description: 'Skogsbrand klassad som HEMLIG.' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('does not flag clean nested payload', async () => {
    app = await buildAppWithPlugin();
    const res = await app.inject({
      method: 'POST',
      url: '/exercises',
      payload: {
        meta: {
          notes: ['hemlig favoriträtt', 'restricted parking', 'top secret meeting tomorrow'],
        },
      },
    });
    expect(res.statusCode).toBe(200);
  });
});
