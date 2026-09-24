import type {
  FieldNode,
  FormSpec,
  NormalizedFieldNode,
  NormalizedFormSpec,
  NormalizedPanelNode,
  NormalizedResponsiveSpan,
  PanelNode,
  ResponsiveSpan,
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

function normalizePanel(panel: PanelNode, path: string): NormalizedPanelNode {
  return {
    ...panel,
    id: panel.id ?? path,
    children: panel.children.map((field, index) => normalizeField(field, `${path}.field-${index + 1}`)),
  };
}

export function normalizeFormSpec(spec: FormSpec): NormalizedFormSpec {
  return {
    ...spec,
    layout: spec.layout.map((node, index) => node.type === "panel"
      ? normalizePanel(node, `panel-${index + 1}`)
      : normalizeField(node, `field-${index + 1}`)),
  };
}