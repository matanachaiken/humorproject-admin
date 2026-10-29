import "server-only";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getResource, type Resource } from "@/lib/resources";
import type { RelationOptions } from "./RecordForm";

export type Row = Record<string, unknown> & { id: number };

export function resourceOr404(key: string) {
  const resource = getResource(key);
  if (!resource) notFound();
  return resource;
}

// "*" plus the label column of each related table, e.g. llm_providers(name).
export function selectFor(resource: Resource) {
  const embeds = resource.fields.filter((f) => f.relation).map((f) => `${f.relation!.table}(${f.relation!.label})`);
  return ["*", ...embeds].join(", ");
}

export async function relationOptions(db: SupabaseClient, resource: Resource): Promise<RelationOptions> {
  const entries = await Promise.all(
    resource.fields
      .filter((f) => f.relation)
      .map(async (f) => {
        const { data } = await db.from(f.relation!.table).select(`id, ${f.relation!.label}`).order(f.relation!.label);
        const rows = (data ?? []) as unknown as Record<string, unknown>[];
        return [f.name, rows.map((r) => ({ value: Number(r.id), label: String(r[f.relation!.label]) }))] as const;
      })
  );
  return Object.fromEntries(entries);
}

// What a field shows in a table cell.
export function display(row: Row, name: string, resource: Resource): string {
  const field = resource.fields.find((f) => f.name === name);
  if (field?.relation) {
    const related = row[field.relation.table] as Record<string, unknown> | null;
    return related ? String(related[field.relation.label]) : "—";
  }
  const value = row[name];
  if (field?.type === "select") return field.options?.find((o) => o.value === value)?.label.split(" (")[0] ?? String(value);
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
