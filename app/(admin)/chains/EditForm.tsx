"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { EditState } from "./actions";

export type EditField = {
  name: string;
  label: string;
  value: string;
  maxLength: number;
  required?: boolean;
  rows?: number;
  mono?: boolean;
  hint?: string;
};

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-axis focus:ring-2 focus:ring-brand/30";

// Submitting from onSubmit keeps what was typed if saving is refused, which a
// plain form action would clear.
export function EditForm({
  action,
  fields,
  submitLabel,
}: {
  action: (state: EditState, formData: FormData) => Promise<EditState>;
  fields: EditField[];
  submitLabel: string;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<EditState>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => setState(await action(null, formData)));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map(({ name, label, value, maxLength, required, rows, mono, hint }) => (
        <label key={name} className="block">
          <span className="mb-1.5 block text-sm font-medium">{label}</span>
          {rows ? (
            <textarea
              name={name}
              rows={rows}
              required={required}
              maxLength={maxLength}
              defaultValue={value}
              className={`${inputClass} ${mono ? "font-mono" : ""}`}
            />
          ) : (
            <input name={name} required={required} maxLength={maxLength} defaultValue={value} className={inputClass} />
          )}
          {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
        </label>
      ))}
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
