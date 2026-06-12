import { getBaseMaps, getCapabilityMap, getCapabilityCrossMap, getUsers, getCompetences, getCapacityView } from "@/lib/queries";
import { Card, Empty } from "@/components/ui";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function BaseMapsPage() {
  const maps = getBaseMaps();
  const { areas, capabilities } = getCapabilityMap();
  const users = getUsers();
  const competences = getCompetences();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Grundkartorna – metodens faktabas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fem versionshanterade kartor korsmappade mot förmågekartan gör påverkans-, beroende- och konsekvensanalys
          till faktahantering i stället för workshoptyckande. Regel: en uppgift, ett hem.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Processkartan" subtitle="Värdeströmmar och huvudprocesser · förvaltas av verksamhetsutveckling/processansvariga">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th">Process</th><th className="th">Ansvarig OU</th></tr></thead>
            <tbody>{maps.processes.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-100"><td className="td">{p.name}</td><td className="td text-slate-500">{p.owner}</td></tr>
            ))}</tbody>
          </table>
        </Card>

        <Card title="Informationsmodellen" subtitle="Kritiska informationsobjekt enligt DAMA-DMBOK · förvaltas av dataförvaltning/CDO">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th">Informationsobjekt</th><th className="th">Klass</th><th className="th">Kvalitetsstatus</th></tr></thead>
            <tbody>{maps.info.map((i: any) => (
              <tr key={i.id} className="border-b border-slate-100">
                <td className="td">{i.name}</td><td className="td text-slate-500">{i.classification}</td>
                <td className="td text-xs">{i.quality?.startsWith("Brister") || i.quality?.startsWith("Ofullständig") ? <span className="text-amber-600">{i.quality}</span> : <span className="text-slate-500">{i.quality}</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>

        <Card title="Systemkatalogen" subtitle="IT- och OT-system med livscykelstatus och teknisk skuld · förvaltas av IT-arkitektur">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th">System</th><th className="th">Livscykel</th><th className="th">Teknisk skuld</th></tr></thead>
            <tbody>{maps.systems.map((s: any) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="td">{s.name}</td><td className="td text-slate-500">{s.lifecycle}</td>
                <td className="td text-xs text-amber-600">{s.debt}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>

        <Card title="Organisationskartan" subtitle="OU:er, nyckelroller och förändringskapacitet per kompetensområde">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th">OU</th><th className="th">Förändringskapacitet (h/kvartal)</th></tr></thead>
            <tbody>{maps.ous.map((o: any) => {
              const cap = getCapacityView(o.id);
              const byComp = new Map<string, number>();
              for (const r of cap) if (!byComp.has(r.competence)) byComp.set(r.competence, r.available);
              return (
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="td font-medium">{o.name}</td>
                  <td className="td text-xs text-slate-500">
                    {byComp.size === 0 ? "–" : [...byComp.entries()].map(([c, h]) => `${c} ${fmt(h)}`).join(" · ")}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          <div className="mt-3 text-xs text-slate-500">
            Nyckelroller: {users.map((u) => `${u.name} (${u.role})`).join(" · ")}
          </div>
        </Card>
      </div>

      <Card title="Förmågekartan med korsmappningar" subtitle="Navet som övriga kartor mappas mot. När ett tema pekar ut en förmåga följer berörda processer, informationsobjekt, system och OU:er direkt ur korsmappningarna.">
        <div className="space-y-3">
          {areas.map((a) => (
            <details key={a.id} className="rounded-lg border border-slate-100">
              <summary className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{a.name}</summary>
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {capabilities.filter((c) => c.area_id === a.id).map((c) => {
                  const cross = getCapabilityCrossMap(c.id);
                  const has = cross.processes.length + cross.info.length + cross.systems.length + cross.ous.length > 0;
                  return (
                    <div key={c.id} className="px-4 py-2.5 text-sm">
                      <span className="font-medium text-slate-800">{c.name}</span>
                      {has ? (
                        <div className="mt-1 grid gap-1 text-xs text-slate-500 md:grid-cols-4">
                          <span><strong className="text-slate-400">Processer:</strong> {cross.processes.map((p: any) => p.name).join(", ") || "–"}</span>
                          <span><strong className="text-slate-400">Information:</strong> {cross.info.map((i: any) => i.name).join(", ") || "–"}</span>
                          <span><strong className="text-slate-400">System:</strong> {cross.systems.map((s: any) => s.name).join(", ") || "–"}</span>
                          <span><strong className="text-slate-400">OU:er:</strong> {cross.ous.map((o: any) => o.short).join(", ") || "–"}</span>
                        </div>
                      ) : (
                        <span className="ml-2 text-xs text-amber-600">korsmappning saknas – minimikrav: grov men komplett före första metodcykeln</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
