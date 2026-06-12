import Link from "next/link";
import { getGaps, getThemes, getHeatmap, getKrsWithLatest, getAllGapDependencies } from "@/lib/queries";
import { createGap } from "@/lib/actions";
import { Card, ClassBadge, Empty } from "@/components/ui";
import { DIMENSIONS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GapsPage({ searchParams }: { searchParams: Promise<{ tema?: string }> }) {
  const sp = await searchParams;
  const themes = getThemes().filter((t) => t.status === "beslutad");
  const themeId = sp.tema ? Number(sp.tema) : undefined;
  const gaps = getGaps(themeId);
  const deps = getAllGapDependencies();
  const heatCaps = themeId ? getHeatmap(themeId).filter((h) => h.to_gap) : [];
  const krs = themeId ? getKrsWithLatest(themeId) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Gap-register</h1>
        <p className="mt-1 text-sm text-slate-500">
          Steg 4 · Avståndet mellan krävd och nuvarande förmågenivå, per dimension. Gap formuleras som förmågebrist –
          aldrig som systemkrav. Lösningsval görs i steg 5.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/gap" className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!themeId ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-slate-300 text-slate-700"}`}>Alla teman</Link>
        {themes.map((t) => (
          <Link key={t.id} href={`/gap?tema=${t.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${t.id === themeId ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50"}`}>
            {t.name}
          </Link>
        ))}
      </div>

      <Card title={`Gap (${gaps.length})`} subtitle="Måste = KR nås inte utan åtgärd eller regulatoriskt krav · Bör = väsentligt bidrag · Kan = idébacklog, inte roadmap">
        {gaps.length === 0 ? <Empty>Inga gap för urvalet.</Empty> : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-200">
              <th className="th">Klass</th><th className="th">Gap</th><th className="th">Förmåga</th><th className="th">Tema</th><th className="th">KR-spårbarhet</th><th className="th">Initiativ</th>
            </tr></thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="td"><ClassBadge c={g.classification} /></td>
                  <td className="td"><Link href={`/gap/${g.id}`} className="font-medium text-indigo-700 hover:underline">{g.title}</Link></td>
                  <td className="td text-slate-600">{g.capability_name}</td>
                  <td className="td text-slate-500">{g.theme_name}</td>
                  <td className="td text-xs text-slate-500">{g.kr_titles ?? <span className="text-rose-600 font-medium">saknas</span>}</td>
                  <td className="td">{g.initiative_count > 0 ? g.initiative_count : <span className="text-xs font-medium text-amber-600">oadresserat</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Beroendekarta" subtitle="Gap som delar data, plattform eller nyckelkompetens upptäcks här – inte i leverans. Kritisk input till konsolideringen.">
        {deps.length === 0 ? <Empty>Inga beroenden dokumenterade.</Empty> : (
          <ul className="space-y-2 text-sm">
            {deps.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/gap/${d.gap_id}`} className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 hover:bg-indigo-50">{d.from_title}</Link>
                <span className="text-slate-400">→ förutsätter →</span>
                <Link href={`/gap/${d.depends_on_gap_id}`} className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 hover:bg-indigo-50">{d.to_title}</Link>
                {d.from_theme !== d.to_theme && <span className="badge text-violet-700 bg-violet-50 ring-violet-600/20">tvärs teman</span>}
                <span className="text-xs text-slate-400">{d.note}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {themeId && (
        <Card title="Nytt gap-kort" subtitle="Fastställ nuläge och målläge per dimension med motivering. Målläget härleds ur Key Results – inte ur ambitionen att nå nivå 5 överallt.">
          {heatCaps.length === 0 ? <Empty>Heatmappa temat först – endast utvalda förmågor gap-analyseras.</Empty> : (
            <form action={createGap} className="space-y-4">
              <input type="hidden" name="theme_id" value={themeId} />
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="label">Förmåga (ur heatmappens urval)</label>
                  <select name="capability_id" className="input" required>
                    {heatCaps.map((h) => <option key={h.capability_id} value={h.capability_id}>{h.capability_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Klassning</label>
                  <select name="classification" className="input"><option>Måste</option><option>Bör</option><option>Kan</option></select>
                </div>
                <div>
                  <label className="label">Berörda Key Results (spårbarhet – krävs för Måste)</label>
                  <select name="kr_ids" multiple size={3} className="input">
                    {krs.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="label">Gap-titel (lösningsneutral: ”förmågan saknar X” – inte ”vi behöver systemet Y”)</label>
                  <input name="title" required className="input" />
                </div>
                <div className="md:col-span-3">
                  <label className="label">Beskrivning</label>
                  <textarea name="description" rows={2} className="input" />
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Mognad per dimension (1 Initial · 2 Repeterbar · 3 Definierad · 4 Styrd · 5 Optimerande) – fyll i berörda dimensioner
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {DIMENSIONS.map((d) => (
                    <div key={d} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2">
                      <span className="w-44 shrink-0 text-xs font-medium text-slate-600">{d}</span>
                      <input name={`cur_${d}`} type="number" min={1} max={5} placeholder="nu" className="input !w-16" />
                      <span className="text-slate-300">→</span>
                      <input name={`tgt_${d}`} type="number" min={1} max={5} placeholder="mål" className="input !w-16" />
                      <input name={`mot_${d}`} placeholder="motivering (aldrig bara en siffra)" className="input flex-1" />
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn">Skapa gap-kort</button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
