"use client";

import { Role } from "@/lib/role";
import { useRole } from "@/lib/use-role";

const LABELS: Record<Role, string> = {
  finance: "Finance",
  directie: "Directie",
};

const INITIALS: Record<Role, string> = {
  finance: "FI",
  directie: "DI",
};

/**
 * A view-mode switch, not a login: this app has no authentication, so
 * anyone can flip between the Finance and Directie views of /vraagposten.
 * Styled as a profile row (avatar + role) so it sits naturally at the
 * bottom of the sidebar, ready to become a real account control later.
 * See docs/vraagposten-overview.md.
 */
export function RoleSwitcher() {
  const { role, toggleRole } = useRole();

  return (
    <button
      type="button"
      onClick={toggleRole}
      className="sidebar-account no-print"
      aria-label={`Huidige weergave: ${LABELS[role]}. Klik om te wisselen.`}
      title="Wissel tussen Finance- en Directie-weergave (geen echte toegangscontrole)"
    >
      <span className="sidebar-avatar" aria-hidden="true">
        {INITIALS[role]}
      </span>
      <span className="sidebar-account-text sidebar-label">
        <span className="sidebar-account-role">{LABELS[role]}</span>
        <span className="sidebar-account-hint">Wissel weergave</span>
      </span>
    </button>
  );
}
