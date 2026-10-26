import "server-only";
import { adminClient } from "./db";
import { favoriteCounts } from "./favorites";
import { ilikePattern, nextDay, rangeOf } from "./params";

export const CAPTION_SORTS = ["created_at", "like_count", "vote_count", "favorites", "id"] as const;
export type CaptionSort = (typeof CAPTION_SORTS)[number];
export const CAPTION_STATUSES = ["all", "published", "unpublished"] as const;
export type CaptionStatus = (typeof CAPTION_STATUSES)[number];

export type CaptionListRow = {
  id: number;
  image_id: number;
  content: string;
  is_public: boolean;
  like_count: number;
  created_at: string;
  profile_id: string | null;
  caption_request_id: number | null;
  image_url: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
  author_email: string | null;
  vote_count: number;
  favorites: number;
};

const COLUMNS =
  "id, image_id, content, is_public, like_count, created_at, profile_id, caption_request_id, image_url, author_first_name, author_last_name, author_email, vote_count";

type Opts = {
  status: CaptionStatus;
  q: string;
  from?: string; // YYYY-MM-DD, inclusive, UTC
  to?: string; // YYYY-MM-DD, inclusive, UTC
  sort: CaptionSort;
  dir: "asc" | "desc";
  page: number;
};

export async function listCaptions(opts: Opts) {
  const { supabase } = await adminClient();
  const favs = await favoriteCounts(supabase);
  const ascending = opts.dir === "asc";

  // One filtered query builder, reused for count, page and id lookups.
  const filtered = (columns: string, head = false) => {
    let query = supabase
      .from("admin_caption_rows")
      .select(columns, { count: "exact", head });
    if (opts.status === "published") query = query.eq("is_public", true);
    if (opts.status === "unpublished") query = query.eq("is_public", false);
    if (opts.q) query = query.ilike("content", ilikePattern(opts.q));
    if (opts.from) query = query.gte("created_at", `${opts.from}T00:00:00Z`);
    if (opts.to) query = query.lt("created_at", `${nextDay(opts.to)}T00:00:00Z`);
    return query;
  };

  const [from, to] = rangeOf(opts.page);
  let rows: Omit<CaptionListRow, "favorites">[];
  let total: number;

  if (opts.sort !== "favorites") {
    const { data, error, count } = await filtered(COLUMNS)
      .order(opts.sort, { ascending })
      .order("id", { ascending })
      .range(from, to);
    if (error) throw new Error(error.message);
    if (!data || count === null) throw new Error("caption query returned no data");
    rows = data as unknown as Omit<CaptionListRow, "favorites">[];
    total = count;
  } else {
    // Favorite counts live in an RPC, not a column, so PostgREST can't sort
    // by them. Order = favorited captions (by count) + the rest (by id),
    // reversed for ascending, and only the requested 50 rows are fetched.
    const favIds = [...favs.keys()];
    const { count, error: countError } = await filtered("id", true);
    if (countError || count === null) throw new Error(countError?.message ?? "count failed");
    total = count;

    let favOrdered: number[] = [];
    if (favIds.length) {
      const { data, error } = await filtered("id").in("id", favIds);
      if (error || !data) throw new Error(error?.message ?? "favorite lookup failed");
      favOrdered = (data as unknown as { id: number }[])
        .map((r) => r.id)
        .sort((a, b) => (favs.get(b)! - favs.get(a)!) || b - a);
      if (ascending) favOrdered.reverse();
    }
    const restTotal = total - favOrdered.length;

    // Split the page range into the favorited part and the rest.
    const favStart = ascending ? restTotal : 0;
    const restStart = ascending ? 0 : favOrdered.length;
    const pageFavIds = favOrdered.slice(
      Math.max(0, from - favStart),
      Math.max(0, to + 1 - favStart),
    );
    const restFrom = Math.max(0, from - restStart);
    const restTo = Math.min(restTotal - 1, to - restStart);

    const fetchByIds = async (ids: number[]) => {
      if (!ids.length) return [];
      const { data, error } = await filtered(COLUMNS).in("id", ids);
      if (error || !data) throw new Error(error?.message ?? "caption lookup failed");
      const byId = new Map(
        (data as unknown as Omit<CaptionListRow, "favorites">[]).map((r) => [r.id, r]),
      );
      return ids.map((id) => byId.get(id)!).filter(Boolean);
    };
    const fetchRest = async () => {
      if (restTo < restFrom) return [];
      let query = filtered(COLUMNS);
      if (favIds.length) query = query.not("id", "in", `(${favIds.join(",")})`);
      const { data, error } = await query.order("id", { ascending }).range(restFrom, restTo);
      if (error || !data) throw new Error(error?.message ?? "caption page failed");
      return data as unknown as Omit<CaptionListRow, "favorites">[];
    };

    const [favRows, restRows] = await Promise.all([fetchByIds(pageFavIds), fetchRest()]);
    rows = ascending ? [...restRows, ...favRows] : [...favRows, ...restRows];
  }

  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      vote_count: Number(r.vote_count),
      favorites: favs.get(r.id) ?? 0,
    })) as CaptionListRow[],
  };
}

export type ProvenanceStep = {
  id: number;
  step_index: number;
  step_name: string;
  prompt: string;
  model: string;
  raw_output: string | null;
  created_at: string;
};

export type Provenance = {
  caption: CaptionListRow;
  request: { id: number; image_id: number; profile_id: string; created_at: string } | null;
  requester: string | null;
  steps: ProvenanceStep[];
};

export async function getProvenance(id: number): Promise<Provenance | null> {
  const { supabase } = await adminClient();

  const [{ data: caption, error }, favs] = await Promise.all([
    supabase
      .from("admin_caption_rows")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle<Omit<CaptionListRow, "favorites">>(),
    favoriteCounts(supabase),
  ]);
  if (error) throw new Error(error.message);
  if (!caption) return null;

  let request: Provenance["request"] = null;
  let requester: string | null = null;
  let steps: ProvenanceStep[] = [];

  if (caption.caption_request_id !== null) {
    const [req, st] = await Promise.all([
      supabase
        .from("caption_requests")
        .select("id, image_id, profile_id, created_at")
        .eq("id", caption.caption_request_id)
        .maybeSingle<NonNullable<Provenance["request"]>>(),
      supabase
        .from("caption_request_steps")
        .select("id, step_index, step_name, prompt, model, raw_output, created_at")
        .eq("caption_request_id", caption.caption_request_id)
        .order("step_index")
        .returns<ProvenanceStep[]>(),
    ]);
    if (req.error) throw new Error(req.error.message);
    if (st.error) throw new Error(st.error.message);
    request = req.data;
    steps = st.data ?? [];

    if (request) {
      const { data: p, error: pError } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", request.profile_id)
        .maybeSingle<{ first_name: string | null; last_name: string | null; email: string | null }>();
      if (pError) throw new Error(pError.message);
      requester = p
        ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email
        : null;
    }
  }

  return {
    caption: { ...caption, vote_count: Number(caption.vote_count), favorites: favs.get(id) ?? 0 },
    request,
    requester,
    steps,
  };
}

// For the "new caption" picker: the most recent images only, never the table.
export async function listImageChoices() {
  const { supabase } = await adminClient();
  const { data, error } = await supabase
    .from("images")
    .select("id, url, description")
    .order("id", { ascending: false })
    .limit(200)
    .returns<{ id: number; url: string; description: string | null }[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
