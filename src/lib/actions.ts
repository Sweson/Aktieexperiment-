"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { DIMENSIONS } from "./format";

function s(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function n(fd: FormData, key: string, fallback = 0): number {
  const v = Number(fd.get(key));
  return Number.isFinite(v) ? v : fallback;
}
function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Steg 1: Teman & OKR ----------
export async function createTheme(fd: FormData) {
  const r = db().prepare(
    "INSERT INTO themes (name, objective, why_now, status) VALUES (?, ?, ?, 'utkast')"
  ).run(s(fd, "name"), s(fd, "objective"), s(fd, "why_now"));
  refresh();
  redirect(`/teman/${r.lastInsertRowid}`);
}

export async function updateTheme(fd: FormData) {
  db().prepare(`UPDATE themes SET name=?, objective=?, why_now=?, mandate=?, resources=?, priority_rank=?, owner_id=?, coordinator_id=? WHERE id=?`)
    .run(
      s(fd, "name"), s(fd, "objective"), s(fd, "why_now"), s(fd, "mandate"), s(fd, "resources"),
      fd.get("priority_rank") ? n(fd, "priority_rank") : null,
      fd.get("owner_id") ? n(fd, "owner_id") : null,
      fd.get("coordinator_id") ? n(fd, "coordinator_id") : null,
      n(fd, "id")
    );
  refresh();
}

export async function decideTheme(fd: FormData) {
  const id = n(fd, "id");
  const status = s(fd, "status");
  db().prepare("UPDATE themes SET status=?, decided_at=COALESCE(decided_at, date('now')) WHERE id=?").run(status, id);
  refresh();
}

export async function addKeyResult(fd: FormData) {
  db().prepare(`INSERT INTO key_results (theme_id, title, baseline, target, unit, deadline, source, frequency, is_customer_value, direction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(n(fd, "theme_id"), s(fd, "title"), n(fd, "baseline"), n(fd, "target"), s(fd, "unit"), s(fd, "deadline"),
      s(fd, "source"), s(fd, "frequency") || "Månadsvis", fd.get("is_customer_value") ? 1 : 0, s(fd, "direction") || "up");
  refresh();
}

export async function addMeasurement(fd: FormData) {
  db().prepare("INSERT INTO kr_measurements (kr_id, date, actual, forecast, rag, comment) VALUES (?, ?, ?, ?, ?, ?)")
    .run(n(fd, "kr_id"), s(fd, "date") || new Date().toISOString().slice(0, 10),
      fd.get("actual") ? n(fd, "actual") : null, fd.get("forecast") ? n(fd, "forecast") : null,
      s(fd, "rag") || "grön", s(fd, "comment"));
  refresh();
}

// ---------- Steg 3: Heatmap ----------
export async function setHeatmap(fd: FormData) {
  const themeId = n(fd, "theme_id");
  const capabilityId = n(fd, "capability_id");
  const criticality = s(fd, "criticality");
  const movement = s(fd, "movement");
  const toGap = fd.get("to_gap") ? 1 : 0;
  db().prepare(`INSERT INTO heatmap (theme_id, capability_id, criticality, movement, motivation, to_gap, exclusion_motive)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(theme_id, capability_id) DO UPDATE SET criticality=excluded.criticality, movement=excluded.movement,
      motivation=excluded.motivation, to_gap=excluded.to_gap, exclusion_motive=excluded.exclusion_motive`)
    .run(themeId, capabilityId, criticality, movement, s(fd, "motivation"), toGap, s(fd, "exclusion_motive"));
  refresh();
}

// ---------- Steg 4: Gap ----------
export async function createGap(fd: FormData) {
  const r = db().prepare("INSERT INTO gaps (theme_id, capability_id, title, description, classification) VALUES (?, ?, ?, ?, ?)")
    .run(n(fd, "theme_id"), n(fd, "capability_id"), s(fd, "title"), s(fd, "description"), s(fd, "classification") || "Bör");
  const gapId = Number(r.lastInsertRowid);
  for (const dim of DIMENSIONS) {
    const cur = fd.get(`cur_${dim}`);
    const tgt = fd.get(`tgt_${dim}`);
    const mot = s(fd, `mot_${dim}`);
    if (cur && tgt && Number(cur) > 0 && Number(tgt) > 0) {
      db().prepare("INSERT INTO gap_dimensions (gap_id, dimension, current, target, motivation) VALUES (?, ?, ?, ?, ?)")
        .run(gapId, dim, Number(cur), Number(tgt), mot);
    }
  }
  const krIds = fd.getAll("kr_ids").map(Number).filter(Boolean);
  for (const krId of krIds) db().prepare("INSERT OR IGNORE INTO gap_krs (gap_id, kr_id) VALUES (?, ?)").run(gapId, krId);
  refresh();
  redirect(`/gap/${gapId}`);
}

export async function updateGapClassification(fd: FormData) {
  db().prepare("UPDATE gaps SET classification=?, status=? WHERE id=?").run(s(fd, "classification"), s(fd, "status") || "öppet", n(fd, "id"));
  refresh();
}

export async function addGapDependency(fd: FormData) {
  db().prepare("INSERT INTO gap_dependencies (gap_id, depends_on_gap_id, note) VALUES (?, ?, ?)")
    .run(n(fd, "gap_id"), n(fd, "depends_on_gap_id"), s(fd, "note"));
  refresh();
}

// ---------- Steg 5: Initiativ & roadmap ----------
export async function createInitiative(fd: FormData) {
  const r = db().prepare(`INSERT INTO initiatives
    (name, ou_id, owner, description, status, start_quarter, end_quarter, ownership, ext_cost, business_value, time_criticality, risk_reduction, job_size, benefit_logic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(s(fd, "name"), n(fd, "ou_id"), s(fd, "owner"), s(fd, "description"), s(fd, "status") || "planned",
      s(fd, "start_quarter"), s(fd, "end_quarter"), s(fd, "ownership") || "ou", n(fd, "ext_cost"),
      n(fd, "business_value", 5), n(fd, "time_criticality", 5), n(fd, "risk_reduction", 5), n(fd, "job_size", 5),
      s(fd, "benefit_logic"));
  const id = Number(r.lastInsertRowid);
  for (const gapId of fd.getAll("gap_ids").map(Number).filter(Boolean)) {
    db().prepare("INSERT OR IGNORE INTO initiative_gaps (initiative_id, gap_id) VALUES (?, ?)").run(id, gapId);
  }
  refresh();
  redirect(`/initiativ/${id}`);
}

export async function updateInitiativeStatus(fd: FormData) {
  db().prepare("UPDATE initiatives SET status=? WHERE id=?").run(s(fd, "status"), n(fd, "id"));
  refresh();
}

export async function updateWsjf(fd: FormData) {
  db().prepare("UPDATE initiatives SET business_value=?, time_criticality=?, risk_reduction=?, job_size=? WHERE id=?")
    .run(n(fd, "business_value", 5), n(fd, "time_criticality", 5), n(fd, "risk_reduction", 5), n(fd, "job_size", 5), n(fd, "id"));
  refresh();
}

export async function addMilestone(fd: FormData) {
  db().prepare("INSERT INTO milestones (initiative_id, title, due_quarter) VALUES (?, ?, ?)")
    .run(n(fd, "initiative_id"), s(fd, "title"), s(fd, "due_quarter"));
  refresh();
}

export async function updateMilestone(fd: FormData) {
  db().prepare("UPDATE milestones SET status=?, verified_by=?, outcome=? WHERE id=?")
    .run(s(fd, "status"), s(fd, "verified_by"), s(fd, "outcome"), n(fd, "id"));
  refresh();
}

export async function addResource(fd: FormData) {
  db().prepare(`INSERT INTO initiative_resources (initiative_id, competence_id, quarter, hours) VALUES (?, ?, ?, ?)
    ON CONFLICT(initiative_id, competence_id, quarter) DO UPDATE SET hours = excluded.hours`)
    .run(n(fd, "initiative_id"), n(fd, "competence_id"), s(fd, "quarter"), n(fd, "hours"));
  refresh();
}

export async function addMirror(fd: FormData) {
  db().prepare("INSERT INTO mirror_commitments (initiative_id, ou_id, description, due_quarter, status, competence_id, hours) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(n(fd, "initiative_id"), n(fd, "ou_id"), s(fd, "description"), s(fd, "due_quarter"), s(fd, "status") || "planned",
      fd.get("competence_id") ? n(fd, "competence_id") : null, n(fd, "hours"));
  refresh();
}

export async function updateMirrorStatus(fd: FormData) {
  db().prepare("UPDATE mirror_commitments SET status=? WHERE id=?").run(s(fd, "status"), n(fd, "id"));
  refresh();
}

export async function addEscalation(fd: FormData) {
  db().prepare("INSERT INTO escalations (ou_id, initiative_id, title, description, quarter) VALUES (?, ?, ?, ?, ?)")
    .run(fd.get("ou_id") ? n(fd, "ou_id") : null, fd.get("initiative_id") ? n(fd, "initiative_id") : null,
      s(fd, "title"), s(fd, "description"), s(fd, "quarter"));
  refresh();
}

export async function resolveEscalation(fd: FormData) {
  db().prepare("UPDATE escalations SET status='löst', resolution=? WHERE id=?").run(s(fd, "resolution"), n(fd, "id"));
  refresh();
}

// ---------- Vägval ----------
export async function createDecision(fd: FormData) {
  const r = db().prepare("INSERT INTO decisions (theme_id, title, question, recommendation, forum) VALUES (?, ?, ?, ?, ?)")
    .run(fd.get("theme_id") ? n(fd, "theme_id") : null, s(fd, "title"), s(fd, "question"), s(fd, "recommendation"), s(fd, "forum") || "DEMT");
  const id = Number(r.lastInsertRowid);
  for (let i = 1; i <= 4; i++) {
    const name = s(fd, `alt${i}_name`);
    if (!name) continue;
    db().prepare("INSERT INTO decision_alternatives (decision_id, name, cost, kr_effect, risk, lead_time) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, name, s(fd, `alt${i}_cost`), s(fd, `alt${i}_kr`), s(fd, `alt${i}_risk`), s(fd, `alt${i}_time`));
  }
  refresh();
}

export async function decideDecision(fd: FormData) {
  const id = n(fd, "id");
  db().prepare("UPDATE decisions SET decision=?, decided_by=?, decided_at=date('now'), motive=?, review_conditions=?, status='beslutat' WHERE id=?")
    .run(s(fd, "decision"), s(fd, "decided_by"), s(fd, "motive"), s(fd, "review_conditions"), id);
  const chosen = fd.get("chosen_alternative");
  if (chosen) {
    db().prepare("UPDATE decision_alternatives SET chosen = (id = ?) WHERE decision_id = ?").run(Number(chosen), id);
  }
  refresh();
}

// ---------- Steg 7: Status, nytta ----------
export async function addStatusReport(fd: FormData) {
  db().prepare(`INSERT INTO status_reports (initiative_id, month, summary, prognosis, resource_state, decisions_needed, lessons)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(initiative_id, month) DO UPDATE SET summary=excluded.summary, prognosis=excluded.prognosis,
      resource_state=excluded.resource_state, decisions_needed=excluded.decisions_needed, lessons=excluded.lessons`)
    .run(n(fd, "initiative_id"), s(fd, "month"), s(fd, "summary"), s(fd, "prognosis") || "grön",
      s(fd, "resource_state"), s(fd, "decisions_needed"), s(fd, "lessons"));
  refresh();
}

export async function addBenefit(fd: FormData) {
  db().prepare("INSERT INTO benefits (theme_id, initiative_id, kr_id, description, owner, action, baseline, measure_point, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ej påbörjad')")
    .run(n(fd, "theme_id"), fd.get("initiative_id") ? n(fd, "initiative_id") : null, fd.get("kr_id") ? n(fd, "kr_id") : null,
      s(fd, "description"), s(fd, "owner"), s(fd, "action"), s(fd, "baseline"), s(fd, "measure_point"));
  refresh();
}

export async function updateBenefitStatus(fd: FormData) {
  db().prepare("UPDATE benefits SET status=? WHERE id=?").run(s(fd, "status"), n(fd, "id"));
  refresh();
}
