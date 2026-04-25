import type { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';

export const OPENAPI_INFO = {
  title: 'ÖvningsHub Sverige API',
  description:
    'Suverän svensk SaaS för krisövning på öppen/intern informationsnivå. ' +
    'Plattformen hanterar inte säkerhetsskyddsklassificerad information ' +
    '(säkerhetsskyddslagen 2018:585).',
  version: '0.0.0',
} as const;

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: { ...OPENAPI_INFO },
      servers: [{ url: 'http://localhost:3000', description: 'Local dev' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'system', description: 'Hälsoslut och plattformsstatus' },
        { name: 'exercises', description: 'Övningsdesign och MSEL' },
        { name: 'auth', description: 'Identitet och federation' },
      ],
    },
  });

  await app.register(scalarApiReference, {
    routePrefix: '/docs',
    configuration: {
      theme: 'default',
      hideClientButton: true,
    },
  });

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
}
