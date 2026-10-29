"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: "Community",
    links: [
      { href: "/", label: "Overview" },
      { href: "/users", label: "Users" },
      { href: "/media", label: "Riffs" },
      { href: "/votes", label: "Votes & battles" },
    ],
  },
  {
    label: "AI pipeline",
    links: [
      { href: "/chains", label: "Prompt chains" },
      { href: "/requests", label: "Requests" },
      { href: "/responses", label: "LLM responses" },
      { href: "/models", label: "Models" },
      { href: "/providers", label: "Providers" },
    ],
  },
  {
    label: "Prompt inputs",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/examples", label: "Examples" },
    ],
  },
  {
    label: "Sign-up access",
    links: [
      { href: "/signup-domains", label: "Allowed domains" },
      { href: "/whitelist", label: "Whitelisted emails" },
    ],
  },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:block lg:min-h-0 lg:flex-1 lg:space-y-5 lg:overflow-y-auto lg:px-3 lg:pb-4">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex shrink-0 gap-1 lg:block lg:space-y-0.5">
          <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted lg:block">
            {group.label}
          </p>
          {group.links.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
