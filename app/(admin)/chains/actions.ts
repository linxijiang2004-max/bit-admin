"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/db";
import { checkbox, dbError, noRows, type FormState } from "@/lib/admin/forms";

const MAX_WEIGHT = 1_000_000;

// prompt_chain_mix is UPDATE only: there is deliberately no create or delete.
export async function updateMix(chainId: number, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return { error: "invalid chain" };

  const raw = String(formData.get("weight") ?? "").trim();
  const weight = Number(raw);
  if (raw === "" || !Number.isFinite(weight)) return { error: "weight must be a number" };
  if (weight < 0) return { error: "weight can't be negative" };
  if (weight > MAX_WEIGHT) return { error: `max weight ${MAX_WEIGHT.toLocaleString("en-US")}` };
  const isEnabled = checkbox(formData, "is_enabled");

  const { data, error } = await supabase
    .from("prompt_chain_mix")
    .update({ weight, is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq("chain_id", chainId)
    .select("weight, is_enabled");
  if (error) return { error: dbError(error, "mix row") };
  if (!data?.length) return noRows("mix", "update");
  const row = data[0] as { weight: number; is_enabled: boolean };
  // The column's numeric scale may round the weight, so only is_enabled is
  // compared exactly; the stored weight is echoed back instead.
  if (row.is_enabled !== isEnabled) {
    return { error: "update did not apply (mix unchanged in the database)" };
  }

  revalidatePath("/chains");
  return { ok: `saved · ${Number(row.weight)}`, done: true };
}
