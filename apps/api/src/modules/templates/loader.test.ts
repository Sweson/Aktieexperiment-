import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadTemplatesFromDir } from './loader.js';

const SEED_DIR = join(__dirname, '../../../seed/templates');

describe('template seed', () => {
  it('all 5 PI-1 templates load and validate', async () => {
    const templates = await loadTemplatesFromDir(SEED_DIR);
    expect(templates.length).toBeGreaterThanOrEqual(5);
    const ids = templates.map((t) => t.templateId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'skogsbrand-2026',
        'oversvamning-2026',
        'elavbrott-2026',
        'cyberangrepp-kommun-2026',
        'pandemi-2026',
      ]),
    );
  });

  it('every template has at least one objective and a non-empty MSEL seed', async () => {
    const templates = await loadTemplatesFromDir(SEED_DIR);
    for (const t of templates) {
      expect(t.objectives.length).toBeGreaterThan(0);
      expect(t.mselSeed.length).toBeGreaterThan(0);
      expect(t.classification).toMatch(/^(open|internal)$/);
    }
  });

  it('templates only contain open or internal classification', async () => {
    const templates = await loadTemplatesFromDir(SEED_DIR);
    for (const t of templates) {
      expect(['open', 'internal']).toContain(t.classification);
    }
  });
});
