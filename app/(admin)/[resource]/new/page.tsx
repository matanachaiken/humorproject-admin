import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getResource } from "@/lib/resources";
import { PageHeader } from "../../ui";
import { saveRecord } from "../actions";
import { relationOptions, resourceOr404 } from "../data";
import RecordForm from "../RecordForm";

export async function generateMetadata({ params }: PageProps<"/[resource]/new">): Promise<Metadata> {
  const resource = getResource((await params).resource);
  return { title: resource ? `New ${resource.singular}` : "Not found" };
}

export default async function NewRecordPage({ params }: PageProps<"/[resource]/new">) {
  const { db } = await requireAdmin();
  const resource = resourceOr404((await params).resource);

  return (
    <div className="max-w-2xl">
      <Link href={`/${resource.key}`} className="text-sm text-ink-2 hover:text-ink">
        ← {resource.title}
      </Link>
      <PageHeader title={`New ${resource.singular}`} description={resource.description} />
      <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <RecordForm
          fields={resource.fields}
          initial={null}
          relations={await relationOptions(db, resource)}
          action={saveRecord.bind(null, resource.key, null)}
          submitLabel={`Create ${resource.singular}`}
        />
      </div>
    </div>
  );
}
