import "server-only";
import { adminClient } from "./db";
import { rangeOf } from "./params";

export type ImageListRow = {
  id: number;
  url: string;
  description: string | null;
  is_library: boolean;
  profile_id: string | null;
  created_at: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_email: string | null;
  caption_count: number;
  // Votes on this image's captions: what a delete would cascade into.
  vote_count: number;
};

export async function listImages(opts: { page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);

  const { data, error, count } = await supabase
    .from("admin_image_rows")
    .select(
      "id, url, description, is_library, profile_id, created_at, owner_first_name, owner_last_name, owner_email, caption_count",
      { count: "exact" },
    )
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("image query returned no data");

  const images = data as unknown as Omit<ImageListRow, "vote_count">[];

  // Vote totals for just the images on this page (never the whole table).
  const ids = images.map((i) => i.id);
  const votes = new Map<number, number>();
  if (ids.length) {
    const { data: caps, error: capError } = await supabase
      .from("admin_caption_rows")
      .select("image_id, vote_count")
      .in("image_id", ids)
      .returns<{ image_id: number; vote_count: number }[]>();
    if (capError) throw new Error(capError.message);
    for (const c of caps ?? []) votes.set(c.image_id, (votes.get(c.image_id) ?? 0) + Number(c.vote_count));
  }

  return {
    total: count,
    rows: images.map((r) => ({
      ...r,
      caption_count: Number(r.caption_count),
      vote_count: votes.get(r.id) ?? 0,
    })) as ImageListRow[],
  };
}
