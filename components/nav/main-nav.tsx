"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const ROUTES = [
  { href: "/", label: "Checker" },
  { href: "/pdf-invoice", label: "PDF → UBL" },
  { href: "/dashboard", label: "Dashboard" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="app-nav no-print">
      <span className="app-nav-brand">Factuur Checker</span>
      <nav className="app-nav-links">
        {ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="app-nav-link"
            aria-current={pathname === route.href ? "page" : undefined}
          >
            {route.label}
          </Link>
        ))}
      </nav>
      <ThemeToggle />
    </header>
  );
}
