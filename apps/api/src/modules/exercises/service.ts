import type { AuditChain, AuditEntry } from '@ovh/audit-log';
import type { ExerciseRepository } from './repository.js';
import type {
  Exercise,
  ExerciseCreateInput,
  ExerciseStatus,
} from './types.js';
import {
  ALLOWED_STATUS_TRANSITIONS,
  ExerciseNotFoundError,
  StatusTransitionError,
} from './types.js';

export interface AuditPort {
  append(entry: Parameters<AuditChain['append']>[0]): AuditEntry;
}

/** Identitet utdragen ur autentiserad request. */
export interface ActorContext {
  tenantId: string;
  userId: string;
}

export class ExerciseService {
  constructor(
    private readonly repo: ExerciseRepository,
    private readonly audit: AuditPort,
  ) {}

  async create(actor: ActorContext, input: ExerciseCreateInput): Promise<Exercise> {
    const ex = await this.repo.create({
      tenantId: actor.tenantId,
      createdById: actor.userId,
      data: input,
    });
    this.audit.append({
      actor: { id: actor.userId, kind: 'user' },
      action: 'exercise.created',
      target: { id: ex.id, kind: 'exercise' },
      classification: ex.classification,
      payload: { slug: ex.slug, format: ex.format },
    });
    return ex;
  }

  list(
    actor: ActorContext,
    filter: { status?: ExerciseStatus; limit: number; offset: number },
  ): ReturnType<ExerciseRepository['list']> {
    return this.repo.list({
      tenantId: actor.tenantId,
      ...(filter.status !== undefined ? { status: filter.status } : {}),
      limit: filter.limit,
      offset: filter.offset,
    });
  }

  async get(actor: ActorContext, id: string): Promise<Exercise> {
    const ex = await this.repo.findById(actor.tenantId, id);
    if (!ex) {
      throw new ExerciseNotFoundError(id);
    }
    return ex;
  }

  async transitionStatus(
    actor: ActorContext,
    id: string,
    nextStatus: ExerciseStatus,
  ): Promise<Exercise> {
    const current = await this.get(actor, id);
    const allowed = ALLOWED_STATUS_TRANSITIONS[current.status];
    if (!allowed.includes(nextStatus)) {
      throw new StatusTransitionError(current.status, nextStatus);
    }
    const updated = await this.repo.setStatus(actor.tenantId, id, nextStatus);
    this.audit.append({
      actor: { id: actor.userId, kind: 'user' },
      action: 'exercise.status_changed',
      target: { id, kind: 'exercise' },
      classification: updated.classification,
      payload: { from: current.status, to: nextStatus },
    });
    return updated;
  }

  async delete(actor: ActorContext, id: string): Promise<void> {
    const ex = await this.get(actor, id);
    await this.repo.softDelete(actor.tenantId, id);
    this.audit.append({
      actor: { id: actor.userId, kind: 'user' },
      action: 'exercise.deleted',
      target: { id, kind: 'exercise' },
      classification: ex.classification,
      payload: { slug: ex.slug },
    });
  }
}
