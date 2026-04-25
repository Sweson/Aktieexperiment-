import { describe, it, expect } from 'vitest';
import { scanForRestrictedMarkings } from './dlp.js';

describe('scanForRestrictedMarkings — should flag (positive cases)', () => {
  it.each([
    'BEGRÄNSAT HEMLIG',
    'Begränsat hemlig',
    'KONFIDENTIELL',
    'HEMLIG',
    'KVALIFICERAT HEMLIG',
    'RESTRICTED',
    'SECRET',
    'TOP SECRET',
    'CONFIDENTIAL',
    'EU RESTRICTED',
    'EU CONFIDENTIAL',
    'CONFIDENTIEL UE',
    'EU SECRET',
    'SECRET UE/EU SECRET',
    'TRES SECRET UE/EU TOP SECRET',
    // Markering på egen rad i dokument
    '\nBEGRÄNSAT HEMLIG\n',
    'Klassning: HEMLIG',
    'Klassning: KONFIDENTIELL.',
    'KLASSNING: BEGRÄNSAT HEMLIG',
    'Information klassad som BEGRÄNSAT HEMLIG enligt säkerhetsskyddslagen.',
    // Vanlig stämpel-formatering
    '*** HEMLIG ***',
    '[KONFIDENTIELL]',
    'Säkerhetsskyddsklass: BEGRÄNSAT HEMLIG',
    'Sek.skyddsklass: HEMLIG',
    'EU-RESTRICTED',
  ])('flags "%s"', (input) => {
    const result = scanForRestrictedMarkings(input);
    expect(result.flagged).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('reports the matched marking and a label', () => {
    const result = scanForRestrictedMarkings('Klassning: BEGRÄNSAT HEMLIG');
    expect(result.flagged).toBe(true);
    expect(result.matches[0]).toMatchObject({
      label: expect.stringMatching(/begränsat[-\s]hemlig|restricted/i),
    });
    expect(result.matches[0]?.value).toMatch(/BEGRÄNSAT HEMLIG/i);
  });

  it('returns multiple matches when several markings appear', () => {
    const result = scanForRestrictedMarkings('Bilaga 1: HEMLIG. Bilaga 2: KONFIDENTIELL.');
    expect(result.flagged).toBe(true);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('scanForRestrictedMarkings — should NOT flag (negative cases)', () => {
  it.each([
    // Naturligt språk där säkerhetsskyddstermer förekommer som adjektiv
    'Den hemliga ingrediensen är salt.',
    'kandidaten är hemligt förälskad i sin kollega',
    'Tävlingen var en hemlig överraskning.',
    'restricted area sign',
    'top secret meeting tomorrow',
    'My secret recipe for meatballs.',
    'En konfidentiell men inte säkerhetsskyddsklassad chatt.',
    'konfidentiell information mellan klient och advokat',
    'Hemlighetsmakeri på kontoret.',
    'Skogsbranden var ett hemligt scenario tills idag.',
    'Hon delade en hemlig kod med sin syster.',
    'Den hemliga koden var 1234.',
    'Det är en hemlighet.',
    // "secret" som vanligt ord
    'Secret Santa happens in December.',
    'The secret garden is a novel.',
    'restricted parking',
    'restricted by law',
    // "EU" + andra ord
    'EU-medborgare',
    'EU-direktivet om dataskydd',
    'EU restriktioner mot import',
    // klassmodellens egna värden ska INTE flaggas
    'classification: open',
    'classification: internal',
    'Klassning: ÖPPEN',
    'Klassning: INTERN',
    // tomma och korta strängar
    '',
    ' ',
    'a',
    'foo',
    'Lorem ipsum dolor sit amet.',
    // versaler men inte säkerhetsskyddsmarkeringar
    'CHEFENS BESLUT',
    'BRANDLARM AKTIVERAT',
    'KOMMUNIKATION KLART',
    // svenska ord som råkar innehålla "hemlig"-prefix utan markering
    'Hemligheterna i berättelsen avslöjas i kapitel 12.',
    'Han har en hemlig favoritmaträtt.',
    'En hemlig beundrare.',
    'Vi har en hemlig handskakning.',
    // "begränsad" utan "hemlig"
    'begränsad åtkomst till parkeringen',
    'Begränsad upplaga av boken.',
    'Erbjudandet är begränsat till medlemmar.',
    // engelska ord med bokstavsöverlapp
    'classified ads in the newspaper',
    'unclassified document',
    'a classified employee',
    'It was classified as a routine event.',
    // affärsspråk
    'company secrets are protected by law',
    'industrial secrets',
    'business secrets',
    // teknisk text
    'TLS-handskakningen kräver en hemlig nyckel.',
    'Den hemliga signeringsnyckeln roteras månadsvis.',
    'OAuth client secret rotation policy.',
    'API secret stored in vault.',
    // klassningsfält i JSON
    '{"classification": "open"}',
    '{"classification": "internal"}',
    // siffror och kod
    '0xdeadbeef',
    '404 not found',
    // svenska ord med bokstavsöverlapp
    'sekretessklass enligt OSL 2009:400',
    'sekretessbelagd information',
  ])('does NOT flag "%s"', (input) => {
    const result = scanForRestrictedMarkings(input);
    expect(result.flagged).toBe(false);
    expect(result.matches).toEqual([]);
  });
});

describe('scanForRestrictedMarkings — interface', () => {
  it('returns a stable shape', () => {
    const result = scanForRestrictedMarkings('hello');
    expect(result).toEqual({ flagged: false, matches: [] });
  });

  it('includes index and length on each match', () => {
    const result = scanForRestrictedMarkings('Header\nBEGRÄNSAT HEMLIG\nFooter');
    expect(result.flagged).toBe(true);
    const m = result.matches[0]!;
    expect(m.index).toBeGreaterThanOrEqual(0);
    expect(m.value.length).toBeGreaterThan(0);
    expect(typeof m.label).toBe('string');
  });

  it('handles non-string input by coercing to empty result', () => {
    expect(scanForRestrictedMarkings('')).toEqual({ flagged: false, matches: [] });
  });
});
