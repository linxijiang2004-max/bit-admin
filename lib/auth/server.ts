import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateGates } from "./gates";

// Memoized per request, so the layout and page share one round-trip.
// connection() pins the check to request time: it must never be prerendered.
const getGate = cache(async () => {
  await connection();
  return evaluateGates(await createClient());
});

// The real security boundary. Call this at the top of EVERY page, Server
// Action and Route Handler that touches data, before touching it. The proxy
// is only a redirect convenience; do not rely on it.
export async function requireSuperadmin(): Promise<{ email: string }> {
  const gate = await getGate();
  if (gate.state === "anon") redirect("/login");
  if (gate.state === "forbidden") redirect("/not-authorized");
  return { email: gate.email };
}
