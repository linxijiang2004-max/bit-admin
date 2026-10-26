"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Ends the caller's own session only and touches no data, so it needs no
// superadmin check. Any action that reads or writes data must start with
// requireSuperadmin().
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
