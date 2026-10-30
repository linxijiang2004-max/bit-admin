import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInt } from "@/lib/admin/format";
import { IMAGE_PAGE_SIZE, listImageTiles, type ImageTile } from "@/lib/admin/images";
import { clampPage, hrefWith, one, pageOf, pick, type SearchParams } from "@/lib/admin/params";
import { requireSuperadmin } from "@/lib/auth/server";
import { FilterTabs, Pagination } from "../list-controls";
import { Section } from "../section";
import { SelectNav } from "../select-nav";
import { Empty, ErrorNote } from "../ui";
import { uploadImage } from "../media/actions";
import { UploadTile } from "./upload-tile";

const PATH = "/images";

// All images, or the ones nothing was generated from. Sort is a separate,
// quieter control (and moot for unused images).
const VIEWS = ["all", "unused"] as const;
const SORTS = ["newest", "captions", "votes"] as const;

export default function ImagesPage({ searchParams }: PageProps<"/images">) {
  return (
    <Section href={PATH}>
      <ImagesContent searchParams={searchParams} />
    </Section>
  );
}

async function ImagesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const view = pick(one(sp, "view"), VIEWS, "all");
  const sort = pick(one(sp, "sort"), SORTS, "newest");
  const page = pageOf(sp);
  const deleted = Number(one(sp, "deleted"));
  const orphan = one(sp, "orphan");

  let result, admin;
  try {
    [result, admin] = await Promise.all([
      listImageTiles({ page, sort: view === "unused" ? "unused" : sort }),
      requireSuperadmin(),
    ]);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (result.rows.length === 0 && result.total > 0 && page > 1) {
    redirect(hrefWith(PATH, sp, { page: String(clampPage(page, result.total, IMAGE_PAGE_SIZE)) }));
  }

  return (
    <div className="flex flex-col gap-4">
      {Number.isSafeInteger(deleted) && deleted > 0 && (
        <p role="status" className="rounded-card bg-card px-4 py-3">
          Deleted image #{deleted}
          {orphan ? (
            <>
              , but its file is still in Storage. Remove{" "}
              <span className="font-mono text-accent">{orphan}</span> in Supabase → Storage → images.
            </>
          ) : (
            " and everything under it."
          )}{" "}
          <Link href={hrefWith(PATH, sp, { deleted: null, orphan: null })} className="text-muted hover:text-text">
            dismiss
          </Link>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          path={PATH}
          sp={sp}
          param="view"
          current={view}
          options={[
            { value: "all", label: "All" },
            { value: "unused", label: "Unused" },
          ]}
        />
        {view !== "unused" && (
          <SelectNav
            label="Sort"
            value={sort}
            options={[
              { value: "newest", label: "Newest" },
              { value: "captions", label: "Most captions" },
              { value: "votes", label: "Most votes" },
            ].map((o) => ({ ...o, href: hrefWith(PATH, sp, { sort: o.value === "newest" ? null : o.value }) }))}
          />
        )}
        <span className="ml-auto text-[14px] text-muted">
          {formatInt(result.total)} image{result.total === 1 ? "" : "s"}
          {view === "unused" && " with no captions"}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-4 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-5">
        <li>
          <UploadTile action={uploadImage} adminId={admin.id} />
        </li>
        {result.rows.map((i) => (
          <li key={i.id}>
            <Tile image={i} />
          </li>
        ))}
      </ul>
      {result.rows.length === 0 && (
        <Empty>
          {view === "unused"
            ? "Every image has at least one caption."
            : "No images yet. Upload one, or they appear here once someone uploads in bit."}
        </Empty>
      )}

      {result.total > IMAGE_PAGE_SIZE && (
        <Pagination path={PATH} sp={sp} page={page} total={result.total} size={IMAGE_PAGE_SIZE} />
      )}
    </div>
  );
}

function Tile({ image: i }: { image: ImageTile }) {
  const label = `Image #${i.id}: ${i.caption_count} caption${i.caption_count === 1 ? "" : "s"}${
    i.published_count ? `, ${i.published_count} published` : ""
  }`;
  return (
    <Link
      href={`${PATH}/${i.id}`}
      aria-label={label}
      className="group relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-card"
    >
      {/* Arbitrary user/remote URLs; next/image would need every host allowlisted. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={i.url}
        alt=""
        loading="lazy"
        className="size-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
      />
      <span className="absolute bottom-2.5 left-2.5 flex h-7 items-center gap-1.5 rounded-full bg-black/40 px-3 text-[13px] text-white backdrop-blur-[8px]">
        <span>
          {formatInt(i.caption_count)} caption{i.caption_count === 1 ? "" : "s"}
        </span>
        {i.published_count > 0 && (
          <>
            <span aria-hidden className="text-white/50">
              ·
            </span>
            <span>{formatInt(i.published_count)} published</span>
          </>
        )}
      </span>
    </Link>
  );
}
