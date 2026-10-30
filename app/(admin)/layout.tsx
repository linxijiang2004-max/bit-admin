import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth/server";
import { signOut } from "./actions";
import { Sidebar } from "./nav";

// Nothing outside the Suspense boundary, so the prerendered static shell is
// empty: no chrome reaches anyone before the gate has run.
export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={null}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperadmin();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        brand={
          <span className="font-mono text-[13px] font-medium tracking-tight">
            bit<span className="text-accent">/</span>admin
          </span>
        }
        footer={
          <div className="flex flex-col gap-1 text-[13px]">
            <span className="truncate text-muted" title={email ?? undefined}>
              {email}
            </span>
            <form action={signOut}>
              <button type="submit" className="text-muted hover:text-text">
                sign out
              </button>
            </form>
          </div>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
