import { describe, expect, it } from "vitest";
import { formatMonthLabel } from "./format";

describe("formatMonthLabel", () => {
  it("formats an ISO year-month as an abbreviated Dutch month and year", () => {
    expect(formatMonthLabel("2026-01")).toBe("jan 2026");
  });

  it("handles months across the year without shifting due to timezone", () => {
    expect(formatMonthLabel("2026-08")).toBe("aug 2026");
    expect(formatMonthLabel("2025-12")).toBe("dec 2025");
  });
});
