"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/admin/forms";
import { fieldClass } from "../fields";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

// The cached AI description, edited in place. Save appears once it changed;
// the result shows next to it.
export function ImageMeta({
  description,
  action,
}: {
  description: string | null;
  action: Action;
}) {
  const [desc, setDesc] = useState(description ?? "");
  const [state, formAction, pending] = useActionState(action, undefined);
  const dirty = desc.trim() !== (description ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-muted">AI description</span>
        <textarea
          name="description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder="no description cached"
          className={`${fieldClass} resize-y leading-relaxed`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-[14px]">
        {dirty && (
          <button
            type="submit"
            disabled={pending}
            className="rounded-card bg-accent px-2.5 py-1 font-medium text-bg hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "saving…" : "save"}
          </button>
        )}
        {state?.error && <span className="text-accent">{state.error}</span>}
        {state?.ok && !dirty && <span className="text-muted">{state.ok}</span>}
      </div>
    </form>
  );
}
