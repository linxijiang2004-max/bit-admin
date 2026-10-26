import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth/server";

// Every section page renders through this, so each page re-runs the gate
// itself. Layouts and pages render in parallel; the layout's check does not
// protect the page.
export function Section({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <Gated title={title}>{children}</Gated>
    </Suspense>
  );
}

async function Gated({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  await requireSuperadmin();

  return (
    <section className="flex flex-col gap-2">
      <h1 className="px-1 text-xs font-medium uppercase tracking-wider text-muted">
        {title}
      </h1>
      <div className="rounded-card bg-card p-3 text-muted">
        {children ?? "No data yet."}
      </div>
    </section>
  );
}
