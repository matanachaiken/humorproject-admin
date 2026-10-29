import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { formatWhen, fullName } from "@/lib/format";
import { StatusBadge, formatMs } from "../../ui";

export const metadata: Metadata = { title: "Generation request" };

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const { db } = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [{ data: request }, { data: calls }] = await Promise.all([
    db
      .from("generation_requests")
      .select("*, prompt_chains (name, slug)")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("llm_responses")
      .select("id, provider, model, status, error, latency_ms, created_at, prompt_chain_steps (step_order, name)")
      .eq("request_id", id)
      .order("created_at"),
  ]);
  if (!request) notFound();
  const { data: person } = request.user_id
    ? await db.from("profiles").select("first_name, last_name, email").eq("id", request.user_id).maybeSingle()
    : { data: null };

  const facts: [string, React.ReactNode][] = [
    ["Status", <StatusBadge key="s" status={request.status} />],
    ["Person", person ? `${fullName(person)} (${person.email})` : "Deleted user"],
    ["When", formatWhen(request.created_at)],
    ["Took", formatMs(request.duration_ms)],
    [
      "Chain",
      request.prompt_chains ? (
        <Link key="c" href={`/chains#${request.prompt_chains.slug}`} className="underline underline-offset-4">
          {request.prompt_chains.name}
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Theme", request.theme ?? "—"],
    ["Style", request.style ?? "—"],
    [
      "Riff",
      request.generation_id ? (
        <Link key="r" href={`/media/${request.generation_id}`} className="underline underline-offset-4">
          #{request.generation_id}
        </Link>
      ) : (
        "None made"
      ),
    ],
  ];
  if (request.error) facts.push([request.status === "off_theme" ? "Nudge" : "Error", request.error]);

  return (
    <div className="max-w-4xl">
      <Link href="/requests" className="text-sm text-ink-2 hover:text-ink">
        ← All requests
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">“{request.idea}”</h1>
      <p className="mb-6 mt-1 text-sm text-ink-2">Request #{request.id}</p>

      <dl className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-2.5">
            <dt className="w-20 shrink-0 text-muted">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-3 mt-8 font-semibold">AI calls ({calls?.length ?? 0})</h2>
      {calls?.length ? (
        <ol className="space-y-2">
          {calls.map((c) => {
            const step = c.prompt_chain_steps as unknown as { step_order: number; name: string } | null;
            return (
              <li key={c.id}>
                <Link
                  href={`/responses/${c.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface px-4 py-3 text-sm hover:bg-surface-2/60"
                >
                  <span className="font-medium">{step ? `Step ${step.step_order}: ${step.name}` : "Unknown step"}</span>
                  <span className="font-mono text-xs text-ink-2">{c.model}</span>
                  <StatusBadge status={c.status} />
                  <span className="tabular ml-auto text-ink-2">{formatMs(c.latency_ms)}</span>
                  {c.error && <span className="w-full truncate text-xs text-bad">{c.error}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-ink-2">No AI calls were logged for this request.</p>
      )}
    </div>
  );
}
