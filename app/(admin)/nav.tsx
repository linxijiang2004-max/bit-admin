"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/", label: "Overview" },
  { href: "/media", label: "Media" },
  { href: "/people", label: "People" },
  { href: "/votes", label: "Votes" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full items-stretch gap-1 text-xs">
      {SECTIONS.map(({ href, label }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center border-b-2 px-2 ${
              active
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
