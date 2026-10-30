// Form field primitives for the create/edit dialogs. Plain elements with
// defaultValue, so they render on the server and pass into a client dialog.

export const fieldClass =
  "w-full rounded-card bg-bg px-3 py-2 text-[14px] text-text placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent";

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
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[13px] leading-snug text-muted">{hint}</span>}
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
    <label className="flex items-center gap-2 text-[14px]">
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
  return <span className="font-mono text-[13px]">{children}</span>;
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
      <summary className="cursor-pointer list-none text-[13px] font-medium text-muted hover:text-text">
        <span className="group-open:hidden">▸</span>
        <span className="hidden group-open:inline">▾</span> {label}
        {text !== null && (
          <span className="ml-1 normal-case tracking-normal text-muted/70">
            · {text.length.toLocaleString("en-US")} chars
          </span>
        )}
      </summary>
      {text === null ? (
        <p className="mt-1 text-[13px] text-muted">null</p>
      ) : (
        <pre className="mt-1.5 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-bg p-3 font-mono text-[13px] leading-relaxed text-text/90">
          {text}
        </pre>
      )}
    </details>
  );
}
