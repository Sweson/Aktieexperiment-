import { describe, it, expect } from 'vitest';
import { buildLoggerOptions, PII_REDACTION_PATHS } from './logger.js';

describe('buildLoggerOptions', () => {
  it('uses LOG_LEVEL when provided', () => {
    const opts = buildLoggerOptions({ LOG_LEVEL: 'debug' });
    expect(opts.level).toBe('debug');
  });

  it('falls back to "info" outside test', () => {
    const opts = buildLoggerOptions({ NODE_ENV: 'production' });
    expect(opts.level).toBe('info');
  });

  it('falls back to "silent" in test env', () => {
    const opts = buildLoggerOptions({ NODE_ENV: 'test' });
    expect(opts.level).toBe('silent');
  });

  it('configures redact paths and censor', () => {
    const opts = buildLoggerOptions({});
    expect(opts.redact).toMatchObject({
      paths: expect.arrayContaining(['password', 'token', 'authorization']),
      censor: '[REDACTED]',
    });
  });

  it('exports common PII fields in the redaction list', () => {
    expect(PII_REDACTION_PATHS).toContain('password');
    expect(PII_REDACTION_PATHS).toContain('personnummer');
    expect(PII_REDACTION_PATHS).toContain('email');
  });
});
