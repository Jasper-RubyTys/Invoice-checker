import { describe, expect, it } from "vitest";
import { getVraagposten } from "./vraagpost-data";

describe("getVraagposten", () => {
  it("labels itself as mock data, not a live Exact Online feed", async () => {
    const vraagposten = await getVraagposten();
    expect(vraagposten.every((vraagpost) => vraagpost.source === "mock")).toBe(true);
  });

  it("returns at least one open Vraagpost", async () => {
    const vraagposten = await getVraagposten();
    expect(vraagposten.length).toBeGreaterThan(0);
    expect(vraagposten.every((vraagpost) => vraagpost.status === "open")).toBe(true);
  });

  it("gives every Vraagpost a unique id", async () => {
    const vraagposten = await getVraagposten();
    const ids = vraagposten.map((vraagpost) => vraagpost.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
