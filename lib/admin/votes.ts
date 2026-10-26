import "server-only";
import { adminClient } from "./db";
import { nextDay, rangeOf } from "./params";

export const VOTE_DIRECTIONS = ["all", "up", "down"] as const;
export type VoteDirection = (typeof VOTE_DIRECTIONS)[number];

export type VoteListRow = {
  id: number;
  vote_value: number;
  created_at: string;
  caption_id: number;
  caption: { content: string; image_id: number } | null;
  voter: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

type Opts = { direction: VoteDirection; from?: string; to?: string; page: number };

// READ only, by design: there is no write path for votes in this app.
export async function listVotes(opts: Opts) {
  const { supabase } = await adminClient();
  const [a, b] = rangeOf(opts.page);

  let page = supabase
    .from("caption_votes")
    .select(
      "id, vote_value, created_at, caption_id, caption:captions(content, image_id), voter:profiles(first_name, last_name, email)",
      { count: "exact" },
    );
  if (opts.direction === "up") page = page.eq("vote_value", 1);
  if (opts.direction === "down") page = page.eq("vote_value", -1);
  if (opts.from) page = page.gte("created_at", `${opts.from}T00:00:00Z`);
  if (opts.to) page = page.lt("created_at", `${nextDay(opts.to)}T00:00:00Z`);

  // Summary counts are computed by the database (head requests), never by
  // fetching the table.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const countWhere = (apply: (q: ReturnType<typeof base>) => ReturnType<typeof base>) =>
    apply(base());
  const base = () => supabase.from("caption_votes").select("id", { count: "exact", head: true });

  const [list, total, up, recent] = await Promise.all([
    page
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(a, b),
    countWhere((q) => q),
    countWhere((q) => q.eq("vote_value", 1)),
    countWhere((q) => q.gte("created_at", weekAgo)),
  ]);

  for (const r of [list, total, up, recent]) {
    if (r.error) throw new Error(r.error.message);
    if (r.count === null) throw new Error("vote count unavailable");
  }

  return {
    rows: (list.data ?? []) as unknown as VoteListRow[],
    filteredTotal: list.count!,
    summary: { total: total.count!, up: up.count!, down: total.count! - up.count!, last7: recent.count! },
  };
}
