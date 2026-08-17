import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => {
  const spawn = (...args: unknown[]) => spawnMock(...args);
  return { spawn, default: { spawn } };
});

const { runPdfExtractor } = await import("./run-pdf-extractor");

interface FakeChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  kill: ReturnType<typeof vi.fn>;
}

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: vi.fn(), end: vi.fn() };
  child.kill = vi.fn();
  return child;
}

function emitStdoutAndClose(child: FakeChild, payload: unknown, code = 0) {
  child.stdout.emit("data", Buffer.from(JSON.stringify(payload)));
  child.emit("close", code);
}

describe("runPdfExtractor", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("writes the PDF bytes to the child process's stdin and closes it", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = runPdfExtractor(Buffer.from("pdf-bytes"));
    emitStdoutAndClose(child, { ok: true, invoice: { lines: [] }, rawText: "" });
    await promise;

    expect(child.stdin.write).toHaveBeenCalledWith(Buffer.from("pdf-bytes"));
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it("resolves ok:true with a mapped ParsedInvoice on well-formed JSON", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = runPdfExtractor(Buffer.from("pdf-bytes"));
    emitStdoutAndClose(child, {
      ok: true,
      invoice: {
        invoiceNumber: "INV-1",
        supplier: { name: "Acme B.V." },
        lines: [{ description: "Testregel", lineExtensionAmount: 10, taxPercent: 21 }],
      },
      rawText: "hello world",
    });
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.invoiceNumber).toBe("INV-1");
    expect(result.invoice.supplier.name).toBe("Acme B.V.");
    expect(result.invoice.buyer.name).toBe("Ruby Toys B.V.");
    expect(result.invoice.lines).toHaveLength(1);
    expect(result.invoice.totals.payableAmount).toBe(12.1);
    expect(result.rawText).toBe("hello world");
  });

  it("flags fields the extractor didn't find as uncertain", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = runPdfExtractor(Buffer.from("pdf-bytes"));
    emitStdoutAndClose(child, { ok: true, invoice: { lines: [] }, rawText: "" });
    const result = await promise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uncertainFields).toContain("invoiceNumber");
    expect(result.uncertainFields).toContain("supplier.name");
  });

  it("resolves ok:false when the Python script reports a typed error", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = runPdfExtractor(Buffer.from("pdf-bytes"));
    emitStdoutAndClose(child, { ok: false, error: { kind: "extraction-failed", message: "kapot" } });
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("extraction-failed");
  });

  it("resolves ok:false when stdout is not valid JSON", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = runPdfExtractor(Buffer.from("pdf-bytes"));
    child.stdout.emit("data", Buffer.from("not json"));
    child.emit("close", 0);
    const result = await promise;

    expect(result.ok).toBe(false);
  });

  it("resolves ok:false when the process exits with a non-zero code", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = runPdfExtractor(Buffer.from("pdf-bytes"));
    child.emit("close", 1);
    const result = await promise;

    expect(result.ok).toBe(false);
  });

  it("resolves ok:false with python-unavailable when the child process can't be started", async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const promise = runPdfExtractor(Buffer.from("pdf-bytes"));
    child.emit("error", new Error("spawn ENOENT"));
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("python-unavailable");
  });
});
