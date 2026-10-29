"use client";

import { useActionState } from "react";
import type { Field } from "@/lib/resources";
import type { RecordState } from "./actions";

export type RelationOptions = Record<string, { value: number; label: string }[]>;
type Values = Record<string, unknown>;

export default function RecordForm({
  fields,
  initial,
  relations,
  action,
  submitLabel,
}: {
  fields: Field[];
  initial: Values | null;
  relations: RelationOptions;
  action: (state: RecordState, formData: FormData) => Promise<RecordState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {fields.map((field) => (
        <FieldInput key={field.name} field={field} value={initial ? initial[field.name] : field.defaultValue} relations={relations} />
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

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-axis focus:ring-2 focus:ring-brand/30";

function FieldInput({ field, value, relations }: { field: Field; value: unknown; relations: RelationOptions }) {
  const common = {
    name: field.name,
    required: field.required,
    className: `${inputClass} ${field.mono ? "font-mono" : ""}`,
  };
  const text = value === null || value === undefined ? "" : String(value);

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name={field.name} defaultChecked={value !== false} className="h-4 w-4 accent-[var(--series-1)]" />
        {field.label}
      </label>
    );
  }

  let input: React.ReactNode;
  if (field.type === "textarea") {
    input = <textarea {...common} rows={3} maxLength={field.maxLength} defaultValue={text} />;
  } else if (field.type === "select" || field.type === "relation") {
    const options =
      field.type === "select"
        ? (field.options ?? [])
        : (relations[field.name] ?? []).map((o) => ({ value: String(o.value), label: o.label }));
    input = (
      <select {...common} defaultValue={text}>
        <option value="" disabled>
          Choose…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    input = (
      <input
        {...common}
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? 1 : undefined}
        maxLength={field.maxLength}
        defaultValue={text}
        autoCapitalize={field.lowercase ? "none" : undefined}
        spellCheck={field.mono ? false : undefined}
      />
    );
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {field.label}
        {!field.required && <span className="font-normal text-muted"> (optional)</span>}
      </span>
      {input}
      {field.hint && <span className="mt-1 block text-xs text-muted">{field.hint}</span>}
    </label>
  );
}
