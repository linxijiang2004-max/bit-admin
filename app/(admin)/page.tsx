import Link from "next/link";
import { getOverview } from "@/lib/admin/overview";
import { formatInt, formatPct, formatSigned } from "@/lib/admin/format";
import { hourLabel } from "@/lib/admin/insights";
import { ActivityChart } from "./activity-chart";
import { CategoryDonut, HourlyChart, TopicSplit, WeekdayColumns } from "./insight-charts";
import { Panel, Section } from "./section";
import { BarList, Empty, ErrorNote, Stat, Thumb } from "./ui";

export default function OverviewPage() {
  return (
    <Section href="/">
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
  const { recent, prior } = o.publishTrend;

  return (
    <div className="flex flex-col gap-14 pb-10">
      <Hero
        rate={formatPct(t.publicCaptions, t.captions)}
        detail={`${formatInt(t.publicCaptions)} of ${formatInt(t.captions)} captions published`}
        recent={recent}
        prior={prior}
      />

      <Question
        title="When do people use bit?"
        note={`Hours and days in New York time · ${formatInt(t.runs)} generation runs, ${formatInt(t.votes)} votes`}
      >
        <Panel title="Activity by hour of day">
          <HourlyChart hours={o.hourly.hours} />
        </Panel>
        <Rest>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Peak hour for generating"
              value={o.hourly.peakRuns.runs ? `${hourLabel(o.hourly.peakRuns.hour)}–${hourLabel((o.hourly.peakRuns.hour + 1) % 24)}` : "–"}
              detail={`${o.hourly.peakRuns.runs} runs in that hour`}
            />
            <Stat
              label="Peak hour for voting"
              value={o.hourly.peakVotes.votes ? `${hourLabel(o.hourly.peakVotes.hour)}–${hourLabel((o.hourly.peakVotes.hour + 1) % 24)}` : "–"}
              detail={`${o.hourly.peakVotes.votes} votes in that hour`}
            />
            <Stat
              label="Busiest day"
              value={o.hourly.busiestDay?.day ?? "–"}
              detail={o.hourly.busiestDay ? `${o.hourly.busiestDay.events} runs + votes` : "no activity yet"}
            />
            <Stat
              label="People"
              value={formatInt(t.people)}
              detail={`${t.superadmins} superadmin${t.superadmins === 1 ? "" : "s"}`}
            />
          </div>
          <Panel title="By day of week">
            <div className="pb-6">
              <WeekdayColumns days={o.hourly.weekdays} />
            </div>
          </Panel>
        </Rest>
      </Question>

      <Question
        title="What makes a caption land?"
        note={`From ${formatInt(t.votes)} votes on ${formatInt(t.votedCaptions)} captions, so read it as a direction, not a result`}
      >
        <Panel title="Words and terms in voted captions · net votes">
          <p className="mb-4 text-[14px] text-muted">
            Each word that appears in at least two voted captions, with the votes those captions got. Terms from
            Terms &amp; Examples are matched as whole phrases.
          </p>
          <TopicSplit topics={o.topics.slice(0, 12)} />
        </Panel>
        <Rest>
          <Panel title="Top captions · net score">
            {o.topCaptions.length === 0 ? (
              <Empty>No caption has a vote yet.</Empty>
            ) : (
              <ol className="flex flex-col gap-2">
                {o.topCaptions.map((c) => (
                  <li key={c.id} className="flex items-center gap-3">
                    {c.imageUrl && (
                      <Link href={`/images/${c.imageId}`} aria-label={`Image #${c.imageId}`}>
                        <Thumb url={c.imageUrl} size={36} />
                      </Link>
                    )}
                    <Link href={`/media?caption=${c.id}`} className="min-w-0 flex-1 hover:text-accent">
                      {c.content}
                    </Link>
                    <span className="w-8 text-right">{formatSigned(c.score)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <div className="grid grid-cols-2 content-start gap-2">
            <Stat label="Votes" value={formatInt(t.votes)} detail={`▲ ${t.upvotes} · ▼ ${t.downvotes}`} />
            <Stat
              label="Approval"
              value={formatPct(t.upvotes, t.votes)}
              detail={`upvotes, across ${t.votedCaptions} captions`}
            />
          </div>
        </Rest>
      </Question>

      <Question
        title="Which images get people engaged?"
        note="Categories come from keywords in each image's AI description, so they're approximate"
      >
        <Panel title="Share of votes, by image category">
          <CategoryDonut rows={o.categories} />
        </Panel>
        <Rest>
          <Panel title="Caption coverage">
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
              <dt className="text-muted">Images with captions</dt>
              <dd className="text-right">
                {o.coverage.captionedImages}{" "}
                <span className="text-muted">({formatPct(o.coverage.captionedImages, t.images)})</span>
              </dd>
              <dt className="text-muted">Images never captioned</dt>
              <dd className="text-right">
                <Link href="/images?view=unused" className="hover:text-accent">
                  {o.coverage.uncaptionedImages}
                </Link>
              </dd>
              <dt className="text-muted">Captions per captioned image</dt>
              <dd className="text-right">{o.coverage.avgCaptionsPerCaptionedImage.toFixed(1)}</dd>
              <dt className="text-muted">Captions with any vote</dt>
              <dd className="text-right">{formatPct(t.votedCaptions, t.captions)}</dd>
            </dl>
          </Panel>
          <div className="grid grid-cols-2 content-start gap-2">
            <Stat label="Images" value={formatInt(t.images)} detail={`${o.coverage.uncaptionedImages} never captioned`} />
            <Stat
              label="Captions"
              value={formatInt(t.captions)}
              detail={`${t.publicCaptions} public · ${t.draftCaptions} drafts`}
            />
          </div>
        </Rest>
      </Question>

      <Question title="Who and what is doing the work?">
        <Panel title="Captions generated · last 14 days (UTC)">
          <ActivityChart days={o.activity} />
        </Panel>
        <Rest>
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
          <div className="flex flex-col gap-2">
            <Stat
              label="Generation runs"
              value={formatInt(t.runs)}
              detail={`${o.coverage.captionsPerRun.toFixed(1)} captions / run`}
            />
            <Panel title="LLM calls by model">
              <BarList
                empty="No pipeline steps recorded."
                rows={o.models.map((m) => ({
                  key: m.model,
                  label: <span className="font-mono text-[13px]">{m.model}</span>,
                  value: m.count,
                }))}
              />
            </Panel>
          </div>
        </Rest>
      </Question>
    </div>
  );
}

type Cohort = { captions: number; published: number };

// The one number to read first. Its change compares captions created in the
// last 30 days with those created in the 30 before, as they stand today.
function Hero({
  rate,
  detail,
  recent,
  prior,
}: {
  rate: string;
  detail: string;
  recent: Cohort;
  prior: Cohort;
}) {
  let change: string;
  if (recent.captions === 0) {
    change = "no captions created in the last 30 days";
  } else if (prior.captions === 0) {
    change = `${formatPct(recent.published, recent.captions)} of ${formatInt(recent.captions)} captions created in the last 30 days · none in the 30 before`;
  } else {
    const pts = Math.round(
      (recent.published / recent.captions - prior.published / prior.captions) * 100,
    );
    change = `${pts === 0 ? "±0" : formatSigned(pts)} pts over 30 days · ${formatPct(recent.published, recent.captions)} of ${formatInt(recent.captions)} new captions vs ${formatPct(prior.published, prior.captions)} of ${formatInt(prior.captions)} the 30 days before`;
  }
  return (
    <div className="flex flex-col gap-1 px-1 pt-2">
      <div className="text-[13px] uppercase tracking-[0.12em] text-muted">Publish rate</div>
      <div className="text-[56px] font-bold leading-none tabular-nums">{rate}</div>
      <div className="mt-1 text-[13px] text-muted">{change}</div>
      <div className="text-[13px] text-muted">{detail}</div>
    </div>
  );
}

function Question({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-[20px] font-semibold">{title}</h2>
        {note && <p className="text-[14px] text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

// Everything after a section's lead chart.
function Rest({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 min-[900px]:grid-cols-2">{children}</div>;
}
