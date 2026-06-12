export const DIMENSIONS = [
  "Process",
  "Organisation och kompetens",
  "Information och data",
  "Teknik och system",
  "Styrning",
  "Partner och leverantör",
] as const;

export const MATURITY = ["", "Initial", "Repeterbar", "Definierad", "Styrd", "Optimerande"];

export const CRITICALITY = ["Ingen", "Stödjande", "Viktig", "Kritisk"] as const;
export const MOVEMENT = ["Utnyttja", "Förbättra", "Bygga ny"] as const;

export function quarterRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, q] = from.split("-Q").map(Number);
  const [ty, tq] = to.split("-Q").map(Number);
  while (y < ty || (y === ty && q <= tq)) {
    out.push(`${y}-Q${q}`);
    q++;
    if (q > 4) { q = 1; y++; }
  }
  return out;
}

export function currentQuarter(d = new Date()): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function cmpQuarter(a: string, b: string): number {
  return a.localeCompare(b);
}

export const PLANNING_QUARTERS = ["2026-Q3", "2026-Q4", "2027-Q1", "2027-Q2"];

export function ragColor(rag: string): string {
  if (rag === "grön") return "bg-emerald-500";
  if (rag === "gul") return "bg-amber-400";
  if (rag === "röd") return "bg-rose-500";
  return "bg-slate-300";
}

export function ragText(rag: string): string {
  if (rag === "grön") return "text-emerald-700 bg-emerald-50 ring-emerald-600/20";
  if (rag === "gul") return "text-amber-700 bg-amber-50 ring-amber-600/20";
  if (rag === "röd") return "text-rose-700 bg-rose-50 ring-rose-600/20";
  return "text-slate-600 bg-slate-50 ring-slate-500/20";
}

export function classBadge(c: string): string {
  if (c === "Måste") return "text-rose-700 bg-rose-50 ring-rose-600/20";
  if (c === "Bör") return "text-amber-700 bg-amber-50 ring-amber-600/20";
  return "text-slate-600 bg-slate-50 ring-slate-500/20";
}

export function statusBadge(s: string): string {
  if (s === "committed") return "text-indigo-700 bg-indigo-50 ring-indigo-600/20";
  if (s === "planned") return "text-sky-700 bg-sky-50 ring-sky-600/20";
  return "text-slate-600 bg-slate-50 ring-slate-500/20";
}

export function critColor(c: string, movement?: string): string {
  if (c === "Kritisk") return movement === "Bygga ny" ? "bg-rose-600 text-white" : "bg-rose-500 text-white";
  if (c === "Viktig") return "bg-amber-400 text-slate-900";
  if (c === "Stödjande") return "bg-sky-200 text-slate-800";
  return "bg-slate-100 text-slate-500";
}

/** KR-progress 0–100 utifrån riktning. */
export function krProgress(baseline: number, target: number, value: number | null, direction: string): number {
  if (value == null || target === baseline) return 0;
  const p = direction === "down"
    ? (baseline - value) / (baseline - target)
    : (value - baseline) / (target - baseline);
  return Math.max(0, Math.min(100, Math.round(p * 100)));
}

export function fmt(n: number | null | undefined): string {
  if (n == null) return "–";
  return Number.isInteger(n) ? String(n) : n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
}
