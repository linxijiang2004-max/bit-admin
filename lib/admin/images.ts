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
  captions: ImageCaption[];
};

export type ImageCaption = {
  id: number;
  content: string;
  is_public: boolean;
  like_count: number;
  vote_count: number;
  created_at: string;
};

export async function listImages(opts: { page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);

  const query = supabase
    .from("admin_image_rows")
    .select(
      "id, url, description, is_library, profile_id, created_at, owner_first_name, owner_last_name, owner_email, caption_count",
      { count: "exact" },
    );

  const { data, error, count } = await query
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("image query returned no data");

  const images = data as unknown as Omit<ImageListRow, "captions">[];

  // Captions for just the images on this page (never the whole table).
  const ids = images.map((i) => i.id);
  const byImage = new Map<number, ImageCaption[]>();
  if (ids.length) {
    const { data: caps, error: capError } = await supabase
      .from("admin_caption_rows")
      .select("id, image_id, content, is_public, like_count, vote_count, created_at")
      .in("image_id", ids)
      .order("like_count", { ascending: false })
      .order("id", { ascending: false })
      .returns<(ImageCaption & { image_id: number })[]>();
    if (capError) throw new Error(capError.message);
    for (const { image_id, ...c } of caps ?? []) {
      const list = byImage.get(image_id) ?? [];
      list.push({ ...c, vote_count: Number(c.vote_count) });
      byImage.set(image_id, list);
    }
  }

  return {
    total: count,
    rows: images.map((r) => ({
      ...r,
      caption_count: Number(r.caption_count),
      captions: byImage.get(r.id) ?? [],
    })) as ImageListRow[],
  };
}
