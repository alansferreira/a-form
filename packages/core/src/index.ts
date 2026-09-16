export type JsonPrimitive = boolean | number | string | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export interface SourcePosition {
  readonly line: number;
  readonly character: number;
  readonly offset: number;
}

export interface SourceRange {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly path: readonly (number | string)[];
  readonly range?: SourceRange;
}

export interface ResponsiveSpan {
  readonly mobile?: number;
  readonly tablet?: number;
  readonly desktop?: number;
}

export interface FieldNode {
  readonly type: "field";
  readonly id?: string;
  readonly path: string;
}

export interface ColumnNode {
  readonly type: "column";
  readonly id?: string;
  readonly span?: ResponsiveSpan | number;
  readonly children: readonly (FieldNode | RowNode)[];
}

export interface RowNode {
  readonly type: "row";
  readonly id?: string;
  readonly children: readonly ColumnNode[];
}

export type LayoutNode = RowNode | ColumnNode | FieldNode;

export type AsyncValidationTrigger = "change" | "blur" | "submit" | "manual";
export type AsyncValidationFailurePolicy = "block" | "warning";

export interface AsyncValidationRuleSpec {
  readonly id: string;
  readonly adapter: string;
  readonly paths: readonly string[];
  readonly dependsOn?: readonly string[];
  readonly triggers?: readonly AsyncValidationTrigger[];
  readonly debounceMs?: number;
  readonly timeoutMs?: number;
  readonly cacheTtlMs?: number;
  readonly failurePolicy?: AsyncValidationFailurePolicy;
}

export interface FormSpec {
  readonly version: "1";
  readonly schema: JsonObject;
  readonly uiSchema?: JsonObject;
  readonly layout: readonly RowNode[];
  readonly validations?: {
    readonly async?: readonly AsyncValidationRuleSpec[];
  };
}

export interface NormalizedResponsiveSpan {
  readonly mobile: number;
  readonly tablet: number;
  readonly desktop: number;
}

export interface NormalizedFieldNode extends Omit<FieldNode, "id"> {
  readonly id: string;
}

export interface NormalizedColumnNode extends Omit<ColumnNode, "children" | "id" | "span"> {
  readonly id: string;
  readonly span: NormalizedResponsiveSpan;
  readonly children: readonly (NormalizedFieldNode | NormalizedRowNode)[];
}

export interface NormalizedRowNode extends Omit<RowNode, "children" | "id"> {
  readonly id: string;
  readonly children: readonly NormalizedColumnNode[];
}

export interface NormalizedFormSpec extends Omit<FormSpec, "layout"> {
  readonly layout: readonly NormalizedRowNode[];
}