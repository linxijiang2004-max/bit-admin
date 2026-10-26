"use client";

import { useActionState, useState } from "react";
import type { FormState } from "./actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

// Same typed-confirmation modal pattern as DeleteCaption (no window.confirm).
export function DeleteImage({
  id,
  url,
  captions,
  action,
}: {
  id: number;
  url: string;
  captions: number;
  action: Action;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const close = () => {
    setOpen(false);
    setTyped("");
  };
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result?.done) close();
      return result;
    },
    undefined,
  );

  if (captions > 0) {
    return (
      <span
        className="rounded-[6px] px-2 py-0.5 text-[11px] text-muted/50"
        title="Images with captions can't be deleted. Delete or unpublish the captions instead."
      >
        in use
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[6px] bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger hover:bg-danger hover:text-white"
      >
        Delete
      </button>
      {state?.ok && !open && <span className="sr-only">{state.ok}</span>}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
          onKeyDown={(e) => e.key === "Escape" && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-image-${id}`}
            className="w-full max-w-md whitespace-normal rounded-card bg-card p-4 text-left text-xs shadow-2xl shadow-black"
          >
            <h2 id={`delete-image-${id}`} className="text-sm font-medium text-text">
              Delete image #{id} permanently?
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="mt-3 max-h-48 w-full rounded bg-bg object-contain" />
            <p className="mt-3 text-muted">
              This image has no captions, so nothing else is affected. The row is removed
              from bit and, if the file was uploaded to Storage, the file is deleted too,
              so its public link stops working.
            </p>
            <form action={formAction} className="mt-4 flex flex-col gap-1.5">
              <label htmlFor={`confirm-image-${id}`} className="text-muted">
                Type <span className="font-mono text-text">DELETE</span> (capital letters) to confirm
              </label>
              <input
                id={`confirm-image-${id}`}
                name="confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
                className="rounded-card bg-bg px-2 py-1.5 font-mono text-text focus:outline-none focus:ring-1 focus:ring-danger"
              />
              <div className="mt-2 flex items-center justify-between">
                <button type="button" onClick={close} className="text-muted hover:text-text">
                  cancel
                </button>
                <button
                  type="submit"
                  disabled={typed !== "DELETE" || pending}
                  className="rounded-card bg-danger px-3 py-1.5 font-medium text-white hover:brightness-110 disabled:opacity-30"
                >
                  {pending ? "deleting…" : "Delete forever"}
                </button>
              </div>
              {state?.error && <p className="text-danger">{state.error}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
