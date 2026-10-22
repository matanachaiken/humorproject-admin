import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { formatWhen, fullName, imageUrl, number } from "@/lib/format";
import { EmptyState, PageHeader, SortLinks } from "../ui";

export const metadata: Metadata = { title: "Votes & battles" };

const TABS = { votes: "Up/down votes", battles: "Battles" } as const;
const VOTE_FILTERS = { all: "All", up: "Upvotes", down: "Downvotes" } as const;
type Tab = keyof typeof TABS;
type VoteFilter = keyof typeof VOTE_FILTERS;

const UUID = /^[0-9a-f-]{36}$/i;

type RiffRef = { id: number; caption: string; storage_path: string; creator_name: string };

export default async function VotesPage({ searchParams }: PageProps<"/votes">) {
  const { db } = await requireAdmin();
  const params = await searchParams;
  const tab: Tab = params.tab === "battles" ? "battles" : "votes";
  const filter: VoteFilter = params.vote === "up" || params.vote === "down" ? params.vote : "all";
  const user = typeof params.user === "string" && UUID.test(params.user) ? params.user : "";

  let votesQuery = db
    .from("generation_votes")
    .select("id, generation_id, user_id, vote, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filter !== "all") votesQuery = votesQuery.eq("vote", filter === "up" ? 1 : -1);
  if (user) votesQuery = votesQuery.eq("user_id", user);

  let battlesQuery = db
    .from("matchups")
    .select("id, user_id, winner_id, loser_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (user) battlesQuery = battlesQuery.eq("user_id", user);

  const [votes, battles, totals, profiles, riffs] = await Promise.all([
    tab === "votes" ? votesQuery : { data: [] },
    tab === "battles" ? battlesQuery : { data: [] },
    db.from("generation_votes").select("vote").limit(10000),
    db.from("profiles").select("id, first_name, last_name, email"),
    db.from("generations").select("id, caption, storage_path, creator_name").limit(10000),
  ]);
  const { count: battleTotal } = await db.from("matchups").select("id", { count: "exact", head: true });

  const people = new Map((profiles.data ?? []).map((p) => [p.id as string, p]));
  const riffBy = new Map(((riffs.data ?? []) as RiffRef[]).map((r) => [r.id, r]));
  const allVotes = totals.data ?? [];
  const ups = allVotes.filter((v) => v.vote === 1).length;
  const filteredName = user ? fullName(people.get(user)) : "";

  return (
    <>
      <PageHeader
        title="Votes & battles"
        description="Read-only. Votes are 👍/👎 on a riff; battles are “Which is funnier?” picks between two riffs."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Tile label="Votes cast" value={number.format(allVotes.length)} />
        <Tile
          label="Upvote share"
          value={allVotes.length ? `${Math.round((ups / allVotes.length) * 100)}%` : "–"}
          sub={`${ups} up · ${allVotes.length - ups} down`}
        />
        <Tile label="Battles judged" value={number.format(battleTotal ?? 0)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SortLinks name="tab" options={TABS} current={tab} params={{ user }} />
        {tab === "votes" && <SortLinks name="vote" options={VOTE_FILTERS} current={filter} params={{ tab, user }} />}
        {user && (
          <Link href={`/votes?tab=${tab}`} className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
            Only {filteredName} · clear
          </Link>
        )}
      </div>

      {tab === "votes" ? (
        (votes.data ?? []).length === 0 ? (
          <EmptyState>No votes match.</EmptyState>
        ) : (
          <Table head={["When", "Voter", "Riff", "Vote"]}>
            {(votes.data ?? []).map((v) => (
              <tr key={v.id}>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{formatWhen(v.updated_at)}</td>
                <td className="px-4 py-3">
                  <Person id={v.user_id} people={people} tab={tab} />
                </td>
                <td className="px-4 py-3">
                  <RiffCell riff={riffBy.get(v.generation_id)} db={db} />
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {v.vote === 1 ? (
                    <span className="text-good">👍 Up</span>
                  ) : (
                    <span className="text-bad">👎 Down</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )
      ) : (battles.data ?? []).length === 0 ? (
        <EmptyState>No battles match.</EmptyState>
      ) : (
        <Table head={["When", "Judge", "Winner", "Loser"]}>
          {(battles.data ?? []).map((b) => (
            <tr key={b.id}>
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{formatWhen(b.created_at)}</td>
              <td className="px-4 py-3">
                <Person id={b.user_id} people={people} tab={tab} />
              </td>
              <td className="px-4 py-3">
                <RiffCell riff={riffBy.get(b.winner_id)} db={db} badge="🏆" />
              </td>
              <td className="px-4 py-3">
                <RiffCell riff={riffBy.get(b.loser_id)} db={db} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-ink-2">{sub}</p>}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-3 font-medium ${i === head.length - 1 && h === "Vote" ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function Person({
  id,
  people,
  tab,
}: {
  id: string;
  people: Map<string, { first_name: string | null; last_name: string | null; email: string | null }>;
  tab: Tab;
}) {
  const p = people.get(id);
  return (
    <Link href={`/votes?tab=${tab}&user=${id}`} className="hover:underline" title={p?.email ?? undefined}>
      {fullName(p)}
    </Link>
  );
}

function RiffCell({
  riff,
  db,
  badge,
}: {
  riff: RiffRef | undefined;
  db: Parameters<typeof imageUrl>[0];
  badge?: string;
}) {
  if (!riff) return <span className="text-muted">Deleted riff</span>;
  return (
    <Link href={`/media/${riff.id}`} className="flex items-center gap-3 hover:underline">
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-2">
        <Image src={imageUrl(db, riff.storage_path)} alt="" fill sizes="40px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="line-clamp-1">
          {badge && <span className="mr-1">{badge}</span>}
          {riff.caption}
        </span>
        <span className="block text-xs text-muted">by {riff.creator_name}</span>
      </span>
    </Link>
  );
}
