import { describe, expect, it } from "vitest";

import { hasLocale, negotiateLocale } from "./config";

describe("negotiateLocale", () => {
  it("falls back to French when header is missing", () => {
    expect(negotiateLocale(null)).toBe("fr");
    expect(negotiateLocale("")).toBe("fr");
  });

  it("matches regional variants on the primary subtag", () => {
    expect(negotiateLocale("fr-CM,fr;q=0.9")).toBe("fr");
    expect(negotiateLocale("en-GB")).toBe("en");
  });

  it("respects q-values over order", () => {
    expect(negotiateLocale("fr;q=0.4,en;q=0.8")).toBe("en");
  });

  it("skips unsupported languages", () => {
    expect(negotiateLocale("de-DE,sw;q=0.9,en;q=0.5")).toBe("en");
    expect(negotiateLocale("de,es")).toBe("fr");
  });

  it("ignores languages explicitly refused with q=0", () => {
    expect(negotiateLocale("en;q=0,fr;q=0.1")).toBe("fr");
  });
});

describe("hasLocale", () => {
  it("accepts only supported locales", () => {
    expect(hasLocale("fr")).toBe(true);
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("de")).toBe(false);
    expect(hasLocale("../etc")).toBe(false);
  });
});
