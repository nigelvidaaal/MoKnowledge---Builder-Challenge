// The top navigation bar (Build / Library).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME_EVENT } from "@/lib/client/events";

const LINKS = [
  { href: "/knowledge", label: "Build" },
  { href: "/knowledge/view", label: "Library" },
];

export function AppHeader() {
  const pathname = usePathname();
  const goHome = () => {
    if (pathname === "/knowledge") window.dispatchEvent(new Event(HOME_EVENT));
  };
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--header-border)] bg-[var(--header-bg)] transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/knowledge" onClick={goHome} aria-label="MoKnowledge home" className="flex items-center gap-2.5">
          {/* MoFlo's logo: blue normally, white on the blue start screen (CSS picks one). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-moflo.png" alt="" width={30} height={30} className="logo-default h-[30px] w-[30px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-moflo-white.png" alt="" width={30} height={30} className="logo-on-hero h-[30px] w-[30px]" />
          <span className="text-lg font-semibold text-[var(--header-fg)]">
            Mo<span className="font-normal text-[var(--header-muted)]">Knowledge</span>
          </span>
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((l) => {
            const active = l.href === "/knowledge" ? pathname === "/knowledge" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={l.href === "/knowledge" ? goHome : undefined}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-[var(--header-active-bg)] text-[var(--header-active-fg)]"
                    : "text-[var(--header-muted)] hover:text-[var(--header-fg)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
