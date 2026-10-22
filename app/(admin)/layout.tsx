import { requireAdmin } from "@/lib/dal";
import NavLinks from "./NavLinks";

// Every page in this group is admin-only. Pages and server actions check
// again with requireAdmin(), since layouts don't guard server actions.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { viewer } = await requireAdmin();

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-56 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Daily Riff</p>
            <p className="text-lg font-bold leading-tight">Admin</p>
          </div>
          <SignOut className="lg:hidden" />
        </div>
        <NavLinks />
        <div className="mt-auto hidden border-t border-line px-5 py-4 lg:block">
          <p className="truncate text-sm font-medium">{viewer.name}</p>
          <p className="truncate text-xs text-muted">{viewer.email}</p>
          <SignOut className="mt-3" />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}

function SignOut({ className = "" }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <button className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
        Sign out
      </button>
    </form>
  );
}
