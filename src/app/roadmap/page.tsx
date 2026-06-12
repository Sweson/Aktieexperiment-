import Link from "next/link";
import { getOus, getInitiatives, getCapacityView, getEscalations, getGaps, getCompetences, getMilestones } from "@/lib/queries";
import { createInitiative, addEscalation } from "@/lib/actions";
import { Card, StatusBadge, ClassBadge, Empty, Rag } from "@/components/ui";
import { GanttRow, CapacityBar } from "@/components/charts";
import { PLANNING_QUARTERS, fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ ou?: string }> }) {
  const sp = await searchParams;
  const ous = getOus();
  const ouId = sp.ou ? Number(sp.ou) : ous[0].id;
  const ou = ous.find((o) => o.id === ouId)!;
  const inits = getInitiatives(ouId);
  const capacity = getCapacityView(ouId);
  const escalations = getEscalations().filter((e) => e.ou_id === ouId);
  const gaps = getGaps().filter((g) => g.status === "öppet");
  const competences = getCompetences();
  const milestones = getMilestones().filter((m) => m.ou_id === ouId);
  const quarters = PLANNING_QUARTERS;

  const byCompetence = new Map<string, typeof capacity>();
  for (const row of capacity) {
    if (!byCompetence.has(row.competence)) byCompetence.set(row.competence, []);
    byCompetence.get(row.competence)!.push(row);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">OU-roadmap</h1>
        <p className="mt-1 text-sm text-slate-500">
          Steg 5 · Organisationsenhetens tidsatta åtagande mot temana. Horisonter: committed (2 kv) · planned (kv 3–4) ·
          outlook (&gt;12 mån). En roadmap utan kapacitetsbild är en önskelista.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {ous.map((o) => (
          <Link key={o.id} href={`/roadmap?ou=${o.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${o.id === ouId ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50"}`}>
            {o.name}
          </Link>
        ))}
      </div>

      <Card title={`Roadmap – ${ou.name}`} subtitle="Romber är delmål: vit = ej påbörjad/på plan · grön = uppnådd · gul = risk · röd = försenad">
        {inits.length === 0 ? <Empty>Inga initiativ i denna OU:s roadmap.</Empty> : (
          <div>
            <div className="mb-1 grid pl-72" style={{ gridTemplateColumns: `repeat(${quarters.length}, 1fr)` }}>
              {quarters.map((q) => <div key={q} className="text-center text-xs font-semibold text-slate-500">{q}</div>)}
            </div>
            <div className="space-y-1">
              {inits.map((i) => (
                <div key={i.id} className="flex items-center rounded-lg hover:bg-slate-50">
                  <div className="w-72 shrink-0 py-1 pr-3">
                    <Link href={`/initiativ/${i.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-700">{i.name}</Link>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <StatusBadge s={i.status} />
                      {i.gap_class && <ClassBadge c={i.gap_class} />}
                      {i.mirror_count > 0 && <span title="Tvärorganisatoriskt initiativ med delåtaganden">⇄ {i.mirror_count} speglar</span>}
                      <span>WSJF {i.wsjf}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <GanttRow quarters={quarters} start={i.start_quarter} end={i.end_quarter} status={i.status}
                      milestones={milestones.filter((m) => m.initiative_id === i.id) as any} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Kapacitetsbild – roadmapens sanningstest"
          subtitle="Efterfrågan (egna initiativ + spegelposter) mot kapacitet. Grå markering = 80-procentsregeln, röd = 100 %.">
          {byCompetence.size === 0 ? <Empty>Ingen kapacitetsdata för OU:n.</Empty> : (
            <div className="space-y-4">
              {[...byCompetence.entries()].map(([comp, rows]) => (
                <div key={comp}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm font-medium text-slate-700">{comp}</span>
                    <span className="text-xs text-slate-400">{fmt(rows[0].available)} h/kvartal tillgängligt</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {rows.map((r) => (
                      <div key={r.quarter}>
                        <CapacityBar demand={r.demand} available={r.available} />
                        <div className="mt-0.5 text-center text-[10px] text-slate-400">{r.quarter}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">
                Planera aldrig mer än 80 % av förändringskapaciteten – resten konsumeras av det oplanerade.
                Vid överefterfrågan föreslår OU-chefen prioritetsordning enligt temarangordningen och listar vad som föreslås utgå.
              </p>
            </div>
          )}
        </Card>

        <Card title="Eskalationslista" subtitle="Behov av stöd, beslut eller resurser utanför egen ram – input till konsolideringen (steg 6)">
          {escalations.length === 0 ? <Empty>Inga eskaleringar.</Empty> : (
            <ul className="space-y-2">
              {escalations.map((e) => (
                <li key={e.id} className={`rounded-lg border p-3 text-sm ${e.status === "öppen" ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{e.title}</span>
                    <Rag rag={e.status === "öppen" ? "gul" : "grön"} label={e.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{e.description}</p>
                  {e.resolution && <p className="mt-1 text-xs text-emerald-700"><strong>Beslut:</strong> {e.resolution}</p>}
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3">
            <summary className="text-sm font-medium text-indigo-700">+ Eskalera till konsolideringen</summary>
            <form action={addEscalation} className="mt-2 space-y-2">
              <input type="hidden" name="ou_id" value={ouId} />
              <input name="title" required placeholder="Rubrik (t.ex. nyckelkompetens över 100 %)" className="input" />
              <textarea name="description" rows={2} placeholder="Beskrivning och förslag" className="input" />
              <input name="quarter" placeholder="Kvartal (2026-Q4)" className="input" />
              <button className="btn-secondary">Eskalera</button>
            </form>
          </details>
        </Card>
      </div>

      <Card title="Nytt initiativ" subtitle="Designregler: gap-koppling obligatorisk · skär i värdesteg (capability increments) · blanda dimensionerna · delmål är utfall">
        <form action={createInitiative} className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="ou_id" value={ouId} />
          <div className="md:col-span-2">
            <label className="label">Namn (beskriver förflyttningen, inte systemet)</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Initiativägare (en person, inte en funktion)</label>
            <input name="owner" className="input" />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input"><option>planned</option><option>committed</option><option>outlook</option></select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Gap-koppling (obligatorisk – initiativ utan gap hör hemma i förvaltning/idébacklog)</label>
            <select name="gap_ids" multiple size={4} required className="input">
              {gaps.map((g) => <option key={g.id} value={g.id}>[{g.classification}] {g.title} ({g.theme_name})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Start</label>
            <select name="start_quarter" className="input">{PLANNING_QUARTERS.map((q) => <option key={q}>{q}</option>)}</select>
          </div>
          <div>
            <label className="label">Slut</label>
            <select name="end_quarter" className="input" defaultValue={PLANNING_QUARTERS[1]}>{PLANNING_QUARTERS.map((q) => <option key={q}>{q}</option>)}</select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Beskrivning (increments som vart och ett ger mätbar nytta)</label>
            <textarea name="description" rows={2} className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Nyttologik (förväntad effekt på berörda Key Results, kvantifierad där det går)</label>
            <textarea name="benefit_logic" rows={2} className="input" />
          </div>
          <div><label className="label">Affärsvärde/KR-bidrag (1–10)</label><input name="business_value" type="number" min={1} max={10} defaultValue={5} className="input" /></div>
          <div><label className="label">Tidskritikalitet (1–10)</label><input name="time_criticality" type="number" min={1} max={10} defaultValue={5} className="input" /></div>
          <div><label className="label">Risk-/möjlighetsreduktion (1–10)</label><input name="risk_reduction" type="number" min={1} max={10} defaultValue={5} className="input" /></div>
          <div><label className="label">Jobbstorlek (relativ)</label><input name="job_size" type="number" min={1} max={20} step="0.5" defaultValue={5} className="input" /></div>
          <div><label className="label">Extern kostnad (MSEK)</label><input name="ext_cost" type="number" step="0.1" defaultValue={0} className="input" /></div>
          <div className="flex items-end"><button className="btn">Skapa initiativkort</button></div>
        </form>
      </Card>
    </div>
  );
}
