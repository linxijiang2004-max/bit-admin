// Pure analysis over rows the overview has already fetched. No database
// access here, so each function is easy to read and to check by hand.

// Campus time: bit's users are at Columbia/Barnard, so hours are New York's.
export const TIME_ZONE = "America/New_York";

const hourOf = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });
const weekdayOf = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type HourRow = { hour: number; runs: number; votes: number };

// When are people active? Generation runs and votes, by hour of day.
export function activityByHour(runs: { created_at: string }[], votes: { created_at: string }[]) {
  const rows: HourRow[] = Array.from({ length: 24 }, (_, hour) => ({ hour, runs: 0, votes: 0 }));
  for (const r of runs) rows[Number(hourOf.format(new Date(r.created_at)))].runs++;
  for (const v of votes) rows[Number(hourOf.format(new Date(v.created_at)))].votes++;

  const days = new Map(WEEKDAYS.map((d) => [d, 0]));
  for (const x of [...runs, ...votes]) {
    const d = weekdayOf.format(new Date(x.created_at));
    days.set(d, (days.get(d) ?? 0) + 1);
  }
  const busiestDay = [...days.entries()].sort((a, b) => b[1] - a[1])[0];
  const peak = (key: "runs" | "votes") =>
    rows.reduce((best, r) => (r[key] > best[key] ? r : best), rows[0]);

  return {
    hours: rows,
    peakRuns: peak("runs"),
    peakVotes: peak("votes"),
    busiestDay: busiestDay && busiestDay[1] > 0 ? { day: busiestDay[0], events: busiestDay[1] } : null,
    weekdays: WEEKDAYS.map((day) => ({ day, events: days.get(day) ?? 0 })),
  };
}

