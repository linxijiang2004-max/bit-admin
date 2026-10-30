// Shape checks for the signup allowlists, run in the Server Actions. Each
// returns the normalized (lowercased) value to store, or an error to show.

export function normalizeDomain(raw: string): string | { error: string } {
  const value = raw.trim().toLowerCase();
  if (!value) return { error: "domain is required" };
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(value) || value.includes("://")) {
    return { error: "domain only, without a scheme (drop the https://)" };
  }
  if (value.includes("@")) return { error: "domain only, without an @ (e.g. columbia.edu)" };
  if (/[/?#]/.test(value)) return { error: "domain only, without a path, query or #" };
  if (value.includes(":")) return { error: "domain only, without a port" };
  if (value.length > 253) return { error: "domain is too long" };
  // Labels of letters, digits and inner hyphens, at least one dot, an
  // alphabetic TLD.
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
    return { error: "not a valid domain (expected something like columbia.edu)" };
  }
  return value;
}

export function normalizeEmail(raw: string): string | { error: string } {
  const value = raw.trim().toLowerCase();
  if (!value) return { error: "email is required" };
  if (value.length > 254) return { error: "email is too long" };
  const at = value.lastIndexOf("@");
  if (at < 1 || value.indexOf("@") !== at) return { error: "email needs exactly one @ with a name before it" };
  const local = value.slice(0, at);
  const domain = normalizeDomain(value.slice(at + 1));
  if (typeof domain !== "string") return { error: `email domain: ${domain.error}` };
  if (local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) || /^\.|\.\.|\.$/.test(local)) {
    return { error: "the part before the @ isn't a valid email name" };
  }
  return `${local}@${domain}`;
}
