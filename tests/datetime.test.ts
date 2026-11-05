import { describe, expect, it } from "vitest";
import {
  formatInTunis,
  normalizeUtcIso,
  rangesOverlap,
  TUNIS_TIMEZONE,
  utcNow,
} from "@/lib/datetime";

describe("timezone handling", () => {
  it("Africa/Tunis is UTC+1 year-round (no DST)", () => {
    expect(TUNIS_TIMEZONE).toBe("Africa/Tunis");
    // January and July must both render UTC+1
    const jan = formatInTunis("2026-01-15T12:00:00Z", "en-US", {
      hour: "numeric",
      hour12: false,
      timeZoneName: "shortOffset",
    });
    const jul = formatInTunis("2026-07-15T12:00:00Z", "en-US", {
      hour: "numeric",
      hour12: false,
      timeZoneName: "shortOffset",
    });
    expect(jan).toContain("GMT+1");
    expect(jul).toContain("GMT+1");
  });

  it("utcNow returns a valid ISO string", () => {
    expect(Number.isNaN(new Date(utcNow()).getTime())).toBe(false);
  });

  it("normalizeUtcIso rejects garbage", () => {
    expect(normalizeUtcIso("not a date")).toBeNull();
    expect(normalizeUtcIso("2026-05-01T10:00:00Z")).toBe(
      "2026-05-01T10:00:00.000Z",
    );
  });
});

describe("rangesOverlap (half-open intervals)", () => {
  it("detects true overlaps", () => {
    expect(
      rangesOverlap("2026-05-01T10:00:00Z", "2026-05-01T11:00:00Z",
        "2026-05-01T10:30:00Z", "2026-05-01T11:30:00Z"),
    ).toBe(true);
  });

  it("back-to-back appointments do not overlap", () => {
    expect(
      rangesOverlap("2026-05-01T10:00:00Z", "2026-05-01T11:00:00Z",
        "2026-05-01T11:00:00Z", "2026-05-01T12:00:00Z"),
    ).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(rangesOverlap("bad", "2026-05-01T11:00:00Z", "a", "b")).toBe(false);
  });
});
