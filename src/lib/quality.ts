import { db } from "./db";
import {
  getThemes, getKrsWithLatest, getHeatmap, getGaps, getInitiatives,
  getCapacityBreaches, getEscalations, Row,
} from "./queries";

export type Check = { ok: boolean; label: string; detail?: string };
export type StepChecks = { step: string; title: string; checks: Check[] };

const ACTIVITY_WORDS = ["infört", "inför", "lanserat", "lansera", "genomfört", "genomföra", "implementerat", "implementera", "levererat", "etablerat"];

/** Kvalitetsmotorn: handbokens checklistor (bilaga D) utvärderade mot databasens faktiska läge. */
export function runQualityChecks(): StepChecks[] {
  const d = db();
  const themes = getThemes().filter((t) => t.status === "beslutad");
  const krs = getKrsWithLatest();
  const out: StepChecks[] = [];

  // ---- Steg 1 ----
  const s1: Check[] = [];
  s1.push({
    ok: themes.length <= 5 && themes.length >= 1,
    label: "Högst fem beslutade teman (få teman, hård prioritering)",
    detail: `${themes.length} beslutade teman`,
  });
  const incompleteKrs = krs.filter((k) => !k.deadline || !k.source || k.baseline === k.target);
  s1.push({
    ok: incompleteKrs.length === 0,
    label: "Varje KR har basvärde, målvärde, tidpunkt och mätkälla",
    detail: incompleteKrs.length ? `${incompleteKrs.length} KR saknar attribut` : "Alla KR kompletta",
  });
  const themesNoCustomer = themes.filter((t) => !krs.some((k) => k.theme_id === t.id && k.is_customer_value));
  s1.push({
    ok: themesNoCustomer.length === 0,
    label: "Minst ett kund-/samhällsvärdes-KR per tema",
    detail: themesNoCustomer.length ? `Saknas för: ${themesNoCustomer.map((t) => t.name).join(", ")}` : undefined,
  });
  const activityKrs = krs.filter((k) => ACTIVITY_WORDS.some((w) => String(k.title).toLowerCase().includes(w)));
  s1.push({
    ok: activityKrs.length === 0,
    label: "Inga aktivitets-KR ('infört', 'lanserat', 'genomfört' mäter aktivitet – inte utfall)",
    detail: activityKrs.length ? `Misstänkta: ${activityKrs.map((k) => k.title).join("; ")}` : undefined,
  });
  out.push({ step: "1", title: "Strategiska teman med mätbara mål", checks: s1 });

  // ---- Steg 2 ----
  const s2: Check[] = [];
  const noOwner = themes.filter((t) => !t.owner_id);
  s2.push({ ok: noOwner.length === 0, label: "Namngiven DEMT-ägare per tema", detail: noOwner.length ? `Saknas: ${noOwner.map((t) => t.name).join(", ")}` : undefined });
  const noCoord = themes.filter((t) => !t.coordinator_id);
  s2.push({ ok: noCoord.length === 0, label: "Temakoordinator utsedd per tema", detail: noCoord.length ? `Saknas: ${noCoord.map((t) => t.name).join(", ")}` : undefined });
  const noMandate = themes.filter((t) => !t.mandate);
  s2.push({ ok: noMandate.length === 0, label: "Mandatkort beslutat (mandat, resurser, prioritet)", detail: noMandate.length ? `Saknas: ${noMandate.map((t) => t.name).join(", ")}` : undefined });
  const ranks = themes.map((t) => t.priority_rank).filter((r) => r != null);
  s2.push({ ok: ranks.length === themes.length && new Set(ranks).size === ranks.length, label: "Temarangordning beslutad och unik" });
  const ownerCount: Record<number, number> = {};
  for (const t of themes) if (t.owner_id) ownerCount[t.owner_id] = (ownerCount[t.owner_id] || 0) + 1;
  s2.push({ ok: !Object.values(ownerCount).some((n) => n > 2), label: "Ingen DEMT-medlem äger fler än två teman" });
  out.push({ step: "2", title: "Temaägare med mandat, resurser och prioritet", checks: s2 });

  // ---- Steg 3 ----
  const s3: Check[] = [];
  for (const t of themes) {
    const hm = getHeatmap(t.id);
    const toGap = hm.filter((h) => h.to_gap);
    s3.push({
      ok: toGap.length <= 8 && toGap.length > 0,
      label: `${t.name}: max 8 förmågor till gap-analys`,
      detail: `${toGap.length} utvalda`,
    });
    const krsT = krs.filter((k) => k.theme_id === t.id);
    const critical = hm.filter((h) => h.criticality === "Kritisk");
    s3.push({
      ok: critical.length > 0 || krsT.length === 0,
      label: `${t.name}: varje KR har minst en Kritisk-klassad bärare`,
      detail: critical.length ? `${critical.length} kritiska förmågor` : "Inga kritiska förmågor – temats genomförbarhet ska ifrågasättas",
    });
    const excludedNoMotive = hm.filter((h) => !h.to_gap && h.criticality !== "Ingen" && !h.exclusion_motive && !h.motivation);
    s3.push({
      ok: excludedNoMotive.length === 0,
      label: `${t.name}: avgränsning dokumenterad med motiv`,
      detail: excludedNoMotive.length ? `${excludedNoMotive.length} bortvalda förmågor utan motiv` : undefined,
    });
  }
  out.push({ step: "3", title: "Påverkansanalys och heatmapping", checks: s3 });

  // ---- Steg 4 ----
  const s4: Check[] = [];
  const gaps = getGaps();
  const musteNoKr = gaps.filter((g) => g.classification === "Måste" && !g.kr_titles);
  s4.push({
    ok: musteNoKr.length === 0,
    label: "Varje Måste-gap är spårbart till minst ett Key Result eller regelkrav",
    detail: musteNoKr.length ? `Utan spårbarhet: ${musteNoKr.map((g) => g.title).join("; ")}` : `${gaps.filter((g) => g.classification === "Måste").length} Måste-gap spårbara`,
  });
  const dimCount = d.prepare("SELECT gap_id, COUNT(*) AS n FROM gap_dimensions GROUP BY gap_id").all() as Row[];
  const gapsNoDims = gaps.filter((g) => !dimCount.find((x) => x.gap_id === g.id));
  s4.push({
    ok: gapsNoDims.length === 0,
    label: "Mognadsbedömning per dimension med motivering finns för varje gap",
    detail: gapsNoDims.length ? `Saknas för: ${gapsNoDims.map((g) => g.title).join("; ")}` : undefined,
  });
  const solutionWords = ["system ", "plattformen", "upphandla", "köpa in"];
  const polluted = gaps.filter((g) => solutionWords.some((w) => String(g.title).toLowerCase().includes(w)));
  s4.push({
    ok: polluted.length === 0,
    label: "Gap är lösningsneutralt formulerade (förmågebrist – inte systemkrav)",
    detail: polluted.length ? `Misstänkt lösningssmitta: ${polluted.map((g) => g.title).join("; ")}` : undefined,
  });
  out.push({ step: "4", title: "Gap-analys", checks: s4 });

  // ---- Steg 5 ----
  const s5: Check[] = [];
  const inits = getInitiatives();
  const musteGaps = gaps.filter((g) => g.classification === "Måste" && g.status === "öppet");
  const escs = getEscalations();
  const unaddressed = musteGaps.filter((g) => g.initiative_count === 0 && !escs.some((e) => e.description?.includes(g.title)));
  s5.push({
    ok: unaddressed.length === 0,
    label: "Alla Måste-gap är adresserade av initiativ eller eskalerade med motiv",
    detail: unaddressed.length ? `Oadresserade: ${unaddressed.map((g) => g.title).join("; ")}` : `${musteGaps.length} Måste-gap täckta`,
  });
  const noGapLink = inits.filter((i) => !i.theme_ids);
  s5.push({
    ok: noGapLink.length === 0,
    label: "Inga initiativ utan gap-koppling (annars: förvaltning eller idébacklog)",
    detail: noGapLink.length ? `Utan koppling: ${noGapLink.map((i) => i.name).join("; ")}` : undefined,
  });
  const breaches = getCapacityBreaches().filter((b) => b.pct > 80);
  s5.push({
    ok: breaches.length === 0,
    label: "Kapacitetsbild ≤ 80 % planeringsgrad per kompetens och kvartal",
    detail: breaches.length ? breaches.slice(0, 4).map((b) => `${b.ou_short} ${b.competence} ${b.quarter}: ${b.pct} %`).join("; ") : undefined,
  });
  const milestonesActivity = (d.prepare("SELECT * FROM milestones").all() as Row[]).filter((m) =>
    ["workshop", "möte genomfört", "utbildning genomförd"].some((w) => String(m.title).toLowerCase().includes(w)));
  s5.push({
    ok: milestonesActivity.length === 0,
    label: "Delmål är utfallsformulerade och verifierbara (inte aktiviteter)",
    detail: milestonesActivity.length ? `Misstänkta aktivitetsdelmål: ${milestonesActivity.map((m) => m.title).join("; ")}` : undefined,
  });
  out.push({ step: "5", title: "OU-roadmap", checks: s5 });

  // ---- Steg 6 ----
  const s6: Check[] = [];
  const coverage = getKrCoverage();
  const uncovered = coverage.filter((c) => c.committed === 0);
  s6.push({
    ok: uncovered.length === 0,
    label: "Varje KR har minst en committed-bärare eller dokumenterat DEMT-beslut om justerad ambition",
    detail: uncovered.length ? `Utan committed-bärare: ${uncovered.map((c) => c.title).join("; ")}` : undefined,
  });
  const openEsc = escs.filter((e) => e.status === "öppen");
  s6.push({
    ok: openEsc.length === 0,
    label: "Alla eskalerade konflikter har beslut före PI-planering",
    detail: openEsc.length ? `${openEsc.length} öppna eskaleringar` : undefined,
  });
  const mirrors = getMirrorIssues();
  s6.push({
    ok: mirrors.length === 0,
    label: "Spegelkonsistens: tvärorganisatoriska initiativ har kompletta, resurssatta delåtaganden",
    detail: mirrors.length ? mirrors.map((m) => `${m.initiative_name}: ${m.issue}`).join("; ") : undefined,
  });
  out.push({ step: "6", title: "Konsoliderad roadmap och DEMT-beslut", checks: s6 });

  // ---- Steg 7 ----
  const s7: Check[] = [];
  const committed = inits.filter((i) => i.status === "committed");
  const noReport = committed.filter((i) => !i.last_report);
  s7.push({
    ok: noReport.length === 0,
    label: "100 % av committed-initiativ har månadsstatus i portföljverktyget",
    detail: noReport.length ? `Saknar status: ${noReport.map((i) => i.name).join("; ")}` : `${committed.length}/${committed.length} rapporterar`,
  });
  const achievedUnverified = (d.prepare("SELECT * FROM milestones WHERE status = 'uppnådd' AND (verified_by IS NULL OR verified_by = '')").all() as Row[]);
  s7.push({
    ok: achievedUnverified.length === 0,
    label: "Uppnådda delmål är verifierade som utfall av oberoende part",
    detail: achievedUnverified.length ? `Overifierade: ${achievedUnverified.map((m) => m.title).join("; ")}` : undefined,
  });
  const benefitsNoOwner = (d.prepare("SELECT * FROM benefits WHERE owner IS NULL OR owner = ''").all() as Row[]);
  s7.push({
    ok: benefitsNoOwner.length === 0,
    label: "Nyttohemtagning har namngiven ägare i linjen",
    detail: benefitsNoOwner.length ? `${benefitsNoOwner.length} nyttoposter utan ägare` : undefined,
  });
  out.push({ step: "7", title: "Realisering och uppföljning", checks: s7 });

  return out;
}

