import "server-only";
import { adminClient } from "./db";
import { rangeOf } from "./params";

export type DomainRow = { id: number; domain: string; note: string | null; created_at: string };
export type EmailRow = { id: number; email: string; note: string | null; created_at: string };

export async function listDomains(opts: { page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);
  const { data, error, count } = await supabase
    .from("allowed_signup_domains")
    .select("id, domain, note, created_at", { count: "exact" })
    .order("domain")
    .order("id")
    .range(from, to)
    .returns<DomainRow[]>();
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("domain query returned no data");
  return { total: count, rows: data };
}

export async function listEmails(opts: { page: number }) {
  const { supabase } = await adminClient();
  const [from, to] = rangeOf(opts.page);
  const { data, error, count } = await supabase
    .from("whitelisted_emails")
    .select("id, email, note, created_at", { count: "exact" })
    .order("email")
    .order("id")
    .range(from, to)
    .returns<EmailRow[]>();
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("email query returned no data");
  return { total: count, rows: data };
}
