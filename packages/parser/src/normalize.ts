import type {
  FieldNode,
  FormSpec,
  NormalizedFieldNode,
  NormalizedFormSpec,
  NormalizedSeparatorNode,
  NormalizedResponsiveSpan,
  ResponsiveSpan,
  SeparatorNode,
} from "a-form-core";

function normalizeSpan(span: ResponsiveSpan | number | undefined): NormalizedResponsiveSpan {
  const responsive = typeof span === "number" ? { mobile: span } : span;
  const mobile = responsive?.mobile ?? 12;
  const tablet = responsive?.tablet ?? mobile;
  return {
    mobile,
    tablet,
    desktop: responsive?.desktop ?? tablet,
  };
}

function normalizeField(field: FieldNode, path: string): NormalizedFieldNode {
  return {
    ...field,
    id: field.id ?? path,
    span: normalizeSpan(field.span),
    align: field.align ?? "start",
  };
}

function normalizeSeparator(separator: SeparatorNode, path: string): NormalizedSeparatorNode {
  return {
    ...separator,
    id: separator.id ?? path,
  };
}

export function normalizeFormSpec(spec: FormSpec): NormalizedFormSpec {
  return {
    ...spec,
    layout: spec.layout.map((node, index) => node.type === "separator"
      ? normalizeSeparator(node, `separator-${index + 1}`)
      : normalizeField(node, `field-${index + 1}`)),
  };
}