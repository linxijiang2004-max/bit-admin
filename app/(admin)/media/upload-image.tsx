"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  downscaleImage,
  formatBytes,
  JPEG_QUALITY,
  MAX_EDGE,
  MAX_SOURCE_BYTES,
  type Downscaled,
} from "@/lib/admin/downscale";
import type { FormState } from "@/lib/admin/forms";
import { ALLOWED_IMAGE_TYPES, IMAGE_BUCKET, MAX_IMAGE_BYTES, uploadPathFor } from "@/lib/admin/upload";
import { createClient } from "@/lib/supabase/browser";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const field =
  "rounded-card bg-bg px-2 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent";

// The file is downscaled here, then goes straight from the browser to Storage
// (as the signed-in admin, into their own folder), so it never passes through
// a Server Action body limit. The action receives only the storage path,
// re-validates it, and inserts the images row with its public URL.
export function UploadImage({ action, adminId }: { action: Action; adminId: string }) {
  const [shrunk, setShrunk] = useState<Downscaled | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const reset = () => {
    form.current?.reset();
    setShrunk(null);
    setPreview(null);
    setFileError(null);
  };

  async function onFile(file: File | undefined) {
    setShrunk(null);
    setPreview(null);
    setFileError(null);
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return setFileError("png, jpeg, webp or gif only");
    if (file.size > MAX_SOURCE_BYTES) return setFileError(`source file max ${formatBytes(MAX_SOURCE_BYTES)}`);
    setProcessing(true);
    try {
      const result = await downscaleImage(file);
      if (result.blob.size > MAX_IMAGE_BYTES) {
        setFileError(`still ${formatBytes(result.blob.size)} after downscaling; max ${formatBytes(MAX_IMAGE_BYTES)}`);
        return;
      }
      setShrunk(result);
      setPreview(URL.createObjectURL(result.blob));
    } catch (e) {
      setFileError(`couldn't read that image: ${(e as Error).message}`);
    } finally {
      setProcessing(false);
    }
  }

  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData): Promise<FormState> => {
      if (!shrunk) return { error: "choose an image file" };
      const file = new File([shrunk.blob], "upload.jpg", { type: "image/jpeg" });
      const path = uploadPathFor(adminId, file);
      const { error } = await createClient()
        .storage.from(IMAGE_BUCKET)
        .upload(path, file, { contentType: "image/jpeg" });
      if (error) return { error: `upload failed: ${error.message}` };

      formData.delete("file");
      formData.set("upload_path", path);
      const result = await action(prev, formData);
      if (result?.done) reset();
      return result;
    },
    undefined,
  );

  return (
    <form ref={form} action={formAction} className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="hidden size-[120px] rounded bg-bg object-cover md:block" />
      ) : (
        <div className="hidden size-[120px] items-center justify-center rounded bg-bg text-[11px] text-muted md:flex">
          {processing ? "resizing…" : "no image"}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            File · png, jpeg, webp, gif · resized to {MAX_EDGE}px long edge, JPEG {JPEG_QUALITY * 100}
          </span>
          <input
            name="file"
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            onChange={(e) => onFile(e.target.files?.[0])}
            className="text-xs text-muted file:mr-3 file:rounded-card file:border-0 file:bg-card-hover file:px-2.5 file:py-1 file:text-text"
          />
          {fileError && <span className="text-xs text-accent">{fileError}</span>}
          {shrunk && (
            <span className="text-xs text-muted">
              {shrunk.sourceWidth}×{shrunk.sourceHeight} · {formatBytes(shrunk.sourceBytes)} →{" "}
              <span className="text-text">
                {shrunk.width}×{shrunk.height} · {formatBytes(shrunk.blob.size)}
              </span>{" "}
              will be uploaded
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">Description · optional</span>
          <textarea name="description" rows={2} maxLength={2000} className={field} />
        </label>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="is_library" className="accent-[var(--accent)]" />
            library image
          </label>
          <button
            type="submit"
            disabled={pending || processing || !shrunk}
            className="rounded-card bg-accent px-3 py-1 font-medium text-bg disabled:opacity-50"
          >
            {pending ? "uploading…" : "Upload image"}
          </button>
          {state?.error && <span className="text-accent">{state.error}</span>}
          {state?.ok && <span className="text-muted">{state.ok}</span>}
        </div>
      </div>
    </form>
  );
}
