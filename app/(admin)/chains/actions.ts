"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { placeholders } from "@/lib/format";

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

export type EditState = { error?: string; saved?: boolean } | null;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// Daily Riff calls steps by number and fills in their placeholders, so only
// the wording can change here. Step type, order and count stay as they are.
export async function updateStep(stepId: number, _prev: EditState, formData: FormData): Promise<EditState> {
  const { db } = await requireAdmin();
  const name = text(formData, "name");
  const prompt_template = text(formData, "prompt_template");
  if (!name || name.length > 120) return { error: "Step name must be 1–120 characters." };
  if (!prompt_template || prompt_template.length > 20000) return { error: "Prompt must be 1–20,000 characters." };

  const { data: step } = await db.from("prompt_chain_steps").select("prompt_template").eq("id", stepId).maybeSingle();
  if (!step) return { error: "That step doesn't exist anymore." };
  const required = placeholders(step.prompt_template);
  if (required.join() !== placeholders(prompt_template).join()) {
    return {
      error: required.length
        ? `This step needs exactly these placeholders: ${required.join(", ")}.`
        : "This step doesn't use placeholders, so remove them.",
    };
  }

  const { error } = await db.from("prompt_chain_steps").update({ name, prompt_template }).eq("id", stepId);
  if (error) {
    console.error("Updating a step failed:", error);
    return { error: "Couldn't save the step. Please try again." };
  }
  refresh();
  return { saved: true };
}

export async function updateChain(chainId: number, _prev: EditState, formData: FormData): Promise<EditState> {
  const { db } = await requireAdmin();
  const name = text(formData, "name");
  const description = text(formData, "description");
  if (!name || name.length > 120) return { error: "Name must be 1–120 characters." };
  if (description.length > 500) return { error: "Description must be under 500 characters." };

  const { error } = await db
    .from("prompt_chains")
    .update({ name, description: description || null })
    .eq("id", chainId);
  if (error) {
    console.error("Updating a chain failed:", error);
    return { error: "Couldn't save the chain. Please try again." };
  }
  refresh();
  return { saved: true };
}
