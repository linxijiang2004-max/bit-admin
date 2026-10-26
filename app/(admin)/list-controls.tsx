import Link from "next/link";
import { formatInt } from "@/lib/admin/format";
import { hrefWith, PAGE_SIZE, type SearchParams } from "@/lib/admin/params";

// Server-rendered list controls. All state is in the URL; no client JS.

export function SortTh({
  label,
  column,
  path,
  sp,
  sort,
  dir,
  num,
}: {
  label: string;
  column: string;
  path: string;
  sp: SearchParams;
  sort: string;
  dir: "asc" | "desc";
  num?: boolean;
}) {
  const active = sort === column;
  const nextDir = active && dir === "desc" ? "asc" : "desc";
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={`whitespace-nowrap px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider ${
        num ? "text-right" : ""
      }`}
    >
      <Link
        href={hrefWith(path, sp, { sort: column, dir: nextDir })}
        className={active ? "text-text" : "text-muted hover:text-text"}
      >
        {label}
        <span className={active ? "text-accent" : "invisible"}>
          {dir === "asc" ? " ↑" : " ↓"}
        </span>
      </Link>
    </th>
  );
}

export function Pagination({
  path,
  sp,
  page,
  total,
}: {
  path: string;
  sp: SearchParams;
  page: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const link = "rounded-card px-2 py-1 hover:bg-card-hover";
  const off = "rounded-card px-2 py-1 text-muted/40";

  return (
    <div className="mt-2 flex items-center justify-between text-xs text-muted">
      <span>
        {formatInt(from)}–{formatInt(to)} of {formatInt(total)}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link className={link} href={hrefWith(path, sp, { page: String(page - 1) })}>
            ← prev
          </Link>
        ) : (
          <span className={off}>← prev</span>
        )}
        {/* Jump to a page: a plain GET form that keeps every other param. */}
        <form action={path} className="flex items-center gap-1 px-1">
          {Object.entries(sp).map(([k, v]) => {
            const value = Array.isArray(v) ? v[0] : v;
            return k === "page" || value === undefined ? null : (
              <input key={k} type="hidden" name={k} value={value} />
            );
          })}
          <label htmlFor={`page-${path}`} className="sr-only">
            Page number
          </label>
          <input
            id={`page-${path}`}
            name="page"
            type="number"
            min={1}
            max={pages}
            defaultValue={page}
            key={page}
            className="w-12 rounded-[6px] bg-bg px-1.5 py-0.5 text-center text-text [appearance:textfield] focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span>/ {pages}</span>
          <button type="submit" className="rounded-[6px] px-1.5 py-0.5 hover:bg-card-hover hover:text-text">
            go
          </button>
        </form>
        {page < pages ? (
          <Link className={link} href={hrefWith(path, sp, { page: String(page + 1) })}>
            next →
          </Link>
        ) : (
          <span className={off}>next →</span>
        )}
      </div>
    </div>
  );
}

export function FilterTabs({
  path,
  sp,
  param,
  current,
  options,
}: {
  path: string;
  sp: SearchParams;
  param: string;
  current: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex rounded-card bg-bg p-0.5 text-xs">
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefWith(path, sp, { [param]: o.value })}
          className={`rounded-[8px] px-2.5 py-1 ${
            current === o.value ? "bg-card-hover text-text" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

export const inputClass =
  "rounded-card bg-bg px-2.5 py-1 text-xs text-text placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent";
