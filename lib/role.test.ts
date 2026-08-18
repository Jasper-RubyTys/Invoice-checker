import { beforeEach, describe, expect, it } from "vitest";
import { applyRole, getStoredRole, resolveInitialRole } from "./role";

describe("role", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no role is stored", () => {
    expect(getStoredRole()).toBeNull();
  });

  it("defaults to finance when nothing is stored", () => {
    expect(resolveInitialRole()).toBe("finance");
  });

  it("prefers the stored role over the default", () => {
    window.localStorage.setItem("role", "directie");
    expect(resolveInitialRole()).toBe("directie");
  });

  it("applies and persists the role", () => {
    applyRole("directie");
    expect(getStoredRole()).toBe("directie");
  });

  it("ignores garbage values in storage", () => {
    window.localStorage.setItem("role", "admin");
    expect(getStoredRole()).toBeNull();
    expect(resolveInitialRole()).toBe("finance");
  });
});
