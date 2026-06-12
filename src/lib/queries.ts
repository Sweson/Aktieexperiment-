import { db } from "./db";

export type Row = Record<string, any>;

// ---------- Teman och OKR ----------
export function getThemes(): Row[] {
  return db().prepare(`
    SELECT t.*, ow.name AS owner_name, co.name AS coordinator_name
    FROM themes t
    LEFT JOIN users ow ON ow.id = t.owner_id
    LEFT JOIN users co ON co.id = t.coordinator_id
    ORDER BY CASE WHEN t.priority_rank IS NULL THEN 99 ELSE t.priority_rank END, t.id
  `).all() as Row[];
}

export function getTheme(id: number): Row | undefined {
  return db().prepare(`
    SELECT t.*, ow.name AS owner_name, co.name AS coordinator_name
    FROM themes t
    LEFT JOIN users ow ON ow.id = t.owner_id
    LEFT JOIN users co ON co.id = t.coordinator_id
    WHERE t.id = ?
  `).get(id) as Row | undefined;
}

/** KR med senaste mätning (utfall, prognos, RAG). */
export function getKrsWithLatest(themeId?: number): Row[] {
  const where = themeId ? "WHERE kr.theme_id = ?" : "";
  const rows = db().prepare(`
    SELECT kr.*, t.name AS theme_name, t.priority_rank,
      (SELECT m.actual   FROM kr_measurements m WHERE m.kr_id = kr.id ORDER BY m.date DESC LIMIT 1) AS actual,
      (SELECT m.forecast FROM kr_measurements m WHERE m.kr_id = kr.id ORDER BY m.date DESC LIMIT 1) AS forecast,
      (SELECT m.rag      FROM kr_measurements m WHERE m.kr_id = kr.id ORDER BY m.date DESC LIMIT 1) AS rag,
      (SELECT m.comment  FROM kr_measurements m WHERE m.kr_id = kr.id ORDER BY m.date DESC LIMIT 1) AS comment,
      (SELECT m.date     FROM kr_measurements m WHERE m.kr_id = kr.id ORDER BY m.date DESC LIMIT 1) AS measured_at
    FROM key_results kr JOIN themes t ON t.id = kr.theme_id
    ${where} ORDER BY kr.theme_id, kr.id
  `).all(...(themeId ? [themeId] : [])) as Row[];
  return rows;
}

export function getKrMeasurements(krId: number): Row[] {
  return db().prepare("SELECT * FROM kr_measurements WHERE kr_id = ? ORDER BY date").all(krId) as Row[];
}

// ---------- Förmågekarta & grundkartor ----------
export function getCapabilityMap(): { areas: Row[]; capabilities: Row[] } {
  const areas = db().prepare("SELECT * FROM capability_areas ORDER BY sort").all() as Row[];
  const capabilities = db().prepare("SELECT * FROM capabilities ORDER BY area_id, id").all() as Row[];
  return { areas, capabilities };
}

export function getCapabilityCrossMap(capabilityId: number): Row {
  const d = db();
  return {
    processes: d.prepare("SELECT p.* FROM processes p JOIN map_capability_process m ON m.process_id = p.id WHERE m.capability_id = ?").all(capabilityId),
    info: d.prepare("SELECT i.* FROM info_objects i JOIN map_capability_info m ON m.info_id = i.id WHERE m.capability_id = ?").all(capabilityId),
    systems: d.prepare("SELECT s.* FROM systems s JOIN map_capability_system m ON m.system_id = s.id WHERE m.capability_id = ?").all(capabilityId),
    ous: d.prepare("SELECT o.*, m.role FROM ous o JOIN map_capability_ou m ON m.ou_id = o.id WHERE m.capability_id = ?").all(capabilityId),
  };
}

export function getBaseMaps(): Row {
  const d = db();
  return {
    processes: d.prepare("SELECT * FROM processes ORDER BY name").all(),
    info: d.prepare("SELECT * FROM info_objects ORDER BY name").all(),
    systems: d.prepare("SELECT * FROM systems ORDER BY name").all(),
    ous: d.prepare("SELECT * FROM ous ORDER BY id").all(),
  };
}

