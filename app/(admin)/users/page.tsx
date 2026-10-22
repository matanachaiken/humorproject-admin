import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { formatDate, fullName, levelFor, number } from "@/lib/format";
import { PageHeader, SearchBox, SortLinks } from "../ui";

export const metadata: Metadata = { title: "Users" };

const SORTS = { newest: "Newest", xp: "Most XP", riffs: "Most riffs", active: "Most active" } as const;
type Sort = keyof typeof SORTS;

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_superadmin: boolean;
};

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const { db } = await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const sort: Sort = typeof params.sort === "string" && params.sort in SORTS ? (params.sort as Sort) : "newest";

  const [profiles, stats, riffs, votes, battles] = await Promise.all([
    db
      .from("profiles")
      .select("id, email, first_name, last_name, avatar_url, created_at, is_superadmin")
      .order("created_at", { ascending: false })
      .overrideTypes<ProfileRow[], { merge: false }>(),
    db.from("player_stats").select("user_id, xp, streak, best_streak"),
    db.from("generations").select("user_id, points").limit(10000),
    db.from("generation_votes").select("user_id").limit(10000),
    db.from("matchups").select("user_id").limit(10000),
  ]);

  const statsBy = new Map((stats.data ?? []).map((s) => [s.user_id as string, s]));
  const count = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const riffCount = count(riffs.data);
  const voteCount = count(votes.data);
  const battleCount = count(battles.data);
  const pointsBy = new Map<string, number>();
  for (const r of riffs.data ?? []) pointsBy.set(r.user_id, (pointsBy.get(r.user_id) ?? 0) + r.points);

  const users = (profiles.data ?? [])
    .map((p) => {
      const s = statsBy.get(p.id);
      return {
        ...p,
        name: fullName(p),
        xp: s?.xp ?? 0,
        streak: s?.streak ?? 0,
        bestStreak: s?.best_streak ?? 0,
        riffs: riffCount.get(p.id) ?? 0,
        points: pointsBy.get(p.id) ?? 0,
        votes: voteCount.get(p.id) ?? 0,
        battles: battleCount.get(p.id) ?? 0,
      };
    })
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));

  if (sort === "xp") users.sort((a, b) => b.xp - a.xp);
  if (sort === "riffs") users.sort((a, b) => b.riffs - a.riffs || b.points - a.points);
  if (sort === "active") users.sort((a, b) => b.votes + b.battles - (a.votes + a.battles));

  return (
    <>
      <PageHeader
        title="Users"
        description={`${number.format(profiles.data?.length ?? 0)} profiles. Read-only: people manage their own names in Daily Riff.`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox placeholder="Search name or email" defaultValue={q} />
        <SortLinks options={SORTS} current={sort} params={{ q }} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 text-right font-medium">Level · XP</th>
              <th className="px-4 py-3 text-right font-medium">Streak</th>
              <th className="px-4 py-3 text-right font-medium">Riffs</th>
              <th className="px-4 py-3 text-right font-medium">Points earned</th>
              <th className="px-4 py-3 text-right font-medium">Votes cast</th>
              <th className="px-4 py-3 text-right font-medium">Battles judged</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-2/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} url={u.avatar_url} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        {u.name}
                        {u.is_superadmin && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-ink-2">Lv {levelFor(u.xp)}</span> · {number.format(u.xp)}
                </td>
                <td className="px-4 py-3 text-right" title={`Best: ${u.bestStreak} days`}>
                  {u.streak > 0 ? `🔥 ${u.streak}` : <span className="text-muted">0</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.riffs > 0 ? (
                    <Link href={`/media?user=${u.id}`} className="underline-offset-4 hover:underline">
                      {u.riffs}
                    </Link>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{number.format(u.points)}</td>
                <td className="px-4 py-3 text-right">
                  {u.votes > 0 ? (
                    <Link href={`/votes?user=${u.id}`} className="underline-offset-4 hover:underline">
                      {u.votes}
                    </Link>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{u.battles}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-2">
                  No one matches &ldquo;{q}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from many hosts
    return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2">
      {name[0]?.toUpperCase()}
    </span>
  );
}
