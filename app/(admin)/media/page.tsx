import Link from "next/link";
import {
  CAPTION_SORTS,
  CAPTION_STATUSES,
  listCaptions,
  listImageChoices,
} from "@/lib/admin/captions";
import { formatDateTime, formatInt, formatSigned } from "@/lib/admin/format";
import { requireSuperadmin } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import {
  clampPage,
  dateOf,
  dirOf,
  hrefWith,
  one,
  pageOf,
  pick,
  type SearchParams,
} from "@/lib/admin/params";
import { FilterTabs, inputClass, Pagination, SortTh } from "../list-controls";
import { Panel, Section } from "../section";
import { Badge, Empty, ErrorNote, Table, Td, Th, Thumb, Tr } from "../ui";
import { createCaption, deleteCaption, updateCaption } from "./actions";
import { CaptionEditor } from "./caption-editor";
import { CreateCaption } from "./create-caption";
import { DeleteCaption } from "./delete-caption";
import { ImagesView } from "./images-view";
import { ProvenanceDrawer } from "./provenance-drawer";

const PATH = "/media";

export default function MediaPage({ searchParams }: PageProps<"/media">) {
  return (
    <Section title="Media">
      <MediaContent searchParams={searchParams} />
    </Section>
  );
}

async function MediaContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const view = one(sp, "view") === "images" ? "images" : "captions";

  return (
    <div className="flex flex-col gap-2">
      <nav className="flex gap-1 text-xs" aria-label="Media views">
        {(
          [
            ["captions", "AI captions", PATH],
            ["images", "Images", `${PATH}?view=images`],
          ] as const
        ).map(([value, label, href]) => (
          <Link
            key={value}
            href={href}
            aria-current={view === value ? "page" : undefined}
            className={`rounded-card px-3 py-1.5 ${
              view === value ? "bg-card text-text" : "text-muted hover:text-text"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {view === "images" ? <ImagesView sp={sp} /> : <CaptionsView sp={sp} />}
    </div>
  );
}

async function CaptionsView({ sp }: { sp: SearchParams }) {
  const status = pick(one(sp, "status"), CAPTION_STATUSES, "all");
  const q = (one(sp, "q") ?? "").trim().slice(0, 200);
  const sort = pick(one(sp, "sort"), CAPTION_SORTS, "created_at");
  const dir = dirOf(sp);
  const from = dateOf(sp, "from");
  const to = dateOf(sp, "to");
  const page = pageOf(sp);
  const drawerId = Number(one(sp, "caption"));

  let list, images, admin;
  try {
    [list, images, admin] = await Promise.all([
      listCaptions({ status, q, from, to, sort, dir, page }),
      listImageChoices(),
      requireSuperadmin(),
    ]);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }

  if (list.rows.length === 0 && list.total > 0 && page > 1) {
    redirect(hrefWith(PATH, sp, { page: String(clampPage(page, list.total)) }));
  }

  const sortProps = { path: PATH, sp, sort, dir };
  const filtered = status !== "all" || q !== "" || !!from || !!to;

  return (
    <>
      <details className="group rounded-card bg-card">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted hover:text-text">
          <span className="text-accent group-open:hidden">+</span>
          <span className="hidden text-accent group-open:inline">−</span> New caption
        </summary>
        <div className="px-3 pb-3">
          <CreateCaption action={createCaption} images={images} adminId={admin.id} />
        </div>
      </details>

      <Panel>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FilterTabs
            path={PATH}
            sp={sp}
            param="status"
            current={status}
            options={[
              { value: "all", label: "All" },
              { value: "published", label: "Published" },
              { value: "unpublished", label: "Unpublished" },
            ]}
          />
          {/* Search and created-date range submit together, keeping status/sort. */}
          <form action={PATH} className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="search caption text"
              className={`${inputClass} w-56`}
            />
            <label className="flex items-center gap-1">
              from
              <input type="date" name="from" defaultValue={from} className={inputClass} />
            </label>
            <label className="flex items-center gap-1">
              to
              <input type="date" name="to" defaultValue={to} className={inputClass} />
            </label>
            <button type="submit" className="rounded-card px-2 py-1 hover:text-text">
              apply
            </button>
          </form>
          {filtered && (
            <Link
              href={hrefWith(PATH, sp, { status: null, q: null, from: null, to: null })}
              className="text-xs text-muted hover:text-text"
            >
              clear filters
            </Link>
          )}
        </div>

        {list.rows.length === 0 ? (
          <Empty>
            {filtered
              ? "No captions match these filters."
              : "No captions yet. Captions appear here once someone generates them in bit, or create one above."}
          </Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th />
                  <SortTh label="ID" column="id" num {...sortProps} />
                  <Th>Caption</Th>
                  <Th>Author</Th>
                  <Th>Status</Th>
                  <SortTh label="Score" column="like_count" num {...sortProps} />
                  <SortTh label="Votes" column="vote_count" num {...sortProps} />
                  <SortTh label="Favs" column="favorites" num {...sortProps} />
                  <SortTh label="Created (UTC)" column="created_at" {...sortProps} />
                  <Th />
                </tr>
              </thead>
              <tbody>
                {list.rows.map((c) => (
                  <Tr key={c.id}>
                    <Td className="w-10">
                      {c.image_url ? <Thumb url={c.image_url} /> : <div className="size-8 rounded bg-bg" />}
                    </Td>
                    <Td num muted>
                      {c.id}
                    </Td>
                    <Td className="min-w-[18rem] max-w-[34rem]">
                      <CaptionEditor
                        key={`${c.id}:${c.content}:${c.is_public}`}
                        content={c.content}
                        isPublic={c.is_public}
                        action={updateCaption.bind(null, c.id)}
                      />
                    </Td>
                    <Td muted className="whitespace-nowrap">
                      {authorName(c) ?? "—"}
                    </Td>
                    <Td>{c.is_public ? <Badge tone="accent">published</Badge> : <Badge>draft</Badge>}</Td>
                    <Td num>{formatSigned(c.like_count)}</Td>
                    <Td num>{formatInt(c.vote_count)}</Td>
                    <Td num>{formatInt(c.favorites)}</Td>
                    <Td muted className="whitespace-nowrap">
                      {formatDateTime(c.created_at)}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Link
                          href={hrefWith(PATH, sp, { caption: String(c.id), page: String(page) })}
                          scroll={false}
                          className="rounded-[6px] bg-white/5 px-2 py-0.5 text-[11px] text-muted hover:bg-card-hover hover:text-text"
                        >
                          Provenance
                        </Link>
                        <DeleteCaption
                          id={c.id}
                          content={c.content}
                          isPublic={c.is_public}
                          votes={c.vote_count}
                          favorites={c.favorites}
                          deleteAction={deleteCaption.bind(null, c.id)}
                          unpublishAction={updateCaption.bind(null, c.id)}
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={page} total={list.total} />
          </>
        )}
      </Panel>

      {Number.isSafeInteger(drawerId) && drawerId > 0 && (
        <ProvenanceDrawer id={drawerId} closeHref={hrefWith(PATH, sp, { caption: null, page: String(page) })} />
      )}
    </>
  );
}

function authorName(c: {
  author_first_name: string | null;
  author_last_name: string | null;
  author_email: string | null;
}) {
  return [c.author_first_name, c.author_last_name].filter(Boolean).join(" ") || c.author_email;
}
