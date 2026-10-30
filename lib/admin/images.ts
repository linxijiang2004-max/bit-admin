import "server-only";
import { adminClient, displayName, fetchAll } from "./db";
import { favoriteCounts } from "./favorites";
import { rangeOf } from "./params";
import type { LlmResponse } from "./responses";

export const IMAGE_PAGE_SIZE = 60;
export const IMAGE_SORTS = ["newest", "captions", "votes", "unused"] as const;
export type ImageSort = (typeof IMAGE_SORTS)[number];

export type ImageTile = {
  id: number;
  url: string;
  caption_count: number;
  published_count: number;
  vote_count: number;
};

type Client = Awaited<ReturnType<typeof adminClient>>["supabase"];
type BaseTile = Pick<ImageTile, "id" | "url" | "caption_count">;

const TILE_COLUMNS = "id, url, caption_count";

// Grid page: 60 tiles, sorted and filtered in the database except "votes",
// whose per-image total isn't a column (see votesOrder).
export async function listImageTiles(opts: { page: number; sort: ImageSort }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page, IMAGE_PAGE_SIZE);

  const filtered = (columns: string) => {
    let q = supabase.from("admin_image_rows").select(columns, { count: "exact" });
    if (opts.sort === "unused") q = q.eq("caption_count", 0);
    return q;
  };

  let rows: BaseTile[];
  let total: number;
  if (opts.sort === "votes") {
    ({ rows, total } = await votesOrder(supabase, from, to));
  } else {
    let q = filtered(TILE_COLUMNS);
    if (opts.sort === "captions") q = q.order("caption_count", { ascending: false });
    const { data, error, count } = await q
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    if (!data || count === null) throw new Error("image query returned no data");
    rows = data as unknown as BaseTile[];
    total = count;
  }

  const stats = await captionStats(supabase, rows.map((r) => r.id));
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      caption_count: Number(r.caption_count),
      published_count: stats.get(r.id)?.published ?? 0,
      vote_count: stats.get(r.id)?.votes ?? 0,
    })) as ImageTile[],
  };
}

// Order = images by total votes on their captions, then newest. Only ids and
// counts are read for the whole set; full rows only for the 60 on the page.
async function votesOrder(supabase: Client, from: number, to: number) {
  const [images, voted] = await Promise.all([
    fetchAll<{ id: number; created_at: string }>((a, b) =>
      supabase.from("admin_image_rows").select("id, created_at").order("id").range(a, b),
    ),
    fetchAll<{ image_id: number; vote_count: number }>((a, b) =>
      supabase
        .from("admin_caption_rows")
        .select("image_id, vote_count")
        .gt("vote_count", 0)
        .order("id")
        .range(a, b),
    ),
  ]);
  const votes = new Map<number, number>();
  for (const c of voted) votes.set(c.image_id, (votes.get(c.image_id) ?? 0) + Number(c.vote_count));

  const ordered = images.sort(
      (a, b) =>
        (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id - a.id,
    );
  const pageIds = ordered.slice(from, to + 1).map((i) => i.id);
  if (pageIds.length === 0) return { rows: [], total: ordered.length };

  const { data, error } = await supabase
    .from("admin_image_rows")
    .select(TILE_COLUMNS)
    .in("id", pageIds)
    .returns<BaseTile[]>();
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((r) => [r.id, r]));
  return {
    rows: pageIds.map((id) => byId.get(id)).filter((r) => r !== undefined),
    total: ordered.length,
  };
}

// Published captions and votes for just these images (never the whole table).
async function captionStats(supabase: Client, ids: number[]) {
  const stats = new Map<number, { published: number; votes: number }>();
  if (ids.length === 0) return stats;
  const caps = await fetchAll<{ image_id: number; is_public: boolean; vote_count: number }>((a, b) =>
    supabase
      .from("admin_caption_rows")
      .select("image_id, is_public, vote_count")
      .in("image_id", ids)
      .order("id")
      .range(a, b),
  );
  for (const c of caps) {
    const s = stats.get(c.image_id) ?? { published: 0, votes: 0 };
    if (c.is_public) s.published++;
    s.votes += Number(c.vote_count);
    stats.set(c.image_id, s);
  }
  return stats;
}

