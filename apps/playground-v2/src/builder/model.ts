import type { FormSpec, JsonObject, JsonValue } from 'a-form-core'
import { parse, stringify } from 'yaml'

export type FieldKind = 'text' | 'email' | 'number' | 'textarea' | 'checkbox' | 'radio' | 'select'

export interface DataPathNode {
  readonly jsonPath: string
  readonly label: string
  readonly depth: number
  readonly branch: boolean
  readonly value?: JsonValue
}

export interface BuilderField {
  readonly id: string
  readonly path: string
  readonly jsonPath: string
  readonly label: string
  readonly kind: FieldKind
  readonly span: number
  readonly align: 'start' | 'end'
  readonly sampleValue?: JsonValue
}

export interface BuilderRow {
  readonly id: string
  readonly fields: readonly BuilderField[]
}

export interface PalettePayload {
  readonly source: 'data' | 'kind' | 'canvas'
  readonly path?: string
  readonly jsonPath?: string
  readonly label: string
  readonly kind: FieldKind
  readonly sampleValue?: JsonValue
  readonly fieldId?: string
}

export const FIELD_KINDS: readonly { kind: FieldKind; label: string; span: number }[] = [
  { kind: 'text', label: 'Text', span: 6 },
  { kind: 'email', label: 'Email', span: 6 },
  { kind: 'number', label: 'Number', span: 4 },
  { kind: 'textarea', label: 'Long text', span: 12 },
  { kind: 'checkbox', label: 'Checkbox', span: 12 },
  { kind: 'radio', label: 'Radio group', span: 6 },
  { kind: 'select', label: 'Select', span: 6 },
]

function titleFromSegment(segment: string): string {
  return segment
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every(isJsonValue)
  return typeof value === 'object' && Object.values(value).every(isJsonValue)
}

export function parseExampleData(source: string): { value?: JsonObject; error?: string } {
  try {
    const value: unknown = parse(source)
    if (!value || Array.isArray(value) || typeof value !== 'object' || !isJsonValue(value)) {
      return { error: 'The YAML example must contain an object at its root.' }
    }
    return { value: value as JsonObject }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not parse YAML.' }
  }
}

export function listDataPaths(value: JsonObject): readonly DataPathNode[] {
  const nodes: DataPathNode[] = []

  const visit = (current: JsonValue, segments: readonly string[], depth: number): void => {
    const branch = current !== null && typeof current === 'object'
    nodes.push({
      jsonPath: `$.${segments.join('.')}`,
      label: titleFromSegment(segments.at(-1) ?? ''),
      depth,
      branch,
      value: branch ? undefined : current,
    })
    if (branch && !Array.isArray(current)) {
      Object.entries(current).forEach(([key, child]) => visit(child, [...segments, key], depth + 1))
    }
  }

  Object.entries(value).forEach(([key, child]) => visit(child, [key], 0))
  return nodes
}

export function inferFieldKind(path: string, value: JsonValue | undefined): FieldKind {
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'number') return 'number'
  if (/email/i.test(path)) return 'email'
  return 'text'
}

function schemaForField(field: BuilderField, existing: JsonObject | undefined): Record<string, unknown> {
  const schema: Record<string, unknown> = { ...existing }
  delete schema.format
  delete schema.enum

  if (field.kind === 'checkbox') return { ...schema, type: 'boolean', title: field.label }
  if (field.kind === 'number') return { ...schema, type: 'number', title: field.label }
  if (field.kind === 'radio' || field.kind === 'select') {
    return { ...schema, type: 'string', title: field.label, enum: existing?.enum ?? ['Option A', 'Option B', 'Option C'] }
  }
  return {
    ...schema,
    type: 'string',
    title: field.label,
    ...(field.kind === 'email' ? { format: 'email' } : {}),
  }
}

function setNested(target: Record<string, unknown>, path: string, value: Record<string, unknown>): void {
  const segments = path.split('.')
  let properties = target
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      const existing = properties[segment]
      properties[segment] = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...existing, ...value }
        : value
      return
    }
    const existing = properties[segment]
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      properties[segment] = { type: 'object', properties: {} }
    }
    const objectSchema = properties[segment] as { properties: Record<string, unknown> }
    properties = objectSchema.properties
  })
}

function setUiOption(target: Record<string, unknown>, path: string, value: Record<string, unknown>): void {
  const segments = path.split('.')
  let current = target
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value
      return
    }
    current[segment] ??= {}
    current = current[segment] as Record<string, unknown>
  })
}

function valueAtPath(value: JsonObject | undefined, path: string): JsonValue | undefined {
  return path.split('.').reduce<JsonValue | undefined>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    return current[segment]
  }, value)
}

function schemaAtPath(schema: JsonObject, path: string): JsonObject | undefined {
  return path.split('.').reduce<JsonObject | undefined>((current, segment) => {
    const properties = current?.properties
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return undefined
    const child = properties[segment]
    return child && typeof child === 'object' && !Array.isArray(child) ? child : undefined
  }, schema)
}

