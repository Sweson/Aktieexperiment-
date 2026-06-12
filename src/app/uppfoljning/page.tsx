import Link from "next/link";
import { getStatusReports, getInitiatives, getBenefits, getThemes, getKrsWithLatest } from "@/lib/queries";
import { updateBenefitStatus, addBenefit } from "@/lib/actions";
import { Card, Rag, StatusBadge, Empty } from "@/components/ui";
import { ragColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function FollowUpPage() {
  const reports = getStatusReports();
  const inits = getInitiatives();
  const committed = inits.filter((i) => i.status === "committed");
  const benefits = getBenefits();
  const themes = getThemes().filter((t) => t.status === "beslutad");
  const krs = getKrsWithLatest();
  const months = [...new Set(reports.map((r) => r.month))].sort().reverse();
  const latestMonth = months[0];
  const reported = new Set(reports.filter((r) => r.month === latestMonth).map((r) => r.initiative_id));
  const missing = committed.filter((i) => !reported.has(i.id));
  const lessons = reports.filter((r) => r.lessons).slice(0, 8);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Realisering & uppföljning</h1>
        <p className="mt-1 text-sm text-slate-500">
          Steg 7 · Två genomförandespår – en styrning: portföljspåret (epics i ART:er) och linjespåret (linjeuppdrag)
          rapporterar enligt samma månadsmodell. Linjeuppdrag får inte bli osynliga för att de saknar projektkod.
        </p>
      </header>

      {missing.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <strong>Kvalitetskriterium:</strong> 100 % av committed-initiativ ska ha månadsstatus.
          Saknas för {latestMonth}: {missing.map((i) => i.name).join(", ")}.
        </div>
      )}

      <Card title="Månadsrapportering" subtitle="Delmålsstatus · prognos · resursläge · beslut som behövs · lärdomar">
        {months.length === 0 ? <Empty>Inga rapporter.</Empty> : months.map((month) => (
          <div key={month} className="mb-4">
            <div className="mb-2 text-sm font-semibold text-slate-500">{month}</div>
            <div className="grid gap-3 lg:grid-cols-2">
              {reports.filter((r) => r.month === month).map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/initiativ/${r.initiative_id}`} className="font-medium text-indigo-700 hover:underline">
                      {r.initiative_name} <span className="text-xs text-slate-400">({r.ou_short})</span>
                    </Link>
                    <Rag rag={r.prognosis} />
                  </div>
                  <p className="mt-1 text-slate-600">{r.summary}</p>
                  {r.resource_state && <p className="mt-1 text-xs text-slate-500"><strong>Resursläge:</strong> {r.resource_state}</p>}
                  {r.decisions_needed && <p className="mt-1 text-xs text-amber-700"><strong>Beslut som behövs:</strong> {r.decisions_needed}</p>}
                  {r.lessons && <p className="mt-1 text-xs text-slate-500"><strong>Lärdom:</strong> {r.lessons}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Ändringshantering" subtitle="Tre situationer kräver alltid omedelbar eskalering till temaägaren" className="lg:col-span-1">
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="rounded-lg bg-rose-50 p-2.5">Ett Måste-initiativ prognosticerar miss av regulatorisk deadline.</li>
            <li className="rounded-lg bg-rose-50 p-2.5">Ett delmål kopplat till KR förskjuts över kvartalsgräns.</li>
            <li className="rounded-lg bg-rose-50 p-2.5">En beroendepart drar sig ur ett åtagande eller delåtagande i ett tvärorganisatoriskt initiativ.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Övriga ändringar enligt mandatordningen: inom OU → OU-chef · inom tema → temaägare · mellan teman → DEMT.
            Alltid registrerade och synliga i nästa månadsuppföljning.
          </p>
        </Card>

        <Card title="Lärande som styrmedel" subtitle="PMO sammanställer lärdomsfälten till mönster inför kvartalsprioritering och årlig temaöversyn" className="lg:col-span-2">
          {lessons.length === 0 ? <Empty>Inga lärdomar registrerade.</Empty> : (
            <ul className="space-y-2 text-sm">
              {lessons.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-100 p-2.5">
                  <span className="text-slate-700">{r.lessons}</span>
                  <span className="block text-xs text-slate-400">{r.initiative_name} · {r.month}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Nyttoregister" subtitle="Hemtagningsansvarig är alltid linjen – aldrig initiativet självt. Kvarstående hemtagning följs i navet tills verifierad eller formellt avskriven av temaägaren.">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200">
            <th className="th">Nytta</th><th className="th">Tema / KR-koppling</th><th className="th">Hemtagningsansvarig</th><th className="th">Hemtagningsåtgärd</th><th className="th">Status</th>
          </tr></thead>
          <tbody>
            {benefits.map((b) => (
              <tr key={b.id} className="border-b border-slate-100">
                <td className="td">{b.description}<span className="block text-xs text-slate-400">{b.initiative_name} · baslinje {b.baseline} · mäts: {b.measure_point}</span></td>
                <td className="td text-xs text-slate-500">{b.theme_name}<br />{b.kr_title ?? ""}</td>
                <td className="td">{b.owner}</td>
                <td className="td text-xs text-slate-500">{b.action}</td>
                <td className="td">
                  <form action={updateBenefitStatus} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={b.id} />
                    <select name="status" defaultValue={b.status} className="input !w-auto !py-1 !text-xs">
                      <option>ej påbörjad</option><option>pågår</option><option>verifierad</option><option>utebliven</option>
                    </select>
                    <button className="btn-secondary !px-2 !py-1 !text-xs">OK</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="mt-4">
          <summary className="text-sm font-medium text-indigo-700">+ Ny nyttopost</summary>
          <form action={addBenefit} className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="md:col-span-2"><label className="label">Nytta (mätbart utfall: ledtid, kostnad, kapacitet, NKI)</label><input name="description" required className="input" /></div>
            <div><label className="label">Tema</label>
              <select name="theme_id" className="input">{themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="label">Initiativ</label>
              <select name="initiative_id" className="input"><option value="">–</option>{inits.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
            <div><label className="label">KR-koppling</label>
              <select name="kr_id" className="input"><option value="">–</option>{krs.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select></div>
            <div><label className="label">Hemtagningsansvarig (namngiven roll i linjen)</label><input name="owner" required className="input" /></div>
            <div className="md:col-span-2"><label className="label">Hemtagningsåtgärd (vad linjen måste göra för att nyttan ska uppstå)</label><input name="action" className="input" /></div>
            <div><label className="label">Baslinje</label><input name="baseline" className="input" /></div>
            <div className="md:col-span-2"><label className="label">Mätpunkt</label><input name="measure_point" className="input" /></div>
            <div><button className="btn">Registrera</button></div>
          </form>
        </details>
      </Card>
    </div>
  );
}
