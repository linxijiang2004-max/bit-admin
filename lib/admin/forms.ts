// Shared by every Server Action: the form result shape and field readers.
// The browser's `required`/`maxLength` are a convenience; these are the checks.

export type FormState = { error?: string; ok?: string; done?: boolean } | undefined;

export type Field<T> = T | { error: string };

export function isError<T>(v: Field<T>): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}

export function text(
  fd: FormData,
  name: string,
  opts: { label?: string; max: number; required?: boolean },
): Field<string | null> {
  const value = String(fd.get(name) ?? "").trim();
  const label = opts.label ?? name.replace(/_/g, " ");
  if (!value) return opts.required ? { error: `${label} is required` } : null;
  if (value.length > opts.max) return { error: `${label}: max ${opts.max} characters` };
  return value;
}

export function checkbox(fd: FormData, name: string): boolean {
  return fd.get(name) === "on";
}

export function positiveId(raw: unknown, label: string): Field<number> {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : { error: `pick a ${label}` };
}

// The typed confirmation is enforced on the server too, not only in the browser.
export function confirmedDelete(fd: FormData): boolean {
  return fd.get("confirm") === "DELETE";
}

// Postgres errors an admin can act on, in words; anything else verbatim.
export function dbError(e: { code?: string; message: string }, what: string): string {
  if (e.code === "23505") return `that ${what} already exists`;
  if (e.code === "23503") return `${what} references a row that doesn't exist (or is still referenced)`;
  if (e.code === "42501") return `not permitted: ${e.message}`;
  return e.message;
}

// RLS hides refused writes: an UPDATE/DELETE that policy filters out returns
// 200 with zero rows. Every write asks for the affected rows back and treats
// "none" as failure.
export function noRows(what: string, verb: string): { error: string } {
  return { error: `${verb} did not apply: no ${what} row changed (missing, or refused by RLS)` };
}
