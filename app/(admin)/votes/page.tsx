import Link from "next/link";
import { formatDateTime, formatInt, formatPct } from "@/lib/admin/format";
import { redirect } from "next/navigation";
import { clampPage, dateOf, hrefWith, one, pageOf, pick, type SearchParams } from "@/lib/admin/params";
import { listVotes, VOTE_DIRECTIONS } from "@/lib/admin/votes";
import { FilterTabs, inputClass, Pagination } from "../list-controls";
import { Panel, Section } from "../section";
import { Empty, ErrorNote, Stat, Table, Td, Th, Tr } from "../ui";

const PATH = "/votes";

export default function VotesPage({ searchParams }: PageProps<"/votes">) {
  return (
    <Section title="Votes">
      <VotesContent searchParams={searchParams} />
    </Section>
  );
}

async function VotesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const direction = pick(one(sp, "vote"), VOTE_DIRECTIONS, "all");
  const from = dateOf(sp, "from");
  const to = dateOf(sp, "to");
  const page = pageOf(sp);

  let result;
  try {
    result = await listVotes({ direction, from, to, page });
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  const { rows, summary: s, filteredTotal } = result;
  if (rows.length === 0 && filteredTotal > 0 && page > 1) {
    redirect(hrefWith(PATH, sp, { page: String(clampPage(page, filteredTotal)) }));
  }
  const filtered = direction !== "all" || !!from || !!to;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Total votes" value={formatInt(s.total)} />
        <Stat label="Upvotes ▲" value={formatInt(s.up)} detail={formatPct(s.up, s.total)} />
        <Stat label="Downvotes ▼" value={formatInt(s.down)} detail={formatPct(s.down, s.total)} />
        <Stat label="Last 7 days" value={formatInt(s.last7)} />
      </div>

      <Panel>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FilterTabs
            path={PATH}
            sp={sp}
            param="vote"
            current={direction}
            options={[
              { value: "all", label: "All" },
              { value: "up", label: "▲ Up" },
              { value: "down", label: "▼ Down" },
            ]}
          />
          <form action={PATH} className="flex items-center gap-1.5 text-xs text-muted">
            {direction !== "all" && <input type="hidden" name="vote" value={direction} />}
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
              href={hrefWith(PATH, sp, { vote: null, from: null, to: null })}
              className="text-xs text-muted hover:text-text"
            >
              clear filters
            </Link>
          )}
          <span className="ml-auto text-xs text-muted">Read only · newest first · dates in UTC</span>
        </div>

        {rows.length === 0 ? (
          <Empty>
            {filtered ? "No votes match these filters." : "No one has voted yet. Votes appear here as people rate captions in bit."}
          </Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Caption</Th>
                  <Th>Voter</Th>
                  <Th num>Vote</Th>
                  <Th>When (UTC)</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <Tr key={v.id}>
                    <Td className="max-w-[36rem]">
                      {v.caption ? (
                        <span className="line-clamp-1" title={v.caption.content}>
                          {v.caption.content}
                        </span>
                      ) : (
                        <span className="text-muted">caption {v.caption_id}</span>
                      )}
                    </Td>
                    <Td muted className="whitespace-nowrap">
                      {voterName(v.voter)}
                    </Td>
                    <Td num className={v.vote_value > 0 ? "text-accent" : "text-muted"}>
                      {v.vote_value > 0 ? "+1" : "−1"}
                    </Td>
                    <Td muted className="whitespace-nowrap">
                      {formatDateTime(v.created_at)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={page} total={filteredTotal} />
          </>
        )}
      </Panel>
    </div>
  );
}

function voterName(
  p: { first_name: string | null; last_name: string | null; email: string | null } | null,
) {
  if (!p) return "—";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—";
}
