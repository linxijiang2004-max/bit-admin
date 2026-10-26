import "server-only";
import { adminClient, displayName, fetchAll } from "./db";
import type { CaptionRow, ImageRow, ProfileRow, VoteRow } from "./types";

type StepRow = { model: string; step_name: string };
type RequestRow = { id: number; created_at: string };

export type Overview = Awaited<ReturnType<typeof getOverview>>;

const DAYS = 14;

export async function getOverview() {
  const { supabase } = await adminClient();

  const [profiles, images, captions, votes, requests, steps] =
    await Promise.all([
      fetchAll<Pick<ProfileRow, "id" | "email" | "first_name" | "last_name" | "is_superadmin" | "created_at">>(
        (a, b) =>
          supabase
            .from("profiles")
            .select("id, email, first_name, last_name, is_superadmin, created_at")
            .order("id")
            .range(a, b),
      ),
      fetchAll<Pick<ImageRow, "id" | "url" | "is_library" | "profile_id">>((a, b) =>
        supabase
          .from("images")
          .select("id, url, is_library, profile_id")
          .order("id")
          .range(a, b),
      ),
      fetchAll<CaptionRow>((a, b) =>
        supabase
          .from("captions")
          .select(
            "id, image_id, content, is_public, like_count, profile_id, caption_request_id, created_at",
          )
          .order("id")
          .range(a, b),
      ),
      fetchAll<Pick<VoteRow, "caption_id" | "vote_value">>((a, b) =>
        supabase
          .from("caption_votes")
          .select("caption_id, vote_value")
          .order("id")
          .range(a, b),
      ),
      fetchAll<RequestRow>((a, b) =>
        supabase
          .from("caption_requests")
          .select("id, created_at")
          .order("id")
          .range(a, b),
      ),
      fetchAll<StepRow>((a, b) =>
        supabase
          .from("caption_request_steps")
          .select("model, step_name")
          .order("id")
          .range(a, b),
      ),
    ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const imageById = new Map(images.map((i) => [i.id, i]));

  // --- captions per image: how well is the library covered? ---
  const captionsPerImage = new Map<number, number>();
  for (const c of captions) {
    captionsPerImage.set(c.image_id, (captionsPerImage.get(c.image_id) ?? 0) + 1);
  }
  const captionedImages = images.filter((i) => captionsPerImage.has(i.id)).length;

  // --- generation activity, last N days (UTC) ---
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const activity = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
    return { day: d.toISOString().slice(0, 10), captions: 0, runs: 0 };
  });
  const dayIndex = new Map(activity.map((a, i) => [a.day, i]));
  for (const c of captions) {
    const i = dayIndex.get(c.created_at.slice(0, 10));
    if (i !== undefined) activity[i].captions++;
  }
  for (const r of requests) {
    const i = dayIndex.get(r.created_at.slice(0, 10));
    if (i !== undefined) activity[i].runs++;
  }

  // --- votes ---
  const upvotes = votes.filter((v) => v.vote_value > 0).length;
  const downvotes = votes.length - upvotes;
  const votedCaptions = new Set(votes.map((v) => v.caption_id)).size;

  // --- top captions by net score ---
  const topCaptions = [...captions]
    .filter((c) => c.like_count !== 0)
    .sort((a, b) => b.like_count - a.like_count || b.id - a.id)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      content: c.content,
      score: c.like_count,
      imageId: c.image_id,
      imageUrl: imageById.get(c.image_id)?.url ?? null,
    }));

  // --- model usage across pipeline steps ---
  const modelCounts = new Map<string, number>();
  for (const s of steps) modelCounts.set(s.model, (modelCounts.get(s.model) ?? 0) + 1);
  const models = [...modelCounts.entries()]
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);

  // --- most active people (uploads + generated captions) ---
  const activityByProfile = new Map<string, { uploads: number; captions: number }>();
  const bump = (id: string | null, key: "uploads" | "captions") => {
    if (!id) return;
    const row = activityByProfile.get(id) ?? { uploads: 0, captions: 0 };
    row[key]++;
    activityByProfile.set(id, row);
  };
  images.forEach((i) => bump(i.profile_id, "uploads"));
  captions.forEach((c) => bump(c.profile_id, "captions"));
  const topPeople = [...activityByProfile.entries()]
    .map(([id, a]) => {
      const p = profileById.get(id);
      return { id, name: p ? displayName(p) : id.slice(0, 8), ...a };
    })
    .sort((a, b) => b.uploads + b.captions - (a.uploads + a.captions))
    .slice(0, 5);

  const publicCaptions = captions.filter((c) => c.is_public).length;

  return {
    totals: {
      people: profiles.length,
      superadmins: profiles.filter((p) => p.is_superadmin).length,
      images: images.length,
      libraryImages: images.filter((i) => i.is_library).length,
      captions: captions.length,
      publicCaptions,
      draftCaptions: captions.length - publicCaptions,
      runs: requests.length,
      votes: votes.length,
      upvotes,
      downvotes,
      votedCaptions,
    },
    coverage: {
      captionedImages,
      uncaptionedImages: images.length - captionedImages,
      avgCaptionsPerCaptionedImage:
        captionedImages === 0 ? 0 : captions.length / captionedImages,
      captionsPerRun: requests.length === 0 ? 0 : captions.length / requests.length,
    },
    activity,
    topCaptions,
    models,
    topPeople,
  };
}
