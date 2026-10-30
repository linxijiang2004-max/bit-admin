import { redirect } from "next/navigation";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import { listImages, type ImageListRow } from "@/lib/admin/images";
import { clampPage, hrefWith, pageOf, type SearchParams } from "@/lib/admin/params";
import { requireSuperadmin } from "@/lib/auth/server";
import { DeleteDialog, FormDialog } from "../dialogs";
import { Check, Field, fieldClass } from "../fields";
import { Pagination } from "../list-controls";
import { Panel } from "../section";
import { Badge, Empty, ErrorNote, Table, Td, Th, Thumb, Tr } from "../ui";
import { deleteImage, updateImage, uploadImage } from "./actions";
import { UploadImage } from "./upload-image";

const PATH = "/media";

// Images tab: upload, edit description / library flag, delete (cascading).
export async function ImagesView({ sp }: { sp: SearchParams }) {
  const page = pageOf(sp);

  let result, admin;
  try {
    [result, admin] = await Promise.all([listImages({ page }), requireSuperadmin()]);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (result.rows.length === 0 && result.total > 0 && page > 1) {
    redirect(hrefWith(PATH, sp, { page: String(clampPage(page, result.total)) }));
  }

  return (
    <>
      <details className="group rounded-card bg-card">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted hover:text-text">
          <span className="text-accent group-open:hidden">+</span>
          <span className="hidden text-accent group-open:inline">−</span> Upload image
        </summary>
        <div className="px-3 pb-3">
          <UploadImage action={uploadImage} adminId={admin.id} />
        </div>
      </details>

      <Panel>
        <p className="mb-2 text-xs text-muted">{formatInt(result.total)} images · newest first</p>
        {result.rows.length === 0 ? (
          <Empty>No images yet. Upload one above, or they appear here once someone uploads in bit.</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th />
                  <Th num>ID</Th>
                  <Th>Description</Th>
                  <Th>Library</Th>
                  <Th>Owner</Th>
                  <Th num>Captions</Th>
                  <Th>Created (UTC)</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((i) => (
                  <Tr key={i.id}>
                    <Td className="w-12">
                      <a href={i.url} target="_blank" rel="noreferrer" title="Open full size">
                        <Thumb url={i.url} size={40} />
                      </a>
                    </Td>
                    <Td num muted>
                      {i.id}
                    </Td>
                    <Td className="min-w-[16rem] max-w-[32rem]">
                      {i.description ? (
                        <span className="line-clamp-2" title={i.description}>
                          {i.description}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>{i.is_library ? <Badge tone="accent">library</Badge> : <Badge>upload</Badge>}</Td>
                    <Td muted className="whitespace-nowrap">
                      {ownerName(i)}
                    </Td>
                    <Td num>{formatInt(i.caption_count)}</Td>
                    <Td muted className="whitespace-nowrap">
                      {formatDateTime(i.created_at)}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <FormDialog trigger="edit" title={`Edit image #${i.id}`} action={updateImage.bind(null, i.id)}>
                          <ImageFields i={i} />
                        </FormDialog>
                        <DeleteDialog title={`Delete image #${i.id} permanently?`} action={deleteImage.bind(null, i.id)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={i.url} alt="" className="max-h-40 w-full rounded bg-bg object-contain" />
                          {i.caption_count > 0 ? (
                            <p>
                              Deleting this image also deletes{" "}
                              <span className="text-danger">
                                its {formatInt(i.caption_count)} caption{i.caption_count === 1 ? "" : "s"} and the{" "}
                                {formatInt(i.vote_count)} vote{i.vote_count === 1 ? "" : "s"} on them
                              </span>{" "}
                              (and any favorites) through cascade. None of it can be recovered.
                            </p>
                          ) : (
                            <p>This image has no captions, so nothing else is deleted with it.</p>
                          )}
                          <p>If the file was uploaded to Storage it is removed too, so its public link stops working.</p>
                        </DeleteDialog>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={page} total={result.total} />
          </>
        )}
      </Panel>
    </>
  );
}

function ImageFields({ i }: { i: ImageListRow }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={i.url} alt="" className="max-h-40 w-full rounded bg-bg object-contain" />
      <Field label="Description" hint="optional">
        <textarea name="description" rows={3} maxLength={2000} defaultValue={i.description ?? ""} className={fieldClass} />
      </Field>
      <Check name="is_library" label="library image" defaultChecked={i.is_library} />
    </>
  );
}

function ownerName(i: ImageListRow) {
  return (
    [i.owner_first_name, i.owner_last_name].filter(Boolean).join(" ") || i.owner_email || "seed"
  );
}