/** Täckningsanalys: committed/planned-bärare per KR (via gap → initiativ). */
export function getKrCoverage(): Row[] {
  return db().prepare(`
    SELECT kr.id, kr.title, kr.theme_id, t.name AS theme_name,
      (SELECT COUNT(DISTINCT i.id) FROM gap_krs gk
        JOIN initiative_gaps ig ON ig.gap_id = gk.gap_id
        JOIN initiatives i ON i.id = ig.initiative_id
        WHERE gk.kr_id = kr.id AND i.status = 'committed') AS committed,
      (SELECT COUNT(DISTINCT i.id) FROM gap_krs gk
        JOIN initiative_gaps ig ON ig.gap_id = gk.gap_id
        JOIN initiatives i ON i.id = ig.initiative_id
        WHERE gk.kr_id = kr.id AND i.status = 'planned') AS planned,
      (SELECT GROUP_CONCAT(DISTINCT i.name) FROM gap_krs gk
        JOIN initiative_gaps ig ON ig.gap_id = gk.gap_id
        JOIN initiatives i ON i.id = ig.initiative_id
        WHERE gk.kr_id = kr.id) AS bearers
    FROM key_results kr JOIN themes t ON t.id = kr.theme_id
    WHERE t.status = 'beslutad'
    ORDER BY t.priority_rank, kr.id
  `).all() as Row[];
}

