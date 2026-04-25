import { describe, it, expect } from 'vitest';
import {
  Classification,
  ClassificationSchema,
  assertClassification,
  isClassification,
  ClassificationError,
  ALLOWED_CLASSIFICATIONS,
} from './index.js';

describe('ALLOWED_CLASSIFICATIONS', () => {
  it('exposes exactly two values: open and internal', () => {
    expect([...ALLOWED_CLASSIFICATIONS].sort()).toEqual(['internal', 'open']);
  });

  it('is frozen at runtime so mutations throw or are silently dropped', () => {
    expect(Object.isFrozen(ALLOWED_CLASSIFICATIONS)).toBe(true);
    expect(() => {
      // @ts-expect-error — readonly tuple
      ALLOWED_CLASSIFICATIONS.push('confidential');
    }).toThrow(TypeError);
  });
});

describe('ClassificationSchema (zod)', () => {
  it('accepts "open"', () => {
    expect(ClassificationSchema.parse('open')).toBe('open');
  });

  it('accepts "internal"', () => {
    expect(ClassificationSchema.parse('internal')).toBe('internal');
  });

  it.each([
    'confidential',
    'secret',
    'top_secret',
    'top secret',
    'public',
    'restricted',
    'OPEN',
    'Internal',
    'begränsat hemlig',
    'hemlig',
    'kvalificerat hemlig',
    '',
    null,
    undefined,
    42,
    {},
  ])('rejects %p', (input) => {
    const result = ClassificationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('isClassification type guard', () => {
  it('returns true for valid values', () => {
    expect(isClassification('open')).toBe(true);
    expect(isClassification('internal')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isClassification('confidential')).toBe(false);
    expect(isClassification('OPEN')).toBe(false);
    expect(isClassification(null)).toBe(false);
    expect(isClassification(123)).toBe(false);
  });
});

describe('assertClassification', () => {
  it('returns the value when valid', () => {
    const v: Classification = assertClassification('open');
    expect(v).toBe('open');
    expect(assertClassification('internal')).toBe('internal');
  });

  it('throws ClassificationError on confidential', () => {
    expect(() => assertClassification('confidential')).toThrow(ClassificationError);
  });

  it.each([
    'secret',
    'top_secret',
    'begränsat hemlig',
    'hemlig',
    'kvalificerat hemlig',
    'restricted',
    'public',
    'OPEN',
    '',
    null,
    undefined,
    {},
    42,
  ])('throws ClassificationError on %p', (input) => {
    expect(() => assertClassification(input)).toThrow(ClassificationError);
  });

  it('error references säkerhetsskyddslagen', () => {
    try {
      assertClassification('confidential');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ClassificationError);
      const ce = err as ClassificationError;
      expect(ce.message).toMatch(/säkerhetsskyddslag|2018:585|open|internal/i);
      expect(ce.attemptedValue).toBe('confidential');
    }
  });
});
