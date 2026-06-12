import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Navet · Förmågebaserad planering",
  description: "Plattform för taktisk styrning – från strategiska teman till OU-roadmap och realisering",
};

const NAV = [
  { href: "/", label: "Navet", icon: "◉", hint: "Uppföljning, vägval, prioritering" },
  { href: "/teman", label: "Teman & OKR", icon: "1–2", hint: "Steg 1–2" },
  { href: "/formagor", label: "Förmågekarta", icon: "3", hint: "Steg 3 · Heatmapping" },
  { href: "/gap", label: "Gap-register", icon: "4", hint: "Steg 4 · GAP-analys" },
  { href: "/roadmap", label: "OU-roadmap", icon: "5", hint: "Steg 5 · Initiativ & kapacitet" },
  { href: "/konsolidering", label: "Konsolidering", icon: "6", hint: "Steg 6 · Fem analyser & WSJF" },
  { href: "/uppfoljning", label: "Realisering", icon: "7", hint: "Steg 7 · Status & nytta" },
  { href: "/vagval", label: "Vägval & beslut", icon: "⇄", hint: "Beslutslogg" },
  { href: "/grundkartor", label: "Grundkartor", icon: "▦", hint: "Faktabasen" },
  { href: "/metod", label: "Metodstöd", icon: "✓", hint: "Checklistor & kadens" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <div className="flex min-h-screen">
          <aside className="fixed inset-y-0 w-64 overflow-y-auto bg-slate-900 text-slate-200">
            <div className="px-5 py-6">
              <Link href="/" className="block">
                <div className="text-xl font-bold tracking-tight text-white">Navet</div>
                <div className="mt-0.5 text-xs text-slate-400">Förmågebaserad planering</div>
              </Link>
            </div>
            <nav className="space-y-0.5 px-3 pb-6">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-800 transition-colors">
                  <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[11px] font-semibold text-indigo-300 group-hover:bg-slate-700">
                    {item.icon}
                  </span>
                  <span>
                    <span className="block font-medium text-slate-100">{item.label}</span>
                    <span className="block text-[11px] text-slate-400">{item.hint}</span>
                  </span>
                </Link>
              ))}
            </nav>
            <div className="mx-5 mb-6 rounded-lg bg-slate-800/60 p-3 text-[11px] leading-relaxed text-slate-400">
              <span className="font-semibold text-slate-300">Kärnprincip:</span> teman säger <em>vad</em> och <em>varför</em>,
              förmågeanalysen <em>vilka delar</em>, OU-roadmaps <em>hur</em> och <em>när</em>.
              Uppföljningen i DEMT sluter cirkeln.
            </div>
          </aside>
          <main className="ml-64 flex-1 px-8 py-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
