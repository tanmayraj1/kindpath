import { describe, it, expect, vi, afterEach } from "vitest";
import { parseDsn, buildSentryEvent, captureError, log } from "./observability";

afterEach(() => {
  delete process.env.SENTRY_DSN;
  vi.restoreAllMocks();
});

describe("parseDsn", () => {
  it("parses a standard Sentry DSN", () => {
    expect(parseDsn("https://abc123@o450.ingest.sentry.io/987654")).toEqual({
      publicKey: "abc123",
      host: "o450.ingest.sentry.io",
      projectId: "987654",
    });
  });
  it("rejects malformed DSNs", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not-a-url")).toBeNull();
    expect(parseDsn("https://sentry.io/123")).toBeNull(); // no key
  });
});

describe("buildSentryEvent", () => {
  it("shapes an Error into a store-API event", () => {
    const ev = buildSentryEvent(new TypeError("boom"), { source: "test" });
    expect(ev).toMatchObject({
      platform: "node",
      level: "error",
      exception: { values: [{ type: "TypeError", value: "boom" }] },
      extra: { source: "test" },
    });
    expect(String(ev.event_id)).toMatch(/^[0-9a-f]{32}$/);
  });
  it("wraps non-Error throwables", () => {
    const ev = buildSentryEvent("plain string", {});
    expect(ev.exception).toMatchObject({ values: [{ value: "plain string" }] });
  });
});

describe("captureError", () => {
  it("logs locally and does NOT call fetch without a DSN", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    captureError(new Error("no dsn"), { a: 1 });
    expect(err).toHaveBeenCalledOnce();
    const line = JSON.parse(err.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "error", message: "no dsn", a: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the DSN's store endpoint when configured", () => {
    process.env.SENTRY_DSN = "https://key1@errors.example.com/42";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    captureError(new Error("sent"), { source: "unit" });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://errors.example.com/api/42/store/");
    expect((init.headers as Record<string, string>)["X-Sentry-Auth"]).toContain("sentry_key=key1");
    expect(JSON.parse(String(init.body)).exception.values[0].value).toBe("sent");
  });

  it("never throws even if fetch rejects", () => {
    process.env.SENTRY_DSN = "https://key1@errors.example.com/42";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(() => captureError(new Error("x"))).not.toThrow();
  });
});

describe("log", () => {
  it("emits one-line JSON with level routing", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    log("info", "hello", { n: 5 });
    log("warn", "careful");
    expect(JSON.parse(info.mock.calls[0][0] as string)).toMatchObject({ level: "info", message: "hello", n: 5 });
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({ level: "warn", message: "careful" });
  });
});
