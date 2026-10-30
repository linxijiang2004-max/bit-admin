"use server";

import { revalidatePath } from "next/cache";
import { normalizeDomain, normalizeEmail } from "@/lib/admin/access-validate";
import { adminClient } from "@/lib/admin/db";
import { confirmedDelete, dbError, isError, noRows, text, type FormState } from "@/lib/admin/forms";

// Every action: adminClient() runs requireSuperadmin() first. Both lists are
// written directly through PostgREST (superadmin RLS). They are only stored
// here; nothing in signup reads them yet.

const PATH = "/access";

function readNote(fd: FormData) {
  return text(fd, "note", { max: 500 });
}

// ---------- allowed signup domains ----------

function readDomain(fd: FormData) {
  const domain = normalizeDomain(String(fd.get("domain") ?? ""));
  if (typeof domain !== "string") return domain;
  const note = readNote(fd);
  if (isError(note)) return note;
  return { domain, note };
}

export async function createDomain(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readDomain(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("allowed_signup_domains").insert(values).select("id");
  if (error) return { error: dbError(error, "domain") };
  if (!data?.length) return noRows("domain", "create");

  revalidatePath(PATH);
  return { ok: `added ${values.domain}`, done: true };
}

export async function updateDomain(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readDomain(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase
    .from("allowed_signup_domains")
    .update(values)
    .eq("id", id)
    .select("id");
  if (error) return { error: dbError(error, "domain") };
  if (!data?.length) return noRows("domain", "update");

  revalidatePath(PATH);
  return { ok: "saved", done: true };
}

export async function deleteDomain(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  if (!confirmedDelete(fd)) return { error: "type DELETE to confirm" };

  const { data, error } = await supabase.from("allowed_signup_domains").delete().eq("id", id).select("id");
  if (error) return { error: dbError(error, "domain") };
  if (!data?.length) return noRows("domain", "delete");

  revalidatePath(PATH);
  return { ok: "deleted", done: true };
}

// ---------- whitelisted emails (stored lowercased) ----------

function readEmail(fd: FormData) {
  const email = normalizeEmail(String(fd.get("email") ?? ""));
  if (typeof email !== "string") return email;
  const note = readNote(fd);
  if (isError(note)) return note;
  return { email, note };
}

export async function createEmail(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readEmail(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("whitelisted_emails").insert(values).select("id");
  if (error) return { error: dbError(error, "email") };
  if (!data?.length) return noRows("email", "create");

  revalidatePath(PATH);
  return { ok: `added ${values.email}`, done: true };
}

export async function updateEmail(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readEmail(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("whitelisted_emails").update(values).eq("id", id).select("id");
  if (error) return { error: dbError(error, "email") };
  if (!data?.length) return noRows("email", "update");

  revalidatePath(PATH);
  return { ok: "saved", done: true };
}

export async function deleteEmail(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  if (!confirmedDelete(fd)) return { error: "type DELETE to confirm" };

  const { data, error } = await supabase.from("whitelisted_emails").delete().eq("id", id).select("id");
  if (error) return { error: dbError(error, "email") };
  if (!data?.length) return noRows("email", "delete");

  revalidatePath(PATH);
  return { ok: "deleted", done: true };
}
