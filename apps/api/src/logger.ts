import { pino, type LoggerOptions } from 'pino';

/**
 * PII-redactionspaths för pino enligt CLAUDE.md §1.7.
 * Listan utökas vid behov när nya PII-fält identifieras.
 */
export const PII_REDACTION_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'personnummer',
  '*.personnummer',
  'ssn',
  '*.ssn',
  'email',
  '*.email',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export function buildLoggerOptions(env: NodeJS.ProcessEnv = process.env): LoggerOptions {
  const level = env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info');
  return {
    level,
    redact: {
      paths: PII_REDACTION_PATHS,
      censor: '[REDACTED]',
    },
    base: {
      service: 'ovh-api',
      env: env.NODE_ENV ?? 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
}

export const logger = pino(buildLoggerOptions());
