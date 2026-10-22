import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nyToday } from "@/lib/day";
import { fullName, imageUrl, isStyleId, STYLES } from "@/lib/format";

// Everything the overview page shows, computed from the raw tables. Daily
// Riff is small enough to aggregate in memory; past ~10k rows this should
// move into SQL views.

const LIMIT = 10000;
const DAYS = 30;

type Generation = {
  id: number;
  user_id: string;
  creator_name: string;
  theme_day: string | null;
  theme: string;
  caption: string;
  storage_path: string;
  created_at: string;
  score: number;
  wins: number;
  losses: number;
  points: number;
  style: string;
};

const nyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Weekday (0 = Monday) and hour in New York.
function nySlot(iso: string) {
  const parts = nyParts.formatToParts(new Date(iso));
  const weekday = WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")!.value);
  const hour = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  return { weekday, hour };
}

export async function getOverview(db: SupabaseClient) {
  const [gens, votes, battles, profiles, players] = await Promise.all([
    db
      .from("generations")
      .select("id, user_id, creator_name, theme_day, theme, caption, storage_path, created_at, score, wins, losses, points, style")
      .limit(LIMIT)
      .overrideTypes<Generation[], { merge: false }>(),
    db.from("generation_votes").select("generation_id, user_id, vote, created_at").limit(LIMIT),
    db.from("matchups").select("user_id, winner_id, loser_id, created_at").limit(LIMIT),
    db.from("profiles").select("id, first_name, last_name, created_at"),
    db.from("player_stats").select("user_id, xp, streak, best_streak"),
  ]);
  const G = gens.data ?? [];
  const V = votes.data ?? [];
  const M = battles.data ?? [];
  const P = profiles.data ?? [];
  const S = players.data ?? [];

  // --- Headline tiles -------------------------------------------------
  const today = nyToday();
  const dayOf = (iso: string) => nyToday(new Date(iso));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recent = (iso: string) => Date.parse(iso) >= weekAgo;
  const activeThisWeek = new Set([
    ...G.filter((g) => recent(g.created_at)).map((g) => g.user_id),
    ...V.filter((v) => recent(v.created_at)).map((v) => v.user_id),
    ...M.filter((m) => recent(m.created_at)).map((m) => m.user_id),
  ]);
  const ups = V.filter((v) => v.vote === 1).length;

  const tiles = {
    riffs: G.length,
    riffsToday: G.filter((g) => dayOf(g.created_at) === today).length,
    players: P.length,
    activeThisWeek: activeThisWeek.size,
    votes: V.length,
    upShare: V.length ? ups / V.length : null,
    battles: M.length,
    battlesPerRiff: G.length ? (M.length * 2) / G.length : 0,
  };

  // --- Activity per day, last 30 days ------------------------------------
  const days: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push(nyToday(new Date(Date.now() - i * 86_400_000)));
  const index = new Map(days.map((d, i) => [d, i]));
  const activity = days.map((day) => ({ day, riffs: 0, votes: 0, battles: 0 }));
  const bump = (iso: string, key: "riffs" | "votes" | "battles") => {
    const i = index.get(dayOf(iso));
    if (i !== undefined) activity[i][key]++;
  };
  G.forEach((g) => bump(g.created_at, "riffs"));
  V.forEach((v) => bump(v.created_at, "votes"));
  M.forEach((m) => bump(m.created_at, "battles"));

  // --- When people play (weekday x hour, New York) -----------------------
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const iso of [...G.map((g) => g.created_at), ...V.map((v) => v.created_at), ...M.map((m) => m.created_at)]) {
    const { weekday, hour } = nySlot(iso);
    if (weekday >= 0) heat[weekday][hour]++;
  }

  // --- Crowd vs. arena: does vote score predict battle win rate? ---------
  const battled = G.filter((g) => g.wins + g.losses > 0).map((g) => ({
    id: g.id,
    caption: g.caption,
    creator: g.creator_name,
    score: g.score,
    wins: g.wins,
    losses: g.losses,
    winRate: g.wins / (g.wins + g.losses),
  }));
  const agreement = battled.length >= 3 ? pearson(battled.map((b) => b.score), battled.map((b) => b.winRate)) : null;

  // --- Riffs that split the crowd ----------------------------------------
  const tally = new Map<number, { up: number; down: number }>();
  for (const v of V) {
    const t = tally.get(v.generation_id) ?? { up: 0, down: 0 };
    if (v.vote === 1) t.up++;
    else t.down++;
    tally.set(v.generation_id, t);
  }
  const genById = new Map(G.map((g) => [g.id, g]));
  const controversial = [...tally.entries()]
    .filter(([, t]) => t.up > 0 && t.down > 0)
    .map(([id, t]) => ({ id, ...t, riff: genById.get(id)! }))
    .filter((c) => c.riff)
    .sort((a, b) => Math.min(b.up, b.down) - Math.min(a.up, a.down) || b.up + b.down - (a.up + a.down))
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      up: c.up,
      down: c.down,
      caption: c.riff.caption,
      creator: c.riff.creator_name,
      imageUrl: imageUrl(db, c.riff.storage_path),
    }));

  // --- Art styles ---------------------------------------------------------
  const styles = Object.entries(STYLES)
    .map(([id, label]) => {
      const riffs = G.filter((g) => (isStyleId(g.style) ? g.style : "classic") === id);
      return {
        id,
        label,
        count: riffs.length,
        avgPoints: riffs.length ? riffs.reduce((s, g) => s + g.points, 0) / riffs.length : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  // --- Themes that landed --------------------------------------------------
  const themeMap = new Map<string, { day: string; theme: string; riffs: number; points: number }>();
  for (const g of G) {
    const day = g.theme_day ?? dayOf(g.created_at);
    const t = themeMap.get(day) ?? { day, theme: g.theme, riffs: 0, points: 0 };
    t.riffs++;
    t.points += g.points;
    themeMap.set(day, t);
  }
  const themes = [...themeMap.values()].sort((a, b) => b.riffs - a.riffs || b.points - a.points).slice(0, 6);

  // --- Leaderboards ---------------------------------------------------------
  const nameOf = new Map(P.map((p) => [p.id as string, fullName(p)]));
  const creatorPoints = new Map<string, { points: number; riffs: number }>();
  for (const g of G) {
    const c = creatorPoints.get(g.user_id) ?? { points: 0, riffs: 0 };
    c.points += g.points;
    c.riffs++;
    creatorPoints.set(g.user_id, c);
  }
  const topCreators = [...creatorPoints.entries()]
    .map(([id, c]) => ({ id, name: nameOf.get(id) ?? "Unknown", ...c }))
    .sort((a, b) => b.points - a.points || b.riffs - a.riffs)
    .slice(0, 5);

  const judgeCounts = new Map<string, number>();
  for (const m of M) judgeCounts.set(m.user_id, (judgeCounts.get(m.user_id) ?? 0) + 1);
  for (const v of V) judgeCounts.set(v.user_id, (judgeCounts.get(v.user_id) ?? 0) + 1);
  const topJudges = [...judgeCounts.entries()]
    .map(([id, n]) => ({ id, name: nameOf.get(id) ?? "Unknown", count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const longestStreak = S.reduce<{ name: string; days: number } | null>(
    (best, s) => (s.best_streak > (best?.days ?? 0) ? { name: nameOf.get(s.user_id) ?? "Unknown", days: s.best_streak } : best),
    null
  );
  const champion = [...G].sort((a, b) => b.points - a.points)[0];

  return {
    tiles,
    activity,
    heat,
    battled,
    agreement,
    controversial,
    styles,
    themes,
    topCreators,
    topJudges,
    longestStreak,
    champion: champion
      ? { id: champion.id, caption: champion.caption, creator: champion.creator_name, points: champion.points, imageUrl: imageUrl(db, champion.storage_path) }
      : null,
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
