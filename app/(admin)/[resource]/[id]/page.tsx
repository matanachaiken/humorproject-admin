import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { getResource } from "@/lib/resources";
import { formatWhen } from "@/lib/format";
import { deleteRecord, saveRecord } from "../actions";
import { display, relationOptions, resourceOr404, selectFor, type Row } from "../data";
import DeleteRecord from "../DeleteRecord";
import RecordForm from "../RecordForm";

export async function generateMetadata({ params }: PageProps<"/[resource]/[id]">): Promise<Metadata> {
  const resource = getResource((await params).resource);
  return { title: resource ? `Edit ${resource.singular}` : "Not found" };
}

export default async function EditRecordPage({ params, searchParams }: PageProps<"/[resource]/[id]">) {
  const { db } = await requireAdmin();
  const { resource: key, id: rawId } = await params;
  const resource = resourceOr404(key);
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { created } = await searchParams;

  const [{ data: row }, relations] = await Promise.all([
    db.from(resource.table).select(selectFor(resource)).eq("id", id).maybeSingle<Row>(),
    relationOptions(db, resource),
  ]);
  if (!row) notFound();
  const name = display(row, resource.fields[0].name, resource);

  return (
    <div className="max-w-2xl">
      <Link href={`/${resource.key}`} className="text-sm text-ink-2 hover:text-ink">
        ← {resource.title}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{name}</h1>
      <p className="mb-6 mt-1 text-sm text-ink-2">
        {resource.singular[0].toUpperCase() + resource.singular.slice(1)} #{row.id} · added {formatWhen(String(row.created_at))}
        {typeof row.updated_at === "string" && row.updated_at !== row.created_at && ` · updated ${formatWhen(row.updated_at)}`}
      </p>
      {created && (
        <p role="status" className="mb-4 rounded-lg bg-surface-2 px-4 py-2.5 text-sm">
          Created.
        </p>
      )}

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <RecordForm
          fields={resource.fields}
          initial={row}
          relations={relations}
          action={saveRecord.bind(null, resource.key, row.id)}
          submitLabel="Save changes"
        />
      </section>
      <section className="mt-6 rounded-xl border border-bad/30 bg-surface p-5 sm:p-6">
        <h2 className="font-semibold">Delete</h2>
        <p className="mb-4 mt-1 text-sm text-ink-2">
          This can&apos;t be undone.{resource.deleteWarning ? ` ${resource.deleteWarning}` : ""}
        </p>
        <DeleteRecord
          action={deleteRecord.bind(null, resource.key, row.id)}
          label={`Delete ${resource.singular}`}
          confirmText={`Delete “${name}” for good?`}
        />
      </section>
    </div>
  );
}
