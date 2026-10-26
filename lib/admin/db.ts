import "server-only";
import { requireSuperadmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

// The only way admin code gets a Supabase client: the gate runs first, every
// time. Reads still go through RLS as the signed-in superadmin.
export async function adminClient() {
  const admin = await requireSuperadmin();
  const supabase = await createClient();
  return { admin, supabase };
}

// PostgREST caps responses at 1000 rows by default. Page through so stats
// aren't silently computed on a truncated set.
const PAGE = 1000;
const MAX_PAGES = 50;

export async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE, (i + 1) * PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data) throw new Error("query returned no data");
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
  return rows;
}

export function displayName(p: {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return name || p.email || "unknown";
}
