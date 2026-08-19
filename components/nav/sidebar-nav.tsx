"use client";

import {
  FileCheck,
  FileSymlink,
  LayoutDashboard,
  Menu,
  MessageCircleQuestion,
  PanelLeftClose,
  PanelRightClose,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { RoleSwitcher } from "@/components/ui/role-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSidebar } from "@/lib/use-sidebar";

const ROUTES = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/checker", label: "XML Checker", Icon: FileCheck },
  { href: "/pdf-invoice", label: "PDF Converter", Icon: FileSymlink },
  { href: "/vraagposten", label: "Vraagposten", Icon: MessageCircleQuestion },
];

export function SidebarNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileOpenedForPathname, setMobileOpenedForPathname] = useState(pathname);

  if (pathname !== mobileOpenedForPathname) {
    setMobileOpenedForPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div className="app-shell">
      <aside id="app-sidebar" className="sidebar no-print" data-state={collapsed ? "collapsed" : "expanded"} data-mobile-open={mobileOpen}>
        <div className="sidebar-header">
          <Link href="/" className="sidebar-brand" onClick={() => setMobileOpen(false)}>
            <span className="sidebar-brand-mark" aria-hidden="true">
              RT
            </span>
            <span className="sidebar-label sidebar-brand-text">Factuur Checker</span>
          </Link>
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Zijbalk uitklappen" : "Zijbalk inklappen"}
            title={collapsed ? "Uitklappen" : "Inklappen"}
          >
            {collapsed ? <PanelRightClose size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Hoofdnavigatie">
          {ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="sidebar-link"
              aria-current={pathname === route.href ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? route.label : undefined}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                <route.Icon size={20} />
              </span>
              <span className="sidebar-label">{route.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <RoleSwitcher />
          <ThemeToggle />
        </div>
      </aside>
      {mobileOpen && (
        <button type="button" className="sidebar-backdrop" aria-label="Sluit navigatiemenu" onClick={() => setMobileOpen(false)} />
      )}
      <div className="app-content">
        <header className="app-topbar no-print">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
            aria-label={mobileOpen ? "Sluit navigatiemenu" : "Open navigatiemenu"}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="app-topbar-brand">Factuur Checker</span>
        </header>
        {children}
      </div>
    </div>
  );
}
