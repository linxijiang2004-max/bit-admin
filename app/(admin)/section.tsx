import { Suspense } from "react";
import Link from "next/link";
import { formatInt } from "@/lib/admin/format";
import { requireSuperadmin } from "@/lib/auth/server";
import { GROUPS, groupHref, pageInfo } from "./sections";

type HeaderProps = {
  // The page's own href: its name, purpose and group come from sections.ts.
  href?: string;
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  // For a detail page: the list page it belongs to, shown in the breadcrumb.
  parent?: string;
};

// Every section page renders through this, so each page re-runs the gate
// itself. Layouts and pages render in parallel; the layout's check does not
// protect the page. Children are only rendered (and only fetch data) after
// the gate has passed.
export function Section({ children, ...header }: HeaderProps & { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Gated {...header}>{children}</Gated>
    </Suspense>
  );
}

async function Gated({ children, ...header }: HeaderProps & { children: React.ReactNode }) {
  await requireSuperadmin();

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader {...header} />
      <Suspense fallback={<Panel className="text-muted">loading…</Panel>}>
        {children}
      </Suspense>
    </section>
  );
}

function PageHeader({ href, title, description, actions, parent }: HeaderProps) {
  const info = href ? pageInfo(href) : undefined;
  const crumbOf = href ?? parent;
  const group = crumbOf ? GROUPS.find((g) => g.pages.some((p) => p.href === crumbOf)) : undefined;
  const parentInfo = parent ? pageInfo(parent) : undefined;
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-1">
      <div className="flex min-w-0 max-w-3xl flex-col gap-1.5">
        {group && (
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
            <Link href={groupHref(group.slug)} className="hover:text-accent">
              {group.title}
            </Link>
            {parentInfo && (
              <>
                <span aria-hidden>›</span>
                <Link href={parentInfo.href} className="hover:text-accent">
                  {parentInfo.label}
                </Link>
              </>
            )}
          </div>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
          {title ?? info?.label}
        </h1>
        {(description ?? info?.purpose) && (
          <p className="text-[15px] leading-relaxed text-muted">{description ?? info?.purpose}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  count,
  actions,
  className = "",
  children,
}: {
  title?: React.ReactNode;
  count?: number;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-card bg-card p-4 md:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="text-[16px] font-semibold">
              {title}
              {count !== undefined && (
                <span className="ml-2 font-normal text-muted">{formatInt(count)}</span>
              )}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// A row of filters/search above a list, with an optional note on the right.
export function Toolbar({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {children}
      {note && <span className="ml-auto text-[13px] text-muted">{note}</span>}
    </div>
  );
}
