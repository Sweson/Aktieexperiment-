import React from "react";
import { ragText, classBadge, statusBadge } from "@/lib/format";

export function Card({ title, subtitle, children, className = "", actions }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; className?: string; actions?: React.ReactNode;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Rag({ rag, label }: { rag: string; label?: string }) {
  return <span className={`badge ${ragText(rag)}`}>{label ?? rag}</span>;
}

export function ClassBadge({ c }: { c: string }) {
  return <span className={`badge ${classBadge(c)}`}>{c}</span>;
}

export function StatusBadge({ s }: { s: string }) {
  return <span className={`badge ${statusBadge(s)}`}>{s}</span>;
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "warn" | "bad" | "good" }) {
  const tones = {
    default: "text-slate-900",
    warn: "text-amber-600",
    bad: "text-rose-600",
    good: "text-emerald-600",
  };
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
  ) : (
    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-xs font-bold">!</span>
  );
}

export function Progress({ pct, tone }: { pct: number; tone?: string }) {
  const color = tone ?? (pct >= 70 ? "bg-emerald-500" : pct >= 35 ? "bg-amber-400" : "bg-rose-400");
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}
