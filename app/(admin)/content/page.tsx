import Link from "next/link";
import { redirect } from "next/navigation";
import {
  chainChoices,
  EXAMPLE_POLARITIES,
  listExamples,
  listTerms,
  type ExampleRow,
  type TermRow,
} from "@/lib/admin/content";
import { formatDate, formatInt } from "@/lib/admin/format";
import { clampPage, hrefWith, one, pageOf, pick, type SearchParams } from "@/lib/admin/params";
import { DeleteDialog, FormDialog } from "../dialogs";
import { Check, Field, fieldClass } from "../fields";
import { FilterTabs, HiddenParams, inputClass, Pagination } from "../list-controls";
import { Panel, Section } from "../section";
import { Badge, Empty, ErrorNote, Table, Td, Th, Tr } from "../ui";
import {
  createExample,
  createTerm,
  deleteExample,
  deleteTerm,
  updateExample,
  updateTerm,
} from "./actions";

const PATH = "/content";

export default function ContentPage({ searchParams }: PageProps<"/content">) {
  return (
    <Section title="Content">
      <ContentBody searchParams={searchParams} />
    </Section>
  );
}

async function ContentBody({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (one(sp, "q") ?? "").trim().slice(0, 200);
  const category = (one(sp, "cat") ?? "").trim().slice(0, 100);
  const tPage = pageOf(sp, "tp");
  const polarity = pick(one(sp, "ex"), EXAMPLE_POLARITIES, "all");
  const ePage = pageOf(sp, "ep");

  let terms, examples, chains;
  try {
    [terms, examples, chains] = await Promise.all([
      listTerms({ q, category, page: tPage }),
      listExamples({ polarity, page: ePage }),
      chainChoices(),
    ]);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (terms.rows.length === 0 && terms.total > 0 && tPage > 1) {
    redirect(hrefWith(PATH, sp, { tp: String(clampPage(tPage, terms.total)) }));
  }
  if (examples.rows.length === 0 && examples.total > 0 && ePage > 1) {
    redirect(hrefWith(PATH, sp, { ep: String(clampPage(ePage, examples.total)) }));
  }
  const termsFiltered = q !== "" || category !== "";

  return (
    <div className="flex flex-col gap-2">
      <Panel>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            Terms · {formatInt(terms.total)}
          </h2>
          <form action={PATH} className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <HiddenParams sp={sp} omit={["q", "cat", "tp"]} />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="search terms"
              aria-label="Search terms"
              className={`${inputClass} w-48`}
            />
            <input
              name="cat"
              type="search"
              defaultValue={category}
              placeholder="category (exact)"
              aria-label="Category"
              className={`${inputClass} w-36`}
            />
            <button type="submit" className="rounded-card px-2 py-1 hover:text-text">
              apply
            </button>
          </form>
          {termsFiltered && (
            <Link
              href={hrefWith(PATH, sp, { q: null, cat: null, tp: null })}
              className="text-xs text-muted hover:text-text"
            >
              clear filters
            </Link>
          )}
          <span className="ml-auto">
            <FormDialog trigger="new" title="New term" submitLabel="Create" action={createTerm}>
              <TermFields />
            </FormDialog>
          </span>
        </div>

        {terms.rows.length === 0 ? (
          <Empty>{termsFiltered ? "No terms match these filters." : "No terms yet."}</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Term</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Created (UTC)</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {terms.rows.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-medium">{t.term}</Td>
                    <Td muted>
                      {t.category ? (
                        <Link href={hrefWith(PATH, sp, { cat: t.category, tp: null })} className="hover:text-text">
                          {t.category}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>{t.is_active ? <Badge tone="accent">active</Badge> : <Badge>inactive</Badge>}</Td>
                    <Td muted className="whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <FormDialog trigger="edit" title={`Edit term “${t.term}”`} action={updateTerm.bind(null, t.id)}>
                          <TermFields t={t} />
                        </FormDialog>
                        <DeleteDialog title={`Delete term “${t.term}”?`} action={deleteTerm.bind(null, t.id)}>
                          <p>The term is removed permanently. To keep it but stop using it, untick active instead.</p>
                        </DeleteDialog>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={tPage} total={terms.total} param="tp" />
          </>
        )}
      </Panel>

      <Panel>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            Generation examples · {formatInt(examples.total)}
          </h2>
          <FilterTabs
            path={PATH}
            sp={sp}
            param="ex"
            current={polarity}
            resetPage="ep"
            options={[
              { value: "all", label: "All" },
              { value: "positive", label: "Positive" },
              { value: "negative", label: "Negative" },
            ]}
          />
          <span className="ml-auto">
            {chains.length > 0 ? (
              <FormDialog trigger="new" title="New example" submitLabel="Create" action={createExample}>
                <ExampleFields chains={chains} />
              </FormDialog>
            ) : (
              <span className="text-xs text-muted">no prompt chains to attach examples to</span>
            )}
          </span>
        </div>

        {examples.rows.length === 0 ? (
          <Empty>
            {polarity === "all" ? "No generation examples yet." : `No ${polarity} examples.`}
          </Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Chain</Th>
                  <Th>Input description</Th>
                  <Th>Output caption</Th>
                  <Th>Kind</Th>
                  <Th>Notes</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {examples.rows.map((x) => (
                  <Tr key={x.id}>
                    <Td muted className="whitespace-nowrap">
                      {x.chain?.name ?? (x.chain_id === null ? "—" : `#${x.chain_id}`)}
                    </Td>
                    <Td className="min-w-[14rem] max-w-[24rem]">
                      <span className="line-clamp-3 whitespace-pre-wrap" title={x.input_description}>
                        {x.input_description}
                      </span>
                    </Td>
                    <Td className="min-w-[14rem] max-w-[24rem]">
                      <span className="line-clamp-3 whitespace-pre-wrap" title={x.output_caption}>
                        {x.output_caption}
                      </span>
                    </Td>
                    <Td>{x.is_positive ? <Badge tone="accent">positive</Badge> : <Badge>negative</Badge>}</Td>
                    <Td muted className="max-w-[16rem]">
                      <span className="line-clamp-2" title={x.notes ?? undefined}>
                        {x.notes ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <FormDialog trigger="edit" title={`Edit example #${x.id}`} action={updateExample.bind(null, x.id)}>
                          <ExampleFields x={x} chains={chains} />
                        </FormDialog>
                        <DeleteDialog title={`Delete example #${x.id}?`} action={deleteExample.bind(null, x.id)}>
                          <p className="line-clamp-3 rounded bg-bg p-2 text-text/80">{x.output_caption}</p>
                          <p>The example is removed permanently.</p>
                        </DeleteDialog>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={ePage} total={examples.total} param="ep" />
          </>
        )}
      </Panel>
    </div>
  );
}

function TermFields({ t }: { t?: TermRow }) {
  return (
    <>
      <Field label="Term">
        <input name="term" required maxLength={200} defaultValue={t?.term} className={fieldClass} />
      </Field>
      <Field label="Category" hint="optional">
        <input name="category" maxLength={100} defaultValue={t?.category ?? ""} className={fieldClass} />
      </Field>
      <Check name="is_active" label="active" defaultChecked={t ? t.is_active : true} />
    </>
  );
}

function ExampleFields({ x, chains }: { x?: ExampleRow; chains: { id: number; name: string }[] }) {
  return (
    <>
      <Field label="Chain">
        <select name="chain_id" required defaultValue={x?.chain_id ?? chains[0]?.id} className={fieldClass}>
          {chains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Input description">
        <textarea
          name="input_description"
          required
          rows={4}
          maxLength={4000}
          defaultValue={x?.input_description}
          className={fieldClass}
        />
      </Field>
      <Field label="Output caption">
        <textarea
          name="output_caption"
          required
          rows={2}
          maxLength={2000}
          defaultValue={x?.output_caption}
          className={fieldClass}
        />
      </Field>
      <fieldset className="flex gap-4 text-xs">
        <legend className="sr-only">Kind</legend>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="is_positive"
            value="true"
            defaultChecked={x ? x.is_positive : true}
            className="accent-[var(--accent)]"
          />
          positive (do this)
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="is_positive"
            value="false"
            defaultChecked={x ? !x.is_positive : false}
            className="accent-[var(--accent)]"
          />
          negative (avoid this)
        </label>
      </fieldset>
      <Field label="Notes" hint="optional">
        <textarea name="notes" rows={2} maxLength={2000} defaultValue={x?.notes ?? ""} className={fieldClass} />
      </Field>
    </>
  );
}
