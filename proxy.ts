// Next.js 16 renamed middleware.ts -> proxy.ts. Same mechanism, new name.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { evaluateGates } from "@/lib/auth/gates";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Allowlist, exact match. Every other path is gated, including ones that
// don't exist yet. To make a route public you must add it here.
const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

// Deliberately bare: no nav, no app chrome, no data, no user details.
const NOT_AUTHORIZED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not authorized</title><style>html,body{margin:0;height:100%;background:#0B0B0C;color:#8A8A8E;font:13px/1.4 ui-sans-serif,system-ui,sans-serif}body{display:flex;align-items:center;justify-content:center}</style></head><body>not authorized</body></html>`;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Standard @supabase/ssr session refresh: rotated tokens are written to both
  // the forwarded request and the outgoing response.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  const gate = await evaluateGates(supabase);

  if (gate.state === "anon") {
    return withSessionCookies(
      NextResponse.redirect(new URL("/login", request.url)),
      response,
    );
  }

  if (gate.state === "forbidden") {
    return withSessionCookies(
      new NextResponse(NOT_AUTHORIZED_HTML, {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
      response,
    );
  }

  if (pathname === "/not-authorized") {
    return withSessionCookies(
      NextResponse.redirect(new URL("/", request.url)),
      response,
    );
  }

  return response;
}

// Carry any refreshed session cookies over, and never let a gated response be
// cached by a CDN.
function withSessionCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  target.headers.set("cache-control", "private, no-store");
  return target;
}

export const config = {
  // Runs on everything except Next's own build assets. Do NOT exclude by file
  // extension: that would leave a route like /export.csv unguarded.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
