import { useCallback, useSyncExternalStore } from "react";
import { applyTheme, resolveInitialTheme, Theme } from "./theme";

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The anti-flash inline script (see app/layout.tsx) sets this attribute before
// hydration. Falling back to resolveInitialTheme() here only matters if that
// script didn't run (e.g. blocked by CSP) or in a test environment.
function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  const resolved = resolveInitialTheme();
  applyTheme(resolved);
  return resolved;
}

function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    applyTheme(next);
    listeners.forEach((listener) => listener());
  }, []);

  return { theme, toggleTheme };
}
