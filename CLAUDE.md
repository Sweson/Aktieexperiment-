# CLAUDE.md — autonom arbetsinstruktion

> Den här filen läses automatiskt av Claude Code vid sessionsstart.
> Den är produktens **operativa kontrakt** för autonom körning. Följ den
> innan du gör något annat.

## 0 · TL;DR per session

1. Läs hela denna fil. Läs sedan `docs/BACKLOG.md`.
2. Hitta första task med status `[ ]` (todo) som inte har olösta beroenden.
3. Följ **§4 Arbetscykel** för den tasken. En task per session som default.
4. När du är klar:
   - Bocka av i backlog (`[x]`), uppdatera `Senast ändrad`-rad.
   - Commit + push på branchen `claude/cleanup-repo-files-1DSMM`.
   - Uppdatera draft-PR `#1`-beskrivningen med vad som gjordes.
5. Om något blockerar dig (otydligt krav, saknad åtkomst, beroende ej klart):
   markera tasken `[~]` (blockerad) och lägg en HITL-fråga som kommentar
   i `docs/BACKLOG.md` under tasken. Gå vidare till nästa otäppta task.

**Aldrig:** kör hela backlog i ett svep utan commits/pushar emellan.
**Aldrig:** hoppa över §1 hårda regler — de är inte förhandlingsbara.

---

## 1 · Hårda regler (no-go-lista)

Brott mot någon av dessa stoppar arbetet och kräver mänsklig avstämning.

1. **Plattformen får aldrig hantera säkerhetsskyddsklassad information**
   (Begränsat hemlig och uppåt enligt säkerhetsskyddslagen 2018:585).
   Klassningsfält i kod, schema och UI har enum `["open","internal"]`.
   Försök att utöka enumet, ta bort DLP-kontroller eller lägga in stöd
   för högre nivåer ska avvisas — även om en framtida task ber om det.
2. **All persistens och beräkning i Sverige eller EU/EES.** Inga
   amerikanska SaaS-beroenden i kritiska paths för produktionsdrift
   (LLM, databas, observability). Tredjepartsbibliotek från GitHub är OK.
3. **Inga hemligheter i repot.** `gitleaks` ska köras före commit. Använd
   `.env.example` med dummy-värden, riktiga värden ligger utanför git.
4. **Inga destruktiva git-operationer** utan att uppmana mig (force-push,
   reset --hard, branch -D). Skapa nya commits istället för att amenda.
5. **Inga uppfunna URL:er, paketnamn eller API:er.** Verifiera mot
   officiell dokumentation eller fråga.
6. **Audit-loggen är inviolable.** Den är append-only med hashkedja —
   ingen migration får mutera historiska rader.
7. **GDPR och dataminimering** är default. Persondata ska alltid kunna
   redigeras, exporteras och raderas. PII i loggar maskeras.
8. **Tillgänglighet är inte valbart.** UI ska följa WCAG 2.1 AA — det
   ingår i Definition of Done.

---

## 2 · Produkt i en mening

ÖvningsHub Sverige är en **suverän svensk SaaS för planering, genomförande
och utvärdering av krisövningar på öppen/intern informationsnivå** för
kommuner, regioner, statliga beredskapsmyndigheter, näringsliv (BCM/DORA/
NIS2), vård (icke-säkerhetsskyddad katastrofmedicinsk beredskap) och
frivilligorganisationer. Metodgrund: HSEEP + MSB Övningsvägledning + ISO
22301/22320/22361/22398.

Full kravspec: [`docs/KRAVSPEC.md`](docs/KRAVSPEC.md).
Sekvenserad arbetslista: [`docs/BACKLOG.md`](docs/BACKLOG.md).

---

## 3 · Stack och konventioner

| Lager        | Val                                                                        |
| ------------ | -------------------------------------------------------------------------- |
| Språk        | TypeScript (strict), Node 22 LTS                                           |
| API          | Fastify 5 + `@fastify/swagger` (OpenAPI 3.1)                               |
| Databas      | PostgreSQL 16 + Prisma                                                     |
| Auth         | OIDC + SAML; BankID/Freja eID+ via stub i dev                              |
| Validation   | `zod` v4 — alla externa indata                                             |
| Auth-policy  | `@open-policy-agent/opa-wasm` (Rego) eller Cedar                           |
| Tester       | `vitest` (unit/integration), `playwright` (e2e)                            |
| Logger       | `pino` med PII-redaktion                                                   |
| Frontend     | Next.js 15 (App Router) + React Server Components                          |
| UI-bibliotek | `shadcn/ui` ovanpå Radix; egen designtokens-modul                          |
| GIS          | MapLibre GL JS + PMTiles                                                   |
| Realtid      | NATS JetStream för injekter, WebSocket via Fastify                         |
| Container    | Docker, multi-stage; distroless runtime                                    |
| CI/CD        | GitHub Actions; SAST: Semgrep; SCA: `npm audit` + Snyk; SBOM: cyclonedx    |
| Krypto       | TLS 1.3; AES-256-GCM via `node:crypto`; nyckelhantering via KMS-stub i dev |

