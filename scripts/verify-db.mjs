// Fullständig funktionsverifiering av databaslagret.
// Kör samma SQL-operationer som serveractionerna (src/lib/actions.ts) mot en
// temporär kopia av databasen och kontrollerar resultatet av varje steg.
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const src = path.join(process.cwd(), "data", "navet.db");
const tmp = path.join(process.cwd(), "data", "verify-tmp.db");
if (!fs.existsSync(src)) {
  console.error("Ingen databas i data/navet.db – starta servern en gång först.");
  process.exit(1);
}
fs.copyFileSync(src, tmp);
// WAL-läge: ocheckpointade ändringar ligger i -wal/-shm och måste följa med kopian.
for (const suffix of ["-wal", "-shm"]) {
  if (fs.existsSync(src + suffix)) fs.copyFileSync(src + suffix, tmp + suffix);
  else if (fs.existsSync(tmp + suffix)) fs.rmSync(tmp + suffix);
}
const db = new Database(tmp);
db.pragma("foreign_keys = ON");

let passed = 0, failed = 0;
function check(name, fn) {
  try {
    const ok = fn();
    if (ok) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.error(`  ✗ ${name} (villkor falskt)`); }
  } catch (e) {
    failed++; console.error(`  ✗ ${name}: ${e.message}`);
  }
}

console.log("Seed-data:");
check("5 OU:er, 10 användare, 7 kompetensområden", () =>
  db.prepare("SELECT COUNT(*) n FROM ous").get().n === 5 &&
  db.prepare("SELECT COUNT(*) n FROM users").get().n === 10 &&
  db.prepare("SELECT COUNT(*) n FROM competences").get().n === 7);
check("Förmågekarta: 8 områden, 31 förmågor", () =>
  db.prepare("SELECT COUNT(*) n FROM capability_areas").get().n === 8 &&
  db.prepare("SELECT COUNT(*) n FROM capabilities").get().n === 31);
check("4 teman (3 beslutade) med 8 KR och mätserier", () =>
  db.prepare("SELECT COUNT(*) n FROM themes").get().n === 4 &&
  db.prepare("SELECT COUNT(*) n FROM themes WHERE status='beslutad'").get().n === 3 &&
  db.prepare("SELECT COUNT(*) n FROM key_results").get().n === 8 &&
  db.prepare("SELECT COUNT(*) n FROM kr_measurements").get().n >= 12);
check("Heatmap, gap med dimensioner, KR-spårbarhet och beroenden", () =>
  db.prepare("SELECT COUNT(*) n FROM heatmap").get().n >= 15 &&
  db.prepare("SELECT COUNT(*) n FROM gaps").get().n === 10 &&
  db.prepare("SELECT COUNT(*) n FROM gap_dimensions").get().n >= 20 &&
  db.prepare("SELECT COUNT(*) n FROM gap_krs").get().n >= 10 &&
  db.prepare("SELECT COUNT(*) n FROM gap_dependencies").get().n === 4);
check("10 initiativ med delmål, resurser, speglar, status och nytta", () =>
  db.prepare("SELECT COUNT(*) n FROM initiatives").get().n === 10 &&
  db.prepare("SELECT COUNT(*) n FROM milestones").get().n >= 15 &&
  db.prepare("SELECT COUNT(*) n FROM initiative_resources").get().n >= 15 &&
  db.prepare("SELECT COUNT(*) n FROM mirror_commitments").get().n === 2 &&
  db.prepare("SELECT COUNT(*) n FROM status_reports").get().n === 8 &&
  db.prepare("SELECT COUNT(*) n FROM benefits").get().n === 5);
check("Vägval med alternativ, eskaleringar, kapacitetsdata", () =>
  db.prepare("SELECT COUNT(*) n FROM decisions").get().n === 3 &&
  db.prepare("SELECT COUNT(*) n FROM decision_alternatives").get().n === 7 &&
  db.prepare("SELECT COUNT(*) n FROM escalations").get().n === 3 &&
  db.prepare("SELECT COUNT(*) n FROM ou_capacity").get().n === 48);

