import { getDecisions, getDecisionAlternatives, getThemes } from "@/lib/queries";
import { createDecision, decideDecision } from "@/lib/actions";
import { Card, Rag, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function DecisionsPage() {
  const decisions = getDecisions();
  const themes = getThemes().filter((t) => t.status === "beslutad");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Vägval & beslutslogg</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dokumenterade avvägningsbeslut mellan principiellt olika handlingsalternativ. Beslutsloggen är metodens
          institutionella minne – samma diskussion tas inte om varje kvartal, och nya beslutsfattare förstår varför planen ser ut som den gör.
        </p>
      </header>

      <div className="space-y-4">
        {decisions.map((d) => {
          const alts = getDecisionAlternatives(d.id);
          return (
            <Card key={d.id} className={d.status === "öppet" ? "ring-2 ring-amber-200" : ""}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{d.title}</h2>
                    <Rag rag={d.status === "öppet" ? "gul" : "grön"} label={d.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{d.question}</p>
                  <p className="mt-1 text-xs text-slate-400">{d.theme_name ?? "Portföljgemensamt"} · {d.forum}{d.decided_at ? ` · beslutat ${d.decided_at} av ${d.decided_by}` : ""}</p>
                </div>
              </div>

              {alts.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {alts.map((a) => (
                    <div key={a.id} className={`rounded-lg border p-3 text-sm ${a.chosen ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200"}`}>
                      <div className="font-medium text-slate-800">{a.chosen ? "✓ " : ""}{a.name}</div>
                      <dl className="mt-2 space-y-1 text-xs text-slate-600">
                        <div><dt className="inline font-semibold">Kostnad:</dt> <dd className="inline">{a.cost || "–"}</dd></div>
                        <div><dt className="inline font-semibold">KR-effekt:</dt> <dd className="inline">{a.kr_effect || "–"}</dd></div>
                        <div><dt className="inline font-semibold">Risk:</dt> <dd className="inline">{a.risk || "–"}</dd></div>
                        <div><dt className="inline font-semibold">Tid till effekt:</dt> <dd className="inline">{a.lead_time || "–"}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
              )}

              {d.recommendation && (
                <p className="mt-3 text-sm text-slate-600"><span className="font-semibold text-slate-700">Rekommendation (beredande part):</span> {d.recommendation}</p>
              )}

              {d.status === "beslutat" ? (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <p><span className="font-semibold text-slate-700">Beslut:</span> {d.decision}</p>
                  <p className="mt-1"><span className="font-semibold text-slate-700">Motiv:</span> {d.motive}</p>
                  {d.review_conditions && <p className="mt-1 text-xs text-slate-500"><span className="font-semibold">Omprövningsvillkor:</span> {d.review_conditions}</p>}
                </div>
              ) : (
                <form action={decideDecision} className="mt-4 grid gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={d.id} />
                  <div className="md:col-span-2"><label className="label">Beslut</label><input name="decision" required className="input" /></div>
                  <div><label className="label">Beslutsfattare (enligt mandatordning 3.4 – jävig temaägare föredrar men beslutar inte)</label>
                    <input name="decided_by" required className="input" placeholder="DEMT / temaägare / OU-chef" /></div>
                  <div><label className="label">Valt alternativ</label>
                    <select name="chosen_alternative" className="input">
                      <option value="">–</option>
                      {alts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select></div>
                  <div className="md:col-span-2"><label className="label">Motiv (varför detta alternativ – varför inte de andra)</label>
                    <textarea name="motive" rows={2} className="input" /></div>
                  <div className="md:col-span-2"><label className="label">Omprövningsvillkor (vilka förändrade förutsättningar triggar omprövning)</label>
                    <input name="review_conditions" className="input" /></div>
                  <div><button className="btn">Protokollför beslut</button></div>
                </form>
              )}
            </Card>
          );
        })}
        {decisions.length === 0 && <Empty>Inga vägval i loggen.</Empty>}
      </div>

      <Card title="Nytt vägval" subtitle="Vägvalsmallen (bilaga A.4): frågeställning, 2–4 alternativ med konsekvens för kostnad, KR-effekt, risk och tid">
        <form action={createDecision} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="label">Rubrik</label><input name="title" required className="input" /></div>
            <div><label className="label">Tema</label>
              <select name="theme_id" className="input">
                <option value="">Portföljgemensamt</option>
                {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select></div>
            <div className="md:col-span-3"><label className="label">Frågeställning (avvägningsbeslutet i en mening)</label>
              <input name="question" required className="input" /></div>
            <div className="md:col-span-3"><label className="label">Rekommendation med motiv</label>
              <input name="recommendation" className="input" /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <fieldset key={n} className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-semibold text-slate-500">Alternativ {n}{n > 2 ? " (valfritt)" : ""}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input name={`alt${n}_name`} placeholder="Beskrivning" className="input col-span-2" required={n <= 2} />
                  <input name={`alt${n}_cost`} placeholder="Kostnad" className="input" />
                  <input name={`alt${n}_kr`} placeholder="Effekt på berörda KR" className="input" />
                  <input name={`alt${n}_risk`} placeholder="Risk" className="input" />
                  <input name={`alt${n}_time`} placeholder="Tid till effekt" className="input" />
                </div>
              </fieldset>
            ))}
          </div>
          <button className="btn">Registrera vägval</button>
        </form>
      </Card>
    </div>
  );
}
