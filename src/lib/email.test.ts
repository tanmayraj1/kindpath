import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, sendEmailWithRetry } from "./email";

const ORIGINAL_KEY = process.env.RESEND_API_KEY;

function response(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const MSG = { to: "donor@example.com", subject: "Your receipt", html: "<p>hi</p>" };

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;
});

/** Run a promise that awaits timers, advancing them as they're scheduled. */
async function withTimers<T>(p: Promise<T>): Promise<T> {
  const done = p.then((v) => ({ v }));
  await vi.runAllTimersAsync();
  return (await done).v;
}

describe("sendEmail", () => {
  it("marks the dev console fallback as simulated, not a real delivery", async () => {
    delete process.env.RESEND_API_KEY;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await sendEmail(MSG);
    // Reporting this as a plain success is how receipts got recorded as "sent"
    // while nothing left the building.
    expect(r).toMatchObject({ ok: true, simulated: true });
  });

  it("returns the provider id on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(200, { id: "re_123" })));
    expect(await sendEmail(MSG)).toEqual({ ok: true, id: "re_123" });
  });

  it("classifies a 422 as permanent and a 500 as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(422, { message: "invalid to" })));
    expect(await sendEmail(MSG)).toMatchObject({ ok: false, retryable: false });

    vi.stubGlobal("fetch", vi.fn(async () => response(500, { message: "boom" })));
    expect(await sendEmail(MSG)).toMatchObject({ ok: false, retryable: true });

    vi.stubGlobal("fetch", vi.fn(async () => response(429, { message: "slow down" })));
    expect(await sendEmail(MSG)).toMatchObject({ ok: false, retryable: true });
  });

  it("treats a network throw as retryable rather than losing the message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNRESET");
    }));
    expect(await sendEmail(MSG)).toMatchObject({ ok: false, retryable: true, error: "ECONNRESET" });
  });
});

describe("sendEmailWithRetry", () => {
  it("retries a transient failure and succeeds", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      return calls < 3 ? response(503) : response(200, { id: "re_ok" });
    }));
    const r = await withTimers(sendEmailWithRetry(MSG));
    expect(r).toEqual({ ok: true, id: "re_ok" });
    expect(calls).toBe(3);
  });

  it("does NOT retry a permanent rejection", async () => {
    const fetchMock = vi.fn(async () => response(422, { message: "invalid recipient" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await withTimers(sendEmailWithRetry(MSG));
    expect(r.ok).toBe(false);
    // Burning three attempts on a bad address just delays the failure signal.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt budget and reports the last error", async () => {
    const fetchMock = vi.fn(async () => response(500, { message: "still down" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await withTimers(sendEmailWithRetry(MSG, 3));
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
