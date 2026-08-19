import { useCallback, useSyncExternalStore } from "react";
import { applySidebarCollapsed, resolveInitialSidebarCollapsed } from "./sidebar";

type Listener = () => void;
const listeners = new Set<Listener>();

let currentCollapsed: boolean | null = null;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  if (currentCollapsed === null) {
    currentCollapsed = resolveInitialSidebarCollapsed();
  }
  return currentCollapsed;
}

function getServerSnapshot(): boolean {
  return true;
}

export function useSidebar() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleCollapsed = useCallback(() => {
    const next = !getSnapshot();
    applySidebarCollapsed(next);
    currentCollapsed = next;
    listeners.forEach((listener) => listener());
  }, []);

  return { collapsed, toggleCollapsed };
}
