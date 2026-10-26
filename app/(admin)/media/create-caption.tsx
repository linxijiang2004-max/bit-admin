"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  IMAGE_BUCKET,
  uploadPathFor,
  validateImageFile,
} from "@/lib/admin/upload";
import type { FormState } from "./actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;
type Choice = { id: number; url: string; description: string | null };

const field =
  "rounded-card bg-bg px-2 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent";

export function CreateCaption({
  action,
  images,
  adminId,
}: {
  action: Action;
  images: Choice[];
  adminId: string;
}) {
  const [source, setSource] = useState<"existing" | "upload" | "link">(
    images.length ? "existing" : "upload",
  );
  const [imageId, setImageId] = useState(images[0]?.id ?? 0);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkState, setLinkState] = useState<"idle" | "ok" | "broken">("idle");
  const form = useRef<HTMLFormElement>(null);

  // The file goes straight from the browser to Storage (as the signed-in
  // admin), so it never passes through a Server Action body-size limit. The
  // action then only receives the storage path and re-validates it.
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData): Promise<FormState> => {
      if (source === "upload") {
        const file = formData.get("file");
        if (!(file instanceof File) || file.size === 0) return { error: "choose an image file" };
        const invalid = validateImageFile(file);
        if (invalid) return { error: invalid };

        const path = uploadPathFor(adminId, file);
        const { error } = await createClient()
          .storage.from(IMAGE_BUCKET)
          .upload(path, file, { contentType: file.type });
        if (error) return { error: `upload failed: ${error.message}` };

        formData.delete("file");
        formData.delete("image_id");
        formData.set("upload_path", path);
      }
      if (source === "link") {
        if (linkState !== "ok") return { error: "that link didn't load as an image" };
        formData.delete("image_id");
      }
      const result = await action(prev, formData);
      if (result?.done) {
        form.current?.reset();
        setPreview(null);
        setLink("");
        setLinkState("idle");
      }
      return result;
    },
    undefined,
  );

  // Free the object URL when the preview changes or the form unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const selected = images.find((i) => i.id === imageId);
  const isHttps = /^https:\/\/\S+$/.test(link.trim());
  const shown =
    source === "upload" ? preview : source === "link" ? (isHttps ? link.trim() : null) : selected?.url;

  return (
    <form ref={form} action={formAction} className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={shown}
          src={shown}
          alt=""
          onLoad={() => source === "link" && setLinkState("ok")}
          onError={() => source === "link" && setLinkState("broken")}
          className="hidden size-[120px] rounded bg-bg object-cover md:block"
        />
      ) : (
        <div className="hidden size-[120px] items-center justify-center rounded bg-bg text-[11px] text-muted md:flex">
          no image
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex rounded-card bg-bg p-0.5 text-xs self-start">
          {(
            [
              ["existing", "Existing image"],
              ["upload", "Upload file"],
              ["link", "Paste link"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSource(value)}
              disabled={value === "existing" && images.length === 0}
              className={`rounded-[8px] px-2.5 py-1 disabled:opacity-30 ${
                source === value ? "bg-card-hover text-text" : "text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {source === "existing" ? (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-[11px] uppercase tracking-wider text-muted">
              Image · 200 most recent · selected #{imageId}
            </legend>
            {/* Native radios (visually hidden) behind image tiles: real form
                value, arrow-key navigation and screen-reader labels for free. */}
            <div className="grid max-h-[188px] grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5 overflow-y-auto rounded-card bg-bg p-1.5">
              {images.map((i) => (
                <label
                  key={i.id}
                  title={`#${i.id} · ${i.description ?? "no description"}`}
                  className="relative cursor-pointer"
                >
                  <input
                    type="radio"
                    name="image_id"
                    value={i.id}
                    checked={imageId === i.id}
                    onChange={() => setImageId(i.id)}
                    className="peer sr-only"
                    aria-label={`Image ${i.id}: ${i.description?.slice(0, 120) ?? "no description"}`}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.url}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded bg-card object-cover opacity-70 ring-2 ring-transparent transition hover:opacity-100 peer-checked:opacity-100 peer-checked:ring-accent peer-focus-visible:ring-text"
                  />
                  <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-text">
                    {i.id}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : source === "link" ? (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted">
              Image link · https · stored as a link, not copied
            </span>
            <input
              name="image_url"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setLinkState("idle");
              }}
              placeholder="https://…/photo.jpg"
              className={field}
            />
            {link && !isHttps && <span className="text-xs text-accent">must start with https://</span>}
            {isHttps && linkState === "broken" && (
              <span className="text-xs text-accent">that link didn&apos;t load as an image</span>
            )}
            {isHttps && linkState === "idle" && <span className="text-xs text-muted">checking…</span>}
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted">
              File · png, jpeg, webp, gif · max 5 MB · saved to bit as your upload
            </span>
            <input
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setFileError(file ? validateImageFile(file) : null);
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="text-xs text-muted file:mr-3 file:rounded-card file:border-0 file:bg-card-hover file:px-2.5 file:py-1 file:text-text"
            />
            {fileError && <span className="text-xs text-accent">{fileError}</span>}
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">Caption</span>
          <textarea name="content" rows={2} maxLength={2000} required className={field} />
        </label>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="is_public" className="accent-[var(--accent)]" />
            published
          </label>
          <button
            type="submit"
            disabled={
              pending ||
              (source === "upload" && !!fileError) ||
              (source === "link" && linkState !== "ok")
            }
            className="rounded-card bg-accent px-3 py-1 font-medium text-bg disabled:opacity-50"
          >
            {pending ? (source === "upload" ? "uploading…" : "creating…") : "Create caption"}
          </button>
          {state?.error && <span className="text-accent">{state.error}</span>}
          {state?.ok && <span className="text-muted">{state.ok}</span>}
        </div>
      </div>
    </form>
  );
}
