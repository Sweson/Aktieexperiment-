import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { TemplateSchema, type Template } from './types.js';

/**
 * Läs in alla mallar från en katalog. Varje fil måste vara giltig
 * JSON som validerar mot TemplateSchema. Ogiltiga mallar kastar med
 * tydligt felmeddelande som inkluderar filnamnet.
 */
export async function loadTemplatesFromDir(dir: string): Promise<Template[]> {
  const files = await readdir(dir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  const out: Template[] = [];
  for (const f of jsonFiles) {
    const path = join(dir, f);
    const raw = await readFile(path, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Mall ${f} är inte giltig JSON: ${(err as Error).message}`);
    }
    const result = TemplateSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Mall ${f} validerar inte: ${JSON.stringify(result.error.issues, null, 2)}`,
      );
    }
    out.push(result.data);
  }
  return out;
}
