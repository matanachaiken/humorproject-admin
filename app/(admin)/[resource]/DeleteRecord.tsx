"use client";

import { useActionState } from "react";
import type { RecordState } from "./actions";

export default function DeleteRecord({
  action,
  label,
  confirmText,
}: {
  action: (state: RecordState) => Promise<RecordState>;
  label: string;
  confirmText: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <button
        disabled={pending}
        className="rounded-lg border border-bad/40 px-4 py-2 text-sm font-semibold text-bad hover:bg-bad/10 disabled:opacity-60"
      >
        {pending ? "Deleting…" : label}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
    </form>
  );
}
