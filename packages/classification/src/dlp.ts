/**
 * DLP-skanner för säkerhetsskyddsmarkeringar.
 *
 * Plattformen får inte hantera information klassad högre än "intern"
 * (CLAUDE.md §1, säkerhetsskyddslagen 2018:585). Skannern letar efter
 * stämplar/markeringar som indikerar att uppladdat material kan vara
 * säkerhetsskyddsklassat och flaggar för karantän.
 *
 * Designprincipen: targets måste vara skrivna i versaler (markering,
 * inte naturligt språk) och ha word-boundary före/efter. På så vis
 * skiljs "HEMLIG" som markering från "hemliga" som adjektiv eller
 * "HEMLIGT" som adverb. Reglerna granskas kvartalsvis (T-104).
 */

export interface DlpMatch {
  /** Den faktiska textsekvens som triggade regeln. */
  value: string;
  /** Stabil identifierare för regeln som triggade. */
  label: string;
  /** Position i input där matchningen börjar. */
  index: number;
}

export interface DlpScanResult {
  flagged: boolean;
  matches: DlpMatch[];
}

interface Rule {
  label: string;
  regex: RegExp;
}

// Reglerna körs i ordning. Längre/mer specifika regler först så att
// "BEGRÄNSAT HEMLIG" matchar som "begränsat-hemlig" innan den separata
// "hemlig"-regeln triggas på samma position.
const RULES: Rule[] = [
  // EU-stämplar (alla uppercase enligt rådets säkerhetsregler)
  {
    label: 'eu-top-secret',
    regex: /\bTR[ÈE]S\s+SECRET\s+UE(?:\s*\/\s*EU\s+TOP\s+SECRET)?\b/g,
  },
  {
    label: 'eu-secret',
    regex: /\bSECRET\s+UE(?:\s*\/\s*EU\s+SECRET)?\b/g,
  },
  {
    label: 'eu-confidential',
    regex: /\b(?:CONFIDENTIEL\s+UE|EU[-\s]CONFIDENTIAL)\b/g,
  },
  {
    label: 'eu-restricted',
    regex: /\bEU[-\s]RESTRICTED\b/g,
  },
  // Svenska säkerhetsskyddsklasser
  {
    label: 'kvalificerat-hemlig',
    regex: /\bKVALIFICERAT\s+HEMLIG\b/gi,
  },
  {
    label: 'begränsat-hemlig',
    regex: /\bBEGRÄNSAT\s+HEMLIG\b/gi,
  },
  {
    label: 'hemlig',
    regex: /\bHEMLIG\b/g,
  },
  {
    label: 'konfidentiell',
    regex: /\bKONFIDENTIELL\b/g,
  },
  // Engelska/NATO-klasser
  {
    label: 'top-secret',
    regex: /\bTOP\s+SECRET\b/g,
  },
  {
    label: 'secret',
    regex: /\bSECRET\b/g,
  },
  {
    label: 'confidential',
    regex: /\bCONFIDENTIAL\b/g,
  },
  {
    label: 'restricted',
    regex: /\bRESTRICTED\b/g,
  },
];

/**
 * Skanna text efter säkerhetsskyddsmarkeringar.
 *
 * Returnerar `flagged: true` om någon regel matchar, plus en lista över
 * varje match med position och regel-etikett. Matchningar är ordnade
 * efter position och dedupliceras (samma regel + samma index registreras
 * bara en gång; samma index över olika regler tas det första, längsta
 * matchet eftersom reglerna är sorterade specifika-först).
 */
export function scanForRestrictedMarkings(input: string): DlpScanResult {
  if (!input) {
    return { flagged: false, matches: [] };
  }

  const matches: DlpMatch[] = [];
  const indexClaimed = new Set<number>();

  for (const rule of RULES) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(input)) !== null) {
      if (indexClaimed.has(m.index)) {
        continue;
      }
      indexClaimed.add(m.index);
      matches.push({
        label: rule.label,
        value: m[0],
        index: m.index,
      });
    }
  }

  matches.sort((a, b) => a.index - b.index);

  return { flagged: matches.length > 0, matches };
}
