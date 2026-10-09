"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { WalletButton } from "./wallet-button";

const NAV = [
  { href: "/", label: "Elections" },
  { href: "/elections/new", label: "New election" },
  { href: "/verify", label: "Verify receipt" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center bg-ink text-card">
            <span className="block h-2.5 w-2.5 bg-flare" />
          </span>
          <span className="display text-[17px]">SEALED/BALLOT</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>
        </nav>
        <div className="ml-auto">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return NAV.map((n) => {
    const active = pathname !== null && (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href));
    return (
      <Link
        key={n.href}
        href={n.href}
        className={`text-sm transition-colors ${active ? "text-ink" : "text-graphite/60 hover:text-ink"}`}
      >
        {active && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px bg-flare" />}
        {n.label}
      </Link>
    );
  });
}
