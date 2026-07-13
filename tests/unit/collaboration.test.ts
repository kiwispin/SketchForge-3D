import { describe, expect, it } from "vitest";
import { createInviteCode, formatInviteCode, isValidDisplayName, normalizeInviteCode } from "@/lib/collaboration";

describe("collaboration helpers", () => {
  it("creates a readable eight-character invite code", () => {
    expect(createInviteCode(() => 0)).toBe("AAAA-AAAA");
    expect(createInviteCode(() => 0.999)).toBe("9999-9999");
  });

  it("normalizes invite-code typing", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(formatInviteCode("abcd efgh")).toBe("ABCD-EFGH");
  });

  it("accepts sensible temporary display names", () => {
    expect(isValidDisplayName("A")).toBe(false);
    expect(isValidDisplayName("Alex")).toBe(true);
    expect(isValidDisplayName("x".repeat(25))).toBe(false);
  });
});
