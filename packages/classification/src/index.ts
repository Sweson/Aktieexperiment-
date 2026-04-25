import { z } from 'zod';

/**
 * Tillåtna klassningsvärden för all data i ÖvningsHub Sverige.
 *
 * Plattformen får inte hantera information klassad högre än "intern"
 * enligt CLAUDE.md §1 och säkerhetsskyddslagen 2018:585. Att utöka
 * denna lista är en HITL-gate (CLAUDE.md §5.1).
 */
export const ALLOWED_CLASSIFICATIONS = Object.freeze(['open', 'internal'] as const);

export type Classification = (typeof ALLOWED_CLASSIFICATIONS)[number];

export const ClassificationSchema = z.enum(['open', 'internal']);

const FORBIDDEN_HINT =
  'Plattformen accepterar endast "open" eller "internal". ' +
  'Säkerhetsskyddsklassad information (Begränsat hemlig och uppåt enligt ' +
  'säkerhetsskyddslagen 2018:585) får inte hanteras här — använd ett ' +
  'säkerhetsskyddsklassat verktyg istället.';

export class ClassificationError extends Error {
  public readonly attemptedValue: unknown;

  constructor(attemptedValue: unknown) {
    const printable =
      typeof attemptedValue === 'string'
        ? `"${attemptedValue}"`
        : String(attemptedValue);
    super(`Otillåtet klassningsvärde: ${printable}. ${FORBIDDEN_HINT}`);
    this.name = 'ClassificationError';
    this.attemptedValue = attemptedValue;
  }
}

/** Type guard som returnerar true om värdet är "open" eller "internal". */
export function isClassification(value: unknown): value is Classification {
  return ClassificationSchema.safeParse(value).success;
}

/**
 * Kastar ClassificationError om värdet inte är "open" eller "internal".
 * Returnerar värdet typat som Classification annars.
 */
export function assertClassification(value: unknown): Classification {
  const result = ClassificationSchema.safeParse(value);
  if (!result.success) {
    throw new ClassificationError(value);
  }
  return result.data;
}
