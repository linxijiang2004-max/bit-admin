import { redirect } from "next/navigation";
import { formatInt } from "@/lib/admin/format";
import { listModels, listProviders, providerChoices, type ModelRow, type ProviderRow } from "@/lib/admin/models";
import { clampPage, hrefWith, pageOf, type SearchParams } from "@/lib/admin/params";
import { DeleteDialog, FormDialog } from "../dialogs";
import { Check, Field, fieldClass, Mono } from "../fields";
import { Pagination } from "../list-controls";
import { Panel, Section } from "../section";
import { Badge, Empty, ErrorNote, Table, Td, Th, Tr } from "../ui";
import {
  createModel,
  createProvider,
  deleteModel,
  deleteProvider,
  updateModel,
  updateProvider,
} from "./actions";

const PATH = "/models";

export default function ModelsPage({ searchParams }: PageProps<"/models">) {
  return (
    <Section title="Models">
      <ModelsContent searchParams={searchParams} />
    </Section>
  );
}

async function ModelsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const pPage = pageOf(sp, "pp");
  const mPage = pageOf(sp, "mp");

  let providers, models, choices;
  try {
    [providers, models, choices] = await Promise.all([
      listProviders({ page: pPage }),
      listModels({ page: mPage }),
      providerChoices(),
    ]);
  } catch (e) {
    return <ErrorNote message={(e as Error).message} />;
  }
  if (providers.rows.length === 0 && providers.total > 0 && pPage > 1) {
    redirect(hrefWith(PATH, sp, { pp: String(clampPage(pPage, providers.total)) }));
  }
  if (models.rows.length === 0 && models.total > 0 && mPage > 1) {
    redirect(hrefWith(PATH, sp, { mp: String(clampPage(mPage, models.total)) }));
  }

  return (
    <div className="flex flex-col gap-2">
      <Panel>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Providers · {formatInt(providers.total)}
          </h2>
          <FormDialog trigger="new" title="New provider" submitLabel="Create" action={createProvider}>
            <ProviderFields />
          </FormDialog>
        </div>
        {providers.rows.length === 0 ? (
          <Empty>No providers yet. Add one before adding models.</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th>Base URL</Th>
                  <Th>Status</Th>
                  <Th num>Models</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {providers.rows.map((p) => (
                  <Tr key={p.id}>
                    <Td className="whitespace-nowrap font-medium">{p.name}</Td>
                    <Td>
                      <Mono>{p.slug}</Mono>
                    </Td>
                    <Td muted className="max-w-[24rem] truncate">
                      {p.base_url ? <Mono>{p.base_url}</Mono> : "—"}
                    </Td>
                    <Td>{p.is_active ? <Badge tone="accent">active</Badge> : <Badge>inactive</Badge>}</Td>
                    <Td num>{formatInt(p.model_count)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <FormDialog trigger="edit" title={`Edit provider ${p.name}`} action={updateProvider.bind(null, p.id)}>
                          <ProviderFields p={p} />
                        </FormDialog>
                        <DeleteDialog title={`Delete provider ${p.name}?`} action={deleteProvider.bind(null, p.id)}>
                          <p>
                            Deleting a provider also deletes{" "}
                            <span className="text-text">
                              all {formatInt(p.model_count)} of its model{p.model_count === 1 ? "" : "s"}
                            </span>{" "}
                            through cascade. This can&apos;t be undone.
                          </p>
                          <p>To stop using it without losing anything, edit it and untick active instead.</p>
                        </DeleteDialog>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={pPage} total={providers.total} param="pp" />
          </>
        )}
      </Panel>

      <Panel>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Models · {formatInt(models.total)}
          </h2>
          {choices.length > 0 ? (
            <FormDialog trigger="new" title="New model" submitLabel="Create" action={createModel}>
              <ModelFields providers={choices} />
            </FormDialog>
          ) : (
            <span className="text-xs text-muted">add a provider first</span>
          )}
        </div>
        {models.rows.length === 0 ? (
          <Empty>No models yet.</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Name</Th>
                  <Th>Model string</Th>
                  <Th>Default</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {models.rows.map((m) => (
                  <Tr key={m.id}>
                    <Td muted className="whitespace-nowrap">
                      {m.provider?.name ?? `#${m.provider_id}`}
                    </Td>
                    <Td className="whitespace-nowrap font-medium">{m.name}</Td>
                    <Td>
                      <Mono>{m.model_string}</Mono>
                    </Td>
                    <Td>{m.is_default ? <Badge tone="accent">default</Badge> : null}</Td>
                    <Td>{m.is_active ? <Badge tone="accent">active</Badge> : <Badge>inactive</Badge>}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <FormDialog trigger="edit" title={`Edit model ${m.name}`} action={updateModel.bind(null, m.id)}>
                          <ModelFields m={m} providers={choices} />
                        </FormDialog>
                        <DeleteDialog title={`Delete model ${m.name}?`} action={deleteModel.bind(null, m.id)}>
                          <p>
                            <Mono>{m.model_string}</Mono> is removed from the list.
                            {m.is_default && " It is the current default, so no model will be default afterwards."}{" "}
                            If a chain step still uses it, the database refuses the delete.
                          </p>
                        </DeleteDialog>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination path={PATH} sp={sp} page={mPage} total={models.total} param="mp" />
          </>
        )}
      </Panel>
    </div>
  );
}

function ProviderFields({ p }: { p?: ProviderRow }) {
  return (
    <>
      <Field label="Name">
        <input name="name" required maxLength={100} defaultValue={p?.name} className={fieldClass} />
      </Field>
      <Field label="Slug" hint="lowercase letters, digits and hyphens, e.g. anthropic">
        <input
          name="slug"
          required
          maxLength={64}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={p?.slug}
          className={`${fieldClass} font-mono`}
        />
      </Field>
      <Field label="Base URL" hint="optional · full URL of the API">
        <input
          name="base_url"
          type="url"
          maxLength={2048}
          defaultValue={p?.base_url ?? ""}
          placeholder="https://api.example.com/v1"
          className={`${fieldClass} font-mono`}
        />
      </Field>
      <Check name="is_active" label="active" defaultChecked={p ? p.is_active : true} />
    </>
  );
}

function ModelFields({ m, providers }: { m?: ModelRow; providers: { id: number; name: string }[] }) {
  return (
    <>
      <Field label="Provider">
        <select name="provider_id" required defaultValue={m?.provider_id ?? providers[0]?.id} className={fieldClass}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name">
        <input name="name" required maxLength={100} defaultValue={m?.name} className={fieldClass} />
      </Field>
      <Field
        label="Model string"
        hint={
          <>
            <span className="text-accent">Pinned version only</span>, never a{" "}
            <span className="font-mono">-latest</span> alias. This exact string is sent to the
            API; an alias silently resolves to a different model over time and makes past runs
            irreproducible.
          </>
        }
      >
        <input
          name="model_string"
          required
          maxLength={200}
          defaultValue={m?.model_string}
          placeholder="e.g. claude-sonnet-4-5-20250929"
          spellCheck={false}
          autoComplete="off"
          className={`${fieldClass} font-mono`}
        />
      </Field>
      <Field label="Notes" hint="optional">
        <textarea name="notes" rows={2} maxLength={2000} defaultValue={m?.notes ?? ""} className={fieldClass} />
      </Field>
      <div className="flex gap-4">
        <Check name="is_active" label="active" defaultChecked={m ? m.is_active : true} />
        <Check name="is_default" label="default (clears it on every other model)" defaultChecked={m?.is_default} />
      </div>
    </>
  );
}
