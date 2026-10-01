import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startPayment } from "./payment-action";

describe("startPayment", () => {
  let reload: ReturnType<typeof vi.fn>;
  let store: Record<string, string>;

  beforeEach(() => {
    reload = vi.fn();
    store = {};
    vi.stubGlobal("window", { location: { reload } });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("passes a normal result straight through", async () => {
    const ok = { ok: true as const, redirectTo: "https://iframe.wevend.pro/po/carNew" };
    await expect(startPayment(async () => ok)).resolves.toEqual(ok);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads ONCE when the page is from an older deploy, instead of crashing", async () => {
    const stale = () => Promise.reject(new Error("Failed to find Server Action \"abc\". This request might be from an older or newer deployment."));
    const first = await startPayment(stale);
    expect(first).toMatchObject({ ok: false });
    expect(reload).toHaveBeenCalledTimes(1);

    // A second failure within the minute must not loop.
    const second = await startPayment(stale);
    expect(second).toMatchObject({ ok: false, message: expect.stringMatching(/couldn't reach/) });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("turns a network drop into a message the donor can act on", async () => {
    const res = await startPayment(() => Promise.reject(new TypeError("Load failed")));
    expect(res).toEqual({ ok: false, message: expect.stringMatching(/connection/) });
    expect(reload).not.toHaveBeenCalled();
  });
});
