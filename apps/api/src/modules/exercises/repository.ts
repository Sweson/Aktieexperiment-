import { randomUUID } from 'node:crypto';
import type {
  Exercise,
  ExerciseCreateInput,
  ExerciseStatus,
} from './types.js';
import { SlugConflictError, ExerciseNotFoundError } from './types.js';

/**
 * Repository-port (hexagonal). Adapters: in-memory (tester) och Prisma
 * (T-T BD när db-anslutning är klar).
 */
export interface ExerciseRepository {
  create(input: {
    tenantId: string;
    createdById: string;
    data: ExerciseCreateInput;
  }): Promise<Exercise>;
  list(filter: {
    tenantId: string;
    status?: ExerciseStatus;
    limit: number;
    offset: number;
  }): Promise<{ items: Exercise[]; total: number }>;
  findById(tenantId: string, id: string): Promise<Exercise | null>;
  setStatus(tenantId: string, id: string, status: ExerciseStatus): Promise<Exercise>;
  softDelete(tenantId: string, id: string): Promise<Exercise>;
}

export class InMemoryExerciseRepository implements ExerciseRepository {
  private byId = new Map<string, Exercise>();

  async create(args: {
    tenantId: string;
    createdById: string;
    data: ExerciseCreateInput;
  }): Promise<Exercise> {
    const slugConflict = [...this.byId.values()].some(
      (e) => e.tenantId === args.tenantId && e.slug === args.data.slug && !e.deletedAt,
    );
    if (slugConflict) {
      throw new SlugConflictError(args.data.slug);
    }
    const now = new Date().toISOString();
    const ex: Exercise = {
      id: randomUUID(),
      tenantId: args.tenantId,
      name: args.data.name,
      slug: args.data.slug,
      ...(args.data.summary !== undefined ? { summary: args.data.summary } : {}),
      format: args.data.format,
      status: 'draft',
      classification: args.data.classification,
      ...(args.data.startsAt !== undefined ? { startsAt: args.data.startsAt } : {}),
      ...(args.data.endsAt !== undefined ? { endsAt: args.data.endsAt } : {}),
      createdById: args.createdById,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(ex.id, ex);
    return Promise.resolve(ex);
  }

  async list(filter: {
    tenantId: string;
    status?: ExerciseStatus;
    limit: number;
    offset: number;
  }): Promise<{ items: Exercise[]; total: number }> {
    const all = [...this.byId.values()].filter(
      (e) =>
        e.tenantId === filter.tenantId &&
        !e.deletedAt &&
        (filter.status ? e.status === filter.status : true),
    );
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve({
      items: all.slice(filter.offset, filter.offset + filter.limit),
      total: all.length,
    });
  }

  async findById(tenantId: string, id: string): Promise<Exercise | null> {
    const ex = this.byId.get(id);
    if (!ex || ex.tenantId !== tenantId || ex.deletedAt) {
      return Promise.resolve(null);
    }
    return Promise.resolve(ex);
  }

  async setStatus(tenantId: string, id: string, status: ExerciseStatus): Promise<Exercise> {
    const ex = await this.findById(tenantId, id);
    if (!ex) {
      throw new ExerciseNotFoundError(id);
    }
    const updated: Exercise = { ...ex, status, updatedAt: new Date().toISOString() };
    this.byId.set(id, updated);
    return updated;
  }

  async softDelete(tenantId: string, id: string): Promise<Exercise> {
    const ex = await this.findById(tenantId, id);
    if (!ex) {
      throw new ExerciseNotFoundError(id);
    }
    const now = new Date().toISOString();
    const updated: Exercise = { ...ex, deletedAt: now, updatedAt: now };
    this.byId.set(id, updated);
    return updated;
  }
}