function fieldKindFromSpec(spec: FormSpec, path: string): FieldKind {
  const schema = schemaAtPath(spec.schema, path)
  const uiOptions = valueAtPath(spec.uiSchema, path)
  const widget = uiOptions && typeof uiOptions === 'object' && !Array.isArray(uiOptions)
    ? uiOptions['ui:widget']
    : undefined

  if (widget === 'textarea' || widget === 'checkbox' || widget === 'radio') return widget
  if (schema?.type === 'boolean') return 'checkbox'
  if (schema?.type === 'number' || schema?.type === 'integer') return 'number'
  if (Array.isArray(schema?.enum)) return 'select'
  if (schema?.format === 'email') return 'email'
  return 'text'
}

export function formSpecToBuilderRows(spec: FormSpec): readonly BuilderRow[] {
  let fieldSequence = 1

  return spec.layout.map((row, rowIndex) => ({
    id: `row-${rowIndex + 1}`,
    fields: row.children.map((column) => {
      if (column.children.length !== 1 || column.children[0]?.type !== 'field') {
        throw new Error('The visual builder only supports columns containing exactly one field.')
      }

      const path = column.children[0].path
      const schema = schemaAtPath(spec.schema, path)
      const span = typeof column.span === 'number'
        ? column.span
        : column.span?.desktop ?? column.span?.tablet ?? column.span?.mobile ?? 12

      return {
        id: `field-${fieldSequence++}`,
        path,
        jsonPath: `$.${path}`,
        label: typeof schema?.title === 'string' ? schema.title : titleFromSegment(path.split('.').at(-1) ?? path),
        kind: fieldKindFromSpec(spec, path),
        span,
        align: column.align === 'end' ? 'end' : 'start',
      }
    }),
  }))
}

export function buildFormSpec(rows: readonly BuilderRow[], baseSpec?: FormSpec): FormSpec {
  const schema = structuredClone(baseSpec?.schema ?? {}) as Record<string, unknown>
  const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, unknown>
    : {}
  schema.properties = properties
  const uiSchema = structuredClone(baseSpec?.uiSchema ?? {}) as Record<string, unknown>

  rows.flatMap((row) => row.fields).forEach((field) => {
    setNested(properties, field.path, schemaForField(field, schemaAtPath(schema as JsonObject, field.path)))
    const currentUi = valueAtPath(uiSchema as JsonObject, field.path)
    const uiOptions: Record<string, unknown> = currentUi && typeof currentUi === 'object' && !Array.isArray(currentUi)
      ? { ...currentUi }
      : {}
    delete uiOptions['ui:widget']
    delete uiOptions['ui:autocomplete']
    if (field.kind === 'textarea') uiOptions['ui:widget'] = 'textarea'
    if (field.kind === 'checkbox') uiOptions['ui:widget'] = 'checkbox'
    if (field.kind === 'radio') uiOptions['ui:widget'] = 'radio'
    if (field.kind === 'email') uiOptions['ui:autocomplete'] = 'email'
    setUiOption(uiSchema, field.path, uiOptions)
  })

  return {
    ...baseSpec,
    version: '1',
    schema: { title: 'Untitled form', type: 'object', ...schema } as JsonObject,
    uiSchema: uiSchema as JsonObject,
    layout: rows
      .filter((row) => row.fields.length > 0)
      .map((row) => ({
        type: 'row',
        id: row.id,
        children: row.fields.map((field) => ({
          type: 'column',
          id: `${row.id}.${field.id}`,
          span: { mobile: 12, tablet: field.span, desktop: field.span },
          align: field.align,
          children: [{ type: 'field', id: field.id, path: field.path }],
        })),
      })),
  }
}

export function formSpecToYaml(rows: readonly BuilderRow[], baseSpec?: FormSpec): string {
  return stringify(buildFormSpec(rows, baseSpec), { lineWidth: 0 })
}

export function defaultSpan(kind: FieldKind): number {
  return FIELD_KINDS.find((item) => item.kind === kind)?.span ?? 6
}

/** Mirrors the AForm renderer's placement: "end"-aligned fields hug the row's right edge instead of packing left. */
export function fieldGridColumns(fields: readonly BuilderField[]): Record<string, string> {
  const columns: Record<string, string> = {}
  let startCursor = 1
  let endCursor = 13
  for (const field of fields) {
    if (field.align === 'end') {
      endCursor -= field.span
      columns[field.id] = `${endCursor} / ${endCursor + field.span}`
    } else {
      columns[field.id] = `${startCursor} / ${startCursor + field.span}`
      startCursor += field.span
    }
  }
  return columns
}

export function internalPath(jsonPath: string): string {
  return jsonPath.replace(/^\$\.?/, '')
}