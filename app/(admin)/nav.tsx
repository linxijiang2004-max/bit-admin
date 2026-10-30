"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GROUPS, groupHref, OVERVIEW } from "./sections";

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemClass(active: boolean) {
  return `rounded-card px-2.5 py-1.5 text-[15px] ${
    active ? "bg-card-hover text-text" : "text-muted hover:text-text"
  }`;
}

function Groups({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={OVERVIEW.href}
        onClick={onNavigate}
        aria-current={isActive(OVERVIEW.href, pathname) ? "page" : undefined}
        className={itemClass(isActive(OVERVIEW.href, pathname))}
      >
        {OVERVIEW.label}
      </Link>
      {GROUPS.map((g) => {
        const href = groupHref(g.slug);
        const active = pathname === href;
        return (
          <div key={g.slug} className="flex flex-col gap-0.5">
            {/* The group header opens that group's overview page. */}
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`mb-1 flex items-center justify-between rounded-card px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] ${
                active ? "bg-card-hover text-accent" : "text-text hover:text-accent"
              }`}
            >
              {g.title}
              <span aria-hidden className="text-[13px] font-normal tracking-normal text-muted">
                ›
              </span>
            </Link>
            {g.pages.map(({ href, label }) => {
              const on = isActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={on ? "page" : undefined}
                  className={itemClass(on)}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Persistent left sidebar from 768px up; below that, a top bar whose menu
// button drops the same groups down as a drawer.
export function Sidebar({ brand, footer }: { brand: React.ReactNode; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[216px] shrink-0 flex-col gap-7 overflow-y-auto bg-card px-3 py-5 md:flex">
        <div className="px-2.5">{brand}</div>
        <nav aria-label="Sections" className="flex-1">
          <Groups />
        </nav>
        <div className="px-2.5">{footer}</div>
      </aside>

      <div className="sticky top-0 z-40 bg-card md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          {brand}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="nav-drawer"
            className="rounded-card px-2 py-1 text-[14px] text-muted hover:text-text"
          >
            {open ? "close" : "menu"}
          </button>
        </div>
        {open && (
          <nav id="nav-drawer" aria-label="Sections" className="flex flex-col gap-5 px-3 pb-5">
            <Groups onNavigate={() => setOpen(false)} />
            <div className="px-2.5">{footer}</div>
          </nav>
        )}
      </div>
    </>
  );
}
