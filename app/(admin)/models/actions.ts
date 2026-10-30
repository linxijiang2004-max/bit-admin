"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/db";
import {
  checkbox,
  confirmedDelete,
  dbError,
  isError,
  noRows,
  positiveId,
  text,
  type FormState,
} from "@/lib/admin/forms";

// Every action: adminClient() runs requireSuperadmin() first. llm_providers
// and llm_models are written directly through PostgREST (superadmin RLS);
// each write asks for the affected rows back so a refused write is an error.

type Client = Awaited<ReturnType<typeof adminClient>>["supabase"];

const PATH = "/models";

// ---------- providers ----------

function readProvider(fd: FormData) {
  const name = text(fd, "name", { max: 100, required: true });
  if (isError(name)) return name;
  const slug = text(fd, "slug", { max: 64, required: true });
  if (isError(slug)) return slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug!)) {
    return { error: "slug: lowercase letters, digits and single hyphens only" };
  }
  const baseUrl = text(fd, "base_url", { label: "base url", max: 2048 });
  if (isError(baseUrl)) return baseUrl;
  if (baseUrl !== null) {
    try {
      const u = new URL(baseUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      return { error: "base url must be a full http(s) URL" };
    }
  }
  return { name: name!, slug: slug!, base_url: baseUrl, is_active: checkbox(fd, "is_active") };
}

export async function createProvider(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readProvider(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("llm_providers").insert(values).select("id");
  if (error) return { error: dbError(error, "provider (name or slug)") };
  if (!data?.length) return noRows("provider", "create");

  revalidatePath(PATH);
  return { ok: `created provider ${values.name}`, done: true };
}

export async function updateProvider(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readProvider(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("llm_providers").update(values).eq("id", id).select("id");
  if (error) return { error: dbError(error, "provider (name or slug)") };
  if (!data?.length) return noRows("provider", "update");

  revalidatePath(PATH);
  return { ok: "saved", done: true };
}

// Cascades to the provider's models (FK on delete cascade).
export async function deleteProvider(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  if (!confirmedDelete(fd)) return { error: "type DELETE to confirm" };

  const { data, error } = await supabase.from("llm_providers").delete().eq("id", id).select("id");
  if (error) return { error: dbError(error, "provider") };
  if (!data?.length) return noRows("provider", "delete");

  revalidatePath(PATH);
  return { ok: "deleted", done: true };
}

// ---------- models ----------

// model_string is sent to the API verbatim. An alias such as "-latest"
// silently resolves to a different model over time, so past runs could never
// be reproduced; only pinned version strings are accepted.
function readModel(fd: FormData) {
  const providerId = positiveId(fd.get("provider_id"), "provider");
  if (isError(providerId)) return providerId;
  const name = text(fd, "name", { max: 100, required: true });
  if (isError(name)) return name;
  const modelString = text(fd, "model_string", { label: "model string", max: 200, required: true });
  if (isError(modelString)) return modelString;
  if (/\s/.test(modelString!)) return { error: "model string can't contain spaces" };
  if (/latest/i.test(modelString!)) {
    return { error: "model string must be a pinned version, not a \"latest\" alias" };
  }
  const notes = text(fd, "notes", { max: 2000 });
  if (isError(notes)) return notes;
  return {
    provider_id: providerId,
    name: name!,
    model_string: modelString!,
    is_active: checkbox(fd, "is_active"),
    notes,
    makeDefault: checkbox(fd, "is_default"),
  };
}

// Exactly one default: clear every other default, then set this one. Two
// requests, not one transaction; a failure between them leaves no default,
// never two, and the error says so.
async function setDefault(supabase: Client, id: number): Promise<string | null> {
  const { error: clearError } = await supabase
    .from("llm_models")
    .update({ is_default: false })
    .eq("is_default", true)
    .neq("id", id);
  if (clearError) return `couldn't clear the previous default: ${clearError.message}`;

  const { data, error } = await supabase
    .from("llm_models")
    .update({ is_default: true })
    .eq("id", id)
    .select("id");
  if (error) return `previous default cleared, but setting this one failed: ${error.message}`;
  if (!data?.length) return "previous default cleared, but this model could not be set as default";
  return null;
}

export async function createModel(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readModel(fd);
  if ("error" in values) return values;
  const { makeDefault, ...row } = values;

  const { data, error } = await supabase
    .from("llm_models")
    .insert({ ...row, is_default: false })
    .select("id");
  if (error) return { error: dbError(error, "model") };
  if (!data?.length) return noRows("model", "create");
  const id = (data[0] as { id: number }).id;

  if (makeDefault) {
    const failed = await setDefault(supabase, id);
    revalidatePath(PATH);
    if (failed) return { error: `model ${id} created, but ${failed}` };
  }

  revalidatePath(PATH);
  return { ok: `created model ${row.name}`, done: true };
}

export async function updateModel(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readModel(fd);
  if ("error" in values) return values;
  const { makeDefault, ...row } = values;

  // is_default is only ever turned on through setDefault(); unticking it
  // here clears it.
  const { data, error } = await supabase
    .from("llm_models")
    .update(makeDefault ? row : { ...row, is_default: false })
    .eq("id", id)
    .select("id");
  if (error) return { error: dbError(error, "model") };
  if (!data?.length) return noRows("model", "update");

  if (makeDefault) {
    const failed = await setDefault(supabase, id);
    revalidatePath(PATH);
    if (failed) return { error: `saved, but ${failed}` };
  }

  revalidatePath(PATH);
  return { ok: "saved", done: true };
}

export async function deleteModel(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  if (!confirmedDelete(fd)) return { error: "type DELETE to confirm" };

  const { data, error } = await supabase.from("llm_models").delete().eq("id", id).select("id");
  if (error) return { error: dbError(error, "model") };
  if (!data?.length) return noRows("model", "delete");

  revalidatePath(PATH);
  return { ok: "deleted", done: true };
}
