"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

// A compact dropdown whose options are links (e.g. sort order). The URL stays
// the source of truth; picking an option navigates to its href.
export function SelectNav({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-[14px] text-muted">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.value === e.target.value);
          if (next) router.push(next.href);
        }}
        className="rounded-card bg-bg px-3 py-2 text-[14px] text-text focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
