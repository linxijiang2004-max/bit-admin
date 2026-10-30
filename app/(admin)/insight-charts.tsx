import { formatInt, formatPct } from "@/lib/admin/format";
import Link from "next/link";
import { CATEGORIES, hourLabel, UNDESCRIBED, type CategoryRow, type HourRow, type TopicRow } from "@/lib/admin/insights";
import { Empty } from "./ui";

// Server-rendered charts. Hover tooltips are CSS (group-hover), so no client
// JS: every column or row is a full-size hover target. Values are always
// printed somewhere, so color is never the only way to read them.

const SERIES = [
  { key: "runs", label: "Generation runs", color: "var(--series-1)" },
  { key: "votes", label: "Votes", color: "var(--series-2)" },
] as const;

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-[13px] text-muted">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

const tooltip =
  "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-bg px-2.5 py-1.5 text-[13px] shadow-lg group-hover:block";

// Two series on one count axis, 24 points (hour of day, campus time).
export function HourlyChart({ hours }: { hours: HourRow[] }) {
  const max = Math.max(1, ...hours.map((h) => Math.max(h.runs, h.votes)));
  const y = (v: number) => 100 - (v / max) * 90;
  const x = (h: number) => (h + 0.5) * 10;
  const total = hours.reduce((n, h) => n + h.runs + h.votes, 0);

  return (
    <figure className="flex flex-col gap-3">
      <Legend />
      <div className="flex gap-2">
        <div className="flex h-44 flex-col justify-between text-right text-[12px] text-muted" aria-hidden>
          <span>{max}</span>
          <span>0</span>
        </div>
        <div
          className="relative h-44 flex-1 border-b border-white/10"
          role="img"
          aria-label={`Generation runs and votes by hour of day, New York time, ${total} events in total`}
        >
          <svg viewBox="0 0 240 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            <line x1="0" x2="240" y1="10" y2="10" stroke="rgba(255,255,255,0.05)" vectorEffect="non-scaling-stroke" />
            {SERIES.map((s) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                points={hours.map((h) => `${x(h.hour)},${y(h[s.key])}`).join(" ")}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex">
            {hours.map((h) => (
              <div key={h.hour} className="group relative h-full flex-1">
                <div className="absolute inset-y-0 left-1/2 hidden w-px bg-white/20 group-hover:block" />
                {SERIES.map((s) => (
                  <span
                    key={s.key}
                    aria-hidden
                    className="absolute left-1/2 hidden size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card group-hover:block"
                    style={{ top: `${y(h[s.key])}%`, background: s.color }}
                  />
                ))}
                <div className={tooltip}>
                  <div className="text-muted">
                    {hourLabel(h.hour)}–{hourLabel((h.hour + 1) % 24)} ET
                  </div>
                  <div>
                    {h.runs} runs · {h.votes} votes
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-6 flex justify-between text-[12px] text-muted" aria-hidden>
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{hourLabel(h)}</span>
        ))}
      </div>
    </figure>
  );
}

// Seven columns, one series; the count sits on each cap.
export function WeekdayColumns({ days }: { days: { day: string; events: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.events));
  return (
    <div className="flex h-36 items-end gap-2 border-b border-white/10" role="img" aria-label="Activity by day of week">
      {days.map((d) => (
        <div key={d.day} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[12px] text-muted">{d.events}</span>
          <div
            className="w-full max-w-6 rounded-t-[4px] bg-accent"
            style={{ height: d.events === 0 ? 0 : `max(2px, ${(d.events / max) * 75}%)` }}
          />
          <span className="absolute -bottom-6 text-[12px] text-muted">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

// Diverging around a center line: downvotes left (blue), upvotes right
// (accent), both counts printed beside the bar.
export function TopicSplit({ topics }: { topics: TopicRow[] }) {
  if (topics.length === 0) {
    return <Empty>No word appears in two or more voted captions yet.</Empty>;
  }
  const max = Math.max(1, ...topics.map((t) => Math.max(t.up, t.down)));
  return (
    <ul className="flex flex-col gap-1">
      {topics.map((t) => (
        <li
          key={`${t.isTerm}:${t.topic}`}
          className="group relative grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-[6px] px-1 py-1.5 hover:bg-white/[0.03] md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7rem]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{t.topic}</span>
            {t.isTerm && (
              <span className="shrink-0 rounded-[6px] bg-white/5 px-1.5 text-[12px] text-muted">term</span>
            )}
          </span>
          <div className="grid h-3 grid-cols-2 gap-0.5" aria-hidden>
            <div className="flex justify-end">
              <div className="rounded-l-[4px]" style={{ width: `${(t.down / max) * 100}%`, background: "var(--series-1)" }} />
            </div>
            <div className="flex">
              <div className="rounded-r-[4px]" style={{ width: `${(t.up / max) * 100}%`, background: "var(--series-2)" }} />
            </div>
          </div>
          <span className="text-right text-[13px] text-muted">
            ▲ {t.up} · ▼ {t.down}
          </span>
          <div className={tooltip}>
            “{t.topic}” in {t.captions} voted captions: {t.up} up, {t.down} down
          </div>
        </li>
      ))}
    </ul>
  );
}

// Fixed color per category (validated as a set on --card, dark): a category
// keeps its color however the ranking changes. Undescribed images are a
// neutral gray, not a hue.
const SLICE_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];
function categoryColor(category: string) {
  if (category === UNDESCRIBED) return "rgba(255,255,255,0.28)";
  return SLICE_COLORS[CATEGORIES.indexOf(category) % SLICE_COLORS.length];
}

// Share of all votes by image category, as a donut; the legend carries the
// numbers and one real image per category, so identity never rests on color.
export function CategoryDonut({ rows }: { rows: CategoryRow[] }) {
  const shown = rows.filter((r) => r.images > 0);
  if (shown.length === 0) return <Empty>No images yet.</Empty>;
  const total = shown.reduce((n, r) => n + r.votes, 0);
  const undescribedLast = (r: CategoryRow) => (r.category === UNDESCRIBED ? 1 : 0);
  const ordered = [...shown].sort(
    (a, b) => undescribedLast(a) - undescribedLast(b) || b.votes - a.votes || b.perCaption - a.perCaption,
  );
  const slices = ordered.filter((r) => r.votes > 0);

  // Arcs clockwise from 12 o'clock on a 100×100 box.
  const C = 50, R = 46, r0 = 29;
  const point = (rad: number, frac: number) => {
    const a = frac * 2 * Math.PI - Math.PI / 2;
    return `${C + rad * Math.cos(a)} ${C + rad * Math.sin(a)}`;
  };
  // Where each slice starts: the running share of the slices before it.
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((n, x) => n + x.votes / total, 0));
  const arcs = slices.map((r, i) => {
    const from = starts[i];
    const to = from + r.votes / total;
    const large = to - from > 0.5 ? 1 : 0;
    // A lone 100% slice is drawn as two halves so the arc isn't degenerate.
    const d =
      slices.length === 1
        ? `M ${point(R, 0)} A ${R} ${R} 0 1 1 ${point(R, 0.5)} A ${R} ${R} 0 1 1 ${point(R, 0.9999)} L ${point(r0, 0.9999)} A ${r0} ${r0} 0 1 0 ${point(r0, 0.5)} A ${r0} ${r0} 0 1 0 ${point(r0, 0)} Z`
        : `M ${point(R, from)} A ${R} ${R} 0 ${large} 1 ${point(R, to)} L ${point(r0, to)} A ${r0} ${r0} 0 ${large} 0 ${point(r0, from)} Z`;
    // Percent label at the middle of the ring, skipped when the slice is too
    // thin to hold it (the legend still has every number).
    const mid = (from + to) / 2;
    const [lx, ly] = point((R + r0) / 2, mid).split(" ").map(Number);
    return { r, d, label: to - from >= 0.06 ? { x: lx, y: ly, text: formatPct(r.votes, total) } : null };
  });

  return (
    <div className="grid grid-cols-1 items-center gap-6 min-[700px]:grid-cols-[220px_minmax(0,1fr)]">
      <figure className="relative mx-auto size-[220px]">
        {total === 0 ? (
          <div className="flex size-full items-center justify-center rounded-full border-[28px] border-white/[0.04] text-center text-[13px] text-muted">
            no votes yet
          </div>
        ) : (
          <svg viewBox="0 0 100 100" className="size-full" role="img" aria-label={`Share of ${total} votes by image category`}>
            {arcs.map(({ r, d }) => (
              <path key={r.category} d={d} fill={categoryColor(r.category)} stroke="var(--card)" strokeWidth={1} className="transition-opacity hover:opacity-80">
                <title>{`${r.category}: ${r.votes} of ${total} votes (${formatPct(r.votes, total)})`}</title>
              </path>
            ))}
            {arcs.map(({ r, label }) =>
              label ? (
                <text
                  key={`${r.category}-label`}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none fill-white text-[5.5px] font-semibold"
                >
                  {label.text}
                </text>
              ) : null,
            )}
          </svg>
        )}
        {total > 0 && (
          <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[26px] font-semibold leading-none">{formatInt(total)}</span>
            <span className="mt-1 text-[13px] text-muted">votes</span>
          </figcaption>
        )}
      </figure>

      <ul className="flex flex-col gap-1">
        {ordered.map((r) => {
          const quiet = r.votes === 0 || r.category === UNDESCRIBED;
          return (
            <li key={r.category} className="flex items-center gap-3 rounded-[8px] px-2 py-1.5 hover:bg-white/[0.03]">
              <span aria-hidden className="h-9 w-1 shrink-0 rounded-full" style={{ background: r.votes > 0 ? categoryColor(r.category) : "rgba(255,255,255,0.08)" }} />
              {r.sample ? (
                <Link href={`/images/${r.sample.id}`} title={`Example: image #${r.sample.id}`} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.sample.url} alt="" loading="lazy" className="size-10 rounded-[8px] bg-bg object-cover" />
                </Link>
              ) : (
                <div className="size-10 shrink-0 rounded-[8px] bg-bg" />
              )}
              <div className="min-w-0 flex-1">
                <div className={quiet ? "text-muted" : "font-medium"}>{r.category}</div>
                <div className="truncate text-[13px] text-muted">
                  {formatInt(r.images)} images · {formatInt(r.captions)} captions
                  {r.votes > 0 && ` · ${r.perCaption.toFixed(2)} votes / caption · ${formatPct(r.up, r.votes)} up`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {r.votes > 0 ? (
                  <>
                    <div className="font-medium">{formatPct(r.votes, total)}</div>
                    <div className="text-[13px] text-muted">{r.votes} votes</div>
                  </>
                ) : (
                  <span className="text-[13px] text-muted">no votes</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
