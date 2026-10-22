import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { number } from "@/lib/format";
import { getOverview } from "@/lib/stats";
import { ActivityChart, BarList, CrowdVsArena, Heatmap } from "./charts";
import { EmptyState } from "./ui";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatDay(day: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${day}T00:00:00Z`)
  );
}

// How strongly the crowd's votes and the battle arena agree, in words.
function describeAgreement(r: number | null, n: number) {
  if (r === null) {
    return n < 3
      ? "Needs at least 3 riffs that have been in battles before this means anything."
      : "Every battled riff has the same score, so there's nothing to compare yet.";
  }
  const strength = Math.abs(r) >= 0.6 ? "strongly" : Math.abs(r) >= 0.3 ? "somewhat" : "barely";
  const verdict =
    r >= 0.3
      ? `The crowd and the arena ${strength} agree: riffs that get upvoted also tend to win battles.`
      : r <= -0.3
        ? `The crowd and the arena ${strength} disagree: upvoted riffs tend to lose head-to-head.`
        : "Votes barely predict battles: being liked and being the funnier of two are different things here.";
  return `${verdict} (r = ${r.toFixed(2)} across ${n} riffs)`;
}

export default async function OverviewPage() {
  const { db, viewer } = await requireAdmin();
  const o = await getOverview(db);
  const t = o.tiles;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-sm text-ink-2">Hi {viewer.name.split(" ")[0]} 👋</p>
        <h1 className="text-2xl font-bold tracking-tight">How Daily Riff is doing</h1>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Riffs" value={number.format(t.riffs)} sub={`${t.riffsToday} today`} />
        <Tile label="Players" value={number.format(t.players)} sub={`${t.activeThisWeek} active this week`} />
        <Tile
          label="Votes"
          value={number.format(t.votes)}
          sub={t.upShare === null ? "No votes yet" : `${Math.round(t.upShare * 100)}% are upvotes`}
        />
        <Tile
          label="Battles judged"
          value={number.format(t.battles)}
          sub={`Each riff fought ${t.battlesPerRiff.toFixed(1)} times on average`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Last 30 days" subtitle="What people did each day (New York time).">
          <ActivityChart data={o.activity} />
        </Card>

        <Card title="Reigning champion" subtitle="Most points of all time (vote score + battle wins).">
          {o.champion ? (
            <Link href={`/media/${o.champion.id}`} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
                <Image src={o.champion.imageUrl} alt={o.champion.caption} fill sizes="(min-width: 1024px) 320px, 100vw" className="object-cover transition-transform group-hover:scale-[1.02]" />
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                  👑 {o.champion.points} pts
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-medium">{o.champion.caption}</p>
              <p className="text-xs text-muted">by {o.champion.creator}</p>
            </Link>
          ) : (
            <EmptyState>No riffs yet.</EmptyState>
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title="Crowd vs. arena"
          subtitle="Does a riff's vote score predict how often it wins “Which is funnier?” Each dot is a riff."
        >
          {o.battled.length ? (
            <>
              <CrowdVsArena data={o.battled} />
              <p className="mt-3 text-sm text-ink-2">{describeAgreement(o.agreement, o.battled.length)}</p>
            </>
          ) : (
            <EmptyState>No riff has been in a battle yet.</EmptyState>
          )}
        </Card>

        <Card title="Split the crowd" subtitle="Riffs with both upvotes and downvotes, most divisive first.">
          {o.controversial.length ? (
            <ul className="space-y-3">
              {o.controversial.map((c) => (
                <li key={c.id}>
                  <Link href={`/media/${c.id}`} className="flex items-center gap-3 rounded-lg hover:bg-surface-2">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-2">
                      <Image src={c.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm">{c.caption}</span>
                      <span className="tabular text-xs text-ink-2">
                        👍 {c.up} · 👎 {c.down}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Nobody disagrees yet: no riff has both upvotes and downvotes.</EmptyState>
          )}
        </Card>

        <Card className="lg:col-span-2" title="When people play" subtitle="Riffs, votes and battle picks by weekday and hour.">
          <Heatmap data={o.heat} />
        </Card>

        <Card title="Art styles" subtitle="Riffs per style, with average points.">
          <BarList
            rows={o.styles.map((s) => ({
              key: s.id,
              label: s.label,
              value: s.count,
              note: s.count ? `avg ${s.avgPoints.toFixed(1)} pts` : undefined,
            }))}
          />
        </Card>

        <Card title="Themes that landed" subtitle="Daily themes with the most riffs.">
          {o.themes.length ? (
            <BarList
              rows={o.themes.map((th) => ({
                key: th.day,
                label: (
                  <>
                    <span className="text-muted">{formatDay(th.day)}</span> {th.theme}
                  </>
                ),
                value: th.riffs,
                note: `${th.points} pts`,
              }))}
            />
          ) : (
            <EmptyState>No themes yet.</EmptyState>
          )}
        </Card>

        <Card title="Top creators" subtitle="Total points across their riffs.">
          <Ranking rows={o.topCreators.map((c) => ({ id: c.id, href: `/media?user=${c.id}`, name: c.name, value: `${c.points} pts`, sub: plural(c.riffs, "riff") }))} />
        </Card>

        <Card title="Most active judges" subtitle="Votes cast plus battle picks.">
          <Ranking rows={o.topJudges.map((j) => ({ id: j.id, href: `/votes?user=${j.id}`, name: j.name, value: String(j.count) }))} />
          {o.longestStreak && (
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-2">
              🔥 Longest streak: <b className="text-ink">{o.longestStreak.name}</b>, {plural(o.longestStreak.days, "day")} in a row
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-ink-2">{sub}</p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 text-sm text-ink-2">{subtitle}</p>
      {children}
    </section>
  );
}

function Ranking({ rows }: { rows: { id: string; href: string; name: string; value: string; sub?: string }[] }) {
  if (!rows.length) return <EmptyState>Nothing yet.</EmptyState>;
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3 text-sm">
          <span className="tabular w-5 text-right text-muted">{i + 1}</span>
          <Link href={r.href} className="min-w-0 flex-1 truncate hover:underline">
            {r.name}
          </Link>
          {r.sub && <span className="text-xs text-muted">{r.sub}</span>}
          <span className="tabular font-medium">{r.value}</span>
        </li>
      ))}
    </ol>
  );
}
