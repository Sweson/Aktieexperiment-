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
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /readyz', () => {
  it('returns 200 ready when no probe is provided', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
  });

  it('returns 200 ready when probe returns true', async () => {
    app = buildApp({ readinessProbe: () => true });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
  });

  it('returns 503 not_ready when probe returns false', async () => {
    app = buildApp({ readinessProbe: () => false });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'not_ready' });
  });
});

describe('unknown route', () => {
  it('returns 404', async () => {
    app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });
});
