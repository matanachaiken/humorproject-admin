import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { nyToday } from "@/lib/day";
import { createRiff } from "../actions";
import RiffForm from "../RiffForm";
import { PageHeader } from "../../ui";

export const metadata: Metadata = { title: "New riff" };

export default async function NewRiffPage() {
  const { db } = await requireAdmin();
  const { data: theme } = await db.from("daily_themes").select("theme").eq("day", nyToday()).maybeSingle();

  return (
    <div className="max-w-2xl">
      <Link href="/media" className="text-sm text-ink-2 hover:text-ink">
        ← All riffs
      </Link>
      <PageHeader
        title="New riff"
        description="Upload an image and it appears in Daily Riff under your name, entered in today's theme."
      />
      <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <RiffForm
          action={createRiff}
          image="required"
          submitLabel="Create riff"
          initial={{ caption: "", idea: "", theme: theme?.theme ?? "", style: "classic" }}
        />
      </div>
    </div>
  );
}
