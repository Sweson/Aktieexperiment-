import Link from "next/link";
import { getThemes, getKrsWithLatest } from "@/lib/queries";
import { createTheme } from "@/lib/actions";
import { Card, Rag } from "@/components/ui";
import { ragColor, fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function ThemesPage() {
  const themes = getThemes();
  const krs = getKrsWithLatest();
  const decided = themes.filter((t) => t.status === "beslutad");

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Strategiska teman med mätbara mål</h1>
          <p className="mt-1 text-sm text-slate-500">
            Steg 1–2 · 3–5 differentierande affärsmål i OKR-format, var och en med namngiven ägare i DEMT,
            mandatkort och plats i temarangordningen.
          </p>
        </div>
      </header>

      {decided.length >= 5 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Designprincip 1 – få teman, hård prioritering:</strong> fem teman är beslutade.
          Ett tema som läggs till tvingar fram frågan vilket som ska bort.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {themes.map((t) => {
          const tkrs = krs.filter((k) => k.theme_id === t.id);
          return (
            <Link key={t.id} href={`/teman/${t.id}`} className="card block p-5 hover:border-indigo-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {t.priority_rank ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">{t.priority_rank}</span>
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold text-slate-500">–</span>
                  )}
                  <h2 className="font-semibold text-slate-900">{t.name}</h2>
                </div>
                <span className={`badge ${t.status === "beslutad" ? "text-emerald-700 bg-emerald-50 ring-emerald-600/20" : "text-slate-600 bg-slate-100 ring-slate-500/20"}`}>
                  {t.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 line-clamp-2">{t.objective}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Temaägare: <span className="font-medium text-slate-700">{t.owner_name ?? "ej utsedd"}</span></span>
                <span>Koordinator: {t.coordinator_name ?? "–"}</span>
              </div>
              {tkrs.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5">
                  {tkrs.map((k) => (
                    <span key={k.id} className={`h-2.5 w-2.5 rounded-full ${ragColor(k.rag ?? "")}`}
                      title={`${k.title}: ${fmt(k.actual)} → ${fmt(k.forecast)} (mål ${fmt(k.target)})`} />
                  ))}
                  <span className="ml-1 text-xs text-slate-400">{tkrs.length} Key Results</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <Card title="Nytt temakandidat" subtitle="Kandidater formuleras på temakortets framsida och prövas mot testfrågorna: differentierande, förflyttande, tvärgående, mätbart, begränsande">
        <form action={createTheme} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Tema (kort, förflyttningsorienterat namn)</label>
            <input name="name" required className="input" placeholder="t.ex. Kapacitet för elektrifieringen" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Objective (max två meningar – kvalitativt och riktningsgivande)</label>
            <textarea name="objective" rows={2} className="input" placeholder="Vart ska vi och varför spelar det roll?" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Varför nu (drivkrafter: strategi, reglering, marknad, risk)</label>
            <textarea name="why_now" rows={2} className="input" />
          </div>
          <div>
            <button className="btn">Skapa temakort</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
