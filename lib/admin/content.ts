import "server-only";
import { adminClient } from "./db";
import { ilikePattern, rangeOf } from "./params";

export type TermRow = {
  id: number;
  term: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
};

export type ExampleRow = {
  id: number;
  chain_id: number | null;
  input_description: string;
  output_caption: string;
  is_positive: boolean;
  notes: string | null;
  created_at: string;
  chain: { name: string } | null;
};

export const EXAMPLE_POLARITIES = ["all", "positive", "negative"] as const;
export type ExamplePolarity = (typeof EXAMPLE_POLARITIES)[number];

export async function listTerms(opts: { q: string; category: string; page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);

  let query = supabase
    .from("terms")
    .select("id, term, category, is_active, created_at", { count: "exact" });
  if (opts.q) query = query.ilike("term", ilikePattern(opts.q));
  // Category is an exact (case-insensitive) match: no wildcards.
  if (opts.category) query = query.ilike("category", opts.category.replace(/[\\%_]/g, (c) => `\\${c}`));

  const { data, error, count } = await query
    .order("term")
    .order("id")
    .range(from, to)
    .returns<TermRow[]>();
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("term query returned no data");
  return { total: count, rows: data };
}

export async function listExamples(opts: { polarity: ExamplePolarity; page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);

  let query = supabase
    .from("generation_examples")
    .select(
      "id, chain_id, input_description, output_caption, is_positive, notes, created_at, chain:prompt_chains(name)",
      { count: "exact" },
    );
  if (opts.polarity === "positive") query = query.eq("is_positive", true);
  if (opts.polarity === "negative") query = query.eq("is_positive", false);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)
    .returns<ExampleRow[]>();
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("example query returned no data");
  return { total: count, rows: data };
}

// For the chain <select>: bounded, never the whole table.
export async function chainChoices() {
  const { supabase } = await adminClient();
  const { data, error } = await supabase
    .from("prompt_chains")
    .select("id, name")
    .order("name")
    .limit(200)
    .returns<{ id: number; name: string }[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
