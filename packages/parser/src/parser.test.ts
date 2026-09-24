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
  - type: field
    path: person.name
    span: { mobile: 12, tablet: 6 }
  - type: field
    path: person.email
    span: { mobile: 12, tablet: 6 }
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
    const firstField = normalized.layout[0];
    if (firstField?.type !== "field") throw new Error("expected a field");
    expect(firstField.span).toEqual({
      mobile: 12,
      tablet: 6,
      desktop: 6,
    });
    expect(firstField.id).toBe("field-1");
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

  it("validates and normalizes panels, recursing into their fields", () => {
    const panelSource = validSource.replace(
      /layout:\n[\s\S]*?(?=validations:)/,
      `layout:
  - type: panel
    title: Contact
    children:
      - type: field
        path: person.name
        span: { mobile: 12, tablet: 6 }
      - type: field
        path: person.email
        span: { mobile: 12, tablet: 6 }
`,
    );

    const parsed = parseYamlSpec(panelSource);
    expect(parsed.diagnostics).toEqual([]);
    expect(validateFormSpec(parsed.value!)).toEqual([]);

    const normalized = normalizeFormSpec(parsed.value!);
    const panel = normalized.layout[0];
    if (panel?.type !== "panel") throw new Error("expected a panel");
    expect(panel.title).toBe("Contact");
    expect(panel.children[0]?.id).toBe("panel-1.field-1");
  });

  it("detects duplicate field paths nested inside a panel", () => {
    const panelSource = validSource.replace(
      /layout:\n[\s\S]*?(?=validations:)/,
      `layout:
  - type: panel
    children:
      - type: field
        path: person.email
  - type: field
    path: person.email
`,
    );

    const diagnostics = validateFormSpec(parseYamlSpec(panelSource).value!);
    expect(diagnostics.map(({ code }) => code)).toContain("YF_FIELD_DUPLICATE");
  });
});

describe("Emmet layouts", () => {
  it("parses fields with responsive spans", () => {
    const parsed = parseEmmetLayout(
      "field[path=person.name mobile=12 tablet=6]+field[path=person.email mobile=12 tablet=6]",
    );

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.value).toHaveLength(2);
    expect(parsed.value?.[1]).toEqual({
      type: "field",
      path: "person.email",
      span: { mobile: 12, tablet: 6 },
    });
  });

  it("parses a panel wrapping fields", () => {
    const parsed = parseEmmetLayout("panel[title=Contact]>(field[path=person.name])+(field[path=person.email])");

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.value).toHaveLength(1);
    const panel = parsed.value?.[0];
    if (panel?.type !== "panel") throw new Error("expected a panel");
    expect(panel.children).toHaveLength(2);
    expect(panel.children[1]).toEqual({ type: "field", path: "person.email" });
  });

  it("reports invalid hierarchy with a source range", () => {
    const parsed = parseEmmetLayout("panel>row[path=name]");

    expect(parsed.value).toBeUndefined();
    expect(parsed.diagnostics[0]?.code).toBe("YF_EMMET_PANEL_CHILD");
    expect(parsed.diagnostics[0]?.range?.start.offset).toBe(6);
  });
});
