import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { formatWhen, imageUrl, isStyleId } from "@/lib/format";
import { updateRiff } from "../actions";
import DeleteButton from "../DeleteButton";
import RiffForm from "../RiffForm";

export const metadata: Metadata = { title: "Edit riff" };

export default async function RiffPage({ params, searchParams }: PageProps<"/media/[id]">) {
  const { db } = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { created } = await searchParams;

  const [{ data: riff }, { data: votes }] = await Promise.all([
    db
      .from("generations")
      .select("id, user_id, creator_name, theme_day, theme, user_input, image_prompt, caption, text_model, image_model, storage_path, created_at, score, wins, losses, points, style")
      .eq("id", id)
      .maybeSingle(),
    db.from("generation_votes").select("vote").eq("generation_id", id),
  ]);
  if (!riff) notFound();

  const up = (votes ?? []).filter((v) => v.vote === 1).length;
  const down = (votes ?? []).length - up;
  const facts: [string, React.ReactNode][] = [
    ["Creator", <Link key="c" href={`/media?user=${riff.user_id}`} className="underline underline-offset-4">{riff.creator_name}</Link>],
    ["Created", formatWhen(riff.created_at)],
    ["Theme day", riff.theme_day ?? "None"],
    ["Points", `${riff.points} (vote score ${riff.score} + ${riff.wins} battle wins)`],
    ["Votes", `${up} up · ${down} down`],
    ["Battles", `${riff.wins} won · ${riff.losses} lost`],
    ["Models", `${riff.text_model} → ${riff.image_model}`],
  ];

  return (
    <div className="max-w-5xl">
      <Link href="/media" className="text-sm text-ink-2 hover:text-ink">
        ← All riffs
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold tracking-tight">Riff #{riff.id}</h1>
      {created && (
        <p role="status" className="mb-4 rounded-lg bg-surface-2 px-4 py-2.5 text-sm">
          Riff created. It&apos;s live in Daily Riff now.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
            <Image
              src={imageUrl(db, riff.storage_path)}
              alt={riff.caption}
              fill
              sizes="(min-width: 1024px) 400px, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <dl className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="flex gap-4 px-4 py-2.5">
                <dt className="w-24 shrink-0 text-muted">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <details className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium">Image prompt</summary>
            <p className="mt-2 text-ink-2">{riff.image_prompt}</p>
          </details>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="mb-4 font-semibold">Edit</h2>
            <RiffForm
              action={updateRiff.bind(null, riff.id)}
              submitLabel="Save changes"
              initial={{
                caption: riff.caption,
                idea: riff.user_input,
                theme: riff.theme,
                style: isStyleId(riff.style) ? riff.style : "classic",
              }}
            />
          </section>
          <section className="rounded-xl border border-bad/30 bg-surface p-5 sm:p-6">
            <h2 className="font-semibold">Delete</h2>
            <p className="mt-1 mb-4 text-sm text-ink-2">
              Removes the image from Daily Riff for everyone, along with its votes and battles. This can&apos;t be undone.
            </p>
            <DeleteButton id={riff.id} votes={up + down} battles={riff.wins + riff.losses} />
          </section>
        </div>
      </div>
    </div>
  );
}
