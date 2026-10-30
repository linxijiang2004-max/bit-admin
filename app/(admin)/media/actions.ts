"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/admin/db";
import {
  confirmedDelete,
  dbError,
  isError,
  noRows,
  text,
  type FormState,
} from "@/lib/admin/forms";
import { IMAGE_BUCKET, isOwnUploadPath } from "@/lib/admin/upload";
import { SUPABASE_URL } from "@/lib/supabase/env";

// Every action: adminClient() runs requireSuperadmin() first. Caption writes
// go through the admin_*_caption SECURITY DEFINER RPCs (caption column grants
// are revoked from authenticated). The RPCs' results prove nothing on their
// own (update/delete return void), so each action reads the row back and
// checks the write actually landed. Images-tab writes go straight to the
// images table under superadmin RLS and ask for the affected rows back.

const MAX_CONTENT = 2000;

// Captions and images show on /media, the /images grid and detail pages, and
// the overview stats.
function revalidateContent() {
  revalidatePath("/media");
  revalidatePath("/images", "layout");
  revalidatePath("/");
}

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
    if (createdImage) revalidateContent();
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

  revalidateContent();
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

  revalidateContent();
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

  revalidateContent();
  return { ok: "deleted", done: true };
}

// ---------- images ----------

function readImageFields(fd: FormData) {
  const description = text(fd, "description", { max: 2000 });
  if (isError(description)) return description;
  // is_library is deliberately not written: bit has no page that lists
  // library images, so the admin doesn't manage the flag.
  return { description };
}

// The browser has already downscaled the file and put it in this admin's
// Storage folder; this records the row with its public URL.
export async function uploadImage(_: FormState, formData: FormData): Promise<FormState> {
  const { admin, supabase } = await adminClient();

  const path = String(formData.get("upload_path") ?? "");
  const fields = readImageFields(formData);
  const removeFile = () => supabase.storage.from(IMAGE_BUCKET).remove([path]);
  if ("error" in fields) {
    if (isOwnUploadPath(path, admin.id)) await removeFile();
    return fields;
  }

  const url = await uploadedFileUrl(supabase, admin.id, path);
  if (typeof url !== "string") return url;

  const { data, error } = await supabase
    .from("images")
    .insert({ url, ...fields, profile_id: admin.id })
    .select("id");
  if (error || !data?.length) {
    await removeFile();
    return error ? { error: `couldn't save the image: ${dbError(error, "image")}` } : noRows("image", "create");
  }

  revalidateContent();
  return { ok: `uploaded image #${(data[0] as { id: number }).id}`, done: true };
}

export async function updateImage(id: number, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await adminClient();
  const fields = readImageFields(formData);
  if ("error" in fields) return fields;

  const { data, error } = await supabase.from("images").update(fields).eq("id", id).select("id");
  if (error) return { error: dbError(error, "image") };
  if (!data?.length) return noRows("image", "update");

  revalidateContent();
  return { ok: "saved", done: true };
}

// Cascades: the image's captions go with it, and their votes and favorites
// with them. The dialog says so, with counts, before the admin types DELETE.
export async function deleteImage(id: number, _: FormState, formData: FormData): Promise<FormState> {
  const r = await removeImage(id, formData);
  if ("error" in r) return { error: r.error };
  if (r.orphan) {
    return {
      error: `image #${id} was deleted, but its file is still in Storage (${r.orphan.reason}). Remove ${r.orphan.path} in Supabase → Storage → images.`,
    };
  }
  return { ok: r.external ? `deleted image #${id} (external link, no file to remove)` : `deleted image #${id} and its file`, done: true };
}

// From /images/[id]: the page is gone once the row is, so go back to the grid
// and carry the outcome there (a leftover Storage file is named in the URL).
export async function deleteImageAndLeave(id: number, _: FormState, formData: FormData): Promise<FormState> {
  const r = await removeImage(id, formData);
  if ("error" in r) return { error: r.error };
  redirect(`/images?deleted=${id}${r.orphan ? `&orphan=${encodeURIComponent(r.orphan.path)}` : ""}`);
}

async function removeImage(
  id: number,
  formData: FormData,
): Promise<{ error: string } | { external: boolean; orphan?: { path: string; reason: string } }> {
  const { supabase } = await adminClient();
  if (!confirmedDelete(formData)) return { error: "type DELETE to confirm" };

  const { data, error } = await supabase.from("images").delete().eq("id", id).select("url");
  if (error) return { error: dbError(error, "image") };
  if (!data?.length) return noRows("image", "delete");
  const url = (data[0] as { url: string }).url;

  revalidateContent();

  // The bucket is public: until the file is gone, its URL still serves the
  // picture. Remove it, then confirm the URL no longer answers.
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;
  if (!url.startsWith(prefix)) return { external: true };
  const path = decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  const { data: removed, error: removeError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .remove([path]);
  const head = await fetch(url, { method: "HEAD", cache: "no-store" }).catch(() => null);
  if (removeError || !removed?.length || head?.ok) {
    return { external: false, orphan: { path, reason: removeError?.message ?? "storage refused the delete" } };
  }
  return { external: false };
}
