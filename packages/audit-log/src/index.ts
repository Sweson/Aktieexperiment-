import { createHash } from 'node:crypto';
import { assertClassification, type Classification } from '@ovh/classification';

/**
 * Append-only audit log med kryptografisk hashkedja (CLAUDE.md §1.6).
 *
 * Varje rad innehåller SHA-256(prevHash || canonicalize(body)). Den
 * fysiska tabellen blockerar UPDATE/DELETE via Postgres rules; här i
 * applikationsskiktet exponerar vi bara `append()` och en off-line
 * verifierare som kan validera en kedja.
 */

export const GENESIS_HASH = '0'.repeat(64);

export type AuditActorKind = 'user' | 'system' | 'service';
export type AuditTargetKind =
  | 'tenant'
  | 'user'
  | 'exercise'
  | 'msel_event'
  | 'objective'
  | 'membership'
  | 'capability';

export interface AuditActor {
  id: string;
  kind: AuditActorKind;
}

export interface AuditTarget {
  id: string;
  kind: AuditTargetKind;
}

export interface AuditEvent {
  actor: AuditActor;
  action: string;
  target: AuditTarget;
  classification: Classification;
  payload?: Record<string, unknown>;
  /** Sätts automatiskt om utelämnat. */
  timestamp?: string;
}

export interface AuditEntry {
  sequence: number;
  prevHash: string;
  hash: string;
  timestamp: string;
  actor: AuditActor;
  action: string;
  target: AuditTarget;
  classification: Classification;
  payload: Record<string, unknown>;
}

/**
 * Kanonisk JSON-serialisering. Sorterar nycklar rekursivt så att
 * semantiskt identiska objekt får identisk byte-representation.
 * Arrays bevarar sin ordning eftersom ordning är meningsbärande.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${parts.join(',')}}`;
}

function hashEntry(prevHash: string, entry: Omit<AuditEntry, 'hash' | 'prevHash'>): string {
  const body = canonicalize(entry);
  return createHash('sha256').update(prevHash, 'hex').update(body, 'utf8').digest('hex');
}

export class AuditChain {
  private _entries: AuditEntry[] = [];

  get entries(): readonly AuditEntry[] {
    return this._entries;
  }

  /** Sista hashen i kedjan, eller GENESIS_HASH om kedjan är tom. */
  tipHash(): string {
    return this._entries.at(-1)?.hash ?? GENESIS_HASH;
  }

  append(event: AuditEvent): AuditEntry {
    assertClassification(event.classification);

    const sequence = this._entries.length + 1;
    const timestamp = event.timestamp ?? new Date().toISOString();
    const prevHash = this.tipHash();
    const partial: Omit<AuditEntry, 'hash' | 'prevHash'> = {
      sequence,
      timestamp,
      actor: event.actor,
      action: event.action,
      target: event.target,
      classification: event.classification,
      payload: event.payload ?? {},
    };
    const hash = hashEntry(prevHash, partial);

    const entry: AuditEntry = { ...partial, prevHash, hash };
    this._entries.push(entry);
    return entry;
  }
}

export interface VerifyResult {
  valid: boolean;
  brokenAtSequence?: number;
}

/**
 * Verifiera att en kedja av AuditEntries är intakt: sekvensnummer
 * ökande från 1, prevHash matchar föregående hash, och varje hash
 * stämmer med rekonstruktionen från innehållet.
 */
export function verifyChain(entries: readonly AuditEntry[]): VerifyResult {
  if (entries.length === 0) {
    return { valid: true };
  }
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.sequence !== i + 1) {
      return { valid: false, brokenAtSequence: e.sequence };
    }
    if (e.prevHash !== prevHash) {
      return { valid: false, brokenAtSequence: e.sequence };
    }
    const reconstructed = hashEntry(prevHash, {
      sequence: e.sequence,
      timestamp: e.timestamp,
      actor: e.actor,
      action: e.action,
      target: e.target,
      classification: e.classification,
      payload: e.payload,
    });
    if (reconstructed !== e.hash) {
      return { valid: false, brokenAtSequence: e.sequence };
    }
    prevHash = e.hash;
  }
  return { valid: true };
}
