import type {
  AsyncValidationRuleSpec,
  Diagnostic,
  FieldNode,
  FormSpec,
  JsonObject,
} from "a-form-core";

const VALID_TRIGGERS = new Set(["change", "blur", "submit", "manual"]);

function addError(diagnostics: Diagnostic[], code: string, message: string, path: readonly (number | string)[]): void {
  diagnostics.push({ code, message, severity: "error", path });
}

function schemaHasPath(schema: JsonObject, fieldPath: string): boolean {
  let current: unknown = schema;
  for (const segment of fieldPath.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return false;
    }
    const properties = (current as Record<string, unknown>).properties;
    if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
      return false;
    }
    current = (properties as Record<string, unknown>)[segment];
    if (current === undefined) {
      return false;
    }
  }
  return true;
}

function validateLayout(spec: FormSpec, diagnostics: Diagnostic[]): void {
  const seenFields = new Set<string>();

  const visitField = (field: FieldNode, path: readonly (number | string)[]): void => {
    if (field.type !== "field" || typeof field.path !== "string" || field.path.length === 0) {
      addError(diagnostics, "YF_LAYOUT_FIELD", "A layout entry must be a field or panel.", path);
      return;
    }
    const span = typeof field.span === "number" ? { mobile: field.span } : field.span;
    for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
      const value = span?.[breakpoint];
      if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 12)) {
        addError(
          diagnostics,
          "YF_LAYOUT_SPAN",
          `Field ${breakpoint} span must be an integer from 1 to 12.`,
          [...path, "span", breakpoint],
        );
      }
    }
    if (!schemaHasPath(spec.schema, field.path)) {
      addError(diagnostics, "YF_FIELD_PATH", `Field path '${field.path}' does not exist in schema.`, [...path, "path"]);
    }
    if (seenFields.has(field.path)) {
      diagnostics.push({
        code: "YF_FIELD_DUPLICATE",
        message: `Field path '${field.path}' appears more than once in the layout.`,
        severity: "warning",
        path: [...path, "path"],
      });
    }
    seenFields.add(field.path);
  };

  spec.layout.forEach((node, index) => {
    const nodePath = ["layout", index];
    if (node.type === "panel") {
      if (!Array.isArray(node.children)) {
        addError(diagnostics, "YF_LAYOUT_PANEL", "A layout panel must contain a children array.", nodePath);
        return;
      }
      node.children.forEach((field, fieldIndex) => visitField(field, [...nodePath, "children", fieldIndex]));
      return;
    }
    visitField(node, nodePath);
  });
}

function validateAsyncRule(spec: FormSpec, rule: AsyncValidationRuleSpec, index: number, diagnostics: Diagnostic[]): void {
  const basePath = ["validations", "async", index] as const;
  if (!rule.id || !rule.adapter || !Array.isArray(rule.paths) || rule.paths.length === 0) {
    addError(diagnostics, "YF_ASYNC_RULE", "Async validation requires id, adapter and at least one path.", basePath);
  }
  [...(rule.paths ?? []), ...(rule.dependsOn ?? [])].forEach((fieldPath) => {
    if (!schemaHasPath(spec.schema, fieldPath)) {
      addError(diagnostics, "YF_ASYNC_PATH", `Async validation path '${fieldPath}' does not exist in schema.`, basePath);
    }
  });
  rule.triggers?.forEach((trigger) => {
    if (!VALID_TRIGGERS.has(trigger)) {
      addError(diagnostics, "YF_ASYNC_TRIGGER", `Unknown async validation trigger '${trigger}'.`, basePath);
    }
  });
  for (const [name, value] of [["debounceMs", rule.debounceMs], ["timeoutMs", rule.timeoutMs], ["cacheTtlMs", rule.cacheTtlMs]] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      addError(diagnostics, "YF_ASYNC_TIMING", `${name} must be a non-negative integer.`, [...basePath, name]);
    }
  }
}

export function validateFormSpec(spec: FormSpec): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (spec.version !== "1") {
    addError(diagnostics, "YF_SPEC_VERSION", "Only spec version '1' is supported.", ["version"]);
  }
  if (spec.schema === null || typeof spec.schema !== "object" || Array.isArray(spec.schema)) {
    addError(diagnostics, "YF_SPEC_SCHEMA", "schema must be a JSON object.", ["schema"]);
  }
  if (!Array.isArray(spec.layout)) {
    addError(diagnostics, "YF_SPEC_LAYOUT", "layout must be an array of fields or panels.", ["layout"]);
    return diagnostics;
  }
  validateLayout(spec, diagnostics);
  spec.validations?.async?.forEach((rule, index) => validateAsyncRule(spec, rule, index, diagnostics));
  return diagnostics;
}