// ---------- detail ----------

export type ImageDetail = {
  id: number;
  url: string;
  description: string | null;
  created_at: string;
  owner: string;
};

export type ImageCaption = {
  id: number;
  content: string;
  is_public: boolean;
  like_count: number;
  created_at: string;
  caption_request_id: number | null;
  up: number;
  down: number;
  favorites: number;
};

export type ImageRequest = {
  id: number;
  created_at: string;
  author: string | null;
  responses: LlmResponse[];
};

export async function getImageDetail(id: number) {
  const { supabase } = await adminClient();

  const { data: image, error } = await supabase
    .from("admin_image_rows")
    .select("id, url, description, created_at, owner_first_name, owner_last_name, owner_email")
    .eq("id", id)
    .maybeSingle<{
      id: number;
      url: string;
      description: string | null;
      created_at: string;
      owner_first_name: string | null;
      owner_last_name: string | null;
      owner_email: string | null;
    }>();
  if (error) throw new Error(error.message);
  if (!image) return null;

  const [captions, votes, favs, requests] = await Promise.all([
    fetchAll<Omit<ImageCaption, "up" | "down" | "favorites">>((a, b) =>
      supabase
        .from("captions")
        .select("id, content, is_public, like_count, created_at, caption_request_id")
        .eq("image_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(a, b),
    ),
    // Votes on this image's captions, filtered through the caption join.
    fetchAll<{ caption_id: number; vote_value: number }>((a, b) =>
      supabase
        .from("caption_votes")
        .select("caption_id, vote_value, captions!inner(image_id)")
        .eq("captions.image_id", id)
        .order("id")
        .range(a, b),
    ),
    favoriteCounts(supabase),
    supabase
      .from("caption_requests")
      .select("id, created_at, profile_id")
      .eq("image_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<{ id: number; created_at: string; profile_id: string | null }[]>(),
  ]);
  if (requests.error) throw new Error(requests.error.message);

  const split = new Map<number, { up: number; down: number }>();
  for (const v of votes) {
    const s = split.get(v.caption_id) ?? { up: 0, down: 0 };
    if (v.vote_value > 0) s.up++;
    else s.down++;
    split.set(v.caption_id, s);
  }

  const reqs = requests.data ?? [];
  const reqIds = reqs.map((r) => r.id);
  const profileIds = [...new Set(reqs.map((r) => r.profile_id).filter((p) => p !== null))];
  const [responses, profiles] = await Promise.all([
    reqIds.length
      ? fetchAll<LlmResponse & { caption_request_id: number }>((a, b) =>
          supabase
            .from("llm_responses")
            .select("id, caption_request_id, step_index, step_name, model, prompt, raw_output, created_at")
            .in("caption_request_id", reqIds)
            .order("step_index")
            .order("id")
            .range(a, b),
        )
      : [],
    profileIds.length
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", profileIds)
          .returns<{ id: string; first_name: string | null; last_name: string | null; email: string | null }[]>()
      : null,
  ]);
  if (profiles?.error) throw new Error(profiles.error.message);
  const nameById = new Map((profiles?.data ?? []).map((p) => [p.id, displayName(p)]));
  const byRequest = new Map<number, LlmResponse[]>();
  for (const r of responses) {
    const list = byRequest.get(r.caption_request_id) ?? [];
    list.push(r);
    byRequest.set(r.caption_request_id, list);
  }

  return {
    image: {
      id: image.id,
      url: image.url,
      description: image.description,
      created_at: image.created_at,
      owner:
        [image.owner_first_name, image.owner_last_name].filter(Boolean).join(" ") ||
        image.owner_email ||
        "seed",
    } satisfies ImageDetail,
    captions: captions.map((c) => ({
      ...c,
      up: split.get(c.id)?.up ?? 0,
      down: split.get(c.id)?.down ?? 0,
      favorites: favs.get(c.id) ?? 0,
    })) as ImageCaption[],
    requests: reqs.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      author: r.profile_id === null ? null : nameById.get(r.profile_id) ?? r.profile_id.slice(0, 8),
      responses: byRequest.get(r.id) ?? [],
    })) as ImageRequest[],
  };
}
