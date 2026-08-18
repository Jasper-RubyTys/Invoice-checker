import { useCallback, useSyncExternalStore } from "react";
import { applyRole, resolveInitialRole, Role } from "./role";

type Listener = () => void;
const listeners = new Set<Listener>();

// Unlike theme, the role has no DOM attribute to read back (it doesn't
// affect global page chrome pre-hydration), so the resolved value is cached
// here instead once per page load.
let currentRole: Role | null = null;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Role {
  if (currentRole === null) {
    currentRole = resolveInitialRole();
  }
  return currentRole;
}

function getServerSnapshot(): Role {
  return "finance";
}

export function useRole() {
  const role = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleRole = useCallback(() => {
    const next: Role = getSnapshot() === "directie" ? "finance" : "directie";
    applyRole(next);
    currentRole = next;
    listeners.forEach((listener) => listener());
  }, []);

  return { role, toggleRole };
}
