import Link from "next/link";
import { getOverview } from "@/lib/admin/overview";
import { formatInt, formatPct, formatSigned } from "@/lib/admin/format";
import { ActivityChart } from "./activity-chart";
import { Panel, Section } from "./section";
import { BarList, Empty, ErrorNote, Stat, Thumb } from "./ui";

export default function OverviewPage() {
  return (
    <Section title="Overview">
      <OverviewContent />
    </Section>
  );
}

async function OverviewContent() {
  let o;
  try {
    o = await getOverview();
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  const t = o.totals;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="People"
          value={formatInt(t.people)}
          detail={`${t.superadmins} superadmin${t.superadmins === 1 ? "" : "s"}`}
        />
        <Stat
          label="Images"
          value={formatInt(t.images)}
          detail={`${t.libraryImages} library · ${t.images - t.libraryImages} uploaded`}
        />
        <Stat
          label="Captions"
          value={formatInt(t.captions)}
          detail={`${t.publicCaptions} public · ${t.draftCaptions} drafts`}
        />
        <Stat
          label="Generation runs"
          value={formatInt(t.runs)}
          detail={`${o.coverage.captionsPerRun.toFixed(1)} captions / run`}
        />
        <Stat
          label="Votes"
          value={formatInt(t.votes)}
          detail={`▲ ${t.upvotes} · ▼ ${t.downvotes}`}
        />
        <Stat
          label="Approval"
          value={formatPct(t.upvotes, t.votes)}
          detail={`upvotes, across ${t.votedCaptions} captions`}
        />
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <Panel title="Captions generated · last 14 days (UTC)" className="lg:col-span-2">
          <ActivityChart days={o.activity} />
        </Panel>
        <Panel title="Caption coverage">
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
            <dt className="text-muted">Images with captions</dt>
            <dd className="text-right">
              {o.coverage.captionedImages}{" "}
              <span className="text-muted">
                ({formatPct(o.coverage.captionedImages, t.images)})
              </span>
            </dd>
            <dt className="text-muted">Images never captioned</dt>
            <dd className="text-right">{o.coverage.uncaptionedImages}</dd>
            <dt className="text-muted">Captions per captioned image</dt>
            <dd className="text-right">
              {o.coverage.avgCaptionsPerCaptionedImage.toFixed(1)}
            </dd>
            <dt className="text-muted">Share published</dt>
            <dd className="text-right">{formatPct(t.publicCaptions, t.captions)}</dd>
            <dt className="text-muted">Captions with any vote</dt>
            <dd className="text-right">{formatPct(t.votedCaptions, t.captions)}</dd>
          </dl>
        </Panel>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <Panel title="Top captions · net score">
          {o.topCaptions.length === 0 ? (
            <Empty>No caption has a vote yet.</Empty>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {o.topCaptions.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  {c.imageUrl && <Thumb url={c.imageUrl} size={28} />}
                  <Link
                    href={`/media?caption=${c.id}`}
                    className="min-w-0 flex-1 truncate hover:text-accent"
                  >
                    {c.content}
                  </Link>
                  <span className="w-8 text-right">{formatSigned(c.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Most active people · uploads + captions">
          <BarList
            empty="No activity yet."
            rows={o.topPeople.map((p) => ({
              key: p.id,
              label: (
                <>
                  {p.name}{" "}
                  <span className="text-muted">
                    {p.uploads}↑ {p.captions}✎
                  </span>
                </>
              ),
              value: p.uploads + p.captions,
            }))}
          />
        </Panel>
        <Panel title="LLM calls by model">
          <BarList
            empty="No pipeline steps recorded."
            rows={o.models.map((m) => ({
              key: m.model,
              label: <span className="font-mono text-[11px]">{m.model}</span>,
              value: m.count,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
