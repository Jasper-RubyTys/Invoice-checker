"use client";

import { Role } from "@/lib/role";
import { useRole } from "@/lib/use-role";

const LABELS: Record<Role, string> = {
  finance: "Finance",
  directie: "Directie",
};

/**
 * A view-mode switch, not a login: this app has no authentication, so
 * anyone can flip between the Finance and Directie views of /vraagposten.
 * See docs/vraagposten-overview.md.
 */
export function RoleSwitcher() {
  const { role, toggleRole } = useRole();

  return (
    <button
      type="button"
      onClick={toggleRole}
      className="btn ghost sm no-print"
      aria-label={`Huidige weergave: ${LABELS[role]}. Klik om te wisselen.`}
      title="Wissel tussen Finance- en Directie-weergave (geen echte toegangscontrole)"
    >
      {LABELS[role]}
    </button>
  );
}
