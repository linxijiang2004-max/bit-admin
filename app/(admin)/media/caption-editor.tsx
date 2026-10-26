"use client";

import { useActionState, useState } from "react";
import type { FormState } from "./actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

// Content cell with inline edit: content + published state -> admin_update_caption.
export function CaptionEditor({
  content,
  isPublic,
  action,
}: {
  content: string;
  isPublic: boolean;
  action: Action;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result?.done) setEditing(false);
      return result;
    },
    undefined,
  );

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <span className="min-w-0 flex-1">{content}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded px-1.5 text-[11px] text-muted opacity-0 hover:text-text focus:opacity-100 group-hover:opacity-100"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-1.5"
      onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
    >
      <textarea
        name="content"
        defaultValue={content}
        rows={3}
        maxLength={2000}
        required
        autoFocus
        className="w-full rounded-card bg-bg px-2 py-1.5 text-text focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="is_public"
            defaultChecked={isPublic}
            className="accent-[var(--accent)]"
          />
          published
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-card bg-accent px-2.5 py-0.5 font-medium text-bg disabled:opacity-50"
        >
          {pending ? "saving…" : "save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-muted hover:text-text">
          cancel
        </button>
        {state?.error && <span className="text-accent">{state.error}</span>}
      </div>
    </form>
  );
}
