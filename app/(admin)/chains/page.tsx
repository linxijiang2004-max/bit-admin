import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getChainSteps, listChains } from "@/lib/admin/chains";
import { formatDate, formatInt } from "@/lib/admin/format";
import { clampPage, hrefWith, one, pageOf, type SearchParams } from "@/lib/admin/params";
import { InlineForm } from "../dialogs";
import { CodeBlock, Mono } from "../fields";
import { Pagination } from "../list-controls";
import { Panel, Section } from "../section";
import { Badge, Empty, ErrorNote, Table, Td, Th, Tr } from "../ui";
import { updateMix } from "./actions";

const PATH = "/chains";
const COLUMNS = 8;

export default function ChainsPage({ searchParams }: PageProps<"/chains">) {
  return (
    <Section title="Prompt chains">
      <ChainsContent searchParams={searchParams} />
    </Section>
  );
}

async function ChainsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const page = pageOf(sp);
  const openId = Number(one(sp, "open"));

  let result;
  try {
    result = await listChains({ page });
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (result.rows.length === 0 && result.total > 0 && page > 1) {
    redirect(hrefWith(PATH, sp, { page: String(clampPage(page, result.total)) }));
  }
  const total = result.totalEnabledWeight;

  return (
    <Panel>
      <p className="mb-2 text-xs text-muted">
        Chains and their steps are read only. The mix is edit only: set each chain&apos;s
        weight and whether it&apos;s in rotation. Share = weight ÷ total weight of enabled
        chains ({formatInt(result.enabledChains)} enabled, total weight{" "}
        <span className="text-text">{formatWeight(total)}</span>).
      </p>

      {result.rows.length === 0 ? (
        <Empty>No prompt chains yet. Chains appear here once they&apos;re added to prompt_chains.</Empty>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th />
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Status</Th>
                <Th num>Steps</Th>
                <Th>Created (UTC)</Th>
                <Th>Mix · weight · enabled</Th>
                <Th num>Share</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((c) => {
                const open = openId === c.id;
                const share =
                  c.mix?.is_enabled && total > 0 ? (c.mix.weight / total) * 100 : null;
                return (
                  <Fragment key={c.id}>
                    <Tr>
                      <Td className="w-6">
                        <Link
                          href={hrefWith(PATH, sp, { open: open ? null : String(c.id), page: String(page) })}
                          scroll={false}
                          aria-expanded={open}
                          aria-label={`${open ? "Hide" : "Show"} steps of ${c.name}`}
                          className="text-muted hover:text-text"
                        >
                          {open ? "▾" : "▸"}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap font-medium">{c.name}</Td>
                      <Td muted className="max-w-[28rem]">
                        <span className="line-clamp-2" title={c.description ?? undefined}>
                          {c.description ?? "—"}
                        </span>
                      </Td>
                      <Td>{c.is_active ? <Badge tone="accent">active</Badge> : <Badge>inactive</Badge>}</Td>
                      <Td num>{formatInt(c.step_count)}</Td>
                      <Td muted className="whitespace-nowrap">
                        {formatDate(c.created_at)}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {c.mix ? (
                          <InlineForm
                            key={`${c.id}:${c.mix.weight}:${c.mix.is_enabled}`}
                            action={updateMix.bind(null, c.id)}
                          >
                            <label className="sr-only" htmlFor={`weight-${c.id}`}>
                              Weight for {c.name}
                            </label>
                            <input
                              id={`weight-${c.id}`}
                              name="weight"
                              type="number"
                              min={0}
                              step="any"
                              required
                              defaultValue={c.mix.weight}
                              className="w-20 rounded-[6px] bg-bg px-1.5 py-0.5 text-right text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                            <label className="flex items-center gap-1 text-[11px] text-muted">
                              <input
                                type="checkbox"
                                name="is_enabled"
                                defaultChecked={c.mix.is_enabled}
                                className="accent-[var(--accent)]"
                              />
                              enabled
                            </label>
                          </InlineForm>
                        ) : (
                          <span className="text-xs text-muted" title="No prompt_chain_mix row; rows are not created here">
                            not in mix
                          </span>
                        )}
                      </Td>
                      <Td num className="w-28">
                        {share === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ShareBar pct={share} />
                        )}
                      </Td>
                    </Tr>
                    {open && (
                      <tr>
                        <td colSpan={COLUMNS} className="bg-bg/60 px-3 py-2">
                          <ChainSteps chainId={c.id} />
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

async function ChainSteps({ chainId }: { chainId: number }) {
  let steps;
  try {
    steps = await getChainSteps(chainId);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (steps.length === 0) return <Empty>This chain has no steps.</Empty>;

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s) => (
        <li key={s.id} className="rounded-card bg-card p-2.5">
          <div className="mb-1.5 flex items-center gap-2 text-xs">
            <span className="font-mono text-accent">{s.step_index}</span>
            <span className="font-medium">{s.step_name}</span>
            <span className="ml-auto text-muted">
              {s.model ? (
                <>
                  {s.model.name} · <Mono>{s.model.model_string}</Mono>
                </>
              ) : s.model_id === null ? (
                "no model"
              ) : (
                `model #${s.model_id} (missing)`
              )}
            </span>
          </div>
          <CodeBlock label="Prompt template" text={s.prompt_template} open />
        </li>
      ))}
    </ol>
  );
}

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded bg-white/5" aria-hidden>
        <div className="h-full rounded bg-accent/60" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function formatWeight(n: number) {
  return Number.isInteger(n) ? formatInt(n) : n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}
