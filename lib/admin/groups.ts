import "server-only";
import { adminClient } from "./db";

type Client = Awaited<ReturnType<typeof adminClient>>["supabase"];
type Filter = (q: ReturnType<ReturnType<Client["from"]>["select"]>) => typeof q;

export type KeyNumber = { label: string; value: number };

// Headline numbers for each page on a group overview. Every one is a head
// count done by the database, never a fetched table.
export async function groupNumbers(slug: "content" | "generation" | "access") {
  const { supabase } = await adminClient();
  const count = async (table: string, filter: Filter = (q) => q) => {
    const { count, error } = await filter(supabase.from(table).select("*", { count: "exact", head: true }));
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  };
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  if (slug === "content") {
    const [captions, published, images, unused, votes, votesWeek] = await Promise.all([
      count("captions"),
      count("captions", (q) => q.eq("is_public", true)),
      count("images"),
      count("admin_image_rows", (q) => q.eq("caption_count", 0)),
      count("caption_votes"),
      count("caption_votes", (q) => q.gte("created_at", weekAgo)),
    ]);
    return {
      "/media": [
        { label: "captions", value: captions },
        { label: "published", value: published },
      ],
      "/images": [
        { label: "images", value: images },
        { label: "unused", value: unused },
      ],
      "/votes": [
        { label: "votes", value: votes },
        { label: "last 7 days", value: votesWeek },
      ],
    } as Record<string, KeyNumber[]>;
  }

  if (slug === "generation") {
    const [chains, enabled, providers, models, terms, examples, requests, requestsWeek] = await Promise.all([
      count("prompt_chains"),
      count("prompt_chain_mix", (q) => q.eq("is_enabled", true)),
      count("llm_providers"),
      count("llm_models"),
      count("terms"),
      count("generation_examples"),
      count("caption_requests"),
      count("caption_requests", (q) => q.gte("created_at", weekAgo)),
    ]);
    return {
      "/chains": [
        { label: "chains", value: chains },
        { label: "in rotation", value: enabled },
      ],
      "/models": [
        { label: "models", value: models },
        { label: "providers", value: providers },
      ],
      "/content": [
        { label: "terms", value: terms },
        { label: "examples", value: examples },
      ],
      "/responses": [
        { label: "requests", value: requests },
        { label: "last 7 days", value: requestsWeek },
      ],
    } as Record<string, KeyNumber[]>;
  }

  const [people, superadmins, domains, emails] = await Promise.all([
    count("profiles"),
    count("profiles", (q) => q.eq("is_superadmin", true)),
    count("allowed_signup_domains"),
    count("whitelisted_emails"),
  ]);
  return {
    "/people": [
      { label: "users", value: people },
      { label: "superadmins", value: superadmins },
    ],
    "/access": [
      { label: "domains", value: domains },
      { label: "emails", value: emails },
    ],
  } as Record<string, KeyNumber[]>;
}
