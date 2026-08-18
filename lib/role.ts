export type Role = "directie" | "finance";

const STORAGE_KEY = "role";

/**
 * Finance deals with open Vraagposten day-to-day; a Directie visit to answer
 * one is the exception. That's the only reason this default exists — the
 * switcher is one click either way, so it isn't load-bearing.
 */
const DEFAULT_ROLE: Role = "finance";

export function getStoredRole(): Role | null {
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "directie" || value === "finance" ? value : null;
}

export function resolveInitialRole(): Role {
  return getStoredRole() ?? DEFAULT_ROLE;
}

export function applyRole(role: Role): void {
  window.localStorage.setItem(STORAGE_KEY, role);
}
