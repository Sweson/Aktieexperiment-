import { describe, it, expect } from 'vitest';
import {
  AuditChain,
  GENESIS_HASH,
  type AuditEntry,
  verifyChain,
  canonicalize,
} from './index.js';

const baseEvent = {
  actor: { id: 'user-123', kind: 'user' as const },
  action: 'exercise.status_changed' as const,
  target: { id: 'ex-1', kind: 'exercise' as const },
  classification: 'internal' as const,
  payload: { from: 'draft', to: 'approved' },
};

describe('canonicalize', () => {
  it('produces stable JSON regardless of key order', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 }));
  });

  it('handles nested objects', () => {
    expect(canonicalize({ a: { y: 2, x: 1 } })).toBe(canonicalize({ a: { x: 1, y: 2 } }));
  });

  it('handles arrays preserving order', () => {
    expect(canonicalize({ a: [3, 1, 2] })).not.toBe(canonicalize({ a: [1, 2, 3] }));
  });
});

describe('AuditChain.append', () => {
  it('seeds the chain with GENESIS_HASH as prevHash on the first entry', () => {
    const chain = new AuditChain();
    const entry = chain.append(baseEvent);
    expect(entry.prevHash).toBe(GENESIS_HASH);
    expect(entry.hash).not.toBe(GENESIS_HASH);
    expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('chains the second entry to the first', () => {
    const chain = new AuditChain();
    const a = chain.append(baseEvent);
    const b = chain.append({ ...baseEvent, action: 'exercise.archived' });
    expect(b.prevHash).toBe(a.hash);
  });

  it('produces deterministic hashes for identical inputs and prevHash', () => {
    const c1 = new AuditChain();
    const c2 = new AuditChain();
    const e1 = c1.append(baseEvent);
    const e2 = c2.append(baseEvent);
    expect(e1.hash).toBe(e2.hash);
  });

  it('rejects classification values outside open/internal', () => {
    const chain = new AuditChain();
    expect(() =>
      chain.append({
        ...baseEvent,
        // @ts-expect-error — invalid classification
        classification: 'confidential',
      }),
    ).toThrow();
  });

  it('assigns ascending sequence numbers', () => {
    const chain = new AuditChain();
    const a = chain.append(baseEvent);
    const b = chain.append(baseEvent);
    const c = chain.append(baseEvent);
    expect([a.sequence, b.sequence, c.sequence]).toEqual([1, 2, 3]);
  });
});

describe('verifyChain', () => {
  it('returns valid for an empty chain', () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });

  it('returns valid for an intact chain', () => {
    const chain = new AuditChain();
    chain.append(baseEvent);
    chain.append({ ...baseEvent, action: 'exercise.archived' });
    chain.append({ ...baseEvent, action: 'msel.released' });
    expect(verifyChain(chain.entries)).toEqual({ valid: true });
  });

  it('detects a tampered payload', () => {
    const chain = new AuditChain();
    chain.append(baseEvent);
    chain.append({ ...baseEvent, action: 'exercise.archived' });
    const entries: AuditEntry[] = JSON.parse(JSON.stringify(chain.entries));
    entries[0]!.payload = { from: 'draft', to: 'cancelled' };
    const result = verifyChain(entries);
    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(1);
  });

  it('detects an out-of-order chain', () => {
    const chain = new AuditChain();
    chain.append(baseEvent);
    chain.append({ ...baseEvent, action: 'exercise.archived' });
    const entries = [...chain.entries].reverse();
    expect(verifyChain(entries).valid).toBe(false);
  });

  it('detects a missing entry', () => {
    const chain = new AuditChain();
    chain.append(baseEvent);
    const middle = chain.append({ ...baseEvent, action: 'exercise.archived' });
    chain.append({ ...baseEvent, action: 'msel.released' });
    const entries = chain.entries.filter((e) => e.sequence !== middle.sequence);
    expect(verifyChain(entries).valid).toBe(false);
  });
});