console.log("Skrivvägar (CRUD som i serveractionerna):");
let themeId, krId, gapId, initId, msId, decId, benId;
check("Skapa tema → besluta → uppdatera mandatkort", () => {
  themeId = db.prepare("INSERT INTO themes (name, objective, why_now, status) VALUES (?,?,?,'utkast')")
    .run("Testtema", "Objective", "Varför nu").lastInsertRowid;
  db.prepare("UPDATE themes SET status='beslutad', decided_at=date('now') WHERE id=?").run(themeId);
  db.prepare("UPDATE themes SET mandate=?, resources=?, priority_rank=?, owner_id=?, coordinator_id=? WHERE id=?")
    .run("Mandat", "Resurser", 4, 2, 7, themeId);
  const t = db.prepare("SELECT * FROM themes WHERE id=?").get(themeId);
  return t.status === "beslutad" && t.priority_rank === 4 && t.owner_id === 2;
});
check("Lägg till KR + mätning", () => {
  krId = db.prepare(`INSERT INTO key_results (theme_id,title,baseline,target,unit,deadline,source,frequency,is_customer_value,direction)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(themeId, "Test-KR", 10, 50, "%", "2027-Q4", "Källa", "Månadsvis", 1, "up").lastInsertRowid;
  db.prepare("INSERT INTO kr_measurements (kr_id,date,actual,forecast,rag,comment) VALUES (?,?,?,?,?,?)")
    .run(krId, "2026-06-12", 18, 45, "gul", "test");
  const m = db.prepare("SELECT * FROM kr_measurements WHERE kr_id=? ORDER BY date DESC LIMIT 1").get(krId);
  return m.actual === 18 && m.rag === "gul";
});
check("Heatmap-upsert (insert + uppdatering via ON CONFLICT)", () => {
  const up = db.prepare(`INSERT INTO heatmap (theme_id,capability_id,criticality,movement,motivation,to_gap,exclusion_motive)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(theme_id,capability_id) DO UPDATE SET criticality=excluded.criticality, movement=excluded.movement,
      motivation=excluded.motivation, to_gap=excluded.to_gap, exclusion_motive=excluded.exclusion_motive`);
  up.run(themeId, 1, "Viktig", "Förbättra", "m", 1, "");
  up.run(themeId, 1, "Kritisk", "Bygga ny", "m2", 1, "");
  const h = db.prepare("SELECT * FROM heatmap WHERE theme_id=? AND capability_id=1").get(themeId);
  return h.criticality === "Kritisk" && db.prepare("SELECT COUNT(*) n FROM heatmap WHERE theme_id=?").get(themeId).n === 1;
});
check("Skapa gap med dimensioner, KR-koppling och beroende", () => {
  gapId = db.prepare("INSERT INTO gaps (theme_id,capability_id,title,description,classification) VALUES (?,?,?,?,?)")
    .run(themeId, 1, "Testgap", "Beskrivning", "Måste").lastInsertRowid;
  db.prepare("INSERT INTO gap_dimensions (gap_id,dimension,current,target,motivation) VALUES (?,?,?,?,?)")
    .run(gapId, "Process", 2, 4, "motiv");
  db.prepare("INSERT OR IGNORE INTO gap_krs (gap_id,kr_id) VALUES (?,?)").run(gapId, krId);
  db.prepare("INSERT INTO gap_dependencies (gap_id,depends_on_gap_id,note) VALUES (?,?,?)").run(gapId, 1, "test");
  db.prepare("UPDATE gaps SET classification='Bör', status='öppet' WHERE id=?").run(gapId);
  return db.prepare("SELECT classification FROM gaps WHERE id=?").get(gapId).classification === "Bör";
});
check("Skapa initiativ med gap-koppling, delmål, resurs-upsert, spegel", () => {
  initId = db.prepare(`INSERT INTO initiatives (name,ou_id,owner,description,status,start_quarter,end_quarter,ownership,ext_cost,business_value,time_criticality,risk_reduction,job_size,benefit_logic)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run("Testinitiativ", 1, "Ägare", "Beskrivning", "planned", "2026-Q3", "2026-Q4", "ou", 1.5, 8, 7, 6, 4, "Nyttologik").lastInsertRowid;
  db.prepare("INSERT OR IGNORE INTO initiative_gaps (initiative_id,gap_id) VALUES (?,?)").run(initId, gapId);
  msId = db.prepare("INSERT INTO milestones (initiative_id,title,due_quarter) VALUES (?,?,?)")
    .run(initId, "Testdelmål", "2026-Q4").lastInsertRowid;
  db.prepare("UPDATE milestones SET status='uppnådd', verified_by='Oberoende', outcome='Utfall' WHERE id=?").run(msId);
  const res = db.prepare(`INSERT INTO initiative_resources (initiative_id,competence_id,quarter,hours) VALUES (?,?,?,?)
    ON CONFLICT(initiative_id,competence_id,quarter) DO UPDATE SET hours=excluded.hours`);
  res.run(initId, 1, "2026-Q3", 100);
  res.run(initId, 1, "2026-Q3", 250);
  db.prepare("INSERT INTO mirror_commitments (initiative_id,ou_id,description,due_quarter,status,competence_id,hours) VALUES (?,?,?,?,?,?,?)")
    .run(initId, 2, "Delleverans", "2026-Q4", "planned", 1, 80);
  db.prepare("UPDATE initiatives SET status='committed' WHERE id=?").run(initId);
  const hrs = db.prepare("SELECT hours FROM initiative_resources WHERE initiative_id=? AND competence_id=1 AND quarter='2026-Q3'").get(initId).hours;
  return hrs === 250 && db.prepare("SELECT status FROM initiatives WHERE id=?").get(initId).status === "committed";
});
check("Eskalering: skapa → besluta", () => {
  const eid = db.prepare("INSERT INTO escalations (ou_id,initiative_id,title,description,quarter) VALUES (?,?,?,?,?)")
    .run(1, initId, "Testeskalering", "Beskrivning", "2026-Q4").lastInsertRowid;
  db.prepare("UPDATE escalations SET status='löst', resolution=? WHERE id=?").run("DEMT-beslut", eid);
  return db.prepare("SELECT status FROM escalations WHERE id=?").get(eid).status === "löst";
});
check("Vägval: skapa med alternativ → protokollför beslut", () => {
  decId = db.prepare("INSERT INTO decisions (theme_id,title,question,recommendation,forum) VALUES (?,?,?,?,?)")
    .run(themeId, "Testvägval", "Fråga?", "Rek", "DEMT").lastInsertRowid;
  const a1 = db.prepare("INSERT INTO decision_alternatives (decision_id,name,cost,kr_effect,risk,lead_time) VALUES (?,?,?,?,?,?)")
    .run(decId, "Alt A", "1 MSEK", "KR+", "låg", "3 mån").lastInsertRowid;
  db.prepare("INSERT INTO decision_alternatives (decision_id,name,cost,kr_effect,risk,lead_time) VALUES (?,?,?,?,?,?)")
    .run(decId, "Alt B", "3 MSEK", "KR++", "hög", "9 mån");
  db.prepare("UPDATE decisions SET decision=?, decided_by=?, decided_at=date('now'), motive=?, review_conditions=?, status='beslutat' WHERE id=?")
    .run("Alt A väljs", "DEMT", "Motiv", "Omprövas vid X", decId);
  db.prepare("UPDATE decision_alternatives SET chosen=(id=?) WHERE decision_id=?").run(a1, decId);
  return db.prepare("SELECT COUNT(*) n FROM decision_alternatives WHERE decision_id=? AND chosen=1").get(decId).n === 1;
});
check("Månadsstatus-upsert (samma månad skriver över)", () => {
  const up = db.prepare(`INSERT INTO status_reports (initiative_id,month,summary,prognosis,resource_state,decisions_needed,lessons)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(initiative_id,month) DO UPDATE SET summary=excluded.summary, prognosis=excluded.prognosis,
      resource_state=excluded.resource_state, decisions_needed=excluded.decisions_needed, lessons=excluded.lessons`);
  up.run(initId, "2026-06", "Första", "grön", "", "", "");
  up.run(initId, "2026-06", "Uppdaterad", "gul", "OK", "Beslut X", "Lärdom");
  const r = db.prepare("SELECT * FROM status_reports WHERE initiative_id=? AND month='2026-06'").get(initId);
  return r.summary === "Uppdaterad" && r.prognosis === "gul" &&
    db.prepare("SELECT COUNT(*) n FROM status_reports WHERE initiative_id=?").get(initId).n === 1;
});
check("Nyttoregister: skapa → uppdatera status", () => {
  benId = db.prepare("INSERT INTO benefits (theme_id,initiative_id,kr_id,description,owner,action,baseline,measure_point,status) VALUES (?,?,?,?,?,?,?,?,'ej påbörjad')")
    .run(themeId, initId, krId, "Testnytta", "Linjechef", "Åtgärd", "0", "Mätpunkt").lastInsertRowid;
  db.prepare("UPDATE benefits SET status='verifierad' WHERE id=?").run(benId);
  return db.prepare("SELECT status FROM benefits WHERE id=?").get(benId).status === "verifierad";
});

console.log("Spårbarhet och analyslogik:");
check("Kedjan tema → KR → gap → initiativ → delmål är obruten", () => {
  const row = db.prepare(`
    SELECT t.name theme, kr.title kr, g.title gap, i.name init, m.title milestone
    FROM themes t JOIN key_results kr ON kr.theme_id=t.id
    JOIN gap_krs gk ON gk.kr_id=kr.id JOIN gaps g ON g.id=gk.gap_id
    JOIN initiative_gaps ig ON ig.gap_id=g.id JOIN initiatives i ON i.id=ig.initiative_id
    JOIN milestones m ON m.initiative_id=i.id
    WHERE t.id=?`).get(themeId);
  return row && row.theme === "Testtema" && row.milestone === "Testdelmål";
});
check("Främmandenycklar avvisar föräldralösa poster", () => {
  try {
    db.prepare("INSERT INTO key_results (theme_id,title) VALUES (99999,'orphan')").run();
    return false;
  } catch { return true; }
});
check("Kapacitetsbild: efterfrågan + spegelpost räknas mot rätt OU", () => {
  // OU 2 (Nät) ska ha testspegelns 80 h som efterfrågan i 2026-Q4 utöver befintlig
  const r = db.prepare(`
    SELECT COALESCE(SUM(m.hours),0) h FROM mirror_commitments m
    WHERE m.ou_id=2 AND m.due_quarter='2026-Q4' AND m.competence_id=1`).get();
  return r.h >= 80;
});

db.close();
fs.rmSync(tmp);
for (const suffix of ["-wal", "-shm"]) {
  const p = tmp + suffix;
  if (fs.existsSync(p)) fs.rmSync(p);
}
console.log(`\nResultat: ${passed} godkända, ${failed} underkända.`);
process.exit(failed ? 1 : 0);
