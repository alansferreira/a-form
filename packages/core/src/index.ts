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

export type ColumnAlign = "start" | "end";

export interface FieldNode {
  readonly type: "field";
  readonly id?: string;
  readonly path: string;
  /** Column span (out of 12) at each responsive breakpoint. Fields pack left-to-right and wrap automatically once a row runs out of space. */
  readonly span?: ResponsiveSpan | number;
  /** Which edge of the flow this field's slot is consumed from; "end" hugs the right edge. */
  readonly align?: ColumnAlign;
}

export interface SeparatorNode {
  readonly type: "separator";
  readonly id?: string;
  readonly title: string;
  readonly description?: string;
}

export type LayoutNode = FieldNode | SeparatorNode;

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

export interface InlineSpec {
  /** HTML document whose `{{path}}` placeholders render as click-to-edit fields. */
  readonly template: string;
}

export interface FormSpec {
  readonly version: "1";
  readonly schema: JsonObject;
  readonly uiSchema?: JsonObject;
  readonly layout: readonly LayoutNode[];
  readonly inline?: InlineSpec;
  readonly validations?: {
    readonly async?: readonly AsyncValidationRuleSpec[];
  };
}

export interface NormalizedResponsiveSpan {
  readonly mobile: number;
  readonly tablet: number;
  readonly desktop: number;
}

export interface NormalizedFieldNode extends Omit<FieldNode, "id" | "span" | "align"> {
  readonly id: string;
  readonly span: NormalizedResponsiveSpan;
  readonly align: ColumnAlign;
}

export interface NormalizedSeparatorNode extends Omit<SeparatorNode, "id"> {
  readonly id: string;
}

export interface NormalizedFormSpec extends Omit<FormSpec, "layout"> {
  readonly layout: readonly (NormalizedFieldNode | NormalizedSeparatorNode)[];
}