import type {
  ColumnNode,
  FormSpec,
  NormalizedColumnNode,
  NormalizedFieldNode,
  NormalizedFormSpec,
  NormalizedPanelNode,
  NormalizedResponsiveSpan,
  NormalizedRowNode,
  PanelNode,
  ResponsiveSpan,
  RowNode,
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

function normalizeRow(row: RowNode, path: string): NormalizedRowNode {
  return {
    ...row,
    id: row.id ?? path,
    children: row.children.map((column, index) => normalizeColumn(column, `${path}.column-${index + 1}`)),
  };
}

function normalizeColumn(column: ColumnNode, path: string): NormalizedColumnNode {
  return {
    ...column,
    id: column.id ?? path,
    span: normalizeSpan(column.span),
    align: column.align ?? "start",
    children: column.children.map((child, index): NormalizedFieldNode | NormalizedRowNode => {
      const childPath = `${path}.${child.type}-${index + 1}`;
      return child.type === "row"
        ? normalizeRow(child, childPath)
        : { ...child, id: child.id ?? childPath };
    }),
  };
}

export function normalizeFormSpec(spec: FormSpec): NormalizedFormSpec {
  return {
    ...spec,
    layout: spec.layout.map((node, index) => node.type === "panel"
      ? normalizePanel(node, `panel-${index + 1}`)
      : normalizeRow(node, `row-${index + 1}`)),
  };
}

function normalizePanel(panel: PanelNode, path: string): NormalizedPanelNode {
  return {
    ...panel,
    id: panel.id ?? path,
    children: panel.children.map((row, index) => normalizeRow(row, `${path}.row-${index + 1}`)),
  };
}