import "server-only";
import { adminClient } from "./db";
import { favoriteCounts } from "./favorites";
import { rangeOf } from "./params";

export const PEOPLE_SORTS = [
  "created_at",
  "images_uploaded",
  "captions_authored",
  "captions_published",
  "votes_cast",
  "publish_rate",
] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number];

export type PersonRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_superadmin: boolean;
  images_uploaded: number;
  captions_authored: number;
  captions_published: number;
  votes_cast: number;
  publish_rate: number | null;
  favorites_received: number;
};

// READ only, by design: there is no write path for profiles in this app.
export async function listPeople(opts: { sort: PeopleSort; dir: "asc" | "desc"; page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);

  const [{ data, error, count }, favs] = await Promise.all([
    supabase
      .from("admin_people_rows")
      .select(
        "id, email, first_name, last_name, avatar_url, created_at, is_superadmin, images_uploaded, captions_authored, captions_published, votes_cast, publish_rate",
        { count: "exact" },
      )
      .order(opts.sort, { ascending: opts.dir === "asc", nullsFirst: false })
      .order("id")
      .range(from, to),
    favoriteCounts(supabase),
  ]);
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("people query returned no data");

  const people = data as unknown as Omit<PersonRow, "favorites_received">[];

  // Favorites received = sum of favorite COUNTS on each person's captions.
  // Only favorited captions authored by people on this page are looked up.
  const received = new Map<string, number>();
  const favIds = [...favs.keys()];
  const ids = people.map((p) => p.id);
  if (favIds.length && ids.length) {
    const { data: authored, error: aError } = await supabase
      .from("captions")
      .select("id, profile_id")
      .in("id", favIds)
      .in("profile_id", ids)
      .returns<{ id: number; profile_id: string }[]>();
    if (aError) throw new Error(aError.message);
    for (const c of authored ?? []) {
      received.set(c.profile_id, (received.get(c.profile_id) ?? 0) + (favs.get(c.id) ?? 0));
    }
  }

  return {
    total: count,
    rows: people.map((p) => ({
      ...p,
      images_uploaded: Number(p.images_uploaded),
      captions_authored: Number(p.captions_authored),
      captions_published: Number(p.captions_published),
      votes_cast: Number(p.votes_cast),
      publish_rate: p.publish_rate === null ? null : Number(p.publish_rate),
      favorites_received: received.get(p.id) ?? 0,
    })) as PersonRow[],
  };
}