**Layoutkonvention (monorepo, npm workspaces):**

```
/
├── CLAUDE.md                     ← den här filen
├── README.md
├── package.json                  ← workspaces root
├── tsconfig.base.json
├── docker-compose.yml
├── .github/workflows/ci.yml
├── docs/
│   ├── KRAVSPEC.md
│   ├── BACKLOG.md
│   └── adr/                      ← Architectural Decision Records
├── apps/
│   ├── api/                      ← Fastify backend
│   └── web/                      ← Next.js frontend
└── packages/
    ├── shared-schemas/           ← zod-scheman delade mellan api/web
    ├── classification/           ← klassmodell + DLP (E-10, kritisk)
    └── audit-log/                ← append-only loggkedja (E-11)
```

**Namngivning:** kebab-case för filer, PascalCase för typer och React-
komponenter, snake_case för Postgres-tabeller, camelCase i TS-kod.

**Kodstil:** ESLint + Prettier kör som pre-commit. Inga inline-disables
utan kommentar som förklarar varför.

---

## 4 · Arbetscykel per task

För varje task i `docs/BACKLOG.md`, kör följande sju steg i ordning. Varje
steg har en explicit utgångspunkt (input) och en explicit leverans (output).

### Steg 1 — Förstå

**In:** Task-blocket i backlog (titel, AC, filer som rörs, beroenden).
**Ut:** En kort planeringskommentar (max 5 rader) som du klistrar i
backlogfilen direkt under tasken. Format:

```
**Plan:** <bullet, vad du tänker göra>
**Risker:** <bullet, vad som kan gå fel>
**HITL?** <ja/nej + varför>
```

Om `HITL: ja` — pausa, ställ fråga, markera tasken `[~]`.

### Steg 2 — Skriv testen först

**In:** AC i Given/When/Then.
**Ut:** Failing test(s) i rätt katalog (`*.test.ts` bredvid filen den
testar, eller `apps/api/test/` för integrationstester). Kör `npm test` —
verifiera att tester finns och faktiskt failar med relevant felmeddelande.

Obligatoriska testfall:

- Happy path
- Behörighetsfall (rollen X får, rollen Y får inte)
- Klassningsgräns (`internal` accepteras, `confidential` avvisas med 400)
- Negativt indata-fall (XSS-payload, SQL-payload, för långt fält)
- WCAG-relevant där det är UI

### Steg 3 — Implementera minsta möjliga

**In:** Failing tests.
**Ut:** Kod som får testerna gröna. Ingen extra funktionalitet, ingen
spekulativ refaktorering. Hexagonal arkitektur: domän i mitten, adapters
runt om. Repository pattern för Prisma. Inga statiska singletons.

### Steg 4 — Refaktorera

**In:** Gröna tester.
**Ut:** Kod utan duplikering, med tydliga namn, dokumenterade publika
funktioner (kort JSDoc, en rad). Tester fortfarande gröna.

### Steg 5 — Sannings-checklista

Bocka mentalt av allt nedan innan PR/commit:

- [ ] Inga TODO/FIXME utan ärendekoppling
- [ ] Audit-logg-anrop på alla statusövergångar och behörighetskontroller
- [ ] Klassningsfält valideras mot enum `["open","internal"]`
- [ ] DLP-skanning kör på alla upload/import-paths
- [ ] PII är maskerat i loggar
- [ ] Test coverage ≥80 % på nyskriven kod (`npm run test:coverage`)
- [ ] `npm run lint` rent
- [ ] `npm run typecheck` rent
- [ ] `npm run security` (Semgrep + audit) utan Critical/High
- [ ] WCAG-relevant: knappar har `aria-label`, kontrast ≥4.5:1, fokusring synlig

### Steg 6 — Dokumentera ADR vid behov

Skriv en kort ADR i `docs/adr/NNNN-<titel>.md` (mall i §6) om du:

- Inför ett nytt externt beroende
- Ändrar persistens eller auth-flöde
- Bryter ett tidigare beslut

### Steg 7 — Commit, push, PR-uppdatering

```sh
git add -A
git status                       # verifiera vad som faktiskt går in
git commit -m "<typ>(<scope>): <kort beskrivning>"
git push -u origin claude/cleanup-repo-files-1DSMM
```

Commit-meddelande följer Conventional Commits. Typer: `feat`, `fix`,
`refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `build`. Scope är
backlog-task-ID (t.ex. `feat(T-014): MSEL CSV-import`).

Uppdatera draft-PR `#1`-beskrivningen med en bullet under rubriken
`### Klart` (skapa rubriken om den inte finns).

