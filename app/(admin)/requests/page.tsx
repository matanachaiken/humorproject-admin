import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { formatWhen, fullName, number } from "@/lib/format";
import { EmptyState, PageHeader, SortLinks, StatusBadge, formatMs } from "../ui";

export const metadata: Metadata = { title: "Generation requests" };

const FILTERS = {
  all: "All",
  succeeded: "Succeeded",
  off_theme: "Off theme",
  rejected: "Rejected",
  problems: "Problems",
} as const;
type Filter = keyof typeof FILTERS;
const PROBLEMS = ["blocked", "busy", "failed", "pending"];

type RequestRow = {
  id: number;
  user_id: string | null;
  idea: string;
  theme: string | null;
  style: string | null;
  status: string;
  duration_ms: number | null;
  generation_id: number | null;
  created_at: string;
  prompt_chains: { name: string } | null;
};

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const { db } = await requireAdmin();
  const params = await searchParams;
  const filter: Filter = typeof params.status === "string" && params.status in FILTERS ? (params.status as Filter) : "all";

  let query = db
    .from("generation_requests")
    .select("id, user_id, idea, theme, style, status, duration_ms, generation_id, created_at, prompt_chains (name)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter === "problems") query = query.in("status", PROBLEMS);
  else if (filter !== "all") query = query.eq("status", filter);

  const [{ data: rows }, { data: all }, { data: people }] = await Promise.all([
    query.overrideTypes<RequestRow[], { merge: false }>(),
    db.from("generation_requests").select("status, duration_ms").limit(10000),
    db.from("profiles").select("id, first_name, last_name"),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id as string, fullName(p)]));
  const total = all?.length ?? 0;
  const succeeded = (all ?? []).filter((r) => r.status === "succeeded");
  const times = succeeded.map((r) => r.duration_ms).filter((d): d is number => d !== null).sort((a, b) => a - b);

  return (
    <>
      <PageHeader
        title="Generation requests"
        description="Every time someone tries to make a riff, whether or not it worked. Open one to see each AI call it made."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Tile label="Requests" value={number.format(total)} />
        <Tile label="Succeeded" value={total ? `${Math.round((succeeded.length / total) * 100)}%` : "—"} sub={`${succeeded.length} riffs made`} />
        <Tile label="Typical time" value={times.length ? formatMs(times[Math.floor(times.length / 2)]) : "—"} sub="Median for successful riffs" />
      </div>
      <div className="mb-4">
        <SortLinks name="status" options={FILTERS} current={filter} params={{}} />
      </div>

      {!rows?.length ? (
        <EmptyState>
          {total ? "No requests match." : "No requests yet. They appear here once someone makes a riff in Daily Riff."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Idea</th>
                <th className="px-4 py-3 font-medium">Chain</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <Link href={`/requests/${r.id}`} className="underline-offset-4 hover:underline">
                      {formatWhen(r.created_at)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top">{r.user_id ? (names.get(r.user_id) ?? "Unknown") : "Deleted user"}</td>
                  <td className="px-4 py-3 align-top">
                    <Link href={`/requests/${r.id}`} className="line-clamp-2 max-w-xs hover:underline">
                      {r.idea}
                    </Link>
                    {r.theme && <span className="line-clamp-1 text-xs text-muted">Theme: {r.theme}</span>}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-2">{r.prompt_chains?.name ?? "—"}</td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={r.status} />
                    {r.generation_id && (
                      <Link href={`/media/${r.generation_id}`} className="block text-xs text-ink-2 underline underline-offset-4">
                        Riff #{r.generation_id}
                      </Link>
                    )}
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-3 text-right align-top">{formatMs(r.duration_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-ink-2">{sub}</p>}
    </div>
  );
}
