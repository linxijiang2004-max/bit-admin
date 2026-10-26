import Link from "next/link";
import { getProvenance } from "@/lib/admin/captions";
import { formatDateTime, formatInt, formatSigned } from "@/lib/admin/format";
import { Badge, ErrorNote } from "../ui";

// Full generation provenance: caption_requests + every caption_request_steps
// row (index, name, exact prompt, model, raw output). Server-rendered; open
// state lives in ?caption=<id>.
export async function ProvenanceDrawer({ id, closeHref }: { id: number; closeHref: string }) {
  let p;
  try {
    p = await getProvenance(id);
  } catch (e) {
    p = e as Error;
  }

  return (
    <>
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close provenance"
        className="fixed inset-0 z-30 bg-black/50"
      />
      <aside
        aria-label={`Provenance for caption ${id}`}
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[720px] flex-col bg-card shadow-2xl shadow-black"
      >
        <header className="flex h-10 shrink-0 items-center justify-between bg-card-hover px-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
            Provenance · caption {id}
          </h2>
          <Link href={closeHref} scroll={false} className="text-xs text-muted hover:text-text">
            close ✕
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {p instanceof Error ? (
            <ErrorNote message={p.message} />
          ) : p === null ? (
            <p className="text-muted">Caption {id} doesn&apos;t exist (it may have been deleted).</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                {p.caption.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.caption.image_url}
                    alt=""
                    className="size-28 shrink-0 rounded bg-bg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{p.caption.content}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-muted">Status</dt>
                    <dd>{p.caption.is_public ? <Badge tone="accent">published</Badge> : <Badge>draft</Badge>}</dd>
                    <dt className="text-muted">Score · votes · favs</dt>
                    <dd>
                      {formatSigned(p.caption.like_count)} · {formatInt(p.caption.vote_count)} ·{" "}
                      {formatInt(p.caption.favorites)}
                    </dd>
                    <dt className="text-muted">Image</dt>
                    <dd>#{p.caption.image_id}</dd>
                    <dt className="text-muted">Created</dt>
                    <dd>{formatDateTime(p.caption.created_at)} UTC</dd>
                  </dl>
                </div>
              </div>

              {p.request === null ? (
                <p className="rounded-card bg-bg p-3 text-muted">
                  No generation request is linked to this caption. It was written by
                  hand (seed data or the admin console), so there is no pipeline to show.
                </p>
              ) : (
                <>
                  <div className="rounded-card bg-bg px-3 py-2 text-xs">
                    <span className="text-muted">Request</span> #{p.request.id}
                    <span className="text-muted"> · by </span>
                    {p.requester ?? p.request.profile_id.slice(0, 8)}
                    <span className="text-muted"> · </span>
                    {formatDateTime(p.request.created_at)} UTC
                    <span className="text-muted"> · {p.steps.length} steps</span>
                  </div>

                  {p.steps.length === 0 && (
                    <p className="text-muted">This request recorded no steps.</p>
                  )}

                  <ol className="flex flex-col gap-2">
                    {p.steps.map((s) => (
                      <li key={s.id} className="rounded-card bg-bg">
                        <div className="flex items-center gap-2 px-3 py-2 text-xs">
                          <span className="font-mono text-accent">{s.step_index}</span>
                          <span className="font-medium">{s.step_name}</span>
                          <span className="ml-auto font-mono text-[11px] text-muted">{s.model}</span>
                        </div>
                        <Block label="Prompt" text={s.prompt} />
                        <Block label="Raw output" text={s.raw_output} />
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Block({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="px-3 pb-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{label}</div>
      {text === null ? (
        <p className="text-xs text-muted">null</p>
      ) : (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-card p-2 font-mono text-[11px] leading-relaxed text-text/90">
          {text}
        </pre>
      )}
    </div>
  );
}
