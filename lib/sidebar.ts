const STORAGE_KEY = "sidebar-collapsed";

const DEFAULT_COLLAPSED = true;

export function getStoredSidebarCollapsed(): boolean | null {
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "true" || value === "false" ? value === "true" : null;
}

export function resolveInitialSidebarCollapsed(): boolean {
  return getStoredSidebarCollapsed() ?? DEFAULT_COLLAPSED;
}

export function applySidebarCollapsed(collapsed: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, String(collapsed));
}
