import "server-only";
import { adminClient } from "./db";
import { rangeOf } from "./params";

export type ProviderRow = {
  id: number;
  name: string;
  slug: string;
  base_url: string | null;
  is_active: boolean;
  created_at: string;
  model_count: number;
};

export type ModelRow = {
  id: number;
  provider_id: number;
  name: string;
  model_string: string;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  provider: { name: string } | null;
};

export async function listProviders(opts: { page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);

  const { data, error, count } = await supabase
    .from("llm_providers")
    .select("id, name, slug, base_url, is_active, created_at", { count: "exact" })
    .order("name")
    .order("id")
    .range(from, to)
    .returns<Omit<ProviderRow, "model_count">[]>();
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("provider query returned no data");

  // Model counts for this page's providers, for the cascade warning.
  const counts = new Map<number, number>();
  const ids = data.map((p) => p.id);
  if (ids.length) {
    const { data: models, error: mError } = await supabase
      .from("llm_models")
      .select("provider_id")
      .in("provider_id", ids)
      .returns<{ provider_id: number }[]>();
    if (mError) throw new Error(mError.message);
    for (const m of models ?? []) counts.set(m.provider_id, (counts.get(m.provider_id) ?? 0) + 1);
  }

  return {
    total: count,
    rows: data.map((p) => ({ ...p, model_count: counts.get(p.id) ?? 0 })) as ProviderRow[],
  };
}

export async function listModels(opts: { page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);

  const { data, error, count } = await supabase
    .from("llm_models")
    .select(
      "id, provider_id, name, model_string, is_default, is_active, notes, created_at, provider:llm_providers(name)",
      { count: "exact" },
    )
    .order("is_default", { ascending: false })
    .order("name")
    .order("id")
    .range(from, to)
    .returns<ModelRow[]>();
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("model query returned no data");
  return { total: count, rows: data };
}

// For the provider <select>: bounded, never the whole table.
export async function providerChoices() {
  const { supabase } = await adminClient();
  const { data, error } = await supabase
    .from("llm_providers")
    .select("id, name")
    .order("name")
    .limit(200)
    .returns<{ id: number; name: string }[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
