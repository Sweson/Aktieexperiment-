import { runQualityChecks } from "@/lib/quality";
import { Card, CheckIcon } from "@/components/ui";

export const dynamic = "force-dynamic";

const FORUMS = [
  { name: "Temaöversyn (steg 1–2)", freq: "Årligen, kv 2, inför affärsplan", who: "DEMT, PMO, strategi", what: "Ompröva teman och OKR, utse/bekräfta temaägare" },
  { name: "Förmågeforum (steg 3–4)", freq: "Kv 2–3 samt löpande", who: "Temaägare, koordinator, förmågesakkunniga, arkitektur", what: "Heatmapping och gap-analys per tema" },
  { name: "Roadmapforum per OU (steg 5)", freq: "Kvartalsvis, v-6 före PI", who: "OU-chef, OU-ledning, portfölj, temakoordinatorer", what: "OU-roadmap uppdateras: initiativ, tidplan, resurser" },
  { name: "Konsolideringsforum (steg 6)", freq: "Kvartalsvis, v-4 före PI", who: "PMO, temakoordinatorer, portfölj", what: "Konsoliderad roadmap, konfliktlista, prioriteringsförslag" },
  { name: "DEMT roadmapbeslut (steg 6)", freq: "Kvartalsvis, v-3 före PI", who: "DEMT", what: "Beslut: roadmap, prioritering, vägval, resursavvägningar" },
  { name: "PI-planering (steg 7)", freq: "Per PI-kadens", who: "ART:er, portfölj", what: "Epics och PI-mål planeras utifrån beslutad roadmap" },
  { name: "Temauppföljning (nav)", freq: "Månadsvis i DEMT", who: "DEMT med temaägare som föredragande", what: "OKR-utfall, leveransstatus, avvikelser, eskalerade vägval" },
];

const RACI = [
  ["1 Teman och OKR", "A/R", "C", "R", "C", "I", "C", "R"],
  ["2 Utse temaägare, mandat", "A/R", "C", "I", "I", "—", "—", "R"],
  ["3 Påverkansanalys / heatmap", "I", "A", "R", "C", "R", "R", "C"],
  ["4 Gap-analys", "I", "A", "R", "C", "R", "R", "C"],
  ["5 OU-roadmap", "I", "C", "C", "A/R", "C", "C", "C"],
  ["6 Konsolidering och beslut", "A", "R", "R", "C", "I", "C", "R"],
  ["7 Realisering", "I", "A (KR)", "C", "A/R (leverans)", "C", "C", "C"],
  ["Nav: månadsuppföljning", "A", "R", "R", "C", "I", "I", "R"],
  ["Nav: kvartalsprioritering", "A/R", "R", "R", "C", "I", "C", "R"],
  ["Årlig temaöversyn", "A/R", "R", "R", "C", "C", "C", "R"],
];

