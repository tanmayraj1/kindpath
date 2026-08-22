import { describe, it, expect, vi, beforeEach } from "vitest";
// Static import, not `await import`: vitest hoists vi.mock above the import
// graph, so the mock is already in place, and a top-level await here fails
// `tsc --noEmit` under this project's module target.
import {
  issueLoginCode,
  consumeLoginCode,
  generateCode,
  normalizeEmail,
  MAX_ATTEMPTS,
} from "./login-code";

/**
 * The guess budget IS the security property here — six digits is a million-wide
 * space, so what stops a walk is the attempt ceiling, not the entropy. These
 * tests pin that ceiling, the single-use guarantee, and the supersession that
 * stops "resend" from multiplying live codes.
 *
 * adminDb is mocked with an in-memory table rather than mocked per-call, so the
 * attempt counter is actually exercised across calls the way it is in production.
 */

type Row = {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
};

let rows: Row[] = [];
let seq = 0;

vi.mock("@/lib/db", () => ({
  adminDb: {
    loginCode: {
      create: async ({ data }: { data: Partial<Row> }) => {
        const row: Row = {
          id: `r${++seq}`,
          email: data.email!,
          codeHash: data.codeHash!,
          expiresAt: data.expiresAt!,
          usedAt: null,
          attemptCount: 0,
          createdAt: new Date(Date.now() + seq),
        };
        rows.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { email: string; usedAt: null } }) =>
        rows
          .filter((r) => r.email === where.email && r.usedAt === null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = rows.find((r) => r.id === where.id)!;
        if (data.usedAt !== undefined) row.usedAt = data.usedAt as Date;
        const inc = data.attemptCount as { increment?: number } | undefined;
        if (inc?.increment) row.attemptCount += inc.increment;
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { email: string; usedAt: null };
        data: { usedAt: Date };
      }) => {
        let count = 0;
        for (const r of rows) {
          if (r.email === where.email && r.usedAt === null) {
            r.usedAt = data.usedAt;
            count++;
          }
        }
        return { count };
      },
      deleteMany: async () => ({ count: 0 }),
    },
  },
}));


beforeEach(() => {
  rows = [];
  seq = 0;
});

describe("generateCode", () => {
  it("is always six digits, zero-padded", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it("reaches both ends of the range, so the space isn't silently narrowed", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) seen.add(generateCode());
    // A biased or truncated generator collapses the space; 4000 draws from a
    // million should be nearly all distinct.
    expect(seen.size).toBeGreaterThan(3900);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims, so casing can't create a second bucket", () => {
    expect(normalizeEmail("  Bob@Example.COM ")).toBe("bob@example.com");
  });
});

describe("consumeLoginCode", () => {
  it("accepts the right code once, then refuses the replay", async () => {
    const { code } = await issueLoginCode("a@example.com");
    expect(await consumeLoginCode("a@example.com", code)).toEqual({ ok: true });
    expect(await consumeLoginCode("a@example.com", code)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("matches regardless of the casing the address is typed in", async () => {
    const { code } = await issueLoginCode("Bob@Example.com");
    expect(await consumeLoginCode("bob@example.com", code)).toEqual({ ok: true });
  });

  it("reports invalid — not a distinct reason — when no code was ever requested", async () => {
    // Distinguishing "no code" from "wrong code" would leak whether the address
    // is on file, which is the whole point of the generic response upstream.
    expect(await consumeLoginCode("nobody@example.com", "123456")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("locks the code after MAX_ATTEMPTS wrong guesses", async () => {
    const { code } = await issueLoginCode("c@example.com");
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      expect(await consumeLoginCode("c@example.com", wrong)).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(await consumeLoginCode("c@example.com", wrong)).toEqual({
      ok: false,
      reason: "too_many_attempts",
    });

    // And the correct code is dead too — otherwise the ceiling only costs the
    // attacker a pause, and the real code still sits there waiting.
    expect(await consumeLoginCode("c@example.com", code)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("refuses an expired code", async () => {
    vi.useFakeTimers();
    try {
      const { code } = await issueLoginCode("d@example.com");
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(await consumeLoginCode("d@example.com", code)).toEqual({
        ok: false,
        reason: "expired",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("supersedes the previous code on reissue", async () => {
    // Without this, tapping "resend" three times leaves three live codes and
    // triples the guess surface for one sign-in.
    const first = await issueLoginCode("e@example.com");
    const second = await issueLoginCode("e@example.com");

    expect(await consumeLoginCode("e@example.com", first.code)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await consumeLoginCode("e@example.com", second.code)).toEqual({ ok: true });
  });

  it("does not accept another address's code", async () => {
    const { code } = await issueLoginCode("f@example.com");
    expect(await consumeLoginCode("g@example.com", code)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("ignores spaces and dashes a reader might paste in", async () => {
    const { code } = await issueLoginCode("h@example.com");
    const spaced = `${code.slice(0, 3)} - ${code.slice(3)}`;
    expect(await consumeLoginCode("h@example.com", spaced)).toEqual({ ok: true });
  });
});
