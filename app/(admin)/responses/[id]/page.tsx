import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { formatWhen } from "@/lib/format";
import { StatusBadge, formatMs } from "../../ui";

export const metadata: Metadata = { title: "LLM response" };

export default async function ResponsePage({ params }: PageProps<"/responses/[id]">) {
  const { db } = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { data: call } = await db
    .from("llm_responses")
    .select("*, prompt_chains (name, slug), prompt_chain_steps (step_order, name)")
    .eq("id", id)
    .maybeSingle();
  if (!call) notFound();

  const response = call.status === "ok" ? prettyJson(call.response ?? "") : call.error;
  const facts: [string, React.ReactNode][] = [
    ["Status", <StatusBadge key="s" status={call.status} />],
    ["When", formatWhen(call.created_at)],
    ["Latency", formatMs(call.latency_ms)],
    ["Model", <code key="m">{call.model}</code>],
    ["Provider", call.provider],
    [
      "Chain",
      call.prompt_chains ? (
        <Link key="c" href={`/chains#${call.prompt_chains.slug}`} className="underline underline-offset-4">
          {call.prompt_chains.name}
          {call.prompt_chain_steps && ` · step ${call.prompt_chain_steps.step_order}: ${call.prompt_chain_steps.name}`}
        </Link>
      ) : (
        "—"
      ),
    ],
    [
      "Request",
      call.request_id ? (
        <Link key="r" href={`/requests/${call.request_id}`} className="underline underline-offset-4">
          #{call.request_id}
        </Link>
      ) : (
        "Not part of a riff request"
      ),
    ],
  ];

  return (
    <div className="max-w-4xl">
      <Link href="/responses" className="text-sm text-ink-2 hover:text-ink">
        ← All LLM responses
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold tracking-tight">AI call #{call.id}</h1>
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-2.5">
            <dt className="w-20 shrink-0 text-muted">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <Block title={call.status === "ok" ? "Response" : "Error"} text={response ?? ""} />
      <Block title="Prompt" text={call.prompt} />
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-ink-2">
        {text}
      </pre>
    </section>
  );
}

function prettyJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
