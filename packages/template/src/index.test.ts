import { describe, expect, it } from "vitest";
import { isFieldPathExpression, renderTemplate, renderUrlTemplate, tokenizeInlineTemplate, urlEncode } from "./index.js";

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

describe("tokenizeInlineTemplate", () => {
  it("splits text and placeholders, dropping comments", () => {
    expect(tokenizeInlineTemplate("Hi {{ customer.name }}{{! note }}, bye {{ ./city }}")).toEqual([
      { kind: "text", value: "Hi " },
      { kind: "placeholder", expression: "customer.name", raw: "{{ customer.name }}" },
      { kind: "text", value: ", bye " },
      { kind: "placeholder", expression: "./city", raw: "{{ ./city }}" },
    ]);
  });

  it("reports sections, triple mustaches and empty placeholders", () => {
    expect(tokenizeInlineTemplate("{{#items}}{{{html}}}{{ }}").map((token) => token.kind)).toEqual([
      "invalid",
      "invalid",
      "invalid",
    ]);
  });

  it("recognizes plain field path expressions", () => {
    expect(isFieldPathExpression("customer.name")).toBe(true);
    expect(isFieldPathExpression("id:email")).toBe(false);
  });
});