/** Spegelkonsistensanalys (analys 5 i steg 6). */
export function getMirrorIssues(): Row[] {
  const d = db();
  const issues: Row[] = [];
  const inits = d.prepare(`
    SELECT i.*, (SELECT COUNT(*) FROM mirror_commitments m WHERE m.initiative_id = i.id) AS mirror_count
    FROM initiatives i WHERE i.status = 'committed'
  `).all() as Row[];
  for (const i of inits) {
    const mirrors = d.prepare("SELECT m.*, o.short AS ou_short FROM mirror_commitments m JOIN ous o ON o.id = m.ou_id WHERE m.initiative_id = ?").all(i.id) as Row[];
    for (const m of mirrors) {
      if (m.status !== "committed") issues.push({ initiative_id: i.id, initiative_name: i.name, issue: `delåtagande hos ${m.ou_short} är '${m.status}' – inte committed` });
      if (!m.hours || m.hours <= 0) issues.push({ initiative_id: i.id, initiative_name: i.name, issue: `delåtagande hos ${m.ou_short} saknar resurssättning` });
    }
  }
  return issues;
}

/** Dubblett- och synergianalys: gap som adresseras av flera initiativ (kandidater för ihopslagning/sekvensering). */
export function getDuplicateCandidates(): Row[] {
  return db().prepare(`
    SELECT g.id, g.title, g.classification, COUNT(DISTINCT ig.initiative_id) AS n,
      GROUP_CONCAT(DISTINCT i.name) AS initiative_names,
      COUNT(DISTINCT i.ou_id) AS ou_count
    FROM gaps g
    JOIN initiative_gaps ig ON ig.gap_id = g.id
    JOIN initiatives i ON i.id = ig.initiative_id
    GROUP BY g.id HAVING n > 1
    ORDER BY n DESC
  `).all() as Row[];
}

