"use client";

import { useActionState, useState } from "react";
import type { FormState } from "./actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

// Typed confirmation in an in-page modal. No window.confirm(): a native dialog
// blocks the whole page. The modal is position: fixed so the table's
// horizontal-scroll wrapper can't clip it.
export function DeleteCaption({
  id,
  content,
  isPublic,
  votes,
  favorites,
  deleteAction,
  unpublishAction,
}: {
  id: number;
  content: string;
  isPublic: boolean;
  votes: number;
  favorites: number;
  deleteAction: Action;
  unpublishAction: Action;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const close = () => {
    setOpen(false);
    setTyped("");
  };

  const [delState, deleteForm, deleting] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await deleteAction(prev, formData);
      if (result?.done) close();
      return result;
    },
    undefined,
  );
  const [unpubState, unpublishForm, unpublishing] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await unpublishAction(prev, formData);
      if (result?.done) close();
      return result;
    },
    undefined,
  );

  const ready = typed === "DELETE";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[6px] bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger hover:bg-danger hover:text-white"
      >
        Delete
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
          onKeyDown={(e) => e.key === "Escape" && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-title-${id}`}
            className="w-full max-w-md whitespace-normal rounded-card bg-card p-4 text-left text-xs shadow-2xl shadow-black"
          >
            <h2 id={`delete-title-${id}`} className="text-sm font-medium text-text">
              Delete caption {id} permanently?
            </h2>
            <p className="mt-2 line-clamp-3 rounded bg-bg p-2 text-text/80">{content}</p>
            <p className="mt-3 text-muted">
              Deleting also destroys this caption&apos;s{" "}
              <span className="text-text">
                {votes} vote{votes === 1 ? "" : "s"}
              </span>{" "}
              and{" "}
              <span className="text-text">
                {favorites} favorite{favorites === 1 ? "" : "s"}
              </span>{" "}
              through cascade. They can&apos;t be recovered.
            </p>
            <p className="mt-2 text-muted">
              Unpublishing is usually the right action instead: it hides the caption
              from bit and keeps its votes, favorites and history.
            </p>

            {isPublic && (
              <form action={unpublishForm} className="mt-3">
                <input type="hidden" name="content" value={content} />
                <button
                  type="submit"
                  disabled={unpublishing}
                  className="w-full rounded-card bg-card-hover px-3 py-1.5 text-text hover:brightness-125 disabled:opacity-50"
                >
                  {unpublishing ? "unpublishing…" : "Unpublish instead"}
                </button>
                {unpubState?.error && <p className="mt-1 text-accent">{unpubState.error}</p>}
              </form>
            )}

            <form action={deleteForm} className="mt-4 flex flex-col gap-1.5">
              <label htmlFor={`confirm-${id}`} className="text-muted">
                Type <span className="font-mono text-text">DELETE</span> (capital letters) to confirm
              </label>
              <input
                id={`confirm-${id}`}
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
                  disabled={!ready || deleting}
                  className="rounded-card bg-danger px-3 py-1.5 font-medium text-white hover:brightness-110 disabled:opacity-30"
                >
                  {deleting ? "deleting…" : "Delete forever"}
                </button>
              </div>
              {delState?.error && <p className="text-danger">{delState.error}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
