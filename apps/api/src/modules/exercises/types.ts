import { z } from 'zod';
import { ClassificationSchema } from '@ovh/classification';

export const EXERCISE_FORMAT = ['ttx', 'drill', 'functional', 'full_scale', 'workshop'] as const;
export const EXERCISE_STATUS = [
  'draft',
  'planning',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
  'archived',
] as const;

export type ExerciseFormat = (typeof EXERCISE_FORMAT)[number];
export type ExerciseStatus = (typeof EXERCISE_STATUS)[number];

export const ExerciseCreateInputSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'slug måste vara lowercase a–z, siffror och bindestreck'),
  summary: z.string().max(2000).optional(),
  format: z.enum(EXERCISE_FORMAT),
  classification: ClassificationSchema.default('internal'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export type ExerciseCreateInput = z.infer<typeof ExerciseCreateInputSchema>;

export const ExerciseStatusTransitionSchema = z.object({
  status: z.enum(EXERCISE_STATUS),
});

export interface Exercise {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  summary?: string;
  format: ExerciseFormat;
  status: ExerciseStatus;
  classification: 'open' | 'internal';
  startsAt?: string;
  endsAt?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/**
 * Tillåtna statusövergångar (kravspec §4.3 + HSEEP livscykel).
 *  draft → planning → approved → in_progress → completed → archived
 *  Alla aktiva kan → cancelled
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<ExerciseStatus, readonly ExerciseStatus[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['draft', 'approved', 'cancelled'],
  approved: ['planning', 'in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

export class StatusTransitionError extends Error {
  constructor(
    public from: ExerciseStatus,
    public to: ExerciseStatus,
  ) {
    super(`Otillåten statusövergång: ${from} → ${to}`);
    this.name = 'StatusTransitionError';
  }
}

export class ExerciseNotFoundError extends Error {
  constructor(id: string) {
    super(`Exercise ${id} hittades inte`);
    this.name = 'ExerciseNotFoundError';
  }
}

export class SlugConflictError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" är redan använd inom tenanten`);
    this.name = 'SlugConflictError';
  }
}