export default function MethodPage() {
  const steps = runQualityChecks();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Metodstöd</h1>
        <p className="mt-1 text-sm text-slate-500">
          Handbokens checklistor (bilaga D) utvärderade live mot portföljens faktiska läge, samt kadens, forum och RACI.
        </p>
      </header>

      <Card title="Kvalitetsmotorn – checklistor per steg" subtitle="Varje kriterium prövas automatiskt mot informationsmodellen. Rött = åtgärd krävs före nästa grind.">
        <div className="grid gap-4 lg:grid-cols-2">
          {steps.map((s) => (
            <div key={s.step} className="rounded-lg border border-slate-100 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">{s.step}</span>
                <h3 className="font-semibold text-slate-800">{s.title}</h3>
                <span className="ml-auto text-xs text-slate-400">{s.checks.filter((c) => c.ok).length}/{s.checks.length}</span>
              </div>
              <ul className="space-y-2">
                {s.checks.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckIcon ok={c.ok} />
                    <span className="text-slate-700">
                      {c.label}
                      {c.detail && <span className={`block text-xs ${c.ok ? "text-slate-400" : "text-rose-600"}`}>{c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Forum och kadens – årshjulet" subtitle="Tumregel: roadmapforum (v-6) → konsolidering (v-4) → DEMT-beslut (v-3) → PI-planering (v-0). Den som missar sitt fönster planerar på föregående kvartals beslut.">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th">Forum</th><th className="th">Frekvens</th><th className="th">Innehåll</th></tr></thead>
            <tbody>
              {FORUMS.map((f) => (
                <tr key={f.name} className="border-b border-slate-100">
                  <td className="td font-medium text-slate-700">{f.name}<span className="block text-xs font-normal text-slate-400">{f.who}</span></td>
                  <td className="td text-xs text-slate-500">{f.freq}</td>
                  <td className="td text-xs text-slate-500">{f.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Styrmodellen – en ledningsgrupp i tre kapaciteter" subtitle="DEMT består av OU-cheferna: samma personer, tydlig kapacitetsseparation">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-800">Kollektivt – DEMT</div>
              <p className="text-slate-600">Beslutsorgan: teman, OKR, konsoliderad roadmap, vägval, prioritering – utifrån helheten, inte egen OU.</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-800">Tvärgående – temaägare</div>
              <p className="text-slate-600">Äger temats resultat tvärs alla OU:er. En hatt, inte en position. Kan ALDRIG delegeras under DEMT.</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-800">I linjen – OU-chef</div>
              <p className="text-slate-600">Äger OU-roadmap, resurssättning och leverans. Roadmaparbetet kan delegeras till roadmapansvarig – fastställelse och leveransåtagande kan inte.</p>
            </div>
            <p className="text-xs text-slate-500">
              PMO är processägare och facilitator – håller kadensen, förvaltar informationsmodellen, bereder underlag,
              fattar aldrig innehållsbeslut. Vägval ska vinnas i sak – inte i förhandlingsstyrka.
            </p>
          </div>
        </Card>
      </div>

      <Card title="Samlad RACI-matris (bilaga B)" subtitle="A = Accountable · R = Responsible · C = Consulted · I = Informed">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-slate-200">
              <th className="th">Steg / aktivitet</th><th className="th">DEMT</th><th className="th">Temaägare</th><th className="th">Temakoord.</th>
              <th className="th">OU-chef</th><th className="th">Förmågesakk.</th><th className="th">Arkitektur</th><th className="th">PMO</th>
            </tr></thead>
            <tbody>
              {RACI.map((row) => (
                <tr key={row[0]} className="border-b border-slate-100">
                  {row.map((cell, i) => (
                    <td key={i} className={`td ${i === 0 ? "font-medium text-slate-700" : "text-slate-500"} ${cell.includes("A") && i > 0 ? "font-semibold text-indigo-700" : ""}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Metodens mognadstrappa" subtitle="PMO utvärderar styrförmågan årligen – samma femgradiga skala som förmågebedömningen">
        <div className="grid gap-2 md:grid-cols-5">
          {[
            ["1 Initial", "Teman på papper; planering per OU utan koppling; uppföljning är statusrapportering"],
            ["2 Repeterbar", "Cykeln genomförs men ojämnt; gap-analyser för vissa teman; prioritering delvis politisk"],
            ["3 Definierad", "Alla sju steg i kadens; informationsmodellen följs; beslutslogg förs; KR följs månadsvis"],
            ["4 Styrd", "Prognosdriven styrning; vägval tas proaktivt; kapacitetsdata tillförlitlig; PI och roadmap synkade"],
            ["5 Optimerande", "Omprioritering på veckor; lärandemönster driver metodförbättring; spårbarhet automatisk"],
          ].map(([t, d], i) => (
            <div key={t} className={`rounded-lg p-3 text-xs ${i === 2 ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-600"}`}>
              <div className={`font-semibold ${i === 2 ? "text-white" : "text-slate-800"}`}>{t}</div>
              <p className="mt-1">{d}</p>
              {i === 2 && <p className="mt-1 font-medium">← plattformens målnivå vid införande</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
