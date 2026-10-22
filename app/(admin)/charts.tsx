"use client";

import { useEffect, useRef, useState } from "react";

// Hand-drawn SVG charts for the overview. Marks follow one spec: 2px lines,
// 4px-rounded bar ends, dots with a 2px surface ring, hairline grid, and a
// hover tooltip on every chart. Text always uses ink colors, never series colors.

const SERIES = [
  { key: "riffs", label: "Riffs created", color: "var(--series-1)" },
  { key: "votes", label: "Votes cast", color: "var(--series-2)" },
  { key: "battles", label: "Battles judged", color: "var(--series-3)" },
] as const;

type Tip = { x: number; y: number; content: React.ReactNode } | null;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  // Flip to the left of the pointer near the right edge.
  const flip = tip.x > width - 180;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
      }}
    >
      {tip.content}
    </div>
  );
}

// Round axis maximum and ticks: 0 / 5 / 10 / 15 style.
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001 || ticks.length < 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
  return ticks;
}

function shortDay(day: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${day}T00:00:00Z`)
  );
}

export type ActivityPoint = { day: string; riffs: number; votes: number; battles: number };

export function ActivityChart({ data }: { data: ActivityPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 260;
  const pad = { top: 12, right: 12, bottom: 26, left: 32 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const ticks = niceTicks(Math.max(...data.flatMap((d) => [d.riffs, d.votes, d.battles])));
  const yMax = ticks.at(-1)!;
  const x = (i: number) => pad.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : 0);
  const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - pad.left) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div>
      <Legend />
      <div ref={ref} className="relative mt-3">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            onPointerMove={move}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label="Daily riffs, votes and battles over the last 30 days"
            className="block touch-none"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--line)"} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % 7 === (data.length - 1) % 7 ? (
                <text
                  key={d.day}
                  x={x(i)}
                  y={height - 6}
                  textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                  className="fill-muted text-[11px]"
                >
                  {shortDay(d.day)}
                </text>
              ) : null
            )}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--axis)" />}
            {SERIES.map((s) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")}
              />
            ))}
            {hover !== null &&
              SERIES.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
          </svg>
        )}
        <Tooltip
          width={width}
          tip={
            hovered && hover !== null
              ? {
                  x: x(hover),
                  y: pad.top + innerH / 2,
                  content: (
                    <>
                      <p className="mb-1 font-semibold">{shortDay(hovered.day)}</p>
                      {SERIES.map((s) => (
                        <p key={s.key} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-ink-2">
                            <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                            {s.label}
                          </span>
                          <span className="tabular font-medium">{hovered[s.key]}</span>
                        </p>
                      ))}
                    </>
                  ),
                }
              : null
          }
        />
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="tabular w-full text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">Day</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="py-1 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...data].reverse().map((d) => (
                <tr key={d.day}>
                  <td className="py-1">{shortDay(d.day)}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="py-1 text-right">
                      {d[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export type BattledRiff = {
  id: number;
  caption: string;
  creator: string;
  score: number;
  wins: number;
  losses: number;
  winRate: number;
};

// Each dot is a riff: x = vote score, y = share of battles won.
export function CrowdVsArena({ data }: { data: BattledRiff[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 240;
  const pad = { top: 12, right: 16, bottom: 34, left: 40 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const lo = Math.min(0, ...data.map((d) => d.score)) - 1;
  const hi = Math.max(1, ...data.map((d) => d.score)) + 1;
  const x = (v: number) => pad.left + ((v - lo) / (hi - lo)) * innerW;
  const y = (r: number) => pad.top + innerH - r * innerH;
  const xTicks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(
    (v, _, all) => all.length <= 9 || v % Math.ceil(all.length / 8) === 0
  );
  const point = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Vote score versus battle win rate per riff" className="block">
          {[0, 0.5, 1].map((r) => (
            <g key={r}>
              <line x1={pad.left} x2={width - pad.right} y1={y(r)} y2={y(r)} stroke={r === 0 ? "var(--axis)" : "var(--line)"} />
              <text x={pad.left - 8} y={y(r)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">
                {r * 100}%
              </text>
            </g>
          ))}
          {lo < 0 && <line x1={x(0)} x2={x(0)} y1={pad.top} y2={pad.top + innerH} stroke="var(--axis)" />}
          {xTicks.map((v) => (
            <text key={v} x={x(v)} y={pad.top + innerH + 16} textAnchor="middle" className="tabular fill-muted text-[11px]">
              {v > 0 ? `+${v}` : v}
            </text>
          ))}
          <text x={pad.left + innerW / 2} y={height - 2} textAnchor="middle" className="fill-muted text-[11px]">
            Vote score (up − down)
          </text>
          {data.map((d, i) => (
            <g key={d.id} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <circle cx={x(d.score)} cy={y(d.winRate)} r={12} fill="transparent" />
              <circle
                cx={x(d.score)}
                cy={y(d.winRate)}
                r={hover === i ? 6 : 5}
                fill="var(--series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          ))}
        </svg>
      )}
      <Tooltip
        width={width}
        tip={
          point
            ? {
                x: x(point.score),
                y: y(point.winRate),
                content: (
                  <>
                    <p className="mb-1 line-clamp-2 max-w-52 font-semibold">{point.caption}</p>
                    <p className="text-ink-2">by {point.creator}</p>
                    <p className="tabular mt-1">
                      Vote score {point.score > 0 ? `+${point.score}` : point.score} · Battles {point.wins}–{point.losses} (
                      {Math.round(point.winRate * 100)}%)
                    </p>
                  </>
                ),
              }
            : null
        }
      />
    </div>
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hourLabel(h: number) {
  return h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
}

// Activity by weekday and hour; darker = busier. One hue, more = stronger.
export function Heatmap({ data }: { data: number[][] }) {
  const [tip, setTip] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...data.flat());
  const busiest = data
    .flatMap((row, d) => row.map((n, h) => ({ d, h, n })))
    .sort((a, b) => b.n - a.n)[0];

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="relative min-w-[560px]">
          <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px]">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center text-[10px] text-muted">
                {h % 3 === 0 ? hourLabel(h) : ""}
              </span>
            ))}
            {data.map((row, d) => (
              <Row key={d} label={DAY_LABELS[d]}>
                {row.map((n, h) => (
                  <span
                    key={h}
                    onPointerEnter={() => setTip({ d, h })}
                    onPointerLeave={() => setTip(null)}
                    className={`aspect-square rounded-[3px] ${tip?.d === d && tip?.h === h ? "ring-2 ring-ink" : ""}`}
                    style={{
                      background:
                        n === 0
                          ? "var(--surface-2)"
                          : `color-mix(in oklab, var(--series-1) ${Math.round(20 + (n / max) * 80)}%, var(--surface))`,
                    }}
                    aria-label={`${DAY_LABELS[d]} ${hourLabel(h)}: ${n} actions`}
                  />
                ))}
              </Row>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 min-h-5 text-xs text-ink-2" aria-live="polite">
        {tip ? (
          <>
            <b className="text-ink">
              {DAY_LABELS[tip.d]} {hourLabel(tip.h)}–{hourLabel((tip.h + 1) % 24)}
            </b>{" "}
            · {data[tip.d][tip.h]} riffs, votes and battle picks
          </>
        ) : busiest && busiest.n > 0 ? (
          <>
            Busiest hour: <b className="text-ink">{DAY_LABELS[busiest.d]}s around {hourLabel(busiest.h)}</b> (New York
            time). Hover a square for its count.
          </>
        ) : (
          "No activity yet."
        )}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="self-center text-[11px] text-muted">{label}</span>
      {children}
    </>
  );
}

// Horizontal bars with the value at the tip.
export function BarList({
  rows,
  format = (n) => String(n),
}: {
  rows: { key: string; label: React.ReactNode; value: number; note?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="group" title={r.note}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            {r.note && <span className="shrink-0 text-xs text-muted">{r.note}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 flex-1 rounded-r bg-surface-2">
              <div
                className="h-full rounded-r bg-series-1 transition-opacity group-hover:opacity-80"
                style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 4 : 0 }}
              />
            </div>
            <span className="tabular w-8 shrink-0 text-right text-sm font-medium">{format(r.value)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
