# ÖvningsHub Sverige

Suverän svensk SaaS-plattform för planering, genomförande och utvärdering
av krisövningar på **öppen och intern informationsnivå**. Plattformen
hanterar **inte** säkerhetsskyddsklassificerade uppgifter (Begränsat
hemlig och uppåt enligt säkerhetsskyddslagen 2018:585).

## Var saker ligger

| Fil/katalog                              | Roll                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                 | Autonom arbetsinstruktion — läses vid sessionsstart   |
| [`docs/KRAVSPEC.md`](docs/KRAVSPEC.md)   | Sammanfattad kravspecifikation (full version i v1.1)  |
| [`docs/BACKLOG.md`](docs/BACKLOG.md)     | Sekvenserad atomär arbetslista, sju PI över 21 mån    |
| [`docs/adr/`](docs/adr/)                 | Architectural Decision Records                        |
| `apps/api/`                              | Fastify backend (Node 22, TypeScript, Prisma)         |
| `apps/web/`                              | Next.js 15 frontend                                   |
| `packages/classification/`               | Klassmodell + DLP — säkerhetskritiskt paket           |
| `packages/audit-log/`                    | Append-only auditlogg med hashkedja                   |

## Snabbstart för utvecklare

```sh
nvm use                          # Node 22 LTS från .nvmrc
docker compose up -d             # postgres, nats, minio, mailhog, keycloak
npm install
npm run db:migrate
npm run dev
```

## Bidra som autonom Claude

Hela arbetsflödet är beskrivet i [`CLAUDE.md`](CLAUDE.md). Kort:

1. Läs `CLAUDE.md` och `docs/BACKLOG.md`.
2. Plocka första `[ ]`-task utan olösta beroenden.
3. Följ sjustegscykeln (förstå → testa → implementera → refaktorera →
   sannings-checklista → ADR → commit/push).
4. Bocka av i backlog; uppdatera draft-PR.

## Compliance

Plattformen utvecklas mot HSEEP, MSB Övningsvägledning, ISO 22301/22320/
22361/22398, WCAG 2.1 AA, GDPR, NIS2, DORA, ISO 27001 och ISO 27701.
Säkerhetsskyddslagen 2018:585 är **utanför scope** — tekniska kontroller
i `packages/classification/` förhindrar aktivt att sådan information
hamnar i tjänsten.
