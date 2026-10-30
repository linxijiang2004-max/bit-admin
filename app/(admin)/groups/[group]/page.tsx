import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInt } from "@/lib/admin/format";
import { groupNumbers, type KeyNumber } from "@/lib/admin/groups";
import { Section } from "../../section";
import { GROUPS, type Group } from "../../sections";
import { ErrorNote } from "../../ui";

// What's in a group: one card per page, saying what it's for and its
// headline numbers, so the pages are told apart before they're opened.
export default function GroupPage({ params }: PageProps<"/groups/[group]">) {
  // params is URL data: read it inside a Suspense boundary so navigation
  // to the page can start instantly.
  return (
    <Suspense fallback={null}>
      <GroupSection params={params} />
    </Suspense>
  );
}

async function GroupSection({ params }: { params: Promise<{ group: string }> }) {
  const { group: slug } = await params;
  const group = GROUPS.find((g) => g.slug === slug);
  if (!group) notFound();

  return (
    <Section title={group.title} description={group.purpose}>
      <GroupCards group={group} />
    </Section>
  );
}

async function GroupCards({ group }: { group: Group }) {
  let numbers: Record<string, KeyNumber[]>;
  try {
    numbers = await groupNumbers(group.slug);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }

  return (
    <ul className="grid gap-4 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
      {group.pages.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            className="group flex h-full flex-col gap-4 rounded-card bg-card p-5 hover:bg-card-hover"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[20px] font-semibold">{p.label}</h2>
              <span aria-hidden className="text-[18px] text-muted group-hover:text-accent">
                →
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-muted">{p.purpose}</p>
            <dl className="mt-auto flex gap-8">
              {(numbers[p.href] ?? []).map((n) => (
                <div key={n.label} className="flex flex-col-reverse">
                  <dt className="mt-1.5 text-[13px] text-muted">{n.label}</dt>
                  <dd className="text-[28px] font-semibold leading-none">{formatInt(n.value)}</dd>
                </div>
              ))}
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}
