import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { formatWhen, number } from "@/lib/format";
import { EmptyState, PageHeader, SortLinks, StatusBadge, formatMs } from "../ui";

export const metadata: Metadata = { title: "LLM responses" };

const STATUS = { all: "All", ok: "OK", error: "Errors" } as const;
const PROVIDERS = { all: "All providers", google: "Google", cloudflare: "Cloudflare" } as const;

type CallRow = {
  id: number;
  request_id: number | null;
  provider: string;
  model: string;
  prompt: string;
  response: string | null;
  status: string;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
  prompt_chains: { name: string } | null;
  prompt_chain_steps: { step_order: number; name: string } | null;
};

export default async function ResponsesPage({ searchParams }: PageProps<"/responses">) {
  const { db } = await requireAdmin();
  const params = await searchParams;
  const status = params.status === "ok" || params.status === "error" ? params.status : "all";
  const provider = params.provider === "google" || params.provider === "cloudflare" ? params.provider : "all";

  let query = db
    .from("llm_responses")
    .select("id, request_id, provider, model, prompt, response, status, error, latency_ms, created_at, prompt_chains (name), prompt_chain_steps (step_order, name)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status !== "all") query = query.eq("status", status);
  if (provider !== "all") query = query.eq("provider", provider);

  const [{ data: rows }, { data: all }] = await Promise.all([
    query.overrideTypes<CallRow[], { merge: false }>(),
    db.from("llm_responses").select("status, model").limit(10000),
  ]);
  const total = all?.length ?? 0;
  const errors = (all ?? []).filter((r) => r.status === "error").length;

  return (
    <>
      <PageHeader
        title="LLM responses"
        description={`Every call Daily Riff makes to an AI model, including failed attempts before a fallback model answered. ${number.format(total)} logged${total ? `, ${Math.round((errors / total) * 100)}% errors` : ""}.`}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SortLinks name="status" options={STATUS} current={status} params={{ provider: provider === "all" ? "" : provider }} />
        <SortLinks name="provider" options={PROVIDERS} current={provider} params={{ status: status === "all" ? "" : status }} />
      </div>

      {!rows?.length ? (
        <EmptyState>{total ? "No calls match." : "No AI calls logged yet. They appear once Daily Riff runs a prompt."}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Chain step</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Response</th>
                <th className="px-4 py-3 text-right font-medium">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <Link href={`/responses/${r.id}`} className="underline-offset-4 hover:underline">
                      {formatWhen(r.created_at)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="block">{r.prompt_chains?.name ?? "—"}</span>
                    {r.prompt_chain_steps && (
                      <span className="text-xs text-muted">
                        Step {r.prompt_chain_steps.step_order}: {r.prompt_chain_steps.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-ink-2">{r.model}</td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link href={`/responses/${r.id}`} className="line-clamp-2 max-w-sm font-mono text-xs text-ink-2 hover:underline">
                      {r.status === "ok" ? r.response : r.error}
                    </Link>
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-3 text-right align-top">{formatMs(r.latency_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
