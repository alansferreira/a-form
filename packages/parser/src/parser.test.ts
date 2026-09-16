import { describe, expect, it } from "vitest";
import { normalizeFormSpec, parseEmmetLayout, parseYamlSpec, validateFormSpec } from "./index.js";

const validSource = `
version: "1"
schema:
  type: object
  properties:
    person:
      type: object
      properties:
        name: { type: string }
        email: { type: string, format: email }
layout:
  - type: row
    children:
      - type: column
        span: { mobile: 12, tablet: 6 }
        children:
          - type: field
            path: person.name
      - type: column
        span: { mobile: 12, tablet: 6 }
        children:
          - type: field
            path: person.email
validations:
  async:
    - id: email-available
      adapter: customer-api
      paths: [person.email]
      triggers: [blur, submit]
      timeoutMs: 5000
`;

describe("YAML form specs", () => {
  it("parses, validates and normalizes a responsive form", () => {
    const parsed = parseYamlSpec(validSource);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.value).toBeDefined();

    const diagnostics = validateFormSpec(parsed.value!);
    expect(diagnostics).toEqual([]);

    const normalized = normalizeFormSpec(parsed.value!);
    expect(normalized.layout[0]?.children[0]?.span).toEqual({
      mobile: 12,
      tablet: 6,
      desktop: 6,
    });
    expect(normalized.layout[0]?.children[0]?.children[0]?.id).toBe("row-1.column-1.field-1");
  });

  it("reports invalid field paths and spans", () => {
    const parsed = parseYamlSpec(validSource.replace("person.name", "person.missing").replace("tablet: 6", "tablet: 13"));
    const diagnostics = validateFormSpec(parsed.value!);
    expect(diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining(["YF_FIELD_PATH", "YF_LAYOUT_SPAN"]));
  });

  it("returns a ranged diagnostic for malformed YAML", () => {
    const parsed = parseYamlSpec("version: [\n");
    expect(parsed.value).toBeUndefined();
    expect(parsed.diagnostics[0]?.code).toBe("YF_PARSE_YAML");
    expect(parsed.diagnostics[0]?.range?.start.line).toBe(1);
  });
});

describe("Emmet layouts", () => {
  it("parses grouped responsive columns", () => {
    const parsed = parseEmmetLayout(
      "row>(col[mobile=12 tablet=6]>field[path=person.name])+(col[mobile=12 tablet=6]>field[path=person.email])",
    );

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value?.[0]?.children).toHaveLength(2);
    expect(parsed.value?.[0]?.children[1]?.children[0]).toEqual({
      type: "field",
      path: "person.email",
    });
  });

  it("reports invalid hierarchy with a source range", () => {
    const parsed = parseEmmetLayout("row>field[path=name]");

    expect(parsed.value).toBeUndefined();
    expect(parsed.diagnostics[0]?.code).toBe("YF_EMMET_ROW_CHILD");
    expect(parsed.diagnostics[0]?.range?.start.offset).toBe(4);
  });
});