export function hourLabel(h: number) {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

// ---------- what are the liked captions about? ----------

const STOPWORDS = new Set(
  (
    "a an the and or but if then so of to in on at by for with from as is are was were be been being it its " +
    "this that these those i me my we our you your he she they them their his her not no just now only " +
    "than too very can will would should could do does did done have has had get gets got into out up " +
    "down over after before again all any each every more most some such own same other about when what " +
    "who whom which while where why how one two three four five first last new still even also there here " +
    "yet like via per"
  ).split(" "),
);

export type TopicRow = { topic: string; isTerm: boolean; captions: number; up: number; down: number };

// Words (and admin-defined terms) that appear in voted captions, with the
// votes those captions received. A topic needs at least two voted captions,
// so one lucky caption doesn't make a word look popular.
export function captionTopics(
  captions: { id: number; content: string }[],
  votes: { caption_id: number; vote_value: number }[],
  terms: string[],
) {
  const split = new Map<number, { up: number; down: number }>();
  for (const v of votes) {
    const s = split.get(v.caption_id) ?? { up: 0, down: 0 };
    if (v.vote_value > 0) s.up++;
    else s.down++;
    split.set(v.caption_id, s);
  }

  const topics = new Map<string, TopicRow>();
  const add = (topic: string, isTerm: boolean, s: { up: number; down: number }) => {
    const row = topics.get(topic) ?? { topic, isTerm, captions: 0, up: 0, down: 0 };
    row.captions++;
    row.up += s.up;
    row.down += s.down;
    topics.set(topic, row);
  };

  const termList = terms.map((t) => t.trim()).filter(Boolean);
  for (const c of captions) {
    const s = split.get(c.id);
    if (!s) continue;
    const text = c.content.toLowerCase();
    for (const t of termList) if (text.includes(t.toLowerCase())) add(t, true, s);
    const words = new Set(
      text
        .replace(/[’']/g, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
    );
    for (const w of words) if (!termList.some((t) => t.toLowerCase() === w)) add(w, false, s);
  }

  return [...topics.values()]
    .filter((t) => t.captions >= 2)
    .sort((a, b) => b.up - b.down - (a.up - a.down) || b.up - a.up || a.topic.localeCompare(b.topic));
}

// ---------- what kinds of images get engagement? ----------

// Ordered rules over the "what is literally happening" part of each image's
// cached AI description. The first match wins, so a cartoon frog is a
// character, not an animal. Words, not a model call: transparent and free,
// but approximate.
const CATEGORY_RULES: [string, RegExp][] = [
  ["Cartoons & characters", /\b(cartoon|animated|animation|looney|kermit|muppet|puppet|b\.o\.b|cgi|low-poly|stylized|x-ray|graphic|disney|pixar|winnie|pooh|sesame)\b/],
  ["Cats", /\b(cat|cats|kitten|tabby)\b/],
  ["Dogs", /\b(dog|dogs|puppy|pug|chihuahua|pomeranian|labrador|retriever|corgi|shiba)\b/],
  ["Other animals", /\b(lizard|gecko|frog|goose|duck|bird|monkey|hamster|rabbit|dragonfly|insect|bug|butterfly|bee|spider|fish|animal)\b/],
  ["Screenshots & objects", /\b(screenshot|map|door|tweet|chart|menu|receipt)\b/],
  ["People", /\b(man|woman|guy|girl|boy|person|people|actor|actress|rapper|toddler|kid|child|selfie|player|smiling|smile|celebrity|he|she|his|her)\b/],
];
export const UNDESCRIBED = "Not yet described";
const OTHER = "Other";

// Every category in a fixed order, so each keeps the same chart color no
// matter how the ranking changes.
export const CATEGORIES = [...CATEGORY_RULES.map(([name]) => name), OTHER, UNDESCRIBED];

export function imageCategory(description: string | null): string {
  if (!description?.trim()) return UNDESCRIBED;
  let text = description.toLowerCase().replace(/[*#]/g, " ");
  const at = text.search(/literally happening|literal description|literal breakdown/);
  if (at >= 0) text = text.slice(at + 20);
  text = text.slice(0, 400);
  for (const [name, re] of CATEGORY_RULES) if (re.test(text)) return name;
  return OTHER;
}

export type CategoryRow = {
  category: string;
  images: number;
  captions: number;
  votes: number;
  up: number;
  // Votes per caption: engagement that doesn't just reward having more images.
  perCaption: number;
  // The category's most-voted image (then most captioned), to show what it is.
  sample: { id: number; url: string } | null;
};

export function categoryEngagement(
  images: { id: number; url: string; description: string | null }[],
  captions: { id: number; image_id: number }[],
  votes: { caption_id: number; vote_value: number }[],
) {
  const categoryOf = new Map(images.map((i) => [i.id, imageCategory(i.description)]));
  const rows = new Map<string, CategoryRow>();
  const row = (category: string) => {
    const r = rows.get(category) ?? { category, images: 0, captions: 0, votes: 0, up: 0, perCaption: 0, sample: null };
    rows.set(category, r);
    return r;
  };
  for (const i of images) row(categoryOf.get(i.id)!).images++;
  const imageOfCaption = new Map(captions.map((c) => [c.id, c.image_id]));
  for (const c of captions) {
    const cat = categoryOf.get(c.image_id);
    if (cat) row(cat).captions++;
  }
  for (const v of votes) {
    const imageId = imageOfCaption.get(v.caption_id);
    const cat = imageId === undefined ? undefined : categoryOf.get(imageId);
    if (!cat) continue;
    const r = row(cat);
    r.votes++;
    if (v.vote_value > 0) r.up++;
  }
  for (const r of rows.values()) r.perCaption = r.captions === 0 ? 0 : r.votes / r.captions;

  const imageVotes = new Map<number, number>();
  const imageCaptions = new Map<number, number>();
  for (const c of captions) imageCaptions.set(c.image_id, (imageCaptions.get(c.image_id) ?? 0) + 1);
  for (const v of votes) {
    const imageId = imageOfCaption.get(v.caption_id);
    if (imageId !== undefined) imageVotes.set(imageId, (imageVotes.get(imageId) ?? 0) + 1);
  }
  // Most votes, then most captions, then newest id.
  const beats = (a: number, b: number) =>
    (imageVotes.get(a) ?? 0) - (imageVotes.get(b) ?? 0) ||
    (imageCaptions.get(a) ?? 0) - (imageCaptions.get(b) ?? 0) ||
    a - b;
  for (const i of images) {
    const r = rows.get(categoryOf.get(i.id)!)!;
    if (!r.sample || beats(i.id, r.sample.id) > 0) r.sample = { id: i.id, url: i.url };
  }
  // Images without a description have no category; they go last, not ranked.
  const undescribed = (r: CategoryRow) => (r.category === UNDESCRIBED ? 1 : 0);
  return [...rows.values()].sort(
    (a, b) => undescribed(a) - undescribed(b) || b.perCaption - a.perCaption || b.votes - a.votes,
  );
}
