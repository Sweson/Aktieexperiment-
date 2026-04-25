# BACKLOG — ÖvningsHub Sverige

> Sekvenserad, atomär arbetslista. Varje task är dimensionerad för att
> stängas inom **en autonom Claude-session** (~2–6 h ekvivalent arbete).
> Följ `CLAUDE.md` §4 Arbetscykel.
>
> **Statusmarkering:** `[ ]` todo · `[~]` blockerad (HITL-fråga inunder)
> · `[x]` klar (datum och commit-sha i kommentar).
>
> **Beroenden:** Tasks utförs i ordning per PI om inget annat anges. En
> task får inte påbörjas innan dess `Beroende:`-fält är `[x]`.

---

## PI 1 — Foundation/MVP (mån 0–3)

Mål: körbar API+web med tenant, user, exercise, MSEL och hård
klassningsspärr. Pilotbar för 3 kommuner + 1 region som TTX-verktyg.

### Block A — Repo, CI, monorepo

- [x] **T-001 · Initiera monorepo med npm workspaces** _(2026-04-25)_

  - Beroende: —
  - Filer: `package.json`, `tsconfig.base.json`, `.editorconfig`, `.gitignore`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`
  - AC: `npm install` rent på Node 22 LTS; `npm run -w apps/api build` failar med begripligt felmeddelande (apps finns inte än).
  - DoD: workspaces-config korrekt; `engines.node` satt; no warnings.

- [x] **T-002 · ESLint + Prettier + commitlint + lint-staged + husky** _(2026-04-25)_

  - Beroende: T-001
  - AC: `npm run lint` och `npm run format:check` exekverar; pre-commit hook kör lint-staged på ändrade filer; conventional-commits enforce på commit-message.

- [ ] **T-003 · GitHub Actions CI: lint, typecheck, test, build**

  - Beroende: T-002
  - Filer: `.github/workflows/ci.yml`
  - AC: PR-checks kör i parallell; tider under 5 min på en tom monorepo; cache av npm.

- [ ] **T-004 · Säkerhetspipeline: Semgrep, gitleaks, npm audit, SBOM**

  - Beroende: T-003
  - Filer: `.github/workflows/security.yml`, `.semgrep.yml`
  - AC: alla fyra scans kör på PR; SBOM (CycloneDX) uppladdas som artifact; gitleaks ren; högsta tillåtna severity som inte failar är Low.

- [ ] **T-005 · Docker-compose för lokal dev (Postgres, NATS, MinIO, MailHog)**
  - Beroende: T-001
  - Filer: `docker-compose.yml`, `.env.example`
  - AC: `docker compose up` startar alla tjänster; healthchecks gröna inom 30 s; volymer namngivna persistenta.

### Block B — Klassmodell och DLP (E-10) — säkerhetskritisk

- [ ] **T-006 · Paket `packages/classification` — enum + typer**

  - Beroende: T-001
  - Filer: `packages/classification/src/index.ts`, `*.test.ts`
  - AC: exporterar `Classification = "open" | "internal"`, zod-schema, helper `assertClassification(x)` som kastar på okända värden inkl. `confidential`/`secret`/`begränsat hemlig`/`hemlig`. Tester ≥95 % coverage.

- [ ] **T-007 · DLP-regex för säkerhetsskyddsmarkeringar**

  - Beroende: T-006
  - Filer: `packages/classification/src/dlp.ts`, omfattande tester
  - AC: matchar svenska och engelska markeringar (BEGRÄNSAT HEMLIG/RESTRICTED, KONFIDENTIELL, HEMLIG/SECRET, KVALIFICERAT HEMLIG/TOP SECRET) samt EU-stämplar (EU RESTRICTED, EU CONFIDENTIEL UE, EU SECRET UE/EU SECRET, EU TRES SECRET); falska positiva minimerade (testa mot 50+ negativa fall: "kandidaten är hemligt förälskad", "den hemliga ingrediensen", etc.). Returnerar `{ flagged: boolean; matches: Match[] }`.
  - HITL: Resultatet av denna task går genom mänsklig granskning innan merge. Markera `[~]` initialt.

- [ ] **T-008 · DLP-middleware för Fastify**
  - Beroende: T-007, T-009
  - Filer: `packages/classification/src/fastify-plugin.ts`
  - AC: plugin scannar request body och multipart-upload; vid träff: sätt karantän, returnera 422 med vägledningstext, logga i audit-loggen; omfattande integrationstest.

### Block C — API-grund och databas

- [ ] **T-009 · Fastify-app skelett med graceful shutdown**

  - Beroende: T-001, T-005
  - Filer: `apps/api/src/server.ts`, `apps/api/src/app.ts`
  - AC: hälsoslut `/healthz` och `/readyz`; structured logging (pino) med PII-redaktion; graceful shutdown inom 30 s vid SIGTERM; `npm run dev` startar med nodemon.

- [ ] **T-010 · OpenAPI 3.1 via @fastify/swagger + Scalar UI**

  - Beroende: T-009
  - AC: `/docs` serverar API-dokumentation; alla endpoints (även hälsoslut) dokumenterade; spec exporterbar som JSON via `/openapi.json`.

- [ ] **T-011 · Prisma-schema steg 1: Tenant, User, Membership, Role**

  - Beroende: T-009
  - Filer: `apps/api/prisma/schema.prisma`, första migration
  - AC: tabeller med korrekta constraints; `tenant_id` på allt tenant-bundet; rollerna ÖL, LÖL, SL, MÖL, UL, LU, LOG, PL, Sim-cell, EXCON, Spelare, Observatör, Mentor, Red-team, VIP, Plattformsadmin, Tenantadmin enligt kravspec §4.2.

- [ ] **T-012 · Prisma-schema steg 2: Exercise, ExerciseObjective, Capability**

  - Beroende: T-011
  - AC: relation till tenant via FK; mjuk radering med `deleted_at`; index på `(tenant_id, status)`; `capability` seedad med MSB:s 12 generella förmågor.

- [ ] **T-013 · Prisma-schema steg 3: MselEvent (HSEEP-fält)**
  - Beroende: T-012
  - AC: fält enligt kravspec §4.3 F-04.1: event_no, scenario_time, real_time, from_role, to_role, mode, message, expected_response, capability_id, objective_id, assigned_controller, status, key_event, attachments[]; `classification` enum `open|internal` med default `internal`; index på `(exercise_id, scenario_time)`.

### Block D — Audit-logg (E-11)

- [ ] **T-014 · Paket `packages/audit-log` — append-only med hashkedja**

  - Beroende: T-011
  - Filer: `packages/audit-log/src/*.ts`, schema-tillägg `audit_event`
  - AC: `Logger.audit(event)` tar `{ actor, action, target, classification, payload }`; varje rad innehåller SHA-256 av föregående rad; ingen UPDATE/DELETE tillåtet på tabellen (Postgres rule + Prisma policy); verifierare som kan validera hela kedjan i en exercise.

- [ ] **T-015 · Audit-logg-täckning på alla statusövergångar**
  - Beroende: T-014, T-013
  - AC: när Exercise eller MselEvent byter `status` skrivs auditrad; integrationstest som muterar status och verifierar kedjan.

### Block E — Auth (E-09)

- [ ] **T-016 · OIDC-anslutning med stub-IdP i dev**

  - Beroende: T-009
  - Filer: `apps/api/src/plugins/auth.ts`, `infra/dev-idp/`
  - AC: dev-IdP via Keycloak i docker-compose; `/auth/login` redirectar; tokens valideras; `request.user` tillgängligt i route handlers.

- [ ] **T-017 · BankID-stub (mock) för dev/test**

  - Beroende: T-016
  - AC: stub returnerar deterministiska svar; tydlig "STUB"-markering i loggar; integrationskontrakt mot riktig BankID dokumenterat i ADR. `[~]` HITL: kontraktsdetaljer mot riktig BankID.

- [ ] **T-018 · ABAC-motor med OPA/Rego**
  - Beroende: T-016, T-013
  - AC: policydecisions <50 ms p99; policyer i `apps/api/policies/*.rego`; bundle laddas vid startup; tester per roll × resurs-matris.

### Block F — Övningsdesigner (E-01) MVP

- [ ] **T-019 · CRUD-endpoints för Exercise**

  - Beroende: T-012, T-018
  - AC: REST endpoints med OpenAPI-doc; behörighet via ABAC; pagination; e2e-test.

- [ ] **T-020 · CRUD-endpoints för MselEvent + CSV-import**

  - Beroende: T-013, T-008
  - AC: import valideras mot HSEEP-fältmodellen; rader med säkerhetsskyddsmarkering avvisas tydligt (referera kravspec §4.3 F-04.1 AC4); rapportvisning över felrader; ≤20 000 rader på <30 s.

- [ ] **T-021 · Scenariomalls-bibliotek (5 mallar för PI 1)**
  - Beroende: T-020
  - Filer: `apps/api/seed/templates/*.json`
  - AC: mallar för "skogsbrand", "översvämning", "elavbrott", "cyberangrepp mot kommun", "pandemi"; alla taggade mot MSB-typhändelser; klona-funktion via endpoint `POST /exercises/from-template/:id`.

### Block G — Frontend MVP (E-01)

- [ ] **T-022 · Next.js 15 init med App Router + auth-integration**

  - Beroende: T-001, T-016
  - AC: login redirect mot OIDC; serverkomponent visar inloggad användare; designtokens-paket (`packages/ui-tokens`).

- [ ] **T-023 · Övningsdesigner-wizard 3 steg**

  - Beroende: T-022, T-021
  - AC: välj mall → fyll basinfo → spara; klassningsfält som dropdown med endast Öppen/Intern; tangentbordsnavigering; WCAG 2.1 AA verifierad med axe-core.

- [ ] **T-024 · MSEL-redigeringsgrid (React Data Grid)**
  - Beroende: T-022, T-020
  - AC: bulk-edit; filter; export CSV; klassningsmarkering på varje rad; försök att skriva "confidential" → fältet rödmarkerat med felmeddelande.

### Block H — EEG/AAR-mall (E-16)

- [ ] **T-025 · EEG-datamodell och CRUD**

  - Beroende: T-013
  - AC: tabeller `evaluation_plan`, `observation`, `improvement_action`; struktur följer HSEEP IP01.

- [ ] **T-026 · AAR-PDF-export (PDF/A-1)**
  - Beroende: T-025
  - AC: PDF/A-1 valideras med veraPDF; klassningsmarkering på varje sida (Öppen/Intern); BankID-signatur via stub; hash i audit-logg.

### Block I — Pilot-paket

- [ ] **T-027 · Onboarding-script för pilot-tenant**

  - Beroende: T-019, T-021
  - AC: skapar tenant + admin + 5 testanvändare + 1 övning från mall via en kommando; idempotent.

- [ ] **T-028 · Användarvillkor + onboardings-flow**
  - Beroende: T-022
  - AC: vid första inloggning godkänner användare att ingen säkerhetsskyddsklassad information laddas upp (kravspec §4.8 F-10.1 AC4); godkännande loggas; nekande blockerar åtkomst.

---

## PI 2 — Spelmiljö (mån 3–6)

- [ ] **T-029 · EXCON-cockpit (realtid via WebSocket)**
- [ ] **T-030 · Spelarvy med rollanpassad inkorg**
- [ ] **T-031 · Push-injekter (tidsstyrda)**
- [ ] **T-032 · Pull-injekter**
- [ ] **T-033 · Conditional injekter med CEL/Rego DSL**
- [ ] **T-034 · MapLibre-karta med Lantmäteriet WMS**
- [ ] **T-035 · COP-lagerredigerare med roll-anpassad sikt**
- [ ] **T-036 · Time compression och pause/resume**
- [ ] **T-037 · Versionshantering på MSEL (branch/merge)**
- [ ] **T-038 · Observability: OpenTelemetry + Grafana stack**

(detaljer skrivs ut när PI 1 är ≥80 % stängt; varje task ska följa samma
nivå av AC och DoD som PI 1)

---

## PI 3 — Kommunikation och integration (mån 6–9)

- [ ] **T-039 · Sociala medier-emulator (X-replika i sandbox)**
- [ ] **T-040 · Simulerad 112-larmcentral**
- [ ] **T-041 · Säker chat med MLS (RFC 9420)**
- [ ] **T-042 · WIS-integration (export-bundle)**
- [ ] **T-043 · SITHS eID + Sjunet-anslutning**
- [ ] **T-044 · NIS2 incidenthanteringsmodul**
- [ ] **T-045 · GDPR-modul (registerförteckning, DPIA, registrerades rättigheter)**
- [ ] **T-046 · Generisk samverkansradio-simulator (ej Rakel-specifik)**

---

## PI 4 — Säkerhet, AI v1, skalning (mån 9–12)

- [ ] **T-047 · Watermarking (synlig + steganografisk)**
- [ ] **T-048 · Vassare DLP med ML-stöd**
- [ ] **T-049 · AI scenarioassistent v1 (EU-driftad LLM)**
- [ ] **T-050 · AI AAR-utkast v1**
- [ ] **T-051 · PWA offline-läge med IndexedDB + CRDT**
- [ ] **T-052 · ISO 27001 evidence-paket och audit**

---

## PI 5 — Förmågeobservatorium och DORA (mån 12–15)

- [ ] **T-053 · Förmågedashboard (aggregerad, anonymiserad)**
- [ ] **T-054 · Nationell kvartalsrapport-generator**
- [ ] **T-055 · DORA TLPT-scenarier**
- [ ] **T-056 · ISO 22301 + ISO 27701 evidence**

---

## PI 6 — Storskalig övning och resiliens (mån 15–18)

- [ ] **T-057 · Fältcontainer-deployment (k3s/talos)**
- [ ] **T-058 · Mesh/LoRaWAN-stöd**
- [ ] **T-059 · Starlink/Iridium-fallback**
- [ ] **T-060 · Multi-region failover (RTO ≤30 min)**
- [ ] **T-061 · Lasttest 1 000+ samtidiga deltagare**

---

## PI 7 — Marknadsexpansion (mån 18–21)

- [ ] **T-062 · Engelskt UI och i18n-ramverk**
- [ ] **T-063 · Lokaliseringspaket Finland och Norge**
- [ ] **T-064 · SOC 2 Type II evidence-insamling**

---

## Tvärgående och löpande

- [ ] **T-100 · Hålla `docs/KRAVSPEC.md` i synk när scope ändras**
- [ ] **T-101 · ADR-katalog levande**
- [ ] **T-102 · Kvartalsvis dependency-uppdatering**
- [ ] **T-103 · Kvartalsvis pentest-genomgång (extern leverantör)**
- [ ] **T-104 · DLP-regelbiblioteket: granska kvartalsvis för nya markeringsformat**

---

## Mallar för nya tasks

```markdown
- [ ] **T-NNN · <Kort titel i imperativ>**
  - Beroende: T-XXX, T-YYY
  - Filer: <huvudfiler som rörs>
  - AC:
    - <Given/When/Then 1>
    - <Given/When/Then 2>
  - DoD: <utöver §4.5 sannings-checklista i CLAUDE.md>
  - HITL: <ja/nej, varför om ja>
```

---

_Senast ändrad: 2026-04-25_
