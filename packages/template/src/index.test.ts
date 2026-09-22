import { describe, expect, it } from "vitest";
import { renderTemplate, renderUrlTemplate, urlEncode } from "./index.js";

describe("renderTemplate", () => {
  it("resolves dotted paths from the context", () => {
    expect(renderTemplate("{{a.b}}", { a: { b: "x" } })).toBe("x");
  });

  it("renders missing paths as empty string", () => {
    expect(renderTemplate("{{missing.path}}", {})).toBe("");
  });

  it("does not escape values by default", () => {
    expect(renderTemplate("{{value}}", { value: "a&b" })).toBe("a&b");
  });
});

describe("renderUrlTemplate", () => {
  it("percent-encodes interpolated values", () => {
    expect(renderUrlTemplate("/search?q={{query}}", { query: "a b&c" })).toBe("/search?q=a%20b%26c");
  });
});

describe("urlEncode", () => {
  it("encodes special characters", () => {
    expect(urlEncode("a b&c")).toBe("a%20b%26c");
  });
});
