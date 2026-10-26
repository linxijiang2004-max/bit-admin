"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function GoogleButton() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Always show the account picker so a non-admin account isn't sticky.
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setPending(false);
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={pending}
      className="rounded-card bg-card px-4 py-2 text-text hover:bg-card-hover disabled:text-muted"
    >
      continue with Google
    </button>
  );
}
