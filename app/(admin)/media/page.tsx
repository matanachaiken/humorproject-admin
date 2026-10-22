import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { formatDate, imageUrl, number } from "@/lib/format";
import { EmptyState, PageHeader, SearchBox, SortLinks } from "../ui";

export const metadata: Metadata = { title: "Riffs" };

const SORTS = { newest: "Newest", top: "Top points", battled: "Most battled", worst: "Lowest score" } as const;
type Sort = keyof typeof SORTS;

const UUID = /^[0-9a-f-]{36}$/i;

type Row = {
  id: number;
  user_id: string;
  creator_name: string;
  theme: string;
  user_input: string;
  caption: string;
  storage_path: string;
  created_at: string;
  score: number;
  wins: number;
  losses: number;
  points: number;
  text_model: string;
};

export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  const { db } = await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const user = typeof params.user === "string" && UUID.test(params.user) ? params.user : "";
  const sort: Sort = typeof params.sort === "string" && params.sort in SORTS ? (params.sort as Sort) : "newest";

  let query = db
    .from("generations")
    .select("id, user_id, creator_name, theme, user_input, caption, storage_path, created_at, score, wins, losses, points, text_model")
    .limit(500);
  if (user) query = query.eq("user_id", user);
  if (sort === "newest") query = query.order("created_at", { ascending: false });
  if (sort === "top") query = query.order("points", { ascending: false }).order("created_at", { ascending: false });
  if (sort === "worst") query = query.order("score", { ascending: true }).order("created_at", { ascending: false });
  if (sort === "battled") query = query.order("created_at", { ascending: false });
  const { data } = await query.overrideTypes<Row[], { merge: false }>();

  let riffs = (data ?? []).filter(
    (r) =>
      !q ||
      [r.caption, r.user_input, r.theme, r.creator_name].some((s) => s.toLowerCase().includes(q))
  );
  if (sort === "battled") riffs = riffs.sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

  return (
    <>
      <PageHeader
        title="Riffs"
        description="Every AI-generated image in Daily Riff. Open one to edit or delete it."
        action={
          <Link href="/media/new" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
            New riff
          </Link>
        }
      />
      {params.deleted && (
        <p role="status" className="mb-4 rounded-lg bg-surface-2 px-4 py-2.5 text-sm">
          Riff deleted.
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox placeholder="Search caption, idea, theme, creator" defaultValue={q} hidden={{ user, sort }} />
        <SortLinks options={SORTS} current={sort} params={{ q, user }} />
        {user && (
          <Link href="/media" className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
            Showing one creator · clear
          </Link>
        )}
      </div>

      {riffs.length === 0 ? (
        <EmptyState>{q ? `No riffs match “${q}”.` : "No riffs yet."}</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {riffs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/media/${r.id}`}
                className="group block overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-square bg-surface-2">
                  <Image
                    src={imageUrl(db, r.storage_path)}
                    alt={r.caption}
                    fill
                    sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 50vw"
                    className="object-cover"
                  />
                  {r.text_model === "admin-upload" && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                      Uploaded
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{r.caption}</p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {r.creator_name} · {formatDate(r.created_at)}
                  </p>
                  <p className="tabular mt-2 flex gap-3 text-xs text-ink-2">
                    <span title="Points: vote score + battle wins">
                      <b className="text-ink">{number.format(r.points)}</b> pts
                    </span>
                    <span title="Upvotes minus downvotes">{r.score >= 0 ? `+${r.score}` : r.score} votes</span>
                    <span title="Battle record">
                      {r.wins}–{r.losses} W–L
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
