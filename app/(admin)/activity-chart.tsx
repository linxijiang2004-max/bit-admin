// Captions generated per day. Single series in the accent color; each column
// is a full-height hover target with a CSS tooltip (no client JS needed).
export function ActivityChart({
  days,
}: {
  days: { day: string; captions: number; runs: number }[];
}) {
  const max = Math.max(...days.map((d) => d.captions), 1);
  const total = days.reduce((n, d) => n + d.captions, 0);

  return (
    <figure>
      <div
        className="flex h-32 items-end gap-0.5 border-b border-white/10"
        role="img"
        aria-label={`Captions generated per day, last ${days.length} days, ${total} total`}
      >
        {days.map((d) => (
          <div
            key={d.day}
            className="group relative flex h-full flex-1 items-end hover:bg-white/[0.03]"
          >
            <div
              className="w-full rounded-t-[4px] bg-accent"
              style={{
                height: d.captions === 0 ? 0 : `max(2px, ${(d.captions / max) * 100}%)`,
              }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-bg px-2 py-1 text-[11px] shadow-lg group-hover:block">
              <div className="text-muted">{d.day}</div>
              <div>
                {d.captions} captions · {d.runs} runs
              </div>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{days[0]?.day}</span>
        <span>{days.at(-1)?.day}</span>
      </figcaption>
    </figure>
  );
}
