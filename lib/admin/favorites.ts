import "server-only";
import type { adminClient } from "./db";

type Client = Awaited<ReturnType<typeof adminClient>>["supabase"];

// Favorites are private in bit. The admin console only ever sees COUNTS,
// aggregated in the database by admin_favorite_counts(); no individual
// favorite row (who favorited what) reaches this app.
export async function favoriteCounts(supabase: Client): Promise<Map<number, number>> {
  const { data, error } = await supabase.rpc("admin_favorite_counts");
  if (error) throw new Error(`admin_favorite_counts: ${error.message}`);
  if (!Array.isArray(data)) throw new Error("admin_favorite_counts returned no rows");
  return new Map(
    (data as { caption_id: number; favorites: number }[])
      .filter((r) => Number(r.favorites) > 0)
      .map((r) => [Number(r.caption_id), Number(r.favorites)]),
  );
}
