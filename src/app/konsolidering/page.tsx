import Link from "next/link";
import { getInitiatives, getThemes, getEscalations, getCapacityBreaches, getAllGapDependencies } from "@/lib/queries";
import { getKrCoverage, getMirrorIssues, getDuplicateCandidates, getCostByTheme } from "@/lib/quality";
import { resolveEscalation, updateInitiativeStatus } from "@/lib/actions";
import { Card, StatusBadge, Rag, Empty, CheckIcon } from "@/components/ui";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function ConsolidationPage() {
  const themes = getThemes().filter((t) => t.status === "beslutad");
  const inits = getInitiatives().sort((a, b) => b.wsjf - a.wsjf);
  const coverage = getKrCoverage();
  const breaches = getCapacityBreaches();
  const mirrorIssues = getMirrorIssues();
  const duplicates = getDuplicateCandidates();
  const costs = getCostByTheme();
  const escalations = getEscalations();
  const crossThemeDeps = getAllGapDependencies().filter((d) => d.from_theme !== d.to_theme);

  const uncovered = coverage.filter((c) => c.committed === 0);
  const totalCost = costs.reduce((s, c) => s + (c.committed_cost ?? 0) + (c.planned_cost ?? 0), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Konsoliderad roadmap & DEMT-beslut</h1>
        <p className="mt-1 text-sm text-slate-500">
          Steg 6 · Här prövas helheten: täcker initiativen temats Key Results? Var krockar OU:erna om kapacitet?
          Tidslinje inför kvartal: roadmapforum (v-6) → konsolidering (v-4) → DEMT-beslut (v-3) → PI-planering (v-0).
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          { n: 1, t: "Täckningsanalys", ok: uncovered.length === 0, d: uncovered.length ? `${uncovered.length} KR utan committed-bärare` : "Alla KR har bärare" },
          { n: 2, t: "Konfliktanalys", ok: breaches.filter((b) => b.pct > 100).length === 0, d: `${breaches.length} kapacitetsflaggor` },
          { n: 3, t: "Dubblett & synergi", ok: true, d: `${duplicates.length} delade gap att pröva` },
          { n: 4, t: "Ram & guardrails", ok: true, d: `${fmt(totalCost)} MSEK i plan` },
          { n: 5, t: "Spegelkonsistens", ok: mirrorIssues.length === 0, d: mirrorIssues.length ? `${mirrorIssues.length} avvikelser` : "Alla speglar kompletta" },
        ].map((a) => (
          <div key={a.n} className="card flex items-start gap-3 p-4">
            <CheckIcon ok={a.ok} />
            <div>
              <div className="text-sm font-semibold text-slate-800">{a.n}. {a.t}</div>
              <div className="text-xs text-slate-500">{a.d}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="1 · Täckningsanalys" subtitle="KR utan bärare är en lucka temaägaren måste adressera: nytt initiativ, sänkt ambition eller förlängd tidshorisont">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th">Key Result</th><th className="th">Committed</th><th className="th">Planned</th></tr></thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.id} className={`border-b border-slate-100 ${c.committed === 0 ? "bg-rose-50/50" : ""}`}>
                  <td className="td">
                    <span className={c.committed === 0 ? "font-medium text-rose-700" : "text-slate-700"}>{c.title}</span>
                    <span className="block text-xs text-slate-400">{c.theme_name}</span>
                  </td>
                  <td className="td font-semibold">{c.committed}</td>
                  <td className="td text-slate-500">{c.planned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="2 · Konfliktanalys" subtitle="Samma nyckelkompetens, samma systemmiljö, samma förändringsmottagare, samma leverantör">
          {breaches.length === 0 ? <Empty>Inga kapacitetskonflikter.</Empty> : (
            <table className="w-full">
              <thead><tr className="border-b border-slate-200"><th className="th">OU</th><th className="th">Kompetens</th><th className="th">Kvartal</th><th className="th">Belastning</th></tr></thead>
              <tbody>
                {breaches.map((b, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="td">{b.ou_short}</td>
                    <td className="td font-medium text-slate-700">{b.competence}</td>
                    <td className="td">{b.quarter}</td>
                    <td className="td"><Rag rag={b.pct > 100 ? "röd" : "gul"} label={`${b.pct} %`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {crossThemeDeps.length > 0 && (
            <div className="mt-3 rounded-lg bg-violet-50 p-3 text-xs text-violet-800">
              <strong>Beroenden tvärs teman:</strong> {crossThemeDeps.map((d) => `${d.from_title} → ${d.to_title}`).join(" · ")}
            </div>
          )}
        </Card>

        <Card title="3 · Dubblett- och synergianalys" subtitle="Initiativ som löser samma gap slås ihop eller sekvenseras; delade plattformsbehov blir enabler-initiativ">
          {duplicates.length === 0 ? <Empty>Inga dubblettkandidater.</Empty> : (
            <ul className="space-y-2 text-sm">
              {duplicates.map((d) => (
                <li key={d.id} className="rounded-lg border border-slate-100 p-3">
                  <Link href={`/gap/${d.id}`} className="font-medium text-indigo-700 hover:underline">{d.title}</Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {d.n} initiativ ({d.initiative_names}) {d.ou_count > 1 ? `i ${d.ou_count} OU:er – pröva värd-OU-modell eller sekvensering` : "– pröva increments-sekvensering"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="4 · Ram- och guardrailanalys" subtitle="Måste-initiativ för regelefterlevnad (NIS2, säkerhetsskydd, Ei) ligger skyddade i planen">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th">Tema</th><th className="th">Committed (MSEK)</th><th className="th">Planned (MSEK)</th></tr></thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="td text-slate-700">{c.priority_rank}. {c.name}</td>
                  <td className="td font-semibold">{fmt(c.committed_cost)}</td>
                  <td className="td text-slate-500">{fmt(c.planned_cost)}</td>
                </tr>
              ))}
              <tr><td className="td font-semibold">Totalt</td><td className="td font-semibold" colSpan={2}>{fmt(totalCost)} MSEK mot ram</td></tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            Ramvillkor är inte förhandlingsbara: initiativ för NIS2/säkerhetsskydd/myndighetsbeslut prioriteras inte bort
            utan formellt DEMT-beslut med dokumenterad riskacceptans.
          </p>
        </Card>
      </div>

      <Card title="5 · Spegelkonsistens & eskaleringar" subtitle="Inga olösta nyckelkompetenskonflikter går in i PI-planering">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Spegelavvikelser</div>
            {mirrorIssues.length === 0 ? <p className="text-sm text-slate-500">Alla tvärorganisatoriska initiativ har kompletta, resurssatta delåtaganden.</p> : (
              <ul className="space-y-1.5 text-sm">
                {mirrorIssues.map((m, i) => (
                  <li key={i}>
                    <Link href={`/initiativ/${m.initiative_id}`} className="text-amber-800 hover:underline">
                      ⚠ {m.initiative_name}: {m.issue}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Eskalationslistor från steg 5</div>
            <ul className="space-y-2">
              {escalations.map((e) => (
                <li key={e.id} className={`rounded-lg border p-3 text-sm ${e.status === "öppen" ? "border-amber-200 bg-amber-50" : "border-slate-100"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.ou_short ?? ""} · {e.title}</span>
                    <Rag rag={e.status === "öppen" ? "gul" : "grön"} label={e.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{e.description}</p>
                  {e.resolution ? (
                    <p className="mt-1 text-xs text-emerald-700"><strong>Beslut:</strong> {e.resolution}</p>
                  ) : (
                    <form action={resolveEscalation} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={e.id} />
                      <input name="resolution" required placeholder="DEMT-beslut med motiv (protokollförs i beslutsloggen)" className="input" />
                      <button className="btn-secondary shrink-0">Besluta</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card title="Prioriterad portfölj (justerad WSJF)"
        subtitle="WSJF = (affärsvärde + tidskritikalitet + risk/möjlighet) × strategisk koppling / jobbstorlek. Multiplikator: temarang 1 → ×1,2 · övriga teman → ×1,0 · utanför tema → ×0,8. Avsteg från ordningen protokollförs med motiv.">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200">
            <th className="th">#</th><th className="th">Initiativ</th><th className="th">OU</th><th className="th">Tema</th>
            <th className="th">V</th><th className="th">T</th><th className="th">R</th><th className="th">Storlek</th><th className="th">WSJF</th><th className="th">Status (DEMT)</th>
          </tr></thead>
          <tbody>
            {inits.map((i, idx) => (
              <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="td text-slate-400">{idx + 1}</td>
                <td className="td"><Link href={`/initiativ/${i.id}`} className="font-medium text-indigo-700 hover:underline">{i.name}</Link></td>
                <td className="td">{i.ou_short}</td>
                <td className="td text-xs text-slate-500">{i.theme_names ?? <span className="text-rose-500">utanför tema</span>}</td>
                <td className="td">{i.business_value}</td>
                <td className="td">{i.time_criticality}</td>
                <td className="td">{i.risk_reduction}</td>
                <td className="td">{i.job_size}</td>
                <td className="td text-base font-bold text-indigo-700">{i.wsjf}</td>
                <td className="td">
                  <form action={updateInitiativeStatus} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={i.id} />
                    <select name="status" defaultValue={i.status} className="input !w-auto !py-1 !text-xs">
                      <option>committed</option><option>planned</option><option>outlook</option>
                    </select>
                    <button className="btn-secondary !px-2 !py-1 !text-xs">Besluta</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
