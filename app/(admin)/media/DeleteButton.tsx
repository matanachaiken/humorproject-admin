"use client";

import { useFormStatus } from "react-dom";
import { deleteRiff } from "./actions";

export default function DeleteButton({ id, votes, battles }: { id: number; votes: number; battles: number }) {
  return (
    <form
      action={deleteRiff.bind(null, id)}
      onSubmit={(e) => {
        const message = `Delete this riff for good? Its ${votes} vote(s) and ${battles} battle(s) go with it.`;
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg border border-bad/40 px-4 py-2 text-sm font-semibold text-bad hover:bg-bad/10 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete riff"}
    </button>
  );
}
