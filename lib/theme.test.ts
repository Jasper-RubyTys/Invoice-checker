import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getStoredTheme, resolveInitialTheme } from "./theme";

function mockMatchMedia(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" && prefersDark,
  })) as unknown as typeof window.matchMedia;
}

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when no theme is stored", () => {
    expect(getStoredTheme()).toBeNull();
  });

  it("falls back to system preference when nothing is stored", () => {
    mockMatchMedia(true);
    expect(resolveInitialTheme()).toBe("dark");

    mockMatchMedia(false);
    expect(resolveInitialTheme()).toBe("light");
  });

  it("prefers the stored theme over system preference", () => {
    mockMatchMedia(true);
    window.localStorage.setItem("theme", "light");
    expect(resolveInitialTheme()).toBe("light");
  });

  it("applies the theme to the document and persists it", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(getStoredTheme()).toBe("dark");
  });
});
