import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getResource } from "@/lib/resources";
import { formatDate } from "@/lib/format";
import { EmptyState, PageHeader, SearchBox } from "../ui";
import { display, resourceOr404, selectFor, type Row } from "./data";

export async function generateMetadata({ params }: PageProps<"/[resource]">): Promise<Metadata> {
  return { title: getResource((await params).resource)?.title ?? "Not found" };
}

export default async function ResourceListPage({ params, searchParams }: PageProps<"/[resource]">) {
  const { db } = await requireAdmin();
  const resource = resourceOr404((await params).resource);
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";

  let request = db.from(resource.table).select(selectFor(resource)).limit(1000);
  for (const o of resource.orderBy) request = request.order(o.column, { ascending: o.ascending });
  const { data } = await request.overrideTypes<Row[], { merge: false }>();
  const rows = (data ?? []).filter(
    (row) => !q || resource.searchable.some((c) => String(row[c] ?? "").toLowerCase().includes(q))
  );
  const columns = resource.fields.filter((f) => f.list);

  return (
    <>
      <PageHeader
        title={resource.title}
        description={resource.description}
        action={
          <Link
            href={`/${resource.key}/new`}
            className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90"
          >
            New {resource.singular}
          </Link>
        }
      />
      {query.deleted && (
        <p role="status" className="mb-4 rounded-lg bg-surface-2 px-4 py-2.5 text-sm">
          Deleted.
        </p>
      )}
      <div className="mb-4">
        <SearchBox placeholder="Search" defaultValue={q} />
      </div>

      {rows.length === 0 ? (
        <EmptyState>{q ? `Nothing matches “${q}”.` : `No ${resource.singular}s yet.`}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                {columns.map((c) => (
                  <th key={c.name} className="px-4 py-3 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-2/60">
                  {columns.map((c, i) => (
                    <td key={c.name} className={`px-4 py-3 align-top ${c.mono ? "font-mono text-xs" : ""}`}>
                      {c.type === "checkbox" ? (
                        row[c.name] ? (
                          <span className="text-good">● Yes</span>
                        ) : (
                          <span className="text-muted">○ No</span>
                        )
                      ) : i === 0 ? (
                        <Link href={`/${resource.key}/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                          {display(row, c.name, resource)}
                        </Link>
                      ) : (
                        <span className="line-clamp-2 max-w-md">{display(row, c.name, resource)}</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 align-top text-ink-2">{formatDate(String(row.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
