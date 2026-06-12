import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTheme, getKrsWithLatest, getKrMeasurements, getHeatmap, getGaps,
  getUsers, getDecisions, getBenefits, getInitiatives,
} from "@/lib/queries";
import { getKrCoverage } from "@/lib/quality";
import { updateTheme, decideTheme, addKeyResult, addMeasurement } from "@/lib/actions";
import { Card, Rag, ClassBadge, StatusBadge, Empty } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { fmt, krProgress, critColor, ragColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ThemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = getTheme(Number(id));
  if (!theme) notFound();
  const krs = getKrsWithLatest(theme.id);
  const heatmap = getHeatmap(theme.id);
  const gaps = getGaps(theme.id);
  const users = getUsers();
  const decisions = getDecisions(theme.id);
  const benefits = getBenefits(theme.id);
  const coverage = getKrCoverage().filter((c) => c.theme_id === theme.id);
  const inits = getInitiatives().filter((i) => (i.theme_ids ?? "").split(",").includes(String(theme.id)));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            <Link href="/teman" className="hover:text-indigo-600">Teman</Link> / Temakort
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {theme.priority_rank && <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 align-middle text-sm font-bold text-white">{theme.priority_rank}</span>}
            {theme.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${theme.status === "beslutad" ? "text-emerald-700 bg-emerald-50 ring-emerald-600/20" : "text-slate-600 bg-slate-100 ring-slate-500/20"}`}>{theme.status}</span>
          {theme.status !== "beslutad" && (
            <form action={decideTheme}>
              <input type="hidden" name="id" value={theme.id} />
              <input type="hidden" name="status" value="beslutad" />
              <button className="btn">Besluta i DEMT</button>
            </form>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Temakort" subtitle="En A4 per tema (bilaga A.1)" className="lg:col-span-2">
          <form action={updateTheme} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="id" value={theme.id} />
            <div className="md:col-span-2">
              <label className="label">Tema</label>
              <input name="name" defaultValue={theme.name} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Objective</label>
              <textarea name="objective" rows={2} defaultValue={theme.objective} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Varför nu</label>
              <textarea name="why_now" rows={2} defaultValue={theme.why_now} className="input" />
            </div>
            <div>
              <label className="label">Temaägare (alltid DEMT-medlem – kan aldrig delegeras)</label>
              <select name="owner_id" defaultValue={theme.owner_id ?? ""} className="input">
                <option value="">Ej utsedd</option>
                {users.filter((u) => u.role.includes("DEMT") || u.role.includes("VD")).map((u) => (
                  <option key={u.id} value={u.id}>{u.name} – {u.role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Temakoordinator (operativt stöd – aldrig ansvarsbärare)</label>
              <select name="coordinator_id" defaultValue={theme.coordinator_id ?? ""} className="input">
                <option value="">Ej utsedd</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} – {u.role}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioritet i temarangordningen (styr konfliktlösning och WSJF-multiplikator)</label>
              <input name="priority_rank" type="number" min={1} max={5} defaultValue={theme.priority_rank ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Giltighet</label>
              <div className="py-1.5 text-sm text-slate-600">
                Beslutad {theme.decided_at ?? "–"} · omprövas {theme.review_at ?? "vid nästa temaöversyn"}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">Mandat (vilka beslut ägaren fattar själv resp. bereder till DEMT)</label>
              <textarea name="mandate" rows={2} defaultValue={theme.mandate} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Resurser (koordinator, analyskapacitet, temabudget)</label>
              <textarea name="resources" rows={2} defaultValue={theme.resources} className="input" />
            </div>
            <div><button className="btn-secondary">Spara temakort & mandatkort</button></div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Temarapport" subtitle="Månadsuppföljningens ensidiga format – högst 10 minuter i DEMT">
            <div className="space-y-3 text-sm">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">OKR-läge (2 min)</div>
                {krs.map((k) => (
                  <div key={k.id} className="flex items-center gap-2 py-0.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ragColor(k.rag ?? "")}`} />
                    <span className="truncate text-slate-700">{k.title}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Leveransläge (2 min)</div>
                <p className="text-slate-600">
                  {inits.filter((i) => i.status === "committed").length} committed-initiativ,
                  varav {inits.filter((i) => i.prognosis === "gul" || i.prognosis === "röd").length} med gul/röd prognos.
                </p>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Beslut som behövs (5 min)</div>
                {decisions.filter((d) => d.status === "öppet").length === 0
                  ? <p className="text-slate-500">Inga öppna beslutspunkter – rapporten läggs till handlingarna utan muntlig föredragning.</p>
                  : decisions.filter((d) => d.status === "öppet").map((d) => (
                    <Link key={d.id} href="/vagval" className="block text-indigo-700 hover:underline">→ {d.title}</Link>
                  ))}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Lärdomar & risker (1 min)</div>
                <p className="text-slate-600">{krs.find((k) => k.comment)?.comment ?? "–"}</p>
              </div>
            </div>
          </Card>

          <Card title="KR-täckning" subtitle="Varje KR ska bäras av minst ett committed-initiativ">
            <ul className="space-y-2 text-sm">
              {coverage.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${c.committed > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                  <span className="text-slate-700">
                    {c.title}
                    <span className="block text-xs text-slate-500">
                      {c.committed} committed · {c.planned} planned {c.committed === 0 && "– lucka som temaägaren måste adressera"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Key Results" subtitle="Kvantitativa utfallsmått med basvärde, målvärde och tidpunkt. Kvalitetsregel: ett KR ska kunna gå åt fel håll trots att alla aktiviteter genomförts.">
        <div className="space-y-4">
          {krs.map((k) => {
            const series = getKrMeasurements(k.id);
            return (
              <details key={k.id} className="rounded-lg border border-slate-100 p-4 open:bg-slate-50/40">
                <summary className="flex flex-wrap items-center gap-4">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${ragColor(k.rag ?? "")}`} />
                  <span className="min-w-0 flex-1 font-medium text-slate-800">{k.title}</span>
                  {Boolean(k.is_customer_value) && <span className="badge text-sky-700 bg-sky-50 ring-sky-600/20">kund-/samhällsvärde</span>}
                  <Sparkline points={series.map((m) => ({ date: m.date, actual: m.actual }))} baseline={k.baseline} target={k.target} direction={k.direction} />
                  <span className="w-56 text-right text-sm text-slate-600">
                    {fmt(k.baseline)} → <strong>{fmt(k.actual)}</strong> → prognos {fmt(k.forecast)}
                    <span className="block text-xs text-slate-400">mål {fmt(k.target)} {k.unit} senast {k.deadline} · {k.source}</span>
                  </span>
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Mätserie (basvärde · utfall · prognos)</div>
                    <table className="w-full">
                      <thead><tr className="border-b border-slate-200"><th className="th">Datum</th><th className="th">Utfall</th><th className="th">Prognos</th><th className="th">RAG</th><th className="th">Kommentar</th></tr></thead>
                      <tbody>
                        {series.map((m) => (
                          <tr key={m.id} className="border-b border-slate-100">
                            <td className="td">{m.date}</td><td className="td">{fmt(m.actual)}</td><td className="td">{fmt(m.forecast)}</td>
                            <td className="td"><Rag rag={m.rag} /></td><td className="td text-slate-500">{m.comment}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ny mätning</div>
                    <form action={addMeasurement} className="grid grid-cols-2 gap-2">
                      <input type="hidden" name="kr_id" value={k.id} />
                      <div><label className="label">Datum</label><input name="date" type="date" className="input" /></div>
                      <div><label className="label">RAG-prognos</label>
                        <select name="rag" className="input"><option>grön</option><option>gul</option><option>röd</option></select>
                      </div>
                      <div><label className="label">Utfall</label><input name="actual" type="number" step="any" className="input" /></div>
                      <div><label className="label">Prognos vid måltidpunkt</label><input name="forecast" type="number" step="any" className="input" /></div>
                      <div className="col-span-2"><label className="label">Kommentar / åtgärdsplan (krävs vid gul; röd kräver DEMT-beslut)</label>
                        <input name="comment" className="input" /></div>
                      <div><button className="btn-secondary">Registrera</button></div>
                    </form>
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        <details className="mt-4 rounded-lg border border-dashed border-slate-300 p-4">
          <summary className="text-sm font-medium text-indigo-700">+ Lägg till Key Result (2–4 per tema)</summary>
          <form action={addKeyResult} className="mt-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="theme_id" value={theme.id} />
            <div className="md:col-span-3">
              <label className="label">Mått (utfall – inte aktivitet; ”systemet X infört” är en milstolpe i fel kostym)</label>
              <input name="title" required className="input" />
            </div>
            <div><label className="label">Basvärde</label><input name="baseline" type="number" step="any" required className="input" /></div>
            <div><label className="label">Målvärde</label><input name="target" type="number" step="any" required className="input" /></div>
            <div><label className="label">Enhet</label><input name="unit" className="input" placeholder="%, mån, MW…" /></div>
            <div><label className="label">Tidpunkt</label><input name="deadline" className="input" placeholder="2027-Q4" /></div>
            <div><label className="label">Mätkälla</label><input name="source" className="input" /></div>
            <div><label className="label">Mätfrekvens</label><input name="frequency" className="input" defaultValue="Månadsvis" /></div>
            <div><label className="label">Riktning</label>
              <select name="direction" className="input"><option value="up">Högre är bättre</option><option value="down">Lägre är bättre</option></select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input id={`cv-${theme.id}`} type="checkbox" name="is_customer_value" className="h-4 w-4" />
              <label htmlFor={`cv-${theme.id}`} className="text-sm text-slate-600">Kund-/samhällsvärdesmått</label>
            </div>
            <div className="flex items-end"><button className="btn">Lägg till KR</button></div>
          </form>
        </details>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Heatmappad förmågekarta" subtitle="Steg 3 · Endast Viktig/Kritisk går vidare till gap-analys – max 8 förmågor"
          actions={<Link href={`/formagor?tema=${theme.id}`} className="btn-secondary">Öppna heatmapping</Link>}>
          {heatmap.length === 0 ? <Empty>Ingen heatmapping ännu – beställs av temaägaren efter mandatbeslut.</Empty> : (
            <ul className="space-y-2">
              {heatmap.map((h) => (
                <li key={h.id} className="flex items-center gap-3 text-sm">
                  <span className={`badge ring-transparent ${critColor(h.criticality, h.movement)}`}>{h.criticality}</span>
                  <span className="badge text-slate-600 bg-slate-100 ring-slate-500/10">{h.movement}</span>
                  <span className="flex-1 font-medium text-slate-700">{h.capability_name}</span>
                  {h.to_gap ? <span className="text-xs text-indigo-600">→ gap-analys</span> : <span className="text-xs text-slate-400" title={h.exclusion_motive}>avgränsad</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Gap-register" subtitle="Steg 4 · Lösningsneutrala förmågegap, klassade Måste/Bör/Kan"
          actions={<Link href={`/gap?tema=${theme.id}`} className="btn-secondary">Hela registret</Link>}>
          {gaps.length === 0 ? <Empty>Inga gap dokumenterade ännu.</Empty> : (
            <ul className="space-y-2">
              {gaps.map((g) => (
                <li key={g.id} className="flex items-center gap-3 text-sm">
                  <ClassBadge c={g.classification} />
                  <Link href={`/gap/${g.id}`} className="flex-1 truncate font-medium text-slate-700 hover:text-indigo-700">{g.title}</Link>
                  <span className="text-xs text-slate-400">{g.capability_name} · {g.initiative_count} initiativ</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Initiativ kopplade till temat" subtitle="Spårbarhet: initiativ → gap → KR">
        {inits.length === 0 ? <Empty>Inga initiativ ännu – byggs i OU-roadmaps (steg 5).</Empty> : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-200">
              <th className="th">Initiativ</th><th className="th">OU</th><th className="th">Status</th><th className="th">Tidplan</th><th className="th">WSJF</th><th className="th">Prognos</th>
            </tr></thead>
            <tbody>
              {inits.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="td"><Link href={`/initiativ/${i.id}`} className="font-medium text-indigo-700 hover:underline">{i.name}</Link></td>
                  <td className="td">{i.ou_short}</td>
                  <td className="td"><StatusBadge s={i.status} /></td>
                  <td className="td text-slate-500">{i.start_quarter} – {i.end_quarter}</td>
                  <td className="td font-semibold">{i.wsjf}</td>
                  <td className="td">{i.prognosis ? <Rag rag={i.prognosis} /> : <span className="text-xs text-slate-400">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Nyttoregister" subtitle="Steg 7 · Nyttan realiseras i drift, inte i projekt – hemtagningsansvarig är alltid linjen">
        {benefits.length === 0 ? <Empty>Inga nyttoposter ännu.</Empty> : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-200">
              <th className="th">Nytta</th><th className="th">KR-koppling</th><th className="th">Hemtagningsansvarig</th><th className="th">Status</th>
            </tr></thead>
            <tbody>
              {benefits.map((b) => (
                <tr key={b.id} className="border-b border-slate-100">
                  <td className="td">{b.description}<span className="block text-xs text-slate-400">{b.initiative_name}</span></td>
                  <td className="td text-slate-500">{b.kr_title ?? "–"}</td>
                  <td className="td">{b.owner}</td>
                  <td className="td"><Rag rag={b.status === "verifierad" ? "grön" : b.status === "utebliven" ? "röd" : "gul"} label={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
