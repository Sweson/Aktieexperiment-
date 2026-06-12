import Link from "next/link";
import { notFound } from "next/navigation";
import { getInitiative, getOus, getCompetences } from "@/lib/queries";
import { strategicMultiplier } from "@/lib/queries";
import {
  updateInitiativeStatus, updateWsjf, addMilestone, updateMilestone,
  addResource, addMirror, updateMirrorStatus, addStatusReport,
} from "@/lib/actions";
import { Card, StatusBadge, ClassBadge, Rag, Empty } from "@/components/ui";
import { PLANNING_QUARTERS, fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

const MS_STATUS = ["ej påbörjad", "på plan", "risk", "försenad", "uppnådd"];

export default async function InitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = getInitiative(Number(id));
  if (!i) notFound();
  const ous = getOus();
  const competences = getCompetences();
  const mult = strategicMultiplier(i.best_rank ?? null);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            <Link href={`/roadmap?ou=${i.ou_id}`} className="hover:text-indigo-600">OU-roadmap ({i.ou_short})</Link> / Initiativkort
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{i.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Initiativägare: <strong>{i.owner || "ej utsedd"}</strong> · {i.start_quarter} – {i.end_quarter} ·
            Extern kostnad {fmt(i.ext_cost)} MSEK · Ägandemodell: {i.ownership === "tema" ? "temaägt (undantag)" : "värd-OU (huvudregel)"}
          </p>
        </div>
        <form action={updateInitiativeStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={i.id} />
          <select name="status" defaultValue={i.status} className="input !w-auto">
            <option>committed</option><option>planned</option><option>outlook</option>
          </select>
          <button className="btn-secondary">Uppdatera</button>
        </form>
      </header>

      <p className="text-sm text-slate-600">{i.description}</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Gap- och temakoppling" subtitle="Spårbarhet åt båda håll (designprincip 7)">
          {(i.gaps as any[]).length === 0 ? <Empty>Ingen gap-koppling – hör hemma i förvaltning eller idébacklog.</Empty> : (
            <ul className="space-y-2 text-sm">
              {(i.gaps as any[]).map((g) => (
                <li key={g.id} className="rounded-lg bg-slate-50 p-2.5">
                  <div className="flex items-center gap-2">
                    <ClassBadge c={g.classification} />
                    <Link href={`/gap/${g.id}`} className="font-medium text-indigo-700 hover:underline">{g.title}</Link>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Tema: {g.theme_name}</div>
                </li>
              ))}
            </ul>
          )}
          {i.benefit_logic && (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Nyttologik</span>
              <p className="mt-1">{i.benefit_logic}</p>
            </div>
          )}
        </Card>

        <Card title="Prioritering (justerad WSJF)" subtitle="(värde + tid + risk) × strategisk koppling / storlek. Modellen rangordnar – DEMT beslutar.">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-700">{i.wsjf}</span>
            <span className="text-xs text-slate-500">multiplikator ×{mult} ({i.best_rank ? `temarang ${i.best_rank}` : "utanför tema → 0,8"})</span>
          </div>
          <form action={updateWsjf} className="grid grid-cols-2 gap-2">
            <input type="hidden" name="id" value={i.id} />
            <div><label className="label">Affärsvärde/KR-bidrag</label><input name="business_value" type="number" min={1} max={10} defaultValue={i.business_value} className="input" /></div>
            <div><label className="label">Tidskritikalitet</label><input name="time_criticality" type="number" min={1} max={10} defaultValue={i.time_criticality} className="input" /></div>
            <div><label className="label">Risk/möjlighet</label><input name="risk_reduction" type="number" min={1} max={10} defaultValue={i.risk_reduction} className="input" /></div>
            <div><label className="label">Jobbstorlek</label><input name="job_size" type="number" min={0.5} step={0.5} defaultValue={i.job_size} className="input" /></div>
            <div className="col-span-2"><button className="btn-secondary">Räkna om</button></div>
          </form>
        </Card>

        <Card title="Resurser per kvartal" subtitle="Bemanning per kompetensområde – räknas in i OU:ns kapacitetsbild">
          {(i.resources as any[]).length === 0 ? <Empty>Inga resurser planerade.</Empty> : (
            <table className="w-full">
              <thead><tr className="border-b border-slate-200"><th className="th">Kompetens</th><th className="th">Kvartal</th><th className="th">Timmar</th></tr></thead>
              <tbody>
                {(i.resources as any[]).map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="td">{r.competence_name}</td><td className="td">{r.quarter}</td><td className="td">{fmt(r.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form action={addResource} className="mt-3 grid grid-cols-3 gap-2">
            <input type="hidden" name="initiative_id" value={i.id} />
            <select name="competence_id" className="input col-span-2">
              {competences.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select name="quarter" className="input">{PLANNING_QUARTERS.map((q) => <option key={q}>{q}</option>)}</select>
            <input name="hours" type="number" placeholder="timmar" className="input" />
            <button className="btn-secondary col-span-2">Lägg till / uppdatera</button>
          </form>
        </Card>
      </div>

      <Card title="Delmål" subtitle="Utfallsformulerade och verifierbara lägen – verifieras av oberoende part (temakoordinator för KR-nära delmål, OU-chef för övriga)">
        {(i.milestones as any[]).length === 0 ? <Empty>Inga delmål – 2–5 verifierbara delmål med måldatum krävs.</Empty> : (
          <div className="space-y-2">
            {(i.milestones as any[]).map((m) => (
              <details key={m.id} className="rounded-lg border border-slate-100 p-3">
                <summary className="flex items-center gap-3 text-sm">
                  <Rag rag={m.status === "uppnådd" ? "grön" : m.status === "risk" ? "gul" : m.status === "försenad" ? "röd" : "none"} label={m.status} />
                  <span className="flex-1 font-medium text-slate-800">{m.title}</span>
                  <span className="text-xs text-slate-400">{m.due_quarter}</span>
                  {m.verified_by && <span className="text-xs text-emerald-600">verifierad av {m.verified_by}</span>}
                </summary>
                {m.outcome && <p className="mt-2 text-xs text-slate-600">{m.outcome}</p>}
                <form action={updateMilestone} className="mt-3 grid grid-cols-4 gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <select name="status" defaultValue={m.status} className="input">{MS_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
                  <input name="verified_by" defaultValue={m.verified_by} placeholder="Verifierad av (oberoende part)" className="input" />
                  <input name="outcome" defaultValue={m.outcome} placeholder="Verifierat utfall (inte aktivitetsprocent)" className="input" />
                  <button className="btn-secondary">Spara</button>
                </form>
              </details>
            ))}
          </div>
        )}
        <form action={addMilestone} className="mt-3 grid grid-cols-4 gap-2">
          <input type="hidden" name="initiative_id" value={i.id} />
          <input name="title" required placeholder="Nytt delmål (utfallsformulerat läge)" className="input col-span-2" />
          <select name="due_quarter" className="input">{PLANNING_QUARTERS.map((q) => <option key={q}>{q}</option>)}</select>
          <button className="btn-secondary">Lägg till</button>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Delåtaganden (spegelposter)" subtitle="Ett initiativ – en ägare – en budget – en plan. Delåtaganden speglas i bidragande OU:ers roadmaps med samma initiativ-ID.">
          {(i.mirrors as any[]).length === 0 ? <Empty>Inga delåtaganden – initiativet är inte tvärorganisatoriskt.</Empty> : (
            <div className="space-y-2">
              {(i.mirrors as any[]).map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{m.ou_short}: {m.description}</span>
                    <StatusBadge s={m.status} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{m.due_quarter} · {m.competence_name ?? "–"} · {fmt(m.hours)} h</span>
                    <form action={updateMirrorStatus} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={m.id} />
                      <select name="status" defaultValue={m.status} className="input !w-auto !py-0.5 !text-xs">
                        <option>committed</option><option>planned</option><option>saknas</option>
                      </select>
                      <button className="btn-secondary !px-2 !py-0.5 !text-xs">OK</button>
                    </form>
                  </div>
                  {m.status !== "committed" && (
                    <p className="mt-1 text-xs text-amber-700">Initiativ med saknade speglar går inte till DEMT-beslut som committed.</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <details className="mt-3">
            <summary className="text-sm font-medium text-indigo-700">+ Nytt delåtagande</summary>
            <form action={addMirror} className="mt-2 grid grid-cols-2 gap-2">
              <input type="hidden" name="initiative_id" value={i.id} />
              <select name="ou_id" className="input">{ous.filter((o) => o.id !== i.ou_id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              <select name="due_quarter" className="input">{PLANNING_QUARTERS.map((q) => <option key={q}>{q}</option>)}</select>
              <input name="description" required placeholder="Namngiven delleverans" className="input col-span-2" />
              <select name="competence_id" className="input"><option value="">Kompetens…</option>{competences.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input name="hours" type="number" placeholder="timmar" className="input" />
              <select name="status" className="input"><option>planned</option><option>committed</option></select>
              <button className="btn-secondary">Lägg till</button>
            </form>
          </details>
        </Card>

        <Card title="Månadsstatus" subtitle="Rapportera prognos, inte historia – en röd prognos i mars är en gåva; en röd utfallsrapport i november är ett haveri">
          {(i.reports as any[]).length === 0 ? <Empty>Ingen månadsstatus rapporterad.</Empty> : (
            <div className="space-y-2">
              {(i.reports as any[]).map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{r.month}</span>
                    <Rag rag={r.prognosis} />
                  </div>
                  <p className="mt-1 text-slate-600">{r.summary}</p>
                  {r.decisions_needed && <p className="mt-1 text-xs text-amber-700"><strong>Beslut som behövs:</strong> {r.decisions_needed}</p>}
                  {r.lessons && <p className="mt-1 text-xs text-slate-500"><strong>Lärdom:</strong> {r.lessons}</p>}
                </div>
              ))}
            </div>
          )}
          <details className="mt-3">
            <summary className="text-sm font-medium text-indigo-700">+ Ny månadsrapport</summary>
            <form action={addStatusReport} className="mt-2 space-y-2">
              <input type="hidden" name="initiative_id" value={i.id} />
              <div className="grid grid-cols-2 gap-2">
                <input name="month" type="month" required className="input" />
                <select name="prognosis" className="input"><option>grön</option><option>gul</option><option>röd</option></select>
              </div>
              <textarea name="summary" rows={2} placeholder="Delmålsstatus med verifiering av utfall" className="input" />
              <input name="resource_state" placeholder="Resursläge (faktisk mot planerad bemanning)" className="input" />
              <input name="decisions_needed" placeholder="Beslut som behövs – till temaägare eller DEMT, med önskat datum" className="input" />
              <input name="lessons" placeholder="Lärdomar – vad bör påverka nästa kvartals planering" className="input" />
              <button className="btn-secondary">Rapportera</button>
            </form>
          </details>
        </Card>
      </div>
    </div>
  );
}
