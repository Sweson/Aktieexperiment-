import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { seed } from "./seed";

let _db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ous (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  ou_id INTEGER REFERENCES ous(id)
);
CREATE TABLE IF NOT EXISTS competences (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ou_capacity (
  id INTEGER PRIMARY KEY,
  ou_id INTEGER NOT NULL REFERENCES ous(id),
  competence_id INTEGER NOT NULL REFERENCES competences(id),
  quarter TEXT NOT NULL,
  hours REAL NOT NULL,
  UNIQUE(ou_id, competence_id, quarter)
);
CREATE TABLE IF NOT EXISTS capability_areas (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS capabilities (
  id INTEGER PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES capability_areas(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS processes (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, owner TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS info_objects (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, classification TEXT DEFAULT 'C2', quality TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS systems (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, lifecycle TEXT DEFAULT 'Aktiv', debt TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS map_capability_process (capability_id INTEGER, process_id INTEGER, UNIQUE(capability_id, process_id));
CREATE TABLE IF NOT EXISTS map_capability_info (capability_id INTEGER, info_id INTEGER, UNIQUE(capability_id, info_id));
CREATE TABLE IF NOT EXISTS map_capability_system (capability_id INTEGER, system_id INTEGER, UNIQUE(capability_id, system_id));
CREATE TABLE IF NOT EXISTS map_capability_ou (capability_id INTEGER, ou_id INTEGER, role TEXT DEFAULT '', UNIQUE(capability_id, ou_id));
CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT DEFAULT '',
  why_now TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'utkast',
  priority_rank INTEGER,
  owner_id INTEGER REFERENCES users(id),
  coordinator_id INTEGER REFERENCES users(id),
  mandate TEXT DEFAULT '',
  resources TEXT DEFAULT '',
  reporting TEXT DEFAULT 'Månadsvis i DEMT enligt navets standardformat',
  horizon TEXT DEFAULT 'Till nästa årliga temaöversyn',
  decided_at TEXT,
  review_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS key_results (
  id INTEGER PRIMARY KEY,
  theme_id INTEGER NOT NULL REFERENCES themes(id),
  title TEXT NOT NULL,
  baseline REAL NOT NULL DEFAULT 0,
  target REAL NOT NULL DEFAULT 0,
  unit TEXT DEFAULT '',
  deadline TEXT DEFAULT '',
  source TEXT DEFAULT '',
  frequency TEXT DEFAULT 'Månadsvis',
  is_customer_value INTEGER NOT NULL DEFAULT 0,
  direction TEXT NOT NULL DEFAULT 'up'
);
CREATE TABLE IF NOT EXISTS kr_measurements (
  id INTEGER PRIMARY KEY,
  kr_id INTEGER NOT NULL REFERENCES key_results(id),
  date TEXT NOT NULL,
  actual REAL,
  forecast REAL,
  rag TEXT NOT NULL DEFAULT 'grön',
  comment TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS heatmap (
  id INTEGER PRIMARY KEY,
  theme_id INTEGER NOT NULL REFERENCES themes(id),
  capability_id INTEGER NOT NULL REFERENCES capabilities(id),
  criticality TEXT NOT NULL DEFAULT 'Ingen',
  movement TEXT NOT NULL DEFAULT 'Utnyttja',
  motivation TEXT DEFAULT '',
  to_gap INTEGER NOT NULL DEFAULT 0,
  exclusion_motive TEXT DEFAULT '',
  UNIQUE(theme_id, capability_id)
);
CREATE TABLE IF NOT EXISTS gaps (
  id INTEGER PRIMARY KEY,
  theme_id INTEGER NOT NULL REFERENCES themes(id),
  capability_id INTEGER NOT NULL REFERENCES capabilities(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  classification TEXT NOT NULL DEFAULT 'Bör',
  status TEXT NOT NULL DEFAULT 'öppet',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS gap_krs (gap_id INTEGER, kr_id INTEGER, UNIQUE(gap_id, kr_id));
CREATE TABLE IF NOT EXISTS gap_dimensions (
  id INTEGER PRIMARY KEY,
  gap_id INTEGER NOT NULL REFERENCES gaps(id),
  dimension TEXT NOT NULL,
  current INTEGER NOT NULL DEFAULT 1,
  target INTEGER NOT NULL DEFAULT 3,
  motivation TEXT DEFAULT '',
  UNIQUE(gap_id, dimension)
);
CREATE TABLE IF NOT EXISTS gap_dependencies (
  id INTEGER PRIMARY KEY,
  gap_id INTEGER NOT NULL REFERENCES gaps(id),
  depends_on_gap_id INTEGER NOT NULL REFERENCES gaps(id),
  note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS initiatives (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  ou_id INTEGER NOT NULL REFERENCES ous(id),
  owner TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  start_quarter TEXT NOT NULL,
  end_quarter TEXT NOT NULL,
  ownership TEXT NOT NULL DEFAULT 'ou',
  ext_cost REAL NOT NULL DEFAULT 0,
  business_value INTEGER NOT NULL DEFAULT 5,
  time_criticality INTEGER NOT NULL DEFAULT 5,
  risk_reduction INTEGER NOT NULL DEFAULT 5,
  job_size REAL NOT NULL DEFAULT 5,
  benefit_logic TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS initiative_gaps (initiative_id INTEGER, gap_id INTEGER, UNIQUE(initiative_id, gap_id));
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id),
  title TEXT NOT NULL,
  due_quarter TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ej påbörjad',
  verified_by TEXT DEFAULT '',
  outcome TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS initiative_resources (
  id INTEGER PRIMARY KEY,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id),
  competence_id INTEGER NOT NULL REFERENCES competences(id),
  quarter TEXT NOT NULL,
  hours REAL NOT NULL,
  UNIQUE(initiative_id, competence_id, quarter)
);
CREATE TABLE IF NOT EXISTS mirror_commitments (
  id INTEGER PRIMARY KEY,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id),
  ou_id INTEGER NOT NULL REFERENCES ous(id),
  description TEXT NOT NULL,
  due_quarter TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  competence_id INTEGER REFERENCES competences(id),
  hours REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY,
  theme_id INTEGER REFERENCES themes(id),
  title TEXT NOT NULL,
  question TEXT DEFAULT '',
  recommendation TEXT DEFAULT '',
  decision TEXT DEFAULT '',
  decided_by TEXT DEFAULT '',
  decided_at TEXT,
  motive TEXT DEFAULT '',
  review_conditions TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'öppet',
  forum TEXT DEFAULT 'DEMT',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS decision_alternatives (
  id INTEGER PRIMARY KEY,
  decision_id INTEGER NOT NULL REFERENCES decisions(id),
  name TEXT NOT NULL,
  cost TEXT DEFAULT '',
  kr_effect TEXT DEFAULT '',
  risk TEXT DEFAULT '',
  lead_time TEXT DEFAULT '',
  chosen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS status_reports (
  id INTEGER PRIMARY KEY,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id),
  month TEXT NOT NULL,
  summary TEXT DEFAULT '',
  prognosis TEXT NOT NULL DEFAULT 'grön',
  resource_state TEXT DEFAULT '',
  decisions_needed TEXT DEFAULT '',
  lessons TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(initiative_id, month)
);
CREATE TABLE IF NOT EXISTS benefits (
  id INTEGER PRIMARY KEY,
  theme_id INTEGER NOT NULL REFERENCES themes(id),
  initiative_id INTEGER REFERENCES initiatives(id),
  kr_id INTEGER REFERENCES key_results(id),
  description TEXT NOT NULL,
  owner TEXT DEFAULT '',
  action TEXT DEFAULT '',
  baseline TEXT DEFAULT '',
  measure_point TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ej påbörjad'
);
CREATE TABLE IF NOT EXISTS escalations (
  id INTEGER PRIMARY KEY,
  ou_id INTEGER REFERENCES ous(id),
  initiative_id INTEGER REFERENCES initiatives(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  quarter TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'öppen',
  resolution TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
`;

export function db(): Database.Database {
  if (_db) return _db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "navet.db");
  const fresh = !fs.existsSync(file);
  _db = new Database(file);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.exec(SCHEMA);
  const hasData = (_db.prepare("SELECT COUNT(*) AS n FROM themes").get() as { n: number }).n > 0;
  if (fresh || !hasData) seed(_db);
  return _db;
}
