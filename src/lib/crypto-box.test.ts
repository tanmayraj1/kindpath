import { describe, it, expect, beforeAll } from "vitest";
import { seal, open } from "./crypto-box";

beforeAll(() => {
  process.env.CREDENTIALS_KEY = "test-credentials-key-0123456789abcdef";
});

describe("crypto-box (AES-256-GCM at-rest secrets)", () => {
  it("round-trips JSON payloads", () => {
    const secret = JSON.stringify({ mid: "RCTST1000101600", password: "S3cret!Pass" });
    const token = seal(secret);
    expect(token.startsWith("v1.")).toBe(true);
    expect(token).not.toContain("RCTST"); // ciphertext, not plaintext
    expect(token).not.toContain("S3cret");
    expect(open(token)).toBe(secret);
  });

  it("produces a different token every time (random IV)", () => {
    expect(seal("same")).not.toBe(seal("same"));
  });

  it("rejects tampered ciphertext (GCM auth)", () => {
    const token = seal("attack at dawn");
    const parts = token.split(".");
    parts[2] = parts[2].slice(0, -3) + (parts[2].endsWith("AAA") ? "BBB" : "AAA");
    expect(open(parts.join("."))).toBeNull();
  });

  it("rejects a token sealed under a different key", () => {
    const token = seal("secret");
    const orig = process.env.CREDENTIALS_KEY;
    process.env.CREDENTIALS_KEY = "a-completely-different-key-9876543210";
    expect(open(token)).toBeNull();
    process.env.CREDENTIALS_KEY = orig;
    expect(open(token)).toBe("secret"); // sanity: original key still works
  });

  it("rejects malformed input", () => {
    expect(open(null)).toBeNull();
    expect(open("")).toBeNull();
    expect(open("v1.only.two")).toBeNull();
    expect(open("v2.a.b.c")).toBeNull();
  });
});
