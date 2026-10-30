import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import { clampPage, dateOf, hrefWith, one, pageOf, type SearchParams } from "@/lib/admin/params";
import { getResponses, listRequests, modelStringChoices } from "@/lib/admin/responses";
import { CodeBlock, Mono } from "../fields";
import { HiddenParams, inputClass, Pagination } from "../list-controls";
import { Panel, Section } from "../section";
import { Empty, ErrorNote, Table, Td, Th, Thumb, Tr } from "../ui";

const PATH = "/responses";
const COLUMNS = 8;

export default function ResponsesPage({ searchParams }: PageProps<"/responses">) {
  return (
    <Section href={PATH}>
      <ResponsesContent searchParams={searchParams} />
    </Section>
  );
}

async function ResponsesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const model = (one(sp, "model") ?? "").trim().slice(0, 200);
  const from = dateOf(sp, "from");
  const to = dateOf(sp, "to");
  const page = pageOf(sp);
  const openId = Number(one(sp, "open"));

  let result, modelChoices;
  try {
    [result, modelChoices] = await Promise.all([
      listRequests({ model, from, to, page }),
      modelStringChoices(),
    ]);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (result.rows.length === 0 && result.total > 0 && page > 1) {
    redirect(hrefWith(PATH, sp, { page: String(clampPage(page, result.total)) }));
  }
  const filtered = model !== "" || !!from || !!to;

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form action={PATH} className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
          <HiddenParams sp={sp} omit={["model", "from", "to", "page", "open"]} />
          <input
            name="model"
            type="search"
            list="model-strings"
            defaultValue={model}
            placeholder="model string (exact)"
            aria-label="Model string"
            spellCheck={false}
            className={`${inputClass} w-64 font-mono`}
          />
          <datalist id="model-strings">
            {modelChoices.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <label className="flex items-center gap-1">
            from
            <input type="date" name="from" defaultValue={from} className={inputClass} />
          </label>
          <label className="flex items-center gap-1">
            to
            <input type="date" name="to" defaultValue={to} className={inputClass} />
          </label>
          <button type="submit" className="rounded-card bg-white/5 px-3 py-2 text-text hover:bg-card-hover">
            apply
          </button>
        </form>
        {filtered && (
          <Link
            href={hrefWith(PATH, sp, { model: null, from: null, to: null, open: null })}
            className="text-[13px] text-muted hover:text-text"
          >
            clear filters
          </Link>
        )}
        <span className="ml-auto text-[13px] text-muted">Read only · newest first · dates in UTC</span>
      </div>

      {result.rows.length === 0 ? (
        <Empty>
          {filtered
            ? "No generation requests match these filters."
            : "No generation requests yet. They appear here once someone generates captions in bit."}
        </Empty>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th />
                <Th num>Request</Th>
                <Th />
                <Th>Image</Th>
                <Th>Author</Th>
                <Th>Models</Th>
                <Th num>Steps</Th>
                <Th>Created (UTC)</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const open = openId === r.id;
                return (
                  <Fragment key={r.id}>
                    <Tr>
                      <Td className="w-6">
                        <Link
                          href={hrefWith(PATH, sp, { open: open ? null : String(r.id), page: String(page) })}
                          scroll={false}
                          aria-expanded={open}
                          aria-label={`${open ? "Hide" : "Show"} LLM responses for request ${r.id}`}
                          className="inline-flex size-8 items-center justify-center rounded-[6px] text-[20px] leading-none text-muted hover:bg-white/5 hover:text-text"
                        >
                          {open ? "▾" : "▸"}
                        </Link>
                      </Td>
                      <Td num muted>
                        {r.id}
                      </Td>
                      <Td className="w-10">
                        {r.image ? <Thumb url={r.image.url} /> : <div className="size-8 rounded bg-bg" />}
                      </Td>
                      <Td muted className="max-w-[22rem]">
                        {r.image_id === null ? (
                          "—"
                        ) : (
                          <span className="line-clamp-1" title={r.image?.description ?? undefined}>
                            #{r.image_id}
                            {r.image?.description ? ` · ${r.image.description}` : r.image ? "" : " (deleted)"}
                          </span>
                        )}
                      </Td>
                      <Td muted className="whitespace-nowrap">
                        {r.author ?? (r.profile_id ? r.profile_id.slice(0, 8) : "—")}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-x-2">
                          {r.models.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : (
                            r.models.map((m) => (
                              <Mono key={m}>
                                <span className={m === model ? "text-accent" : undefined}>{m}</span>
                              </Mono>
                            ))
                          )}
                        </div>
                      </Td>
                      <Td num>{formatInt(r.step_count)}</Td>
                      <Td muted className="whitespace-nowrap">
                        {formatDateTime(r.created_at)}
                      </Td>
                    </Tr>
                    {open && (
                      <tr>
                        <td colSpan={COLUMNS} className="bg-bg/60 px-3 py-2">
                          <Responses requestId={r.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
          <Pagination path={PATH} sp={sp} page={page} total={result.total} />
        </>
      )}
    </Panel>
  );
}

async function Responses({ requestId }: { requestId: number }) {
  let steps;
  try {
    steps = await getResponses(requestId);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (steps.length === 0) return <Empty>This request recorded no LLM responses.</Empty>;

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s) => (
        <li key={s.id} className="flex flex-col gap-1.5 rounded-card bg-card p-2.5">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="font-mono text-accent">{s.step_index}</span>
            <span className="font-medium">{s.step_name}</span>
            <span className="ml-auto text-muted">
              <Mono>{s.model}</Mono> · {formatDateTime(s.created_at)}
            </span>
          </div>
          <CodeBlock label="Prompt" text={s.prompt} />
          <CodeBlock label="Raw output" text={s.raw_output} open />
        </li>
      ))}
    </ol>
  );
}
