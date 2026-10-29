"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/dal";

export type MixState = { error?: string; saved?: boolean } | null;

// Sets how often each riff chain is picked. Weights are relative (0–100 each).
export async function updateMix(_prev: MixState, formData: FormData): Promise<MixState> {
  const { db, viewer } = await requireAdmin();

  const { data: chains } = await db.from("prompt_chains").select("id").eq("purpose", "riff");
  const rows = [];
  for (const { id } of chains ?? []) {
    const weight = Number(formData.get(`weight-${id}`));
    if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
      return { error: "Each weight must be a whole number from 0 to 100." };
    }
    rows.push({ chain_id: id, weight, updated_at: new Date().toISOString(), updated_by: viewer.id });
  }
  if (!rows.some((r) => r.weight > 0)) return { error: "At least one chain needs a weight above 0." };

  const { error } = await db.from("prompt_chain_mix").upsert(rows, { onConflict: "chain_id" });
  if (error) {
    console.error("Updating the mix failed:", error);
    return { error: "Couldn't save the mix. Please try again." };
  }
  refresh();
  return { saved: true };
}
