import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth/server";

// Every section page renders through this, so each page re-runs the gate
// itself. Layouts and pages render in parallel; the layout's check does not
// protect the page. Children are only rendered (and only fetch data) after
// the gate has passed.
export function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <Gated title={title} actions={actions}>
        {children}
      </Gated>
    </Suspense>
  );
}

async function Gated({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  await requireSuperadmin();

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader title={title} actions={actions} />
      <Suspense fallback={<Panel className="text-muted">loading…</Panel>}>
        {children}
      </Suspense>
    </section>
  );
}

function SectionHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex h-7 items-center justify-between px-1">
      <h1 className="text-xs font-medium uppercase tracking-wider text-muted">
        {title}
      </h1>
      {actions}
    </div>
  );
}

export function Panel({
  title,
  className = "",
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-card bg-card p-3 ${className}`}>
      {title && (
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
