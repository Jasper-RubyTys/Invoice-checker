const STORAGE_PREFIX = "card-collapsed:";
const CHANGE_EVENT = "card-collapse-change";

export function isCardCollapsed(key: string): boolean {
  return window.localStorage.getItem(STORAGE_PREFIX + key) === "true";
}

export function setCardCollapsed(key: string, collapsed: boolean): void {
  window.localStorage.setItem(STORAGE_PREFIX + key, String(collapsed));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: notifies on same-tab toggles (custom event) and cross-tab writes ("storage"). */
export function subscribeToCardCollapse(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
