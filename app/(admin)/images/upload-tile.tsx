"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
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
import { Modal } from "../dialogs";
import { fieldClass } from "../fields";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

// First tile of the grid. Picking a file downscales it here (MAX_EDGE long
// edge, JPEG), then a dialog shows the result and its final size before
// anything is sent. The file goes straight from the browser to Storage (as the
// signed-in admin, into their own folder), so it never passes through a
// Server Action body limit; the action receives only the storage path,
// re-validates it, and inserts the images row with its public URL.
export function UploadTile({ action, adminId }: { action: Action; adminId: string }) {
  const [shrunk, setShrunk] = useState<Downscaled | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const close = () => {
    setOpen(false);
    setShrunk(null);
    setPreview(null);
    setFileError(null);
    if (input.current) input.current.value = "";
  };

  async function onFile(file: File | undefined) {
    setShrunk(null);
    setPreview(null);
    setFileError(null);
    if (!file) return;
    setOpen(true);
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

      formData.set("upload_path", path);
      const result = await action(prev, formData);
      if (result?.done) close();
      return result;
    },
    undefined,
  );

  return (
    <>
      <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] bg-card text-accent hover:bg-card-hover focus-within:outline focus-within:outline-1 focus-within:outline-accent">
        <span aria-hidden className="text-3xl font-light leading-none">
          +
        </span>
        <span className="text-[13px]">upload</span>
        <input
          ref={input}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="sr-only"
        />
      </label>
      {state?.ok && !open && (
        <span role="status" className="sr-only">
          {state.ok}
        </span>
      )}

      {open && (
        <Modal titleId={titleId} onClose={close}>
          <h2 id={titleId} className="text-[17px] font-semibold text-text">
            Upload image
          </h2>
          <form action={formAction} className="mt-3 flex flex-col gap-3">
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[10px] bg-bg">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-full object-contain" />
              ) : (
                <span className="text-muted">{processing ? "resizing…" : fileError ? "—" : "no image"}</span>
              )}
            </div>
            {fileError && <p className="text-accent">{fileError}</p>}
            {shrunk && (
              <p className="text-muted">
                {shrunk.sourceWidth}×{shrunk.sourceHeight} · {formatBytes(shrunk.sourceBytes)} →{" "}
                <span className="text-text">
                  {shrunk.width}×{shrunk.height} · {formatBytes(shrunk.blob.size)}
                </span>{" "}
                after resizing to {MAX_EDGE}px, JPEG {Math.round(JPEG_QUALITY * 100)}
              </p>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-[13px] uppercase tracking-wider text-muted">Description · optional</span>
              <textarea name="description" rows={2} maxLength={2000} className={fieldClass} />
            </label>
            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center gap-3">
                <button type="button" onClick={close} className="text-muted hover:text-text">
                  cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || processing || !shrunk}
                  className="rounded-card bg-accent px-3 py-1.5 font-medium text-bg hover:brightness-110 disabled:opacity-50"
                >
                  {pending ? "uploading…" : `Upload${shrunk ? ` ${formatBytes(shrunk.blob.size)}` : ""}`}
                </button>
              </div>
            </div>
            {state?.error && <p className="text-accent">{state.error}</p>}
          </form>
        </Modal>
      )}
    </>
  );
}
