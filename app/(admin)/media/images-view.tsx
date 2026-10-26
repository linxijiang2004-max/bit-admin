import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDate, formatInt, formatSigned } from "@/lib/admin/format";
import { listImages, type ImageCaption } from "@/lib/admin/images";
import { clampPage, hrefWith, one, pageOf, type SearchParams } from "@/lib/admin/params";
import { Pagination } from "../list-controls";
import { Panel } from "../section";
import { Badge, Empty, ErrorNote } from "../ui";
import { deleteImage } from "./actions";
import { DeleteImage } from "./delete-image";
import { ProvenanceDrawer } from "./provenance-drawer";

const PATH = "/media";
const SHOWN = 5;

// Image-centric view: one card per image with every caption generated for it.
export async function ImagesView({ sp }: { sp: SearchParams }) {
  const page = pageOf(sp);
  const drawerId = Number(one(sp, "caption"));

  let result;
  try {
    result = await listImages({ page });
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (result.rows.length === 0 && result.total > 0 && page > 1) {
    redirect(hrefWith(PATH, sp, { page: String(clampPage(page, result.total)) }));
  }

  const provenanceHref = (id: number) =>
    hrefWith(PATH, sp, { caption: String(id), page: String(page) });

  return (
    <>
      <p className="px-1 text-xs text-muted">
        {formatInt(result.total)} images · newest first · only images with no captions can be deleted
      </p>

      {result.rows.length === 0 ? (
        <Panel>
          <Empty>No images yet. Images appear here once someone uploads one in bit.</Empty>
        </Panel>
      ) : (
        <>
          <div className="grid gap-2 2xl:grid-cols-2">
            {result.rows.map((i) => (
              <article key={i.id} className="flex gap-3 rounded-card bg-card p-3">
                <a
                  href={i.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open full size"
                  className="shrink-0 self-start"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.url}
                    alt={i.description ?? `image ${i.id}`}
                    loading="lazy"
                    className="size-36 rounded bg-bg object-cover"
                  />
                </a>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="font-medium text-text">#{i.id}</span>
                    {i.is_library ? <Badge tone="accent">library</Badge> : <Badge>upload</Badge>}
                    <span className="text-muted">
                      {[i.owner_first_name, i.owner_last_name].filter(Boolean).join(" ") ||
                        i.owner_email ||
                        "seed"}
                      {" · "}
                      {formatDate(i.created_at)}
                    </span>
                    <span className="text-muted">
                      · {formatInt(i.caption_count)} caption{i.caption_count === 1 ? "" : "s"}
                    </span>
                    <span className="ml-auto">
                      <DeleteImage
                        id={i.id}
                        url={i.url}
                        captions={i.caption_count}
                        action={deleteImage.bind(null, i.id)}
                      />
                    </span>
                  </header>

                  {i.description && (
                    <p className="line-clamp-2 text-xs text-muted" title={i.description}>
                      {i.description}
                    </p>
                  )}

                  {i.captions.length === 0 ? (
                    <p className="rounded bg-bg px-2 py-3 text-center text-xs text-muted">
                      No captions generated for this image yet.
                    </p>
                  ) : (
                    <div className="rounded bg-bg">
                      <CaptionList captions={i.captions.slice(0, SHOWN)} href={provenanceHref} />
                      {i.captions.length > SHOWN && (
                        <details>
                          <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] text-muted hover:text-text">
                            show all {i.captions.length} captions
                          </summary>
                          <CaptionList captions={i.captions.slice(SHOWN)} href={provenanceHref} />
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          <Panel>
            <Pagination path={PATH} sp={sp} page={page} total={result.total} />
          </Panel>
        </>
      )}

      {Number.isSafeInteger(drawerId) && drawerId > 0 && (
        <ProvenanceDrawer
          id={drawerId}
          closeHref={hrefWith(PATH, sp, { caption: null, page: String(page) })}
        />
      )}
    </>
  );
}

function CaptionList({
  captions,
  href,
}: {
  captions: ImageCaption[];
  href: (id: number) => string;
}) {
  return (
    <ul className="text-xs">
      <li className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem_2.5rem_5.5rem] gap-2 px-2 pt-1.5 text-[10px] uppercase tracking-wider text-muted">
        <span>Status</span>
        <span>Caption</span>
        <span className="text-right">Score</span>
        <span className="text-right">Votes</span>
        <span />
      </li>
      {captions.map((c) => (
        <li
          key={c.id}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem_2.5rem_5.5rem] items-center gap-2 px-2 py-1.5 hover:bg-card-hover"
        >
          <span>{c.is_public ? <Badge tone="accent">published</Badge> : <Badge>draft</Badge>}</span>
          <span className="truncate" title={c.content}>
            {c.content}
          </span>
          <span className="text-right">{formatSigned(c.like_count)}</span>
          <span className="text-right">{formatInt(c.vote_count)}</span>
          <Link
            href={href(c.id)}
            scroll={false}
            className="justify-self-end rounded-[6px] bg-white/5 px-2 py-0.5 text-[11px] text-muted hover:bg-card-hover hover:text-text"
          >
            Provenance
          </Link>
        </li>
      ))}
    </ul>
  );
}
