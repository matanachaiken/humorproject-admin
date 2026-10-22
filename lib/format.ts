import type { SupabaseClient } from "@supabase/supabase-js";

// Daily Riff's art styles (see lib/progression.ts in the main app).
export const STYLES = {
  classic: "✨ Classic",
  renaissance: "🖼️ Renaissance painting",
  disposable: "📸 '90s disposable camera",
  claymation: "🧸 Claymation",
  pixar: "🎬 Pixar-style",
  noir: "🕵️ Film noir",
} as const;
export type StyleId = keyof typeof STYLES;

export function isStyleId(value: string): value is StyleId {
  return value in STYLES;
}

// XP needed for each level, matching the main app.
const LEVEL_XP = [0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250];

export function levelFor(xp: number) {
  return LEVEL_XP.filter((min) => xp >= min).length;
}

export function imageUrl(db: SupabaseClient, storagePath: string) {
  return db.storage.from("generations").getPublicUrl(storagePath).data.publicUrl;
}

export function fullName(p: { first_name: string | null; last_name: string | null } | undefined) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unnamed";
}

const NY = "America/New_York";

// "Oct 22, 2:01 PM" in New York time, where Daily Riff's day starts.
export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export const number = new Intl.NumberFormat("en-US");
