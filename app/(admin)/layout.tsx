import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth/server";
import { signOut } from "./actions";
import { Nav } from "./nav";

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
    <div className="flex min-h-screen flex-col">
      <header className="flex h-10 shrink-0 items-center gap-6 bg-card px-3">
        <span className="font-mono text-xs font-medium tracking-tight">
          bit<span className="text-accent">/</span>admin
        </span>
        <Nav />
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-muted">{email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-card px-2 py-1 text-muted hover:bg-card-hover hover:text-text"
            >
              sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-3">{children}</main>
    </div>
  );
}
