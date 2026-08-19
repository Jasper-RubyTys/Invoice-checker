import { beforeEach, describe, expect, it } from "vitest";
import { applySidebarCollapsed, getStoredSidebarCollapsed, resolveInitialSidebarCollapsed } from "./sidebar";

describe("sidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no collapsed state is stored", () => {
    expect(getStoredSidebarCollapsed()).toBeNull();
  });

  it("defaults to collapsed when nothing is stored", () => {
    expect(resolveInitialSidebarCollapsed()).toBe(true);
  });

  it("prefers the stored state over the default", () => {
    window.localStorage.setItem("sidebar-collapsed", "false");
    expect(resolveInitialSidebarCollapsed()).toBe(false);
  });

  it("applies and persists the collapsed state", () => {
    applySidebarCollapsed(false);
    expect(getStoredSidebarCollapsed()).toBe(false);

    applySidebarCollapsed(true);
    expect(getStoredSidebarCollapsed()).toBe(true);
  });

  it("ignores garbage values in storage", () => {
    window.localStorage.setItem("sidebar-collapsed", "yes");
    expect(getStoredSidebarCollapsed()).toBeNull();
    expect(resolveInitialSidebarCollapsed()).toBe(true);
  });
});
