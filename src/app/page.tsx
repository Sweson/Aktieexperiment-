import Link from "next/link";
import { getThemes, getKrsWithLatest, getInitiatives, getDecisions, getEscalations } from "@/lib/queries";
import { getAlerts, getKrCoverage } from "@/lib/quality";
import { Card, Rag, Stat, StatusBadge } from "@/components/ui";
import { Donut } from "@/components/charts";
import { krProgress, fmt, ragColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const themes = getThemes().filter((t) => t.status === "beslutad");
  const krs = getKrsWithLatest();
  const inits = getInitiatives();
  const alerts = getAlerts();
  const coverage = getKrCoverage();
  const decisions = getDecisions().filter((d) => d.status === "öppet");
  const openEsc = getEscalations(true);

  const committed = inits.filter((i) => i.status === "committed");
  const red = krs.filter((k) => k.rag === "röd").length;
  const yellow = krs.filter((k) => k.rag === "gul").length;
  const green = krs.filter((k) => k.rag === "grön").length;
  const covered = coverage.filter((c) => c.committed > 0).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Navet – uppföljning, vägval och prioritering</h1>
        <p className="mt-1 text-sm text-slate-500">
          Metodens motor: månadsuppföljning av OKR, kvartalsprioritering av roadmap och årlig omprövning av teman.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Beslutade teman" value={themes.length} hint="Max fem – hård prioritering" tone={themes.length > 5 ? "bad" : "default"} />
        <Stat label="Key Results" value={krs.length} hint={`${green} gröna · ${yellow} gula · ${red} röda`} tone={red > 0 ? "bad" : yellow > 0 ? "warn" : "good"} />
        <Stat label="Committed-initiativ" value={committed.length} hint={`${inits.length} totalt i portföljen`} />
        <Stat label="KR-täckning" value={`${covered}/${coverage.length}`} hint="KR med committed-bärare" tone={covered < coverage.length ? "warn" : "good"} />
        <Stat label="Öppna beslut" value={decisions.length + openEsc.length} hint={`${decisions.length} vägval · ${openEsc.length} eskaleringar`} tone={decisions.length + openEsc.length > 0 ? "warn" : "good"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="OKR-läge per tema" subtitle="Prognosdriven uppföljning – styrning sker på prognosen, inte historiken" className="lg:col-span-2">
          <div className="space-y-5">
            {themes.map((t) => {
              const tkrs = krs.filter((k) => k.theme_id === t.id);
              return (
                <div key={t.id} className="rounded-lg border border-slate-100 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Link href={`/teman/${t.id}`} className="font-semibold text-indigo-700 hover:underline">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-600 text-[11px] font-bold text-white">{t.priority_rank}</span>
                      {t.name}
                    </Link>
                    <span className="text-xs text-slate-500">Temaägare: {t.owner_name ?? "–"}</span>
                  </div>
                  <div className="space-y-2">
                    {tkrs.map((k) => (
                      <div key={k.id} className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ragColor(k.rag ?? "")}`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-slate-700">{k.title}</div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                            <div className="h-1.5 rounded-full bg-indigo-500"
                              style={{ width: `${krProgress(k.baseline, k.target, k.actual, k.direction)}%` }} />
                          </div>
                        </div>
                        <div className="w-40 shrink-0 text-right text-xs text-slate-500">
                          {fmt(k.actual)} → prognos {fmt(k.forecast)} (mål {fmt(k.target)} {k.unit})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Kräver uppmärksamhet" subtitle="Tysta misser är det enda som inte accepteras">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">Inga avvikelser – allt på plan.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 9).map((a, i) => (
                  <li key={i}>
                    <Link href={a.href} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50">
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ragColor(a.level)}`} />
                      <span className="text-slate-700">
                        <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{a.kind}</span>
                        {a.text}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Beslut som behövs" subtitle="Regeln som bär hela formatet">
            {decisions.length === 0 && openEsc.length === 0 ? (
              <p className="text-sm text-slate-500">Inga öppna beslutspunkter.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {decisions.map((d) => (
                  <li key={`d${d.id}`}>
                    <Link href="/vagval" className="block rounded-lg border border-amber-200 bg-amber-50 p-2.5 hover:bg-amber-100">
                      <span className="font-medium text-amber-900">Vägval: {d.title}</span>
                      <span className="block text-xs text-amber-700">{d.theme_name ?? "Portföljgemensamt"} · {d.forum}</span>
                    </Link>
                  </li>
                ))}
                {openEsc.map((e) => (
                  <li key={`e${e.id}`}>
                    <Link href="/konsolidering" className="block rounded-lg border border-rose-200 bg-rose-50 p-2.5 hover:bg-rose-100">
                      <span className="font-medium text-rose-900">Eskalering: {e.title}</span>
                      <span className="block text-xs text-rose-700">{e.ou_short ?? ""} {e.quarter}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="Leveransläge committed-initiativ" subtitle="Senaste månadsprognos per initiativ (grön/gul/röd)">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {committed.map((i) => (
            <Link key={i.id} href={`/initiativ/${i.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 hover:border-indigo-200 hover:bg-indigo-50/30">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{i.name}</div>
                <div className="text-xs text-slate-500">{i.ou_short} · {i.start_quarter}–{i.end_quarter} · WSJF {i.wsjf}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge s={i.status} />
                <span className={`h-3 w-3 rounded-full ${ragColor(i.prognosis ?? "")}`} title={`Prognos: ${i.prognosis ?? "ej rapporterad"}`} />
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Spårbarhetskedjan" subtitle="Obruten i båda riktningarna" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {["Strategiskt tema", "Mätbara mål (OKR)", "Påverkade förmågor", "Förmågegap", "Initiativ", "OU-roadmap", "Konsoliderad roadmap", "Realisering", "Uppföljning mot OKR"].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{s}</span>
                {i < arr.length - 1 && <span className="text-slate-300">→</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Varje initiativ kan svara på vilket gap och vilket tema det adresserar; varje tema kan visa sina initiativ.
          </p>
        </Card>
        <Card title="Måluppfyllelse" subtitle="Genomsnittlig KR-progress mot målvärde">
          <div className="flex flex-wrap gap-4">
            {themes.map((t) => {
              const tkrs = krs.filter((k) => k.theme_id === t.id);
              const avg = tkrs.length
                ? tkrs.reduce((s, k) => s + krProgress(k.baseline, k.target, k.actual, k.direction), 0) / tkrs.length
                : 0;
              return <Donut key={t.id} pct={avg} label={t.name} />;
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
