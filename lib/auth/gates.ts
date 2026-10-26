import type { SupabaseClient } from "@supabase/supabase-js";

// The single definition of "who may use this app". Both the proxy and the
// server-side checks call this, so the two layers can never drift apart.
//
//   anon      -> gate 1 failed: no valid Google OAuth session
//   forbidden -> gate 1 passed, gate 2 failed: not a superadmin
//   ok        -> both gates passed
export type Gate =
  | { state: "anon" }
  | { state: "forbidden" }
  | { state: "ok"; email: string };

export async function evaluateGates(supabase: SupabaseClient): Promise<Gate> {
  // Gate 1. getUser() verifies the access token with the Auth server, so a
  // forged or revoked cookie fails here (getSession() would just trust it).
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { state: "anon" };

  const providers: unknown = user.app_metadata?.providers;
  const hasGoogle = Array.isArray(providers)
    ? providers.includes("google")
    : user.app_metadata?.provider === "google";
  if (!hasGoogle) return { state: "anon" };

  // Gate 2. Ask Postgres directly. RLS-blocked reads come back as 200 + null,
  // so we never infer authorization from "no error": only a literal `true`
  // from is_superadmin() opens the gate. Errors, null, and anything else
  // fail closed.
  const { data: isSuperadmin, error: rpcError } =
    await supabase.rpc("is_superadmin");
  if (rpcError || isSuperadmin !== true) return { state: "forbidden" };

  return { state: "ok", email: user.email ?? "" };
}
