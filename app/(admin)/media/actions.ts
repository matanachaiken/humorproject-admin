"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { nyToday } from "@/lib/day";
import { isStyleId } from "@/lib/format";

// Server actions are public endpoints, so each one checks for an admin
// itself instead of trusting the page that rendered the form.

export type FormState = { error?: string; saved?: boolean } | null;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function readFields(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const caption = text("caption");
  const idea = text("idea");
  const theme = text("theme");
  const style = text("style");

  if (!caption || caption.length > 280) return { error: "Caption must be 1–280 characters." };
  if (!idea || idea.length > 200) return { error: "Idea must be 1–200 characters." };
  if (!theme || theme.length > 200) return { error: "Theme must be 1–200 characters." };
  if (!isStyleId(style)) return { error: "Pick an art style." };
  return { fields: { caption, user_input: idea, theme, style } };
}

export async function createRiff(_prev: FormState, formData: FormData): Promise<FormState> {
  const { viewer, db } = await requireAdmin();

  const { fields, error } = readFields(formData);
  if (!fields) return { error };

  // The browser converts uploads to JPEG, the only type the bucket accepts.
  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) return { error: "Choose an image." };
  if (image.type !== "image/jpeg") return { error: "The image must be a JPEG." };
  if (image.size > MAX_IMAGE_BYTES) return { error: "The image must be under 4 MB." };

  const storagePath = `${viewer.id}/${randomUUID()}.jpg`;
  const { error: uploadError } = await db.storage
    .from("generations")
    .upload(storagePath, image, { contentType: "image/jpeg" });
  if (uploadError) {
    console.error("Upload failed:", uploadError);
    return { error: "Couldn't upload the image. Please try again." };
  }

  // Count it toward today's theme when there is one.
  const today = nyToday();
  const { data: theme } = await db.from("daily_themes").select("day").eq("day", today).maybeSingle();
  const [first, ...rest] = viewer.name.split(" ");
  const last = rest.at(-1);

  const { data: inserted, error: insertError } = await db
    .from("generations")
    .insert({
      ...fields,
      user_id: viewer.id,
      creator_name: `${first}${last ? ` ${last[0]}.` : ""}`,
      theme_day: theme?.day ?? null,
      llm_prompt: "Uploaded in the admin area",
      image_prompt: "Uploaded in the admin area",
      text_model: "admin-upload",
      image_model: "admin-upload",
      storage_path: storagePath,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("Insert failed:", insertError);
    await db.storage.from("generations").remove([storagePath]);
    return { error: "Couldn't save the riff. Please try again." };
  }

  redirect(`/media/${inserted.id}?created=1`);
}

export async function updateRiff(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin();

  const { fields, error } = readFields(formData);
  if (!fields) return { error };

  const { error: updateError } = await db.from("generations").update(fields).eq("id", id);
  if (updateError) {
    console.error("Update failed:", updateError);
    return { error: "Couldn't save changes. Please try again." };
  }
  refresh();
  return { saved: true };
}

// Removes the riff with its votes and battles (they cascade), then the image.
export async function deleteRiff(id: number) {
  const { db } = await requireAdmin();

  const { data: riff } = await db.from("generations").select("storage_path").eq("id", id).maybeSingle();
  if (!riff) redirect("/media");

  const { error } = await db.from("generations").delete().eq("id", id);
  if (error) {
    console.error("Delete failed:", error);
    throw new Error("Couldn't delete the riff.");
  }
  await db.storage.from("generations").remove([riff.storage_path]);
  redirect("/media?deleted=1");
}
