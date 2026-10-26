"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/db";
import { IMAGE_BUCKET, isOwnUploadPath } from "@/lib/admin/upload";
import { SUPABASE_URL } from "@/lib/supabase/env";

export type FormState = { error?: string; ok?: string; done?: boolean } | undefined;

// Every action: adminClient() runs requireSuperadmin() first, then every
// database write goes through an admin_* SECURITY DEFINER RPC. The RPCs'
// results prove nothing on their own (update/delete return void), so each
// action reads the row back and checks the write actually landed.

const MAX_CONTENT = 2000;

function readContent(formData: FormData): string | { error: string } {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "caption can't be empty" };
  if (content.length > MAX_CONTENT) return { error: `max ${MAX_CONTENT} characters` };
  return content;
}

export async function createCaption(_: FormState, formData: FormData): Promise<FormState> {
  const { admin, supabase } = await adminClient();

  const content = readContent(formData);
  if (typeof content !== "string") return content;
  const isPublic = formData.get("is_public") === "on";

  // The image is one of: an existing image, a file the browser just uploaded
  // to Storage, or a pasted https link. New images go through admin_create_image.
  const uploadPath = String(formData.get("upload_path") ?? "");
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  let imageId: number;
  let createdImage = false;

  if (uploadPath || imageUrl) {
    const url = uploadPath
      ? await uploadedFileUrl(supabase, admin.id, uploadPath)
      : pastedImageUrl(imageUrl);
    if (typeof url !== "string") return url;

    const created = await createImage(supabase, url);
    if ("error" in created) {
      if (uploadPath) await supabase.storage.from(IMAGE_BUCKET).remove([uploadPath]);
      return created;
    }
    imageId = created.id;
    createdImage = true;
  } else {
    imageId = Number(formData.get("image_id"));
    if (!Number.isSafeInteger(imageId) || imageId <= 0) return { error: "pick an image" };
  }

  const { data: id, error } = await supabase.rpc("admin_create_caption", {
    p_image_id: imageId,
    p_content: content,
    p_is_public: isPublic,
  });
  if (error) {
    if (createdImage) revalidatePath("/media");
    return {
      error: createdImage
        ? `image #${imageId} was saved, but the caption failed: ${error.message}`
        : error.message,
    };
  }

  const newId = Number(id);
  if (!Number.isSafeInteger(newId) || newId <= 0) {
    return { error: "admin_create_caption returned no id; nothing was created" };
  }
  const { data: row, error: readError } = await supabase
    .from("captions")
    .select("id")
    .eq("id", newId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!row) return { error: `caption ${newId} not found after create` };

  revalidatePath("/media");
  revalidatePath("/");
  return {
    ok: createdImage ? `created image #${imageId} and caption ${newId}` : `created caption ${newId}`,
    done: true,
  };
}

type Client = Awaited<ReturnType<typeof adminClient>>["supabase"];

// The file itself has to go to Storage, which no SQL function can write; the
// browser puts it in the admin's own folder (bit's own storage policy). Never
// trust the path it sends back: it must be in this admin's folder and the file
// must answer at its public URL (the bucket is public, as bit serves it).
async function uploadedFileUrl(
  supabase: Client,
  adminId: string,
  path: string,
): Promise<string | { error: string }> {
  if (!isOwnUploadPath(path, adminId)) return { error: "invalid upload path" };
  const url = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  const head = await fetch(url, { method: "HEAD", cache: "no-store" }).catch(() => null);
  if (!head?.ok) return { error: "uploaded file not found in storage" };
  return url;
}

// Pasted links are stored as-is (like bit's seed images). https only, so the
// image never triggers mixed-content blocking. admin_create_image re-checks.
function pastedImageUrl(raw: string): string | { error: string } {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return { error: "image link must start with https://" };
    if (raw.length > 2048) return { error: "image link is too long" };
    return u.toString();
  } catch {
    return { error: "that isn't a valid link" };
  }
}

async function createImage(supabase: Client, url: string): Promise<{ id: number } | { error: string }> {
  const { data: id, error } = await supabase.rpc("admin_create_image", { p_url: url });
  if (error) return { error: `couldn't save the image: ${error.message}` };

  const newId = Number(id);
  if (!Number.isSafeInteger(newId) || newId <= 0) {
    return { error: "admin_create_image returned no id; nothing was created" };
  }
  const { data: row, error: readError } = await supabase
    .from("images")
    .select("id")
    .eq("id", newId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!row) return { error: `image ${newId} not found after create` };
  return { id: newId };
}

export async function updateCaption(
  id: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await adminClient();

  const content = readContent(formData);
  if (typeof content !== "string") return content;
  const isPublic = formData.get("is_public") === "on";

  const { error } = await supabase.rpc("admin_update_caption", {
    p_id: id,
    p_content: content,
    p_is_public: isPublic,
  });
  if (error) return { error: error.message };

  const { data: row, error: readError } = await supabase
    .from("captions")
    .select("content, is_public")
    .eq("id", id)
    .maybeSingle<{ content: string; is_public: boolean }>();
  if (readError) return { error: readError.message };
  if (!row) return { error: `caption ${id} not found` };
  if (row.content !== content || row.is_public !== isPublic) {
    return { error: "update did not apply (caption unchanged in the database)" };
  }

  revalidatePath("/media");
  revalidatePath("/");
  return { ok: "saved", done: true };
}

export async function deleteCaption(
  id: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await adminClient();

  // The typed confirmation is enforced here too, not only in the browser.
  if (formData.get("confirm") !== "DELETE") return { error: "type DELETE to confirm" };

  const { error } = await supabase.rpc("admin_delete_caption", { p_id: id });
  if (error) return { error: error.message };

  const { data: row, error: readError } = await supabase
    .from("captions")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (row) return { error: "delete did not apply (caption still exists)" };

  revalidatePath("/media");
  revalidatePath("/");
  return { ok: "deleted", done: true };
}

export async function deleteImage(
  id: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await adminClient();
  if (formData.get("confirm") !== "DELETE") return { error: "type DELETE to confirm" };

  // admin_delete_image refuses images that have captions, and returns the
  // deleted row's url.
  const { data: url, error } = await supabase.rpc("admin_delete_image", { p_id: id });
  if (error) return { error: error.message };
  if (typeof url !== "string") return { error: "admin_delete_image returned no url" };

  const { data: row, error: readError } = await supabase
    .from("images")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (row) return { error: "delete did not apply (image still exists)" };

  revalidatePath("/media");
  revalidatePath("/");

  // The bucket is public: until the file is gone, its URL still serves the
  // picture. Remove it, then confirm the URL no longer answers.
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;
  if (!url.startsWith(prefix)) {
    return { ok: `deleted image #${id} (external link, no file to remove)`, done: true };
  }
  const path = decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  const { data: removed, error: removeError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .remove([path]);
  const head = await fetch(url, { method: "HEAD", cache: "no-store" }).catch(() => null);
  if (removeError || !removed?.length || head?.ok) {
    return {
      error: `image #${id} was deleted, but its file is still in Storage (${
        removeError?.message ?? "storage refused the delete"
      }). Remove ${path} in Supabase → Storage → images.`,
    };
  }
  return { ok: `deleted image #${id} and its file`, done: true };
}
