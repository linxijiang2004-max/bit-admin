import Link from "next/link";

export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-2xl font-medium leading-tight">{value}</div>
      {detail && <div className="mt-0.5 text-xs text-muted">{detail}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-4 text-center text-muted">{children}</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-card bg-card p-3">
      <span className="text-accent">query failed:</span>{" "}
      <span className="font-mono text-xs">{message}</span>
    </div>
  );
}

// Dense table primitives. Numeric columns get `num` for right alignment.
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12px]">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  num,
}: {
  children?: React.ReactNode;
  num?: boolean;
}) {
  return (
    <th
      className={`whitespace-nowrap px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted ${
        num ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  num,
  muted,
  className = "",
}: {
  children?: React.ReactNode;
  num?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-2 py-1.5 align-middle ${num ? "text-right" : ""} ${
        muted ? "text-muted" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="even:bg-white/[0.02] hover:bg-card-hover">{children}</tr>;
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent";
}) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wider ${
        tone === "accent" ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

export function Thumb({ url, size = 32 }: { url: string; size?: number }) {
  return (
    // Arbitrary user/remote URLs; next/image would need every host allowlisted.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded bg-bg object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function ButtonLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-card bg-accent px-2.5 py-1 text-xs font-medium text-bg hover:brightness-110"
    >
      {children}
    </Link>
  );
}

// Horizontal bars for ranked categories. Single series, so no legend: the
// panel title names it. Values are always printed, so color is never alone.
export function BarList({
  rows,
  empty,
}: {
  rows: { label: React.ReactNode; value: number; key: string }[];
  empty: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2"
        >
          <div className="relative h-6 overflow-hidden rounded">
            <div
              className="absolute inset-y-0 left-0 rounded bg-accent/25"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
            <div className="relative truncate px-2 leading-6">{r.label}</div>
          </div>
          <div className="text-right">{r.value}</div>
        </li>
      ))}
    </ul>
  );
}
