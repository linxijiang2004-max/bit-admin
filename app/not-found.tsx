import Link from "next/link";

// Bare like the not-authorized page: no nav, no data. Only reachable after
// the proxy's gates, so linking home is safe.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted">
      <p>
        <span className="text-text">404</span> · page not found
      </p>
      <Link href="/" className="text-xs hover:text-text">
        ← back to overview
      </Link>
    </main>
  );
}
