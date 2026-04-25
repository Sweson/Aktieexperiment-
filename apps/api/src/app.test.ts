import { describe, it, expect, afterEach } from 'vitest';
import { buildApp } from './app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe('GET /healthz', () => {
  it('returns 200 ok', async () => {
    app = await buildApp({ enableOpenApi: false });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /readyz', () => {
  it('returns 200 ready when no probe is provided', async () => {
    app = await buildApp({ enableOpenApi: false });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
  });

  it('returns 200 ready when probe returns true', async () => {
    app = await buildApp({ readinessProbe: () => true, enableOpenApi: false });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
  });

  it('returns 503 not_ready when probe returns false', async () => {
    app = await buildApp({ readinessProbe: () => false, enableOpenApi: false });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'not_ready' });
  });
});

describe('unknown route', () => {
  it('returns 404', async () => {
    app = await buildApp({ enableOpenApi: false });
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });
});

describe('OpenAPI integration', () => {
  it('serves OpenAPI 3.1 spec at /openapi.json when enabled', async () => {
    app = await buildApp();
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json<{
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    }>();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toMatch(/ÖvningsHub/);
    expect(spec.paths['/healthz']).toBeDefined();
    expect(spec.paths['/readyz']).toBeDefined();
  });

  it('serves Scalar UI at /docs', async () => {
    app = await buildApp();
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect([200, 301, 302]).toContain(res.statusCode);
  });
});
