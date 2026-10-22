"use client";

import { useActionState, useState } from "react";
import { STYLES } from "@/lib/format";
import type { FormState } from "./actions";

type Values = { caption: string; idea: string; theme: string; style: string };

// One form for creating and editing. Creating adds an image picker that
// shrinks the image to 1024px and converts it to JPEG before upload.
export default function RiffForm({
  action,
  initial,
  withImage = false,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: Values;
  withImage?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  async function pickImage(file: File | undefined) {
    setImageError(null);
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
    if (!file) return;
    try {
      const blob = await toJpeg(file);
      setImage({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setImageError("That file couldn't be read as an image.");
    }
  }

  function submit(formData: FormData) {
    if (withImage) {
      if (!image) {
        setImageError("Choose an image.");
        return;
      }
      formData.set("image", image.blob, "upload.jpg");
    }
    return formAction(formData);
  }

  return (
    <form action={submit} className="space-y-5">
      {withImage && (
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="file">
            Image
          </label>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex aspect-square w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface-2 text-xs text-muted">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview blob
                <img src={image.url} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                "No image yet"
              )}
            </div>
            <div className="text-sm text-ink-2">
              {/* No name: the converted JPEG is added on submit instead. */}
              <input
                id="file"
                type="file"
                accept="image/*"
                onChange={(e) => pickImage(e.target.files?.[0])}
                className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-medium file:text-ink hover:file:bg-line"
              />
              <p className="mt-2 text-xs text-muted">Any image type. It&apos;s resized to 1024px and saved as JPEG.</p>
              {imageError && <p className="mt-2 text-sm text-bad">{imageError}</p>}
            </div>
          </div>
        </div>
      )}

      <Field label="Caption" hint="The punchline shown under the image.">
        <textarea name="caption" required maxLength={280} rows={2} defaultValue={initial.caption} className={inputClass} />
      </Field>
      <Field label="Idea" hint="What the creator typed in (up to 200 characters).">
        <input name="idea" required maxLength={200} defaultValue={initial.idea} className={inputClass} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Theme">
          <input name="theme" required maxLength={200} defaultValue={initial.theme} className={inputClass} />
        </Field>
        <Field label="Art style">
          <select name="style" defaultValue={initial.style} className={inputClass}>
            {Object.entries(STYLES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <button
          disabled={pending}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <p role="status" className="text-sm">
          {state?.error && <span className="text-bad">{state.error}</span>}
          {state?.saved && !pending && <span className="text-good">Saved.</span>}
        </p>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-axis focus:ring-2 focus:ring-brand/30";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  // JPEG has no transparency, so paint transparent areas white.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.88)
  );
}