/** Ram- och guardrailanalys: extern kostnad per tema. */
export function getCostByTheme(): Row[] {
  return db().prepare(`
    SELECT t.id, t.name, t.priority_rank,
      SUM(CASE WHEN i.status = 'committed' THEN i.ext_cost ELSE 0 END) AS committed_cost,
      SUM(CASE WHEN i.status = 'planned' THEN i.ext_cost ELSE 0 END) AS planned_cost
    FROM themes t
    LEFT JOIN gaps g ON g.theme_id = t.id
    LEFT JOIN initiative_gaps ig ON ig.gap_id = g.id
    LEFT JOIN initiatives i ON i.id = ig.initiative_id
    WHERE t.status = 'beslutad'
    GROUP BY t.id ORDER BY t.priority_rank
  `).all() as Row[];
}

/** Navets larmlista: allt som kräver uppmärksamhet just nu. */
export function getAlerts(): Row[] {
  const alerts: Row[] = [];
  for (const kr of getKrsWithLatest()) {
    if (kr.rag === "röd") alerts.push({ kind: "KR", level: "röd", text: `Röd prognos: ${kr.title} (${kr.theme_name}) – kräver DEMT-beslut: förstärk, justera eller avveckla.`, href: `/teman/${kr.theme_id}` });
    else if (kr.rag === "gul") alerts.push({ kind: "KR", level: "gul", text: `Gul prognos: ${kr.title} (${kr.theme_name}) – åtgärdsplan krävs av temaägaren.`, href: `/teman/${kr.theme_id}` });
  }
  for (const c of getKrCoverage()) {
    if (c.committed === 0) alerts.push({ kind: "Täckning", level: "röd", text: `KR utan committed-bärare: ${c.title} (${c.theme_name}).`, href: "/konsolidering" });
  }
  for (const b of getCapacityBreaches()) {
    if (b.pct > 100) alerts.push({ kind: "Kapacitet", level: "röd", text: `${b.ou_short}: ${b.competence} ${b.quarter} på ${b.pct} % av kapacitet.`, href: "/roadmap" });
    else alerts.push({ kind: "Kapacitet", level: "gul", text: `${b.ou_short}: ${b.competence} ${b.quarter} på ${b.pct} % (> 80-procentsregeln).`, href: "/roadmap" });
  }
  for (const e of getEscalations(true)) {
    alerts.push({ kind: "Eskalering", level: "gul", text: `Öppen eskalering: ${e.title}`, href: "/konsolidering" });
  }
  for (const m of getMirrorIssues()) {
    alerts.push({ kind: "Spegel", level: "gul", text: `Spegelkonsistens: ${m.initiative_name} – ${m.issue}.`, href: `/initiativ/${m.initiative_id}` });
  }
  const order = { röd: 0, gul: 1 } as Record<string, number>;
  return alerts.sort((a, b) => (order[a.level] ?? 2) - (order[b.level] ?? 2));
}
