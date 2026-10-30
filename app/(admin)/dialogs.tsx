"use client";

import { useActionState, useId, useState } from "react";
import type { FormState } from "@/lib/admin/forms";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

// In-page modals for create / edit / delete. Never window.confirm(): a native
// dialog blocks the whole page. position: fixed, so a table's horizontal
// scroll wrapper can't clip them. Fields are passed in as server-rendered
// children with their defaultValues.

export function Modal({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-full w-full max-w-lg overflow-y-auto whitespace-normal rounded-card bg-card p-5 text-left text-[14px] shadow-2xl shadow-black"
      >
        {children}
      </div>
    </div>
  );
}

export function FormDialog({
  trigger,
  title,
  submitLabel = "Save",
  action,
  children,
}: {
  trigger: "new" | "edit";
  title: string;
  submitLabel?: string;
  action: Action;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result?.done) setOpen(false);
      return result;
    },
    undefined,
  );

  return (
    <>
      {trigger === "new" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-card bg-accent px-3 py-1.5 text-[14px] font-medium text-bg hover:brightness-110"
        >
          {title}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[6px] bg-white/5 px-2.5 py-1 text-[13px] text-muted hover:bg-card-hover hover:text-text"
        >
          Edit
        </button>
      )}
      {state?.ok && !open && (
        <span role="status" className="sr-only">
          {state.ok}
        </span>
      )}

      {open && (
        <Modal titleId={titleId} onClose={() => setOpen(false)}>
          <h2 id={titleId} className="text-[17px] font-semibold text-text">
            {title}
          </h2>
          <form action={formAction} className="mt-3 flex flex-col gap-2.5">
            {children}
            <div className="mt-1 flex items-center justify-between">
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-text">
                cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-card bg-accent px-3 py-1.5 font-medium text-bg hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "saving…" : submitLabel}
              </button>
            </div>
            {state?.error && <p className="text-accent">{state.error}</p>}
          </form>
        </Modal>
      )}
    </>
  );
}

export function DeleteDialog({
  title,
  action,
  children,
}: {
  title: string;
  action: Action;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const inputId = useId();
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[6px] bg-danger/15 px-2.5 py-1 text-[13px] font-medium text-danger hover:bg-danger hover:text-white"
      >
        Delete
      </button>
      {state?.ok && !open && (
        <span role="status" className="sr-only">
          {state.ok}
        </span>
      )}

      {open && (
        <Modal titleId={titleId} onClose={close}>
          <h2 id={titleId} className="text-[17px] font-semibold text-text">
            {title}
          </h2>
          <div className="mt-2 flex flex-col gap-2 text-muted">{children}</div>
          <form action={formAction} className="mt-4 flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-muted">
              Type <span className="font-mono text-text">DELETE</span> (capital letters) to confirm
            </label>
            <input
              id={inputId}
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
        </Modal>
      )}
    </>
  );
}

// A small always-visible form (inline edits like a mix weight). Shows its own
// result next to the button.
export function InlineForm({
  action,
  className = "",
  submitLabel = "save",
  children,
}: {
  action: Action;
  className?: string;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={`flex items-center gap-2 ${className}`}>
      {children}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] bg-white/5 px-2.5 py-1 text-[13px] text-muted hover:bg-card-hover hover:text-text disabled:opacity-50"
      >
        {pending ? "…" : submitLabel}
      </button>
      {state?.error && <span className="text-[13px] text-accent">{state.error}</span>}
      {state?.ok && !pending && <span className="text-[13px] text-muted">{state.ok}</span>}
    </form>
  );
}
