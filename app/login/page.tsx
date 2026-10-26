import { GoogleButton } from "./google-button";

// Public route (see PUBLIC_PATHS in proxy.ts). Renders nothing but the button.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <GoogleButton />
    </main>
  );
}
