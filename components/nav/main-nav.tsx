"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleSwitcher } from "@/components/ui/role-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const ROUTES = [
  { href: "/", label: "Dashboard" },
  { href: "/checker", label: "XML Checker" },
  { href: "/pdf-invoice", label: "PDF Converter" },
  { href: "/vraagposten", label: "Vraagposten" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="app-nav no-print">
      <Link href="/" className="app-nav-brand">
        Factuur Checker
      </Link>
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
      <RoleSwitcher />
      <ThemeToggle />
    </header>
  );
}