export function getHeatmap(themeId: number): Row[] {
  return db().prepare(`
    SELECT h.*, c.name AS capability_name, c.area_id, a.name AS area_name
    FROM heatmap h
    JOIN capabilities c ON c.id = h.capability_id
    JOIN capability_areas a ON a.id = c.area_id
    WHERE h.theme_id = ?
    ORDER BY CASE h.criticality WHEN 'Kritisk' THEN 0 WHEN 'Viktig' THEN 1 WHEN 'Stödjande' THEN 2 ELSE 3 END
  `).all(themeId) as Row[];
}

export function getHeatmapAll(): Row[] {
  return db().prepare("SELECT * FROM heatmap").all() as Row[];
}

// ---------- Gap ----------
export function getGaps(themeId?: number): Row[] {
  const where = themeId ? "WHERE g.theme_id = ?" : "";
  return db().prepare(`
    SELECT g.*, c.name AS capability_name, t.name AS theme_name,
      (SELECT GROUP_CONCAT(kr.title, ' • ') FROM gap_krs gk JOIN key_results kr ON kr.id = gk.kr_id WHERE gk.gap_id = g.id) AS kr_titles,
      (SELECT COUNT(*) FROM initiative_gaps ig WHERE ig.gap_id = g.id) AS initiative_count
    FROM gaps g
    JOIN capabilities c ON c.id = g.capability_id
    JOIN themes t ON t.id = g.theme_id
    ${where}
    ORDER BY CASE g.classification WHEN 'Måste' THEN 0 WHEN 'Bör' THEN 1 ELSE 2 END, g.id
  `).all(...(themeId ? [themeId] : [])) as Row[];
}

export function getGap(id: number): Row | undefined {
  return db().prepare(`
    SELECT g.*, c.name AS capability_name, t.name AS theme_name
    FROM gaps g JOIN capabilities c ON c.id = g.capability_id JOIN themes t ON t.id = g.theme_id
    WHERE g.id = ?
  `).get(id) as Row | undefined;
}

export function getGapDimensions(gapId: number): Row[] {
  return db().prepare("SELECT * FROM gap_dimensions WHERE gap_id = ?").all(gapId) as Row[];
}

export function getGapKrs(gapId: number): Row[] {
  return db().prepare("SELECT kr.* FROM gap_krs gk JOIN key_results kr ON kr.id = gk.kr_id WHERE gk.gap_id = ?").all(gapId) as Row[];
}

export function getGapDependencies(gapId: number): Row[] {
  return db().prepare(`
    SELECT d.*, g2.title AS depends_title, g2.id AS depends_id
    FROM gap_dependencies d JOIN gaps g2 ON g2.id = d.depends_on_gap_id
    WHERE d.gap_id = ?
  `).all(gapId) as Row[];
}

export function getAllGapDependencies(): Row[] {
  return db().prepare(`
    SELECT d.*, g1.title AS from_title, g2.title AS to_title, g1.theme_id AS from_theme, g2.theme_id AS to_theme
    FROM gap_dependencies d
    JOIN gaps g1 ON g1.id = d.gap_id
    JOIN gaps g2 ON g2.id = d.depends_on_gap_id
  `).all() as Row[];
}

export function getGapInitiatives(gapId: number): Row[] {
  return db().prepare(`
    SELECT i.*, o.short AS ou_short FROM initiative_gaps ig
    JOIN initiatives i ON i.id = ig.initiative_id JOIN ous o ON o.id = i.ou_id
    WHERE ig.gap_id = ?
  `).all(gapId) as Row[];
}

