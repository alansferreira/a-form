import type {
  AsyncValidationRuleSpec,
  ColumnNode,
  Diagnostic,
  FormSpec,
  JsonObject,
  RowNode,
} from "jsfl-core";

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

function validateRows(spec: FormSpec, diagnostics: Diagnostic[]): void {
  const seenFields = new Set<string>();

  const visitRows = (rows: readonly RowNode[], path: readonly (number | string)[]): void => {
    rows.forEach((row, rowIndex) => {
      const rowPath = [...path, rowIndex];
      if (row.type !== "row" || !Array.isArray(row.children)) {
        addError(diagnostics, "YF_LAYOUT_ROW", "A layout row must contain a children array.", rowPath);
        return;
      }
      let desktopTotal = 0;
      row.children.forEach((column, columnIndex) => {
        const columnPath = [...rowPath, "children", columnIndex];
        if (column.type !== "column" || !Array.isArray(column.children)) {
          addError(diagnostics, "YF_LAYOUT_COLUMN", "A row may only contain columns.", columnPath);
          return;
        }
        const span = typeof column.span === "number" ? { mobile: column.span } : column.span;
        for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
          const value = span?.[breakpoint];
          if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 12)) {
            addError(
              diagnostics,
              "YF_LAYOUT_SPAN",
              `Column ${breakpoint} span must be an integer from 1 to 12.`,
              [...columnPath, "span", breakpoint],
            );
          }
        }
        desktopTotal += span?.desktop ?? span?.tablet ?? span?.mobile ?? 12;
        column.children.forEach((child: ColumnNode["children"][number], childIndex: number) => {
          const childPath = [...columnPath, "children", childIndex];
          if (child.type === "row") {
            visitRows([child], childPath);
            return;
          }
          if (child.type !== "field" || typeof child.path !== "string" || child.path.length === 0) {
            addError(diagnostics, "YF_LAYOUT_FIELD", "A column child must be a field or nested row.", childPath);
            return;
          }
          if (!schemaHasPath(spec.schema, child.path)) {
            addError(diagnostics, "YF_FIELD_PATH", `Field path '${child.path}' does not exist in schema.`, [...childPath, "path"]);
          }
          if (seenFields.has(child.path)) {
            diagnostics.push({
              code: "YF_FIELD_DUPLICATE",
              message: `Field path '${child.path}' appears more than once in the layout.`,
              severity: "warning",
              path: [...childPath, "path"],
            });
          }
          seenFields.add(child.path);
        });
      });
      if (desktopTotal > 12) {
        diagnostics.push({
          code: "YF_LAYOUT_WRAP",
          message: `Desktop spans total ${desktopTotal}; columns will wrap.`,
          severity: "warning",
          path: rowPath,
        });
      }
    });
  };

  visitRows(spec.layout, ["layout"]);
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
    addError(diagnostics, "YF_SPEC_LAYOUT", "layout must be an array of rows.", ["layout"]);
    return diagnostics;
  }
  validateRows(spec, diagnostics);
  spec.validations?.async?.forEach((rule, index) => validateAsyncRule(spec, rule, index, diagnostics));
  return diagnostics;
}