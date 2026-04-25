# ADR-0001: Append-only audit-logg med hashkedja och Postgres rules

- Status: accepted
- Datum: 2026-04-25
- Beslutsfattare: Claude (autonom session, blanco-godkännande från användaren)

## Kontext

Kravspec §4.9 F-11.3 och CLAUDE.md §1.6 fastslår att audit-loggen ska
vara append-only med kryptografisk hashkedja och WORM-lagring i ≥10 år.
Vi måste välja både ett applikationskontrakt (vad som får skrivas och
hur) och ett databaskontrakt (hur tabellen skyddas mot mutation).

## Beslut

1. **Applikationskontrakt:** `@ovh/audit-log` exponerar
   `AuditChain.append(event)` som enda väg in. Varje rad bär
   `prevHash`, `hash`, `sequence`, `timestamp`, `actor`, `action`,
   `target`, `classification` och `payload`. Hashen är
   `SHA-256(prevHash || canonicalize(body))`. Klassningen valideras
   mot enum `["open","internal"]` innan skrivning.
2. **Databaskontrakt:** Tabellen `audit_event` skyddas av två Postgres
   `CREATE RULE ... DO INSTEAD NOTHING` (UPDATE och DELETE) plus
   `REVOKE UPDATE, DELETE, TRUNCATE ON audit_event FROM PUBLIC`.
   Skriptet `prisma/sql/audit_event_immutability.sql` körs efter varje
   migration via npm-script.
3. **Verifiering:** `verifyChain(entries)` är pure-TS och kan köras off-
   line för att validera utlämningar eller forensiska kopior.

## Konsekvenser

- **Positivt.** Tre-i-stället-för-en-djup försvar: applikationen kan
  inte mutera, ORM:en exponerar inte mutationer, databasen avvisar dem.
- **Positivt.** Hashkedjan ger oberoende verifiering — en operatör som
  exporterar ett offentligt utdrag ur kedjan kan låta tredje part
  validera utan att se övriga rader.
- **Negativt.** RULE `DO INSTEAD NOTHING` är "tyst" — UPDATE/DELETE
  rapporterar 0 rader påverkade istället för att felka. Vi accepterar
  detta eftersom applikationen aldrig genererar sådana frågor.
- **Negativt.** Skarpt korrigeringsbehov (t.ex. GDPR-radering av PII i
  ett payload-fält) kräver HITL-godkännande och en separat migration
  som tillfälligt drop:ar reglerna. Detta är en avsiktlig friktion.

## Alternativ som övervägdes

- **Logga till external WORM (S3 Object Lock).** Avvisat för PI 1
  eftersom det dubblerar persistensen och komplicerar konsistens
  mellan applikations- och loggdomän. Kan adderas senare som en
  asynkron speglingsmekanism utan att ändra applikationskontraktet.
- **Trigger-baserad förbjuden mutation.** Triggers ger snyggare fel
  (RAISE EXCEPTION) men kostar extra latens på legitima INSERT om
  hooken delas. Vi väljer rules för att minimera overhead på
  inläggningar.
- **Endast applikationsspärr.** Avvisat — bryter principen om
  djup-i-försvar; en privilegierad operatör med direkt SQL-åtkomst
  skulle kunna kringgå.
