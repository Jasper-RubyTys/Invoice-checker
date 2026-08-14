import { beforeEach, describe, expect, it } from "vitest";
import { isCardCollapsed, setCardCollapsed } from "./card-collapse";

describe("card-collapse", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns false when nothing is stored", () => {
    expect(isCardCollapsed("totals")).toBe(false);
  });

  it("persists and reflects the collapsed state per key", () => {
    setCardCollapsed("totals", true);
    expect(isCardCollapsed("totals")).toBe(true);
    expect(isCardCollapsed("invoice-lines")).toBe(false);
  });

  it("can be toggled back to expanded", () => {
    setCardCollapsed("totals", true);
    setCardCollapsed("totals", false);
    expect(isCardCollapsed("totals")).toBe(false);
  });
});
