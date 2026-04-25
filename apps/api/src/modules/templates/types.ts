import { z } from 'zod';
import { ClassificationSchema } from '@ovh/classification';
import { EXERCISE_FORMAT } from '../exercises/types.js';

export const TemplateMselSeedSchema = z.object({
  eventNo: z.number().int().positive(),
  scenarioTimeOffsetMinutes: z.number().int().nonnegative(),
  fromRole: z.string(),
  toRole: z.string(),
  mode: z.enum(['push', 'pull', 'conditional']),
  message: z.string(),
  expectedResponse: z.string().optional(),
  conditionExpression: z.string().optional(),
});

export const TemplateObjectiveSchema = z.object({
  code: z.string(),
  description: z.string(),
});

export const TemplateSchema = z.object({
  templateId: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  msbTypEvent: z.string(),
  format: z.enum(EXERCISE_FORMAT),
  summary: z.string(),
  classification: ClassificationSchema,
  objectives: z.array(TemplateObjectiveSchema).min(1),
  mselSeed: z.array(TemplateMselSeedSchema),
});

export type Template = z.infer<typeof TemplateSchema>;
