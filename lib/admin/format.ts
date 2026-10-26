// All timestamps render in UTC so server and client output match.
export function formatDateTime(iso: string) {
  return iso.slice(0, 16).replace("T", " ");
}

export function formatDate(iso: string) {
  return iso.slice(0, 10);
}

const integer = new Intl.NumberFormat("en-US");
export function formatInt(n: number) {
  return integer.format(n);
}

export function formatPct(part: number, whole: number) {
  if (whole === 0) return "–";
  return `${Math.round((part / whole) * 100)}%`;
}

export function formatSigned(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
