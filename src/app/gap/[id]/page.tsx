import Link from "next/link";
import { notFound } from "next/navigation";
import { getGap, getGapDimensions, getGapKrs, getGapDependencies, getGapInitiatives, getGaps } from "@/lib/queries";
import { updateGapClassification, addGapDependency } from "@/lib/actions";
import { Card, ClassBadge, StatusBadge, Empty } from "@/components/ui";
import { Radar } from "@/components/charts";
import { MATURITY } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gap = getGap(Number(id));
  if (!gap) notFound();
  const dims = getGapDimensions(gap.id);
  const krs = getGapKrs(gap.id);
  const deps = getGapDependencies(gap.id);
  const inits = getGapInitiatives(gap.id);
  const allGaps = getGaps().filter((g) => g.id !== gap.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          <Link href="/gap" className="hover:text-indigo-600">Gap-register</Link> / Gap-kort #{gap.id}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{gap.title}</h1>
          <ClassBadge c={gap.classification} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Förmåga: <Link href="/formagor" className="font-medium text-indigo-700">{gap.capability_name}</Link> ·
          Tema: <Link href={`/teman/${gap.theme_id}`} className="font-medium text-indigo-700">{gap.theme_name}</Link> ·
          Status: {gap.status}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Gap-profil per dimension" subtitle="Nuläge (streckad) mot målläge härlett ur Key Results">
          <div className="flex justify-center"><Radar dims={dims as any} /></div>
          <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-0.5 w-5 border-t-2 border-dashed border-indigo-600" /> Nuläge</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-5 border-t-2 border-emerald-500" /> Målläge</span>
          </div>
        </Card>

        <Card title="Mognadsbedömning" subtitle="Skalans värde ligger i samtalen och faktaunderlaget bakom siffran" className="lg:col-span-2">
          {dims.length === 0 ? <Empty>Inga dimensioner bedömda.</Empty> : (
            <table className="w-full">
              <thead><tr className="border-b border-slate-200">
                <th className="th">Dimension</th><th className="th">Nuläge</th><th className="th">Målläge</th><th className="th">Motivering</th>
              </tr></thead>
              <tbody>
                {dims.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="td font-medium text-slate-700">{d.dimension}</td>
                    <td className="td">{d.current} <span className="text-xs text-slate-400">{MATURITY[d.current]}</span></td>
                    <td className="td">{d.target} <span className="text-xs text-slate-400">{MATURITY[d.target]}</span></td>
                    <td className="td text-slate-500">{d.motivation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-sm text-slate-600">{gap.description}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="KR-spårbarhet" subtitle="Varje Måste-gap ska vara spårbart till KR eller regelkrav">
          {krs.length === 0 ? <Empty>Ingen KR-koppling – kontrollera klassningen.</Empty> : (
            <ul className="space-y-2 text-sm">
              {krs.map((k) => <li key={k.id} className="rounded-lg bg-slate-50 p-2.5 text-slate-700">{k.title}</li>)}
            </ul>
          )}
          <form action={updateGapClassification} className="mt-4 flex items-end gap-2">
            <input type="hidden" name="id" value={gap.id} />
            <div className="flex-1">
              <label className="label">Klassning (beslutas av temaägaren)</label>
              <select name="classification" defaultValue={gap.classification} className="input">
                <option>Måste</option><option>Bör</option><option>Kan</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="label">Status</label>
              <select name="status" defaultValue={gap.status} className="input">
                <option>öppet</option><option>stängt</option>
              </select>
            </div>
            <button className="btn-secondary">Spara</button>
          </form>
        </Card>

        <Card title="Beroenden" subtitle="Delad data, delad plattform, samma nyckelkompetens, sekvenskrav">
          {deps.length === 0 ? <Empty>Inga beroenden.</Empty> : (
            <ul className="space-y-2 text-sm">
              {deps.map((d) => (
                <li key={d.id}>
                  <Link href={`/gap/${d.depends_id}`} className="font-medium text-indigo-700 hover:underline">→ {d.depends_title}</Link>
                  <span className="block text-xs text-slate-500">{d.note}</span>
                </li>
              ))}
            </ul>
          )}
          <form action={addGapDependency} className="mt-4 space-y-2">
            <input type="hidden" name="gap_id" value={gap.id} />
            <select name="depends_on_gap_id" className="input">
              {allGaps.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            <input name="note" placeholder="Beroendets art" className="input" />
            <button className="btn-secondary">Lägg till beroende</button>
          </form>
        </Card>

        <Card title="Adresserande initiativ" subtitle="Gap som delar lösning är en signal om ett (1) initiativ – inte tre">
          {inits.length === 0 ? (
            <Empty>
              Oadresserat gap. {gap.classification === "Måste" && <strong className="text-rose-600">Måste-gap ska adresseras eller eskaleras med motiv (steg 5).</strong>}
            </Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {inits.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <Link href={`/initiativ/${i.id}`} className="font-medium text-indigo-700 hover:underline">{i.name}</Link>
                  <span className="flex items-center gap-2 text-xs text-slate-500">{i.ou_short} <StatusBadge s={i.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
