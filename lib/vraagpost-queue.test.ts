import { describe, expect, it } from "vitest";
import { findNextActionableForFinance, findNextOpenVraagpost } from "./vraagpost-queue";
import { Vraagpost } from "./vraagpost-data";

function makeVraagpost(id: string): Vraagpost {
  return {
    id,
    label: `Label ${id}`,
    amount: 100,
    currencyCode: "EUR",
    date: "2026-07-15",
    glAccount: "0410",
    period: "2026-07",
    status: "open",
    source: "mock",
  };
}

describe("findNextOpenVraagpost", () => {
  it("returns the first vraagpost without an answer", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b"), makeVraagpost("c")];
    const result = findNextOpenVraagpost(list, { a: true }, "a");
    expect(result?.id).toBe("b");
  });

  it("skips the excluded id even when it has no recorded answer yet", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b")];
    const result = findNextOpenVraagpost(list, {}, "a");
    expect(result?.id).toBe("b");
  });

  it("skips vraagposten that already have an answer", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b"), makeVraagpost("c")];
    const result = findNextOpenVraagpost(list, { a: true, b: true }, "a");
    expect(result?.id).toBe("c");
  });

  it("returns null when every other vraagpost already has an answer", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b")];
    const result = findNextOpenVraagpost(list, { a: true, b: true }, "a");
    expect(result).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(findNextOpenVraagpost([], {}, "a")).toBeNull();
  });
});

describe("findNextActionableForFinance", () => {
  it("returns the first vraagpost with an answer and no open finance note", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b"), makeVraagpost("c")];
    const result = findNextActionableForFinance(list, { a: true, b: true }, {}, "a");
    expect(result?.id).toBe("b");
  });

  it("skips vraagposten without an answer yet", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b"), makeVraagpost("c")];
    const result = findNextActionableForFinance(list, { a: true, c: true }, {}, "a");
    expect(result?.id).toBe("c");
  });

  it("skips vraagposten that already have an open finance note", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b"), makeVraagpost("c")];
    const result = findNextActionableForFinance(list, { a: true, b: true, c: true }, { b: true }, "a");
    expect(result?.id).toBe("c");
  });

  it("skips the excluded id even when it's otherwise actionable", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b")];
    const result = findNextActionableForFinance(list, { a: true, b: true }, {}, "a");
    expect(result?.id).toBe("b");
  });

  it("returns null when nothing is actionable", () => {
    const list = [makeVraagpost("a"), makeVraagpost("b")];
    const result = findNextActionableForFinance(list, { a: true }, {}, "a");
    expect(result).toBeNull();
  });
});
