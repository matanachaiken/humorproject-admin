import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { PageHeader } from "../ui";
import MixForm, { type MixRow } from "./MixForm";

export const metadata: Metadata = { title: "Prompt chains" };

const PURPOSES: Record<string, string> = {
  riff: "Makes a riff",
  theme: "Daily theme",
  idea_examples: "Example ideas",
  writers_room: "Writers' Room",
};

type ChainRow = {
  id: number;
  slug: string;
  name: string;
  purpose: string;
  description: string | null;
  prompt_chain_steps: {
    id: number;
    step_order: number;
    name: string;
    kind: string;
    runs_when: string;
    prompt_template: string;
  }[];
  prompt_chain_mix: { weight: number; updated_at: string } | null;
};

export default async function ChainsPage() {
  const { db } = await requireAdmin();
  const [{ data: chains }, { data: requests }, { data: riffs }, { data: calls }] = await Promise.all([
    db
      .from("prompt_chains")
      .select("id, slug, name, purpose, description, prompt_chain_steps (id, step_order, name, kind, runs_when, prompt_template), prompt_chain_mix (weight, updated_at)")
      .order("id")
      .overrideTypes<ChainRow[], { merge: false }>(),
    db.from("generation_requests").select("chain_id, status, generation_id").limit(10000),
    db.from("generations").select("id, points").limit(10000),
    db.from("llm_responses").select("step_id").limit(10000),
  ]);

  const points = new Map((riffs ?? []).map((r) => [r.id as number, r.points as number]));
  const callsPerStep = new Map<number, number>();
  for (const c of calls ?? []) if (c.step_id) callsPerStep.set(c.step_id, (callsPerStep.get(c.step_id) ?? 0) + 1);

  const mixRows: MixRow[] = (chains ?? [])
    .filter((c) => c.purpose === "riff")
    .map((c) => {
      const mine = (requests ?? []).filter((r) => r.chain_id === c.id);
      const made = mine.map((r) => (r.generation_id ? points.get(r.generation_id) : undefined)).filter((p) => p !== undefined);
      return {
        id: c.id,
        name: c.name,
        weight: c.prompt_chain_mix?.weight ?? 0,
        requests: mine.length,
        succeeded: mine.filter((r) => r.status === "succeeded").length,
        riffs: made.length,
        avgPoints: made.length ? made.reduce((a, b) => a + b, 0) / made.length : null,
      };
    });

  return (
    <>
      <PageHeader
        title="Prompt chains"
        description="Every AI job in Daily Riff is a chain of prompt steps. Daily Riff reads these templates from the database and fills in the {{placeholders}}."
      />

      <section className="mb-8 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Riff chain mix</h2>
        <p className="mb-4 mt-1 text-sm text-ink-2">
          Each new riff picks one of these chains at random, weighted by the numbers below. Compare their results to see
          which caption voice people like more.
        </p>
        <MixForm rows={mixRows} />
      </section>

      <div className="space-y-6">
        {(chains ?? []).map((chain) => (
          <section key={chain.id} id={chain.slug} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-semibold">{chain.name}</h2>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">{PURPOSES[chain.purpose] ?? chain.purpose}</span>
              <code className="text-xs text-muted">{chain.slug}</code>
            </div>
            {chain.description && <p className="mt-1 text-sm text-ink-2">{chain.description}</p>}
            <ol className="mt-4 space-y-3">
              {[...chain.prompt_chain_steps]
                .sort((a, b) => a.step_order - b.step_order)
                .map((s) => (
                  <li key={s.id} className="rounded-lg border border-line">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
                          {s.step_order}
                        </span>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-muted">
                          {s.kind === "image" ? "🖼️ image model" : "✍️ text model"} · {s.runs_when}
                        </span>
                        <span className="ml-auto text-xs text-ink-2">{callsPerStep.get(s.id) ?? 0} calls logged</span>
                      </summary>
                      <pre className="overflow-x-auto whitespace-pre-wrap border-t border-line bg-surface-2/50 px-4 py-3 font-mono text-xs leading-relaxed text-ink-2">
                        {s.prompt_template}
                      </pre>
                    </details>
                  </li>
                ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