// ---------- Initiativ & roadmap ----------
/** Initiativ med härlett tema (via gap), WSJF-poäng och senaste status. */
export function getInitiatives(ouId?: number): Row[] {
  const where = ouId ? "WHERE i.ou_id = ?" : "";
  const rows = db().prepare(`
    SELECT i.*, o.name AS ou_name, o.short AS ou_short,
      (SELECT GROUP_CONCAT(DISTINCT g.theme_id) FROM initiative_gaps ig JOIN gaps g ON g.id = ig.gap_id WHERE ig.initiative_id = i.id) AS theme_ids,
      (SELECT GROUP_CONCAT(DISTINCT t.name) FROM initiative_gaps ig JOIN gaps g ON g.id = ig.gap_id JOIN themes t ON t.id = g.theme_id WHERE ig.initiative_id = i.id) AS theme_names,
      (SELECT MIN(t.priority_rank) FROM initiative_gaps ig JOIN gaps g ON g.id = ig.gap_id JOIN themes t ON t.id = g.theme_id WHERE ig.initiative_id = i.id) AS best_rank,
      (SELECT GROUP_CONCAT(g.title, ' • ') FROM initiative_gaps ig JOIN gaps g ON g.id = ig.gap_id WHERE ig.initiative_id = i.id) AS gap_titles,
      (SELECT CASE WHEN SUM(g.classification = 'Måste') > 0 THEN 'Måste'
                   WHEN SUM(g.classification = 'Bör') > 0 THEN 'Bör'
                   WHEN COUNT(*) > 0 THEN 'Kan' ELSE NULL END
         FROM initiative_gaps ig JOIN gaps g ON g.id = ig.gap_id WHERE ig.initiative_id = i.id) AS gap_class,
      (SELECT s.prognosis FROM status_reports s WHERE s.initiative_id = i.id ORDER BY s.month DESC LIMIT 1) AS prognosis,
      (SELECT s.month FROM status_reports s WHERE s.initiative_id = i.id ORDER BY s.month DESC LIMIT 1) AS last_report,
      (SELECT COUNT(*) FROM mirror_commitments mc WHERE mc.initiative_id = i.id) AS mirror_count
    FROM initiatives i JOIN ous o ON o.id = i.ou_id
    ${where}
    ORDER BY i.status = 'committed' DESC, i.start_quarter, i.id
  `).all(...(ouId ? [ouId] : [])) as Row[];
  for (const r of rows) r.wsjf = wsjf(r);
  return rows;
}

export function strategicMultiplier(bestRank: number | null): number {
  if (bestRank == null) return 0.8;
  return bestRank === 1 ? 1.2 : 1.0;
}

export function wsjf(i: Row): number {
  const mult = strategicMultiplier(i.best_rank ?? null);
  return Math.round(((i.business_value + i.time_criticality + i.risk_reduction) * mult / Math.max(0.5, i.job_size)) * 10) / 10;
}

export function getInitiative(id: number): Row | undefined {
  const r = db().prepare(`
    SELECT i.*, o.name AS ou_name, o.short AS ou_short FROM initiatives i JOIN ous o ON o.id = i.ou_id WHERE i.id = ?
  `).get(id) as Row | undefined;
  if (!r) return r;
  const d = db();
  r.gaps = d.prepare(`
    SELECT g.*, t.name AS theme_name, t.priority_rank FROM initiative_gaps ig
    JOIN gaps g ON g.id = ig.gap_id JOIN themes t ON t.id = g.theme_id WHERE ig.initiative_id = ?
  `).all(id);
  r.best_rank = (r.gaps as Row[]).reduce((m: number | null, g: Row) => g.priority_rank != null && (m == null || g.priority_rank < m) ? g.priority_rank : m, null);
  r.milestones = d.prepare("SELECT * FROM milestones WHERE initiative_id = ? ORDER BY due_quarter").all(id);
  r.resources = d.prepare(`
    SELECT r.*, c.name AS competence_name FROM initiative_resources r JOIN competences c ON c.id = r.competence_id
    WHERE r.initiative_id = ? ORDER BY r.quarter
  `).all(id);
  r.mirrors = d.prepare(`
    SELECT m.*, o.name AS ou_name, o.short AS ou_short, c.name AS competence_name
    FROM mirror_commitments m JOIN ous o ON o.id = m.ou_id LEFT JOIN competences c ON c.id = m.competence_id
    WHERE m.initiative_id = ?
  `).all(id);
  r.reports = d.prepare("SELECT * FROM status_reports WHERE initiative_id = ? ORDER BY month DESC").all(id);
  r.wsjf = wsjf(r);
  return r;
}

export function getMilestones(): Row[] {
  return db().prepare(`
    SELECT m.*, i.name AS initiative_name, i.ou_id FROM milestones m JOIN initiatives i ON i.id = m.initiative_id
  `).all() as Row[];
}