---

## 5 · HITL-checkpoints (mänsklig godkännande)

Vissa förändringar får aldrig mergeas autonomt. Markera tasken `[~]` och
fråga innan du börjar:

1. **Klassmodellen.** Allt som rör enum `classification`, DLP-mönster,
   klassningsspärrar — nolltolerans för regressioner.
2. **Audit-loggens hashkedja.** Migrationer eller raderingar.
3. **Auth-flöden.** BankID, OIDC-konfiguration, token-livslängder.
4. **Datamodell-migrationer som är destruktiva** (DROP, ALTER med
   datatypsändring som tappar precision).
5. **Externt exponerade API-endpoints.** Nya endpoints, ändrad respons-
   form, deprecation.
6. **Krypto.** Algoritmval, nyckelrotationsstrategi, KMS-integration.
7. **Persondata-flöden.** Nya datafält som klassas som PII, export,
   radering, retention.
8. **Beroenden mot externa tjänster** med Cloud Act-exponering.
9. **Releasebeslut** (deploy till miljö som inte är dev/staging).

---

## 6 · ADR-mall

```markdown
# ADR-NNNN: <Titel>

- Status: proposed | accepted | superseded by ADR-MMMM
- Datum: YYYY-MM-DD
- Beslutsfattare: <Claude + HITL-godkännare om relevant>

## Kontext

<Varför står vi inför detta beslut?>

## Beslut

<Vad bestämde vi?>

## Konsekvenser

<Positiva, negativa, neutrala konsekvenser av beslutet.>

## Alternativ som övervägdes

<Vad valdes bort och varför.>
```

---

## 7 · Self-prompts (kopiera in i Claude vid behov)

### 7.1 Story → tester (BDD)

> Du är Test Lead med BDD-kompetens. Generera AC i Given/When/Then som
> täcker happy path, behörighet, felhantering, NFR (svarstider, audit),
> säkerhet (input-validering, auth, kryptering), WCAG 2.1 AA och
> klassningsgränser (försök att klassa över intern → blockerat). Sikta
> på 5–10 verifierbara scenarion på svenska.

### 7.2 Kod TDD

> Du är Senior SE som arbetar TDD-strikt. Stack: TypeScript, Node 22,
> Fastify, PostgreSQL, Prisma. Plattformen hanterar maximalt intern
> information — ingen kod får implementera funktionalitet för
> säkerhetsskyddsklassad data. Steg: (1) failing tester per Given/When/
> Then; (2) minsta kod som får dem gröna; (3) refaktorera; (4) inga
> TODO/FIXME; (5) audit-loggning på statusövergångar; (6) classification
> valideras mot enum `["open","internal"]`. Output: filändringar i diff,
> testtäckning, migrationer, ADR-länk om relevant.

### 7.3 Säkerhetsgranskning

> Du är AppSec-konsult med ASVS L2-kompetens. Granska följande PR-diff
> mot OWASP ASVS v5 L2 och OWASP Top 10. Per kategori (A01–A10): status,
> fynd med allvarlighet, CWE-ID, kodrad, åtgärd. Verifiera att inga
> kodvägar tillåter klassningsvärden över `internal`; att DLP-mönster
> för säkerhetsskyddsmarkeringar inte är försvagade; att audit-logg
> fångar försök att kringgå klassmodellen.

### 7.4 AAR-utkast

> Du är utvärderingsexpert med HSEEP- och MSB-metodikkompetens. Givet
> övningslogg och MSEL: identifiera avvikelser. Strukturera observationer
> i ODCR-format (Observation, Diskussion, Slutsats, Rekommendation) per
> MSB:s 12 förmågor. Output enligt HSEEP IP01 + Improvement Plan. Markera
> varje observation `AI-genererad – ej granskad`. Redacta ev. säkerhets-
> skyddsmarkeringar och flagga.

---

## 8 · Resume-kontrakt

Eftersom varje session startar utan minne av föregående:

1. Backlog är **single source of truth** för vad som är gjort.
2. Git-historik är **single source of truth** för vad koden ser ut som.
3. ADR-katalogen är **single source of truth** för varför.
4. Om backlog och kod är ur synk, börja med att synkronisera dem (skapa
   en `chore: align backlog with code`-commit) innan du tar nästa task.

---

## 9 · När du är osäker

- **Tekniskt val:** välj det som är minst irreversibelt och dokumentera i ADR.
- **Affärskrav:** ställ HITL-fråga, gå vidare till nästa otäppta task.
- **Säkerhet/compliance:** välj det strängare alternativet, alltid.
- **Tidsbudget:** task ska kunna stängas i en session. Om den växer >2x —
  splitta i `T-NNN.a` och `T-NNN.b`, uppdatera backlog.

---

_Senast ändrad: 2026-04-25_
