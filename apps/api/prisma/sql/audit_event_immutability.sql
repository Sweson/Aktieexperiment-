-- audit_event är append-only (CLAUDE.md §1.6, kravspec §4.9 F-11.3).
--
-- Detta skript skapar Postgres rules som blockerar UPDATE och DELETE
-- på tabellen. Eventuell migration eller felhantering som behöver
-- mutera historiska rader kräver HITL-godkännande och måste i så fall
-- DROP:a dessa rules medvetet med spårbart commitmeddelande.
--
-- Skriptet körs efter `prisma migrate deploy` via en post-migration
-- hook (npm script `db:apply-immutability`) tills Prisma stödjer
-- raw SQL-migrations natively i vår version.

CREATE OR REPLACE RULE audit_event_no_update AS
  ON UPDATE TO audit_event
  DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_event_no_delete AS
  ON DELETE TO audit_event
  DO INSTEAD NOTHING;

-- Belt-and-braces: revoke direkta UPDATE/DELETE-privilegier från
-- application-användaren. Endast en uttrycklig superuser-session med
-- DROP RULE kan kringgå.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_event FROM PUBLIC;
