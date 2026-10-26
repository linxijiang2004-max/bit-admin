import { formatDate, formatInt } from "@/lib/admin/format";
import { redirect } from "next/navigation";
import { clampPage, dirOf, hrefWith, one, pageOf, pick, type SearchParams } from "@/lib/admin/params";
import { listPeople, PEOPLE_SORTS } from "@/lib/admin/people";
import { Pagination, SortTh } from "../list-controls";
import { Panel, Section } from "../section";
import { Badge, Empty, ErrorNote, Table, Td, Th, Thumb, Tr } from "../ui";

const PATH = "/people";

export default function PeoplePage({ searchParams }: PageProps<"/people">) {
  return (
    <Section title="People">
      <PeopleTable searchParams={searchParams} />
    </Section>
  );
}

async function PeopleTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const sort = pick(one(sp, "sort"), PEOPLE_SORTS, "created_at");
  const dir = dirOf(sp);
  const page = pageOf(sp);

  let result;
  try {
    result = await listPeople({ sort, dir, page });
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (result.rows.length === 0 && result.total > 0 && page > 1) {
    redirect(hrefWith(PATH, sp, { page: String(clampPage(page, result.total)) }));
  }
  const sortProps = { path: PATH, sp, sort, dir };

  return (
    <Panel>
      <p className="mb-2 text-xs text-muted">
        Read only by design: profiles can&apos;t be edited or deleted here. Favorites
        show as counts only; who favorited what stays private.
      </p>

      {result.rows.length === 0 ? (
        <Empty>No one has signed up yet. Profiles appear after a first Google sign-in to bit.</Empty>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th />
                <Th>Name</Th>
                <Th>Email</Th>
                <SortTh label="Joined" column="created_at" {...sortProps} />
                <SortTh label="Images" column="images_uploaded" num {...sortProps} />
                <SortTh label="Captions" column="captions_authored" num {...sortProps} />
                <SortTh label="Published" column="captions_published" num {...sortProps} />
                <SortTh label="Publish rate" column="publish_rate" num {...sortProps} />
                <SortTh label="Votes cast" column="votes_cast" num {...sortProps} />
                <Th num>Favs received</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((p) => (
                <Tr key={p.id}>
                  <Td className="w-8">
                    {p.avatar_url ? (
                      <Thumb url={p.avatar_url} size={22} />
                    ) : (
                      <div className="size-[22px] rounded bg-white/5" />
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {fullName(p) || <span className="text-muted">—</span>}
                    {p.is_superadmin && (
                      <span className="ml-1.5">
                        <Badge tone="accent">superadmin</Badge>
                      </span>
                    )}
                  </Td>
                  <Td muted>{p.email ?? "—"}</Td>
                  <Td muted className="whitespace-nowrap">
                    {formatDate(p.created_at)}
                  </Td>
                  <Td num>{formatInt(p.images_uploaded)}</Td>
                  <Td num>{formatInt(p.captions_authored)}</Td>
                  <Td num>{formatInt(p.captions_published)}</Td>
                  <Td num muted={p.publish_rate === null}>
                    {p.publish_rate === null ? "–" : `${p.publish_rate.toFixed(1)}%`}
                  </Td>
                  <Td num>{formatInt(p.votes_cast)}</Td>
                  <Td num>{formatInt(p.favorites_received)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination path={PATH} sp={sp} page={page} total={result.total} />
        </>
      )}
    </Panel>
  );
}

function fullName(p: { first_name: string | null; last_name: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}
