// Fallback target for requireSuperadmin(). Normally the proxy answers
// non-superadmins with its own 403 before this renders. No chrome, no data.
export default function NotAuthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center text-muted">
      not authorized
    </main>
  );
}
