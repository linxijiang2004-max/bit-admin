import { redirect } from "next/navigation";
import { listDomains, listEmails, type DomainRow, type EmailRow } from "@/lib/admin/access";
import { formatDate, formatInt } from "@/lib/admin/format";
import { clampPage, hrefWith, pageOf, type SearchParams } from "@/lib/admin/params";
import { DeleteDialog, FormDialog } from "../dialogs";
import { Field, fieldClass, Mono } from "../fields";
import { Pagination } from "../list-controls";
import { Panel, Section } from "../section";
import { Empty, ErrorNote, Table, Td, Th, Tr } from "../ui";
import {
  createDomain,
  createEmail,
  deleteDomain,
  deleteEmail,
  updateDomain,
  updateEmail,
} from "./actions";

const PATH = "/access";

export default function AccessPage({ searchParams }: PageProps<"/access">) {
  return (
    <Section title="Access">
      <AccessContent searchParams={searchParams} />
    </Section>
  );
}

async function AccessContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const dPage = pageOf(sp, "dp");
  const ePage = pageOf(sp, "wp");

  let domains, emails;
  try {
    [domains, emails] = await Promise.all([listDomains({ page: dPage }), listEmails({ page: ePage })]);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (domains.rows.length === 0 && domains.total > 0 && dPage > 1) {
    redirect(hrefWith(PATH, sp, { dp: String(clampPage(dPage, domains.total)) }));
  }
  if (emails.rows.length === 0 && emails.total > 0 && ePage > 1) {
    redirect(hrefWith(PATH, sp, { wp: String(clampPage(ePage, emails.total)) }));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-card bg-card px-3 py-2 text-xs text-muted">
        These lists are managed here but are <span className="text-text">not yet enforced at signup</span>;
        editing them does not change who can sign up today.
      </p>

      <Panel>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Allowed signup domains · {formatInt(domains.total)}
          </h2>
          <FormDialog trigger="new" title="New domain" submitLabel="Add" action={createDomain}>
            <DomainFields />
          </FormDialog>
        </div>
        {domains.rows.length === 0 ? (
          <Empty>No domains listed.</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Domain</Th>
                  <Th>Note</Th>
                  <Th>Added (UTC)</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {domains.rows.map((d) => (
                  <Tr key={d.id}>
                    <Td>
                      <Mono>{d.domain}</Mono>
                    </Td>
                    <Td muted>{d.note ?? "—"}</Td>
                    <Td muted className="whitespace-nowrap">
                      {formatDate(d.created_at)}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <FormDialog trigger="edit" title={`Edit ${d.domain}`} action={updateDomain.bind(null, d.id)}>
                          <DomainFields d={d} />
                        </FormDialog>
                        <DeleteDialog title={`Remove ${d.domain}?`} action={deleteDomain.bind(null, d.id)}>
                          <p>The domain is removed from the list permanently.</p>
                        </DeleteDialog>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={dPage} total={domains.total} param="dp" />
          </>
        )}
      </Panel>

      <Panel>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Whitelisted emails · {formatInt(emails.total)}
          </h2>
          <FormDialog trigger="new" title="New email" submitLabel="Add" action={createEmail}>
            <EmailFields />
          </FormDialog>
        </div>
        {emails.rows.length === 0 ? (
          <Empty>No emails listed.</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Note</Th>
                  <Th>Added (UTC)</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {emails.rows.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      <Mono>{e.email}</Mono>
                    </Td>
                    <Td muted>{e.note ?? "—"}</Td>
                    <Td muted className="whitespace-nowrap">
                      {formatDate(e.created_at)}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <FormDialog trigger="edit" title={`Edit ${e.email}`} action={updateEmail.bind(null, e.id)}>
                          <EmailFields e={e} />
                        </FormDialog>
                        <DeleteDialog title={`Remove ${e.email}?`} action={deleteEmail.bind(null, e.id)}>
                          <p>The email is removed from the list permanently.</p>
                        </DeleteDialog>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={ePage} total={emails.total} param="wp" />
          </>
        )}
      </Panel>
    </div>
  );
}

function DomainFields({ d }: { d?: DomainRow }) {
  return (
    <>
      <Field label="Domain" hint="bare domain only: no https://, no @, no path. Stored lowercased.">
        <input
          name="domain"
          required
          maxLength={253}
          defaultValue={d?.domain}
          placeholder="columbia.edu"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
          className={`${fieldClass} font-mono`}
        />
      </Field>
      <Field label="Note" hint="optional">
        <input name="note" maxLength={500} defaultValue={d?.note ?? ""} className={fieldClass} />
      </Field>
    </>
  );
}

function EmailFields({ e }: { e?: EmailRow }) {
  return (
    <>
      <Field label="Email" hint="stored lowercased">
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          defaultValue={e?.email}
          placeholder="name@example.com"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
          className={`${fieldClass} font-mono`}
        />
      </Field>
      <Field label="Note" hint="optional">
        <input name="note" maxLength={500} defaultValue={e?.note ?? ""} className={fieldClass} />
      </Field>
    </>
  );
}
