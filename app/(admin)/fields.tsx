// Form field primitives for the create/edit dialogs. Plain elements with
// defaultValue, so they render on the server and pass into a client dialog.

export const fieldClass =
  "w-full rounded-card bg-bg px-2 py-1.5 text-xs text-text placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

export function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px]">{children}</span>;
}

// Collapsible monospace block that preserves whitespace exactly.
export function CodeBlock({
  label,
  text,
  open,
}: {
  label: string;
  text: string | null;
  open?: boolean;
}) {
  return (
    <details open={open} className="group">
      <summary className="cursor-pointer list-none text-[10px] uppercase tracking-wider text-muted hover:text-text">
        <span className="group-open:hidden">▸</span>
        <span className="hidden group-open:inline">▾</span> {label}
        {text !== null && (
          <span className="ml-1 normal-case tracking-normal text-muted/70">
            · {text.length.toLocaleString("en-US")} chars
          </span>
        )}
      </summary>
      {text === null ? (
        <p className="mt-1 text-xs text-muted">null</p>
      ) : (
        <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-bg p-2 font-mono text-[11px] leading-relaxed text-text/90">
          {text}
        </pre>
      )}
    </details>
  );
}
