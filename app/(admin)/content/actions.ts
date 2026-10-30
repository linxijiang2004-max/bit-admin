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

// Every action: adminClient() runs requireSuperadmin() first. terms and
// generation_examples are written directly through PostgREST (superadmin
// RLS); each write asks for the affected rows back.

const PATH = "/content";

// ---------- terms ----------

function readTerm(fd: FormData) {
  const term = text(fd, "term", { max: 200, required: true });
  if (isError(term)) return term;
  const category = text(fd, "category", { max: 100 });
  if (isError(category)) return category;
  return { term: term!, category, is_active: checkbox(fd, "is_active") };
}

export async function createTerm(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readTerm(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("terms").insert(values).select("id");
  if (error) return { error: dbError(error, "term") };
  if (!data?.length) return noRows("term", "create");

  revalidatePath(PATH);
  return { ok: `added “${values.term}”`, done: true };
}

export async function updateTerm(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readTerm(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("terms").update(values).eq("id", id).select("id");
  if (error) return { error: dbError(error, "term") };
  if (!data?.length) return noRows("term", "update");

  revalidatePath(PATH);
  return { ok: "saved", done: true };
}

export async function deleteTerm(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  if (!confirmedDelete(fd)) return { error: "type DELETE to confirm" };

  const { data, error } = await supabase.from("terms").delete().eq("id", id).select("id");
  if (error) return { error: dbError(error, "term") };
  if (!data?.length) return noRows("term", "delete");

  revalidatePath(PATH);
  return { ok: "deleted", done: true };
}

// ---------- generation examples ----------

function readExample(fd: FormData) {
  const chainId = positiveId(fd.get("chain_id"), "chain");
  if (isError(chainId)) return chainId;
  const input = text(fd, "input_description", { label: "input description", max: 4000, required: true });
  if (isError(input)) return input;
  const output = text(fd, "output_caption", { label: "output caption", max: 2000, required: true });
  if (isError(output)) return output;
  const notes = text(fd, "notes", { max: 2000 });
  if (isError(notes)) return notes;
  const polarity = fd.get("is_positive");
  if (polarity !== "true" && polarity !== "false") return { error: "pick positive or negative" };
  return {
    chain_id: chainId,
    input_description: input!,
    output_caption: output!,
    is_positive: polarity === "true",
    notes,
  };
}

export async function createExample(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readExample(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("generation_examples").insert(values).select("id");
  if (error) return { error: dbError(error, "example") };
  if (!data?.length) return noRows("example", "create");

  revalidatePath(PATH);
  return { ok: "example added", done: true };
}

export async function updateExample(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const values = readExample(fd);
  if ("error" in values) return values;

  const { data, error } = await supabase.from("generation_examples").update(values).eq("id", id).select("id");
  if (error) return { error: dbError(error, "example") };
  if (!data?.length) return noRows("example", "update");

  revalidatePath(PATH);
  return { ok: "saved", done: true };
}

export async function deleteExample(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  if (!confirmedDelete(fd)) return { error: "type DELETE to confirm" };

  const { data, error } = await supabase.from("generation_examples").delete().eq("id", id).select("id");
  if (error) return { error: dbError(error, "example") };
  if (!data?.length) return noRows("example", "delete");

  revalidatePath(PATH);
  return { ok: "deleted", done: true };
}
