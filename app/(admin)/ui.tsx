import Link from "next/link";

// Small building blocks shared by the admin pages.

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {action}
    </header>
  );
}

// A GET form, so searches live in the URL and survive reloads.
export function SearchBox({
  placeholder,
  defaultValue,
  hidden = {},
}: {
  placeholder: string;
  defaultValue: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form className="flex w-full max-w-xs" role="search">
      {Object.entries(hidden).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null
      )}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-axis focus:ring-2 focus:ring-brand/30"
      />
    </form>
  );
}

// Segmented links that set one query parameter and keep the others.
export function SortLinks<K extends string>({
  options,
  current,
  params,
  name = "sort",
}: {
  options: Record<K, string>;
  current: K;
  params: Record<string, string>;
  name?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
      {(Object.entries(options) as [K, string][]).map(([key, label]) => {
        const query = new URLSearchParams(
          Object.entries({ ...params, [name]: key }).filter(([, v]) => v)
        );
        return (
          <Link
            key={key}
            href={`?${query}`}
            aria-current={key === current ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${
              key === current ? "bg-surface-2 font-semibold text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-ink-2">
      {children}
    </div>
  );
}
