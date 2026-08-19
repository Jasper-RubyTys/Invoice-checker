import { describe, expect, it } from "vitest";
import { deriveVraagpostStatus, STATUS_LABELS, toneForVraagpostStatus } from "./vraagpost-status";

describe("STATUS_LABELS", () => {
  it("has a Dutch label for a reopened vraagpost", () => {
    expect(STATUS_LABELS.heropend).toBe("Heropend");
  });
});

describe("toneForVraagpostStatus", () => {
  it("returns red for a reopened vraagpost", () => {
    expect(toneForVraagpostStatus("heropend")).toBe("red");
  });
});

describe("deriveVraagpostStatus", () => {
  it("falls back to the fixture status when there is no answer and it hasn't been reopened", () => {
    expect(deriveVraagpostStatus("open", { hasAnswer: false, isReopened: false })).toBe("open");
  });

  it("is 'beantwoord' once Directie has answered", () => {
    expect(deriveVraagpostStatus("open", { hasAnswer: true, isReopened: false })).toBe("beantwoord");
  });

  it("is 'heropend' when finance sent it back, even though an answer still exists", () => {
    expect(deriveVraagpostStatus("open", { hasAnswer: true, isReopened: true })).toBe("heropend");
  });

  it("prioritizes 'heropend' over the fixture status even without an answer", () => {
    expect(deriveVraagpostStatus("open", { hasAnswer: false, isReopened: true })).toBe("heropend");
  });
});