// ---------- Kapacitet ----------
/** Kapacitetsbild per OU: efterfrågan (egna initiativ + spegelposter) mot tillgänglig kapacitet. */
export function getCapacityView(ouId: number): Row[] {
  return db().prepare(`
    WITH demand AS (
      SELECT i.ou_id, r.competence_id, r.quarter, SUM(r.hours) AS hours
      FROM initiative_resources r JOIN initiatives i ON i.id = r.initiative_id
      GROUP BY i.ou_id, r.competence_id, r.quarter
    ), mirror AS (
      SELECT m.ou_id, m.competence_id, m.due_quarter AS quarter, SUM(m.hours) AS hours
      FROM mirror_commitments m WHERE m.competence_id IS NOT NULL
      GROUP BY m.ou_id, m.competence_id, m.due_quarter
    )
    SELECT cap.quarter, cap.hours AS available, c.name AS competence,
      COALESCE(d.hours, 0) + COALESCE(mi.hours, 0) AS demand
    FROM ou_capacity cap
    JOIN competences c ON c.id = cap.competence_id
    LEFT JOIN demand d ON d.ou_id = cap.ou_id AND d.competence_id = cap.competence_id AND d.quarter = cap.quarter
    LEFT JOIN mirror mi ON mi.ou_id = cap.ou_id AND mi.competence_id = cap.competence_id AND mi.quarter = cap.quarter
    WHERE cap.ou_id = ?
    ORDER BY c.name, cap.quarter
  `).all(ouId) as Row[];
}

/** Kompetenskonflikter över hela portföljen: kvartal × kompetens × OU där efterfrågan > 80 % av kapacitet. */
export function getCapacityBreaches(): Row[] {
  const d = db();
  const ous = d.prepare("SELECT * FROM ous").all() as Row[];
  const out: Row[] = [];
  for (const ou of ous) {
    for (const row of getCapacityView(ou.id)) {
      if (row.available > 0 && row.demand > 0.8 * row.available) {
        out.push({ ...row, ou_name: ou.name, ou_short: ou.short, pct: Math.round((row.demand / row.available) * 100) });
      }
    }
  }
  return out.sort((a, b) => b.pct - a.pct);
}

// ---------- Övrigt ----------
export function getOus(): Row[] {
  return db().prepare("SELECT * FROM ous ORDER BY id").all() as Row[];
}
export function getUsers(): Row[] {
  return db().prepare("SELECT u.*, o.short AS ou_short FROM users u LEFT JOIN ous o ON o.id = u.ou_id ORDER BY u.id").all() as Row[];
}
export function getCompetences(): Row[] {
  return db().prepare("SELECT * FROM competences ORDER BY name").all() as Row[];
}
export function getEscalations(onlyOpen = false): Row[] {
  return db().prepare(`
    SELECT e.*, o.short AS ou_short, i.name AS initiative_name
    FROM escalations e LEFT JOIN ous o ON o.id = e.ou_id LEFT JOIN initiatives i ON i.id = e.initiative_id
    ${onlyOpen ? "WHERE e.status = 'öppen'" : ""} ORDER BY e.status = 'öppen' DESC, e.id DESC
  `).all() as Row[];
}
export function getDecisions(themeId?: number): Row[] {
  const where = themeId ? "WHERE d.theme_id = ?" : "";
  return db().prepare(`
    SELECT d.*, t.name AS theme_name FROM decisions d LEFT JOIN themes t ON t.id = d.theme_id
    ${where} ORDER BY d.status = 'öppet' DESC, COALESCE(d.decided_at, d.created_at) DESC
  `).all(...(themeId ? [themeId] : [])) as Row[];
}
export function getDecisionAlternatives(decisionId: number): Row[] {
  return db().prepare("SELECT * FROM decision_alternatives WHERE decision_id = ?").all(decisionId) as Row[];
}
export function getStatusReports(month?: string): Row[] {
  const where = month ? "WHERE s.month = ?" : "";
  return db().prepare(`
    SELECT s.*, i.name AS initiative_name, o.short AS ou_short
    FROM status_reports s JOIN initiatives i ON i.id = s.initiative_id JOIN ous o ON o.id = i.ou_id
    ${where} ORDER BY s.month DESC, i.name
  `).all(...(month ? [month] : [])) as Row[];
}
export function getBenefits(themeId?: number): Row[] {
  const where = themeId ? "WHERE b.theme_id = ?" : "";
  return db().prepare(`
    SELECT b.*, t.name AS theme_name, i.name AS initiative_name, kr.title AS kr_title
    FROM benefits b
    JOIN themes t ON t.id = b.theme_id
    LEFT JOIN initiatives i ON i.id = b.initiative_id
    LEFT JOIN key_results kr ON kr.id = b.kr_id
    ${where} ORDER BY b.id
  `).all(...(themeId ? [themeId] : [])) as Row[];
}
