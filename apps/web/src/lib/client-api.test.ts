import { describe, expect, it } from "vitest";

import { safeNext } from "./client-api";
import { fmt } from "./format";

describe("safeNext (open-redirect protection)", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNext("/fr/app", "/x")).toBe("/fr/app");
    expect(safeNext("/fr/invite?token=abc", "/x")).toBe("/fr/invite?token=abc");
  });

  it("rejects absolute, protocol-relative and backslash URLs", () => {
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
      expect(safeNext(evil, "/fr/app")).toBe("/fr/app");
    }
  });

  it("falls back when missing", () => {
    expect(safeNext(null, "/en/app")).toBe("/en/app");
    expect(safeNext("", "/en/app")).toBe("/en/app");
  });
});

describe("fmt", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(fmt("Hello {name}, {x}", { name: "Awa" })).toBe("Hello Awa, {x}");
  });
});
