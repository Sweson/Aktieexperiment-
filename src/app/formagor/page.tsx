import Link from "next/link";
import { getCapabilityMap, getThemes, getHeatmap, getCapabilityCrossMap, getKrsWithLatest } from "@/lib/queries";
import { setHeatmap } from "@/lib/actions";
import { Card } from "@/components/ui";
import { critColor, CRITICALITY, MOVEMENT } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CapabilitiesPage({ searchParams }: { searchParams: Promise<{ tema?: string; formaga?: string }> }) {
  const sp = await searchParams;
  const { areas, capabilities } = getCapabilityMap();
  const themes = getThemes().filter((t) => t.status === "beslutad");
  const themeId = sp.tema ? Number(sp.tema) : themes[0]?.id;
  const theme = themes.find((t) => t.id === themeId);
  const heatmap = theme ? getHeatmap(theme.id) : [];
  const hmByCap = new Map(heatmap.map((h) => [h.capability_id, h]));
  const selectedCap = sp.formaga ? capabilities.find((c) => c.id === Number(sp.formaga)) : undefined;
  const cross = selectedCap ? getCapabilityCrossMap(selectedCap.id) : undefined;
  const selectedHm = selectedCap ? hmByCap.get(selectedCap.id) : undefined;
  const toGapCount = heatmap.filter((h) => h.to_gap).length;
  const krs = theme ? getKrsWithLatest(theme.id) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Förmågekartan & heatmapping</h1>
        <p className="mt-1 text-sm text-slate-500">
          Steg 3 · Organisationsneutral karta i 2–3 nivåer (TOGAF). Förmågor ägs inte – de är samlingsytor där behov
          och initiativ aggregeras tvärs OU:er. Heatmappen styr vilka förmågor som gap-analyseras.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Heatmap för tema:</span>
        {themes.map((t) => (
          <Link key={t.id} href={`/formagor?tema=${t.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${t.id === themeId ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50"}`}>
            {t.priority_rank}. {t.name}
          </Link>
        ))}
        <span className={`ml-auto badge ${toGapCount > 8 ? "text-rose-700 bg-rose-50 ring-rose-600/20" : "text-slate-600 bg-slate-100 ring-slate-500/20"}`}>
          {toGapCount}/8 förmågor till gap-analys
        </span>
      </div>

      {toGapCount > 8 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <strong>Disciplinregel:</strong> max 8 förmågor per tema till gap-analys. Fler betyder att heatmappingen
          inte vågat prioritera – gör om konvergensen.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {areas.map((a) => (
            <Card key={a.id} title={a.name} className="!p-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {capabilities.filter((c) => c.area_id === a.id).map((c) => {
                  const h = hmByCap.get(c.id);
                  return (
                    <Link key={c.id} href={`/formagor?tema=${themeId}&formaga=${c.id}`}
                      className={`relative rounded-lg p-2.5 text-xs font-medium leading-snug ring-1 ring-black/5 transition-transform hover:scale-[1.02] ${h ? critColor(h.criticality, h.movement) : "bg-slate-100 text-slate-500"} ${selectedCap?.id === c.id ? "outline outline-2 outline-indigo-600 outline-offset-1" : ""}`}>
                      {c.name}
                      {h?.to_gap ? <span className="absolute right-1.5 top-1 text-[10px]">▸gap</span> : null}
                      {h?.movement === "Bygga ny" && <span className="absolute right-1.5 bottom-1 text-[10px]">ny</span>}
                    </Link>
                  );
                })}
              </div>
            </Card>
          ))}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-medium">Legend:</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-500" /> Kritisk</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-400" /> Viktig</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-200" /> Stödjande</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-200" /> Ej bedömd/Ingen</span>
            <span>Tumregel: en förmåga är Kritisk om ett KR inte kan nås utan att förmågan förflyttas.</span>
          </div>
        </div>

        <div className="space-y-6">
          {selectedCap ? (
            <>
              <Card title={selectedCap.name} subtitle="Klassning för valt tema (workshopfrågorna 1–3)">
                <form action={setHeatmap} className="space-y-3">
                  <input type="hidden" name="theme_id" value={themeId} />
                  <input type="hidden" name="capability_id" value={selectedCap.id} />
                  <div>
                    <label className="label">1. Kritikalitet för temats Key Results</label>
                    <select name="criticality" defaultValue={selectedHm?.criticality ?? "Ingen"} className="input">
                      {CRITICALITY.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">2. Förflyttningsbehov</label>
                    <select name="movement" defaultValue={selectedHm?.movement ?? "Utnyttja"} className="input">
                      {MOVEMENT.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Motivering (vilka KR bär förmågan, vilka OU:er involveras)</label>
                    <textarea name="motivation" rows={2} defaultValue={selectedHm?.motivation ?? ""} className="input" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="togap" type="checkbox" name="to_gap" defaultChecked={Boolean(selectedHm?.to_gap)} className="h-4 w-4" />
                    <label htmlFor="togap" className="text-sm text-slate-700">Vidare till gap-analys (aktivt beslut av temaägaren)</label>
                  </div>
                  <div>
                    <label className="label">Motiv vid avgränsning (det som INTE analyseras dokumenteras)</label>
                    <textarea name="exclusion_motive" rows={2} defaultValue={selectedHm?.exclusion_motive ?? ""} className="input" />
                  </div>
                  <button className="btn">Spara klassning</button>
                </form>
              </Card>

              <Card title="Korsmappning ur grundkartorna" subtitle="Påverkansanalysen följer mekaniskt ur kartorna – fakta i stället för workshoptyckande">
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">3. Involverade OU:er</div>
                    {cross!.ous.length === 0 ? <p className="text-slate-400">Ej mappad</p> :
                      cross!.ous.map((o: any) => <div key={o.id} className="text-slate-700">{o.name} <span className="text-xs text-slate-400">– {o.role}</span></div>)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Processer</div>
                    {cross!.processes.map((p: any) => <div key={p.id} className="text-slate-700">{p.name}</div>)}
                    {cross!.processes.length === 0 && <p className="text-slate-400">Ej mappad</p>}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Informationsobjekt</div>
                    {cross!.info.map((i: any) => <div key={i.id} className="text-slate-700">{i.name} {i.quality && <span className="text-xs text-amber-600">· {i.quality}</span>}</div>)}
                    {cross!.info.length === 0 && <p className="text-slate-400">Ej mappad</p>}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">System</div>
                    {cross!.systems.map((s: any) => <div key={s.id} className="text-slate-700">{s.name} {s.debt && <span className="text-xs text-amber-600">· {s.debt}</span>}</div>)}
                    {cross!.systems.length === 0 && <p className="text-slate-400">Ej mappad</p>}
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card title="Arbetsgång (steg 3)" subtitle="Faciliterad workshopserie, typiskt 2 × 3 timmar per tema">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
                <li>Förberedelse: uppdatera kartunderlag och korsmappningar; utse förmågesakkunniga.</li>
                <li>Workshop 1 – bred genomgång: preliminär kritikalitet och förflyttningsbehov. Parkera lösningsdiskussioner.</li>
                <li>Mellanarbete: validera klassningen med linjen; komplettera med fakta ur grundkartorna.</li>
                <li>Workshop 2 – konvergens: fastställ heatmap, besluta avgränsning (max 8), identifiera OU:er.</li>
                <li>Beställning: formell gap-beställning per utvald förmåga.</li>
              </ol>
              <p className="mt-3 text-xs text-slate-500">
                Klicka på en förmåga i kartan för att klassa den och se korsmappningen.
              </p>
              {theme && krs.length > 0 && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Temats Key Results (kravnivån)</div>
                  {krs.map((k) => <div key={k.id} className="py-0.5 text-xs text-slate-600">• {k.title}</div>)}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
