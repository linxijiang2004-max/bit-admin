import "server-only";
import { adminClient, fetchAll } from "./db";
import { rangeOf } from "./params";

export type ChainMix = { weight: number; is_enabled: boolean; updated_at: string | null };

export type ChainRow = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  step_count: number;
  mix: ChainMix | null;
};

export type ChainStep = {
  id: number;
  step_index: number;
  step_name: string;
  prompt_template: string;
  model_id: number | null;
  model: { name: string; model_string: string } | null;
};

// prompt_chains and prompt_chain_steps are READ only here. prompt_chain_mix
// is read + update (see app/(admin)/chains/actions.ts); rows are never
// created or deleted from this app.
export async function listChains(opts: { page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);

  const [chains, enabledWeights] = await Promise.all([
    supabase
      .from("prompt_chains")
      .select("id, name, description, is_active, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
      .returns<Omit<ChainRow, "step_count" | "mix">[]>(),
    // The share denominator is a SUM, and PostgREST aggregates are off, so
    // read just the weight column of enabled mix rows (one row per chain).
    fetchAll<{ weight: number }>((a, b) =>
      supabase
        .from("prompt_chain_mix")
        .select("weight")
        .eq("is_enabled", true)
        .order("chain_id")
        .range(a, b),
    ),
  ]);
  if (chains.error) throw new Error(chains.error.message);
  if (!chains.data || chains.count === null) throw new Error("chain query returned no data");

  // Step counts and mix rows for the chains on this page only.
  const ids = chains.data.map((c) => c.id);
  const stepCounts = new Map<number, number>();
  const mixById = new Map<number, ChainMix>();
  if (ids.length) {
    const [steps, mix] = await Promise.all([
      supabase
        .from("prompt_chain_steps")
        .select("chain_id")
        .in("chain_id", ids)
        .returns<{ chain_id: number }[]>(),
      supabase
        .from("prompt_chain_mix")
        .select("chain_id, weight, is_enabled, updated_at")
        .in("chain_id", ids)
        .returns<(ChainMix & { chain_id: number })[]>(),
    ]);
    if (steps.error) throw new Error(steps.error.message);
    if (mix.error) throw new Error(mix.error.message);
    for (const s of steps.data ?? []) stepCounts.set(s.chain_id, (stepCounts.get(s.chain_id) ?? 0) + 1);
    for (const { chain_id, ...m } of mix.data ?? []) mixById.set(chain_id, { ...m, weight: Number(m.weight) });
  }

  return {
    total: chains.count,
    totalEnabledWeight: enabledWeights.reduce((n, r) => n + Number(r.weight), 0),
    enabledChains: enabledWeights.length,
    rows: chains.data.map((c) => ({
      ...c,
      step_count: stepCounts.get(c.id) ?? 0,
      mix: mixById.get(c.id) ?? null,
    })) as ChainRow[],
  };
}

export async function getChainSteps(chainId: number): Promise<ChainStep[]> {
  const { supabase } = await adminClient();
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .select("id, step_index, step_name, prompt_template, model_id, model:llm_models(name, model_string)")
    .eq("chain_id", chainId)
    .order("step_index")
    .returns<ChainStep[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
