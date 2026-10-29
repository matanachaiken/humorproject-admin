"use client";

import { useActionState, useState } from "react";
import { updateMix } from "./actions";

export type MixRow = {
  id: number;
  name: string;
  weight: number;
  requests: number;
  succeeded: number;
  riffs: number;
  avgPoints: number | null;
};

export default function MixForm({ rows }: { rows: MixRow[] }) {
  const [state, formAction, pending] = useActionState(updateMix, null);
  const [weights, setWeights] = useState(() => Object.fromEntries(rows.map((r) => [r.id, r.weight])));
  const total = Object.values(weights).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  return (
    <form action={formAction}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2 pr-4 font-medium">Chain</th>
              <th className="py-2 pr-4 font-medium">Weight</th>
              <th className="py-2 pr-4 font-medium">Share of new riffs</th>
              <th className="py-2 pr-4 text-right font-medium">Requests</th>
              <th className="py-2 pr-4 text-right font-medium">Succeeded</th>
              <th className="py-2 text-right font-medium">Avg points</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {rows.map((r) => {
              const share = total > 0 ? (weights[r.id] || 0) / total : 0;
              return (
                <tr key={r.id}>
                  <td className="py-3 pr-4 font-medium">{r.name}</td>
                  <td className="py-3 pr-4">
                    <input
                      type="number"
                      name={`weight-${r.id}`}
                      min={0}
                      max={100}
                      step={1}
                      required
                      value={Number.isFinite(weights[r.id]) ? weights[r.id] : ""}
                      onChange={(e) => setWeights((w) => ({ ...w, [r.id]: e.target.valueAsNumber }))}
                      aria-label={`Weight for ${r.name}`}
                      className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-32 rounded-r bg-surface-2">
                        <div className="h-full rounded-r bg-series-1" style={{ width: `${share * 100}%` }} />
                      </div>
                      <span className="w-10 text-right">{Math.round(share * 100)}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">{r.requests}</td>
                  <td className="py-3 pr-4 text-right">
                    {r.requests ? `${Math.round((r.succeeded / r.requests) * 100)}%` : "—"}
                  </td>
                  <td className="py-3 text-right">{r.avgPoints === null ? "—" : r.avgPoints.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          disabled={pending}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save mix"}
        </button>
        <p role="status" className="text-sm">
          {state?.error && <span className="text-bad">{state.error}</span>}
          {state?.saved && !pending && <span className="text-good">Saved. New riffs use this mix within 30 seconds.</span>}
        </p>
      </div>
    </form>
  );
}
