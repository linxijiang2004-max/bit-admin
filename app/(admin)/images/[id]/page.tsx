import { Suspense } from "react";
import { formatDateTime, formatInt, formatSigned } from "@/lib/admin/format";
import { getImageDetail, type ImageCaption, type ImageRequest } from "@/lib/admin/images";
import { DeleteDialog } from "../../dialogs";
import { CodeBlock, Mono } from "../../fields";
import { Section } from "../../section";
import { Badge, Empty, ErrorNote } from "../../ui";
import {
  deleteCaption,
  deleteImageAndLeave,
  updateCaption,
  updateImage,
} from "../../media/actions";
import { CaptionEditor } from "../../media/caption-editor";
import { DeleteCaption } from "../../media/delete-caption";
import { ImageMeta } from "../image-meta";

export default function ImageDetailPage({ params }: PageProps<"/images/[id]">) {
  // params is URL data: read it inside a Suspense boundary so navigation
  // to the page can start instantly.
  return (
    <Suspense fallback={null}>
      <ImageSection params={params} />
    </Suspense>
  );
}

async function ImageSection({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Section parent="/images" title={`Image #${id}`}>
      <ImageDetailContent id={Number(id)} />
    </Section>
  );
}

async function ImageDetailContent({ id }: { id: number }) {
  if (!Number.isSafeInteger(id) || id <= 0) return <Empty>That isn&apos;t an image id.</Empty>;

  let detail;
  try {
    detail = await getImageDetail(id);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (!detail) return <Empty>Image #{id} doesn&apos;t exist (it may have been deleted).</Empty>;
  const { image, captions, requests } = detail;
  const votes = captions.reduce((n, c) => n + c.up + c.down, 0);
  const maxSide = Math.max(1, ...captions.map((c) => Math.max(c.up, c.down)));

  return (
    <div className="flex flex-col gap-10 pb-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <a
          href={image.url}
          target="_blank"
          rel="noreferrer"
          title="Open full size"
          className="flex items-center justify-center overflow-hidden rounded-[14px] bg-card"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.description ?? ""} className="max-h-[70vh] w-full object-contain" />
        </a>

        <div className="flex min-w-0 flex-col gap-5">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-[15px]">
            <dt className="text-muted">Owner</dt>
            <dd className="truncate">{image.owner}</dd>
            <dt className="text-muted">Created (UTC)</dt>
            <dd>{formatDateTime(image.created_at)}</dd>
            <dt className="text-muted">Captions</dt>
            <dd>
              {formatInt(captions.length)} · {formatInt(captions.filter((c) => c.is_public).length)} published ·{" "}
              {formatInt(votes)} votes
            </dd>
          </dl>
          <ImageMeta
            key={image.description ?? ""}
            description={image.description}
            action={updateImage.bind(null, image.id)}
          />
          <div>
            <DeleteDialog title={`Delete image #${image.id} permanently?`} action={deleteImageAndLeave.bind(null, image.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="max-h-40 w-full rounded bg-bg object-contain" />
              {captions.length > 0 ? (
                <p>
                  This deletes the image{" "}
                  <span className="text-danger">
                    and every caption on this page ({formatInt(captions.length)}), with the {formatInt(votes)} vote
                    {votes === 1 ? "" : "s"} on them
                  </span>{" "}
                  and any favorites, through cascade. None of it can be recovered.
                </p>
              ) : (
                <p>This image has no captions, so nothing else is deleted with it.</p>
              )}
              <p>If the file was uploaded to Storage it is removed too, so its public link stops working.</p>
            </DeleteDialog>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[20px] font-semibold">
          Captions <span className="font-normal text-muted">{formatInt(captions.length)}</span>
        </h2>
        {captions.length === 0 ? (
          <Empty>No captions have been generated from this image.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {captions.map((c) => (
              <CaptionItem key={c.id} c={c} maxSide={maxSide} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[20px] font-semibold">
          Generation requests <span className="font-normal text-muted">{formatInt(requests.length)}</span>
        </h2>
        {requests.length === 0 ? (
          <Empty>No caption requests recorded for this image.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <RequestItem key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CaptionItem({ c, maxSide }: { c: ImageCaption; maxSide: number }) {
  return (
    <li className="grid gap-4 rounded-card bg-card p-4 md:grid-cols-[minmax(0,1fr)_15rem_auto] md:items-center">
      <div className="min-w-0 text-[15px]">
        <CaptionEditor
          key={`${c.id}:${c.content}:${c.is_public}`}
          content={c.content}
          isPublic={c.is_public}
          action={updateCaption.bind(null, c.id)}
        />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          {c.is_public ? <Badge tone="accent">published</Badge> : <Badge>draft</Badge>}
          <span>#{c.id}</span>
          <span>{formatDateTime(c.created_at)}</span>
          {c.caption_request_id !== null && <span>request {c.caption_request_id}</span>}
        </div>
      </div>
      <VoteSplit up={c.up} down={c.down} score={c.like_count} maxSide={maxSide} />
      <div className="flex justify-end">
        <DeleteCaption
          id={c.id}
          content={c.content}
          isPublic={c.is_public}
          votes={c.up + c.down}
          favorites={c.favorites}
          deleteAction={deleteCaption.bind(null, c.id)}
          unpublishAction={updateCaption.bind(null, c.id)}
        />
      </div>
    </li>
  );
}

// Diverging bar around a center line: downvotes extend left, upvotes right,
// scaled to the largest side on the page. Both counts are printed, so the
// split never depends on color.
function VoteSplit({ up, down, score, maxSide }: { up: number; down: number; score: number; maxSide: number }) {
  return (
    <div
      className="flex flex-col gap-1"
      role="img"
      aria-label={`${up} upvotes, ${down} downvotes, score ${formatSigned(score)}`}
    >
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-muted">▼ {formatInt(down)}</span>
        <span>score {formatSigned(score)}</span>
        <span>▲ {formatInt(up)}</span>
      </div>
      <div className="grid h-2 grid-cols-2 gap-px">
        <div className="flex justify-end rounded-l-full bg-white/[0.04]">
          <div className="rounded-l-full bg-muted/60" style={{ width: `${(down / maxSide) * 100}%` }} />
        </div>
        <div className="flex rounded-r-full bg-white/[0.04]">
          <div className="rounded-r-full bg-accent" style={{ width: `${(up / maxSide) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function RequestItem({ r }: { r: ImageRequest }) {
  const models = [...new Set(r.responses.map((s) => s.model))].sort();
  return (
    <li>
      <details className="group rounded-card bg-card">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[14px]">
          <span className="text-muted group-open:hidden">▸</span>
          <span className="hidden text-muted group-open:inline">▾</span>
          <span className="font-medium">request {r.id}</span>
          <span className="text-muted">{formatDateTime(r.created_at)}</span>
          <span className="text-muted">{r.author ?? "—"}</span>
          <span className="ml-auto flex flex-wrap gap-x-2 text-muted">
            {models.map((m) => (
              <Mono key={m}>{m}</Mono>
            ))}
            <span>
              {r.responses.length} step{r.responses.length === 1 ? "" : "s"}
            </span>
          </span>
        </summary>
        <div className="px-4 pb-4">
          {r.responses.length === 0 ? (
            <Empty>This request recorded no LLM responses.</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {r.responses.map((s) => (
                <li key={s.id} className="flex flex-col gap-1.5 rounded-card bg-bg/60 p-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-mono text-accent">{s.step_index}</span>
                    <span className="font-medium">{s.step_name}</span>
                    <span className="ml-auto text-muted">
                      <Mono>{s.model}</Mono> · {formatDateTime(s.created_at)}
                    </span>
                  </div>
                  <CodeBlock label="Prompt" text={s.prompt} />
                  <CodeBlock label="Raw output" text={s.raw_output} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>
    </li>
  );
}
