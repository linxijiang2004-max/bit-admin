import "server-only";
import { adminClient, displayName } from "./db";
import { nextDay, rangeOf } from "./params";

export type RequestRow = {
  id: number;
  image_id: number | null;
  profile_id: string | null;
  created_at: string;
  image: { url: string; description: string | null } | null;
  author: string | null;
  step_count: number;
  models: string[];
};

export type LlmResponse = {
  id: number;
  step_index: number;
  step_name: string;
  model: string;
  prompt: string | null;
  raw_output: string | null;
  created_at: string;
};

type Opts = { model: string; from?: string; to?: string; page: number };

// READ only. Generation requests, newest first, with their image and author;
// the LLM call log comes from the llm_responses view.
export async function listRequests(opts: Opts) {
  const { supabase } = await adminClient();
  const [a, b] = rangeOf(opts.page);

  // The model filter keeps requests with at least one step on that model: an
  // inner embed of the steps table the llm_responses view is built on, so
  // the database does the filtering and the count.
  let query = supabase
    .from("caption_requests")
    .select(
      opts.model
        ? "id, image_id, profile_id, created_at, steps:caption_request_steps!inner(model)"
        : "id, image_id, profile_id, created_at",
      { count: "exact" },
    );
  if (opts.model) query = query.eq("steps.model", opts.model);
  if (opts.from) query = query.gte("created_at", `${opts.from}T00:00:00Z`);
  if (opts.to) query = query.lt("created_at", `${nextDay(opts.to)}T00:00:00Z`);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(a, b);
  if (error) throw new Error(error.message);
  if (!data || count === null) throw new Error("request query returned no data");
  const requests = data as unknown as {
    id: number;
    image_id: number | null;
    profile_id: string | null;
    created_at: string;
  }[];

  // Images, authors and step summaries for this page's requests only.
  const ids = requests.map((r) => r.id);
  const imageIds = [...new Set(requests.map((r) => r.image_id).filter((x) => x !== null))];
  const profileIds = [...new Set(requests.map((r) => r.profile_id).filter((x) => x !== null))];

  const [images, profiles, steps] = await Promise.all([
    imageIds.length
      ? supabase
          .from("images")
          .select("id, url, description")
          .in("id", imageIds)
          .returns<{ id: number; url: string; description: string | null }[]>()
      : null,
    profileIds.length
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", profileIds)
          .returns<{ id: string; first_name: string | null; last_name: string | null; email: string | null }[]>()
      : null,
    ids.length
      ? supabase
          .from("llm_responses")
          .select("caption_request_id, model")
          .in("caption_request_id", ids)
          .returns<{ caption_request_id: number; model: string }[]>()
      : null,
  ]);
  for (const r of [images, profiles, steps]) if (r?.error) throw new Error(r.error.message);

  const imageById = new Map((images?.data ?? []).map((i) => [i.id, i]));
  const nameById = new Map((profiles?.data ?? []).map((p) => [p.id, displayName(p)]));
  const stepsById = new Map<number, { count: number; models: Set<string> }>();
  for (const s of steps?.data ?? []) {
    const entry = stepsById.get(s.caption_request_id) ?? { count: 0, models: new Set<string>() };
    entry.count++;
    entry.models.add(s.model);
    stepsById.set(s.caption_request_id, entry);
  }

  return {
    total: count,
    rows: requests.map((r) => ({
      id: r.id,
      image_id: r.image_id,
      profile_id: r.profile_id,
      created_at: r.created_at,
      image: r.image_id === null ? null : imageById.get(r.image_id) ?? null,
      author: r.profile_id === null ? null : nameById.get(r.profile_id) ?? null,
      step_count: stepsById.get(r.id)?.count ?? 0,
      models: [...(stepsById.get(r.id)?.models ?? [])].sort(),
    })) as RequestRow[],
  };
}

export async function getResponses(requestId: number): Promise<LlmResponse[]> {
  const { supabase } = await adminClient();
  const { data, error } = await supabase
    .from("llm_responses")
    .select("id, step_index, step_name, model, prompt, raw_output, created_at")
    .eq("caption_request_id", requestId)
    .order("step_index")
    .returns<LlmResponse[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Suggestions for the model filter: the configured model strings (bounded).
export async function modelStringChoices() {
  const { supabase } = await adminClient();
  const { data, error } = await supabase
    .from("llm_models")
    .select("model_string")
    .order("model_string")
    .limit(200)
    .returns<{ model_string: string }[]>();
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((m) => m.model_string))];
}
