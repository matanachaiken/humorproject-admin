"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/dal";
import { getResource, parseRecord, type Resource } from "@/lib/resources";

// Create, update and delete for every table in lib/resources.ts. Each action
// checks for an admin itself, and the table name always comes from that list,
// never from the request.

export type RecordState = { error?: string; saved?: boolean } | null;

export async function saveRecord(
  key: string,
  id: number | null,
  _prev: RecordState,
  formData: FormData
): Promise<RecordState> {
  const { db } = await requireAdmin();
  const resource = getResource(key);
  if (!resource) return { error: "Unknown table." };

  const { values, error } = parseRecord(resource, formData);
  if (!values) return { error };
  if (resource.hasUpdatedAt) values.updated_at = new Date().toISOString();

  if (id === null) {
    const { data, error: insertError } = await db.from(resource.table).insert(values).select("id").single();
    if (insertError || !data) return { error: describe(insertError, resource) };
    redirect(`/${resource.key}/${data.id}?created=1`);
  }

  const { error: updateError } = await db.from(resource.table).update(values).eq("id", id);
  if (updateError) return { error: describe(updateError, resource) };
  refresh();
  return { saved: true };
}

// useActionState passes the previous state first; deleting doesn't need it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteRecord(key: string, id: number, _prev: RecordState): Promise<RecordState> {
  const { db } = await requireAdmin();
  const resource = getResource(key);
  if (!resource) return { error: "Unknown table." };

  const { error } = await db.from(resource.table).delete().eq("id", id);
  if (error) return { error: describe(error, resource) };
  redirect(`/${resource.key}?deleted=1`);
}

function describe(error: PostgrestError | null, resource: Resource) {
  switch (error?.code) {
    case "23505":
      return `That ${resource.singular} already exists.`;
    case "23503":
      return resource.deleteWarning ?? `Other records still use this ${resource.singular}.`;
    case "23514":
      return "One of the values isn't allowed. Check the hints under each field.";
  }
  console.error(`Saving ${resource.table} failed:`, error);
  return "Couldn't save. Please try again.";
}
