// URL search params -> validated query options. Everything list pages do
// (filter, sort, page) lives in the URL, so it's shareable and server-side.

export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 50;

export function one(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function pageOf(sp: SearchParams): number {
  const n = Number(one(sp, "page"));
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

// A typed page past the end shows the last page instead of an empty table.
export function clampPage(page: number, total: number): number {
  return Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
}

export function rangeOf(page: number): [number, number] {
  return [(page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1];
}

export function dirOf(sp: SearchParams): "asc" | "desc" {
  return one(sp, "dir") === "asc" ? "asc" : "desc";
}

// YYYY-MM-DD or undefined.
export function dateOf(sp: SearchParams, key: string): string | undefined {
  const v = one(sp, key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
    ? v
    : undefined;
}

export function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Literal substring match for ILIKE: escape the pattern metacharacters.
export function ilikePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Build a link to the same page with some params changed (null removes).
// Any change other than `page` sends you back to page 1.
export function hrefWith(
  path: string,
  sp: SearchParams,
  changes: Record<string, string | null>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== "") params.set(k, value);
  }
  if (!("page" in changes)) params.delete("page");
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
