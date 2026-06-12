import React from "react";
import { DIMENSIONS } from "@/lib/format";

/** Trendlinje för KR-mätserier: utfall (heldragen) och prognosmål. */
export function Sparkline({ points, baseline, target, direction }: {
  points: { date: string; actual: number | null }[];
  baseline: number; target: number; direction: string;
}) {
  const vals = points.map((p) => p.actual).filter((v): v is number => v != null);
  if (vals.length === 0) return <div className="text-xs text-slate-400">Inga mätningar</div>;
  const all = [...vals, baseline, target];
  const min = Math.min(...all), max = Math.max(...all);
  const W = 180, H = 44, pad = 4;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - 2 * pad);
  const y = (v: number) => max === min ? H / 2 : pad + ((max - v) / (max - min)) * (H - 2 * pad);
  const path = points
    .map((p, i) => (p.actual == null ? null : `${i === 0 || points[i - 1].actual == null ? "M" : "L"}${x(i).toFixed(1)},${y(p.actual).toFixed(1)}`))
    .filter(Boolean).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <line x1={pad} x2={W - pad} y1={y(target)} y2={y(target)} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
      <line x1={pad} x2={W - pad} y1={y(baseline)} y2={y(baseline)} stroke="#cbd5e1" strokeDasharray="2 3" strokeWidth={1} />
      <path d={path} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" />
      {points.map((p, i) => p.actual == null ? null : <circle key={i} cx={x(i)} cy={y(p.actual)} r={2.5} fill="#4f46e5" />)}
    </svg>
  );
}

/** Gap-profil per förmågedimension: nuläge mot målläge (handbokens figur 6) som spindeldiagram. */
export function Radar({ dims }: { dims: { dimension: string; current: number; target: number }[] }) {
  const N = DIMENSIONS.length;
  const R = 80, C = 110;
  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt = (i: number, v: number) => {
    const r = (v / 5) * R;
    return [C + r * Math.cos(angle(i)), C + r * Math.sin(angle(i))];
  };
  const byDim = (name: string) => dims.find((d) => d.dimension === name);
  const poly = (key: "current" | "target") =>
    DIMENSIONS.map((d, i) => pt(i, byDim(d)?.[key] ?? 0).map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <svg width={2 * C} height={2 * C} className="overflow-visible">
      {[1, 2, 3, 4, 5].map((lvl) => (
        <polygon key={lvl}
          points={DIMENSIONS.map((_, i) => pt(i, lvl).map((v) => v.toFixed(1)).join(",")).join(" ")}
          fill="none" stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {DIMENSIONS.map((d, i) => {
        const [x, y] = pt(i, 5);
        const [lx, ly] = pt(i, 6.3);
        return (
          <g key={d}>
            <line x1={C} y1={C} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500" fontSize={9}>
              {d.length > 14 ? d.split(" ")[0] : d}
            </text>
          </g>
        );
      })}
      <polygon points={poly("target")} fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth={2} />
      <polygon points={poly("current")} fill="rgba(79,70,229,0.12)" stroke="#4f46e5" strokeWidth={2} strokeDasharray="4 3" />
    </svg>
  );
}

/** Kapacitetsstapel: efterfrågan mot kapacitet med 80 %- och 100 %-markeringar. */
export function CapacityBar({ demand, available }: { demand: number; available: number }) {
  const pct = available > 0 ? (demand / available) * 100 : 0;
  const color = pct > 100 ? "bg-rose-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="relative h-4 w-full rounded bg-slate-100" title={`${Math.round(pct)} % av kapacitet`}>
      <div className={`h-4 rounded ${color}`} style={{ width: `${Math.min(100, pct * 0.8)}%` }} />
      {/* 80 %-regeln (vid 64 % av skalan eftersom 125 % är full bredd) */}
      <div className="absolute inset-y-0 border-l-2 border-slate-400" style={{ left: "64%" }} />
      <div className="absolute inset-y-0 border-l-2 border-rose-300" style={{ left: "80%" }} />
      <span className="absolute inset-y-0 right-1 text-[10px] leading-4 text-slate-600">{Math.round(pct)} %</span>
    </div>
  );
}

/** Roadmap-gantt: en rad per initiativ över kvartalsaxeln. */
export function GanttRow({ quarters, start, end, status, milestones }: {
  quarters: string[]; start: string; end: string; status: string;
  milestones?: { due_quarter: string; status: string; title: string }[];
}) {
  const si = Math.max(0, quarters.indexOf(start) === -1 ? 0 : quarters.indexOf(start));
  const eiRaw = quarters.indexOf(end);
  const ei = eiRaw === -1 ? quarters.length - 1 : eiRaw;
  const colors: Record<string, string> = {
    committed: "bg-indigo-500",
    planned: "bg-sky-400",
    outlook: "bg-slate-300",
  };
  const msColor: Record<string, string> = {
    "uppnådd": "bg-emerald-500 border-emerald-700",
    "på plan": "bg-white border-indigo-500",
    "risk": "bg-amber-400 border-amber-600",
    "försenad": "bg-rose-500 border-rose-700",
    "ej påbörjad": "bg-white border-slate-400",
  };
  return (
    <div className="grid h-7 items-center" style={{ gridTemplateColumns: `repeat(${quarters.length}, 1fr)` }}>
      <div
        className={`relative h-3.5 rounded-full ${colors[status] ?? "bg-slate-300"} opacity-90`}
        style={{ gridColumn: `${si + 1} / ${ei + 2}` }}
      >
        {milestones?.map((m, idx) => {
          const qi = quarters.indexOf(m.due_quarter);
          if (qi < 0) return null;
          const frac = (qi - si + 0.5) / (ei - si + 1);
          return (
            <span key={idx}
              title={`${m.title} (${m.due_quarter}) – ${m.status}`}
              className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rotate-45 border-2 ${msColor[m.status] ?? "bg-white border-slate-400"}`}
              style={{ left: `${Math.max(4, Math.min(96, frac * 100))}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Donut för enkel andelsvisualisering. */
export function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 26, c = 2 * Math.PI * r;
  const color = pct >= 70 ? "#10b981" : pct >= 35 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="flex items-center gap-3">
      <svg width={64} height={64}>
        <circle cx={32} cy={32} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7} />
        <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 32 32)" />
        <text x={32} y={36} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-slate-800">{Math.round(pct)}%</text>
      </svg>
      <div className="text-xs text-slate-500 max-w-[120px]">{label}</div>
    </div>
  );
}
