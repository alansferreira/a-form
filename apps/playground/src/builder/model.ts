import type { FormSpec, JsonObject, JsonValue } from 'a-form-core'
import { parse, stringify } from 'yaml'

export type FieldKind =
  | 'text' | 'email' | 'number' | 'textarea' | 'checkbox' | 'radio' | 'select'
  | 'date' | 'time' | 'datetime' | 'range' | 'autocomplete' | 'asyncOptions'

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
  readonly panelId?: string
  readonly sampleValue?: JsonValue
  readonly rangeMin?: number
  readonly rangeMax?: number
  readonly rangeStep?: number
  readonly optionsSource?: string
  readonly optionsValueKey?: string
  readonly optionsLabelKey?: string
  readonly optionsItemTemplate?: string
}

export interface BuilderPanel {
  readonly id: string
  readonly title: string
  readonly description?: string
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
  { kind: 'date', label: 'Date', span: 4 },
  { kind: 'time', label: 'Time', span: 4 },
  { kind: 'datetime', label: 'Date & time', span: 6 },
  { kind: 'range', label: 'Range slider', span: 6 },
  { kind: 'autocomplete', label: 'Autocomplete', span: 6 },
  { kind: 'asyncOptions', label: 'Async options', span: 6 },
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
  delete schema.minimum
  delete schema.maximum

  if (field.kind === 'checkbox') return { ...schema, type: 'boolean', title: field.label }
  if (field.kind === 'number') return { ...schema, type: 'number', title: field.label }
  if (field.kind === 'range') {
    return {
      ...schema,
      type: 'number',
      title: field.label,
      ...(field.rangeMin !== undefined ? { minimum: field.rangeMin } : {}),
      ...(field.rangeMax !== undefined ? { maximum: field.rangeMax } : {}),
    }
  }
  if (field.kind === 'radio' || field.kind === 'select') {
    return { ...schema, type: 'string', title: field.label, enum: existing?.enum ?? ['Option A', 'Option B', 'Option C'] }
  }
  return {
    ...schema,
    type: 'string',
    title: field.label,
    ...(field.kind === 'email' ? { format: 'email' } : {}),
    ...(field.kind === 'date' ? { format: 'date' } : {}),
    ...(field.kind === 'datetime' ? { format: 'date-time' } : {}),
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
  if (widget === 'date' || widget === 'time' || widget === 'datetime' || widget === 'range' || widget === 'autocomplete' || widget === 'asyncOptions') return widget
  if (schema?.type === 'boolean') return 'checkbox'
  if (schema?.type === 'number' || schema?.type === 'integer') return 'number'
  if (Array.isArray(schema?.enum)) return 'select'
  if (schema?.format === 'email') return 'email'
  if (schema?.format === 'date') return 'date'
  if (schema?.format === 'date-time') return 'datetime'
  return 'text'
}

function uiSubOptions(spec: FormSpec, path: string): Record<string, unknown> | undefined {
  const uiOptions = valueAtPath(spec.uiSchema, path)
  if (!uiOptions || typeof uiOptions !== 'object' || Array.isArray(uiOptions)) return undefined
  const subOptions = (uiOptions as Record<string, unknown>)['ui:options']
  return subOptions && typeof subOptions === 'object' && !Array.isArray(subOptions) ? subOptions as Record<string, unknown> : undefined
}

export function formSpecToBuilderFields(spec: FormSpec): { fields: readonly BuilderField[]; panels: readonly BuilderPanel[] } {
  let fieldSequence = 1
  const panels: BuilderPanel[] = []
  const fields: BuilderField[] = []

  const toBuilderField = (field: Extract<FormSpec['layout'][number], { type: 'field' }>, panelId: string | undefined): BuilderField => {
    const path = field.path
    const schema = schemaAtPath(spec.schema, path)
    const span = typeof field.span === 'number'
      ? field.span
      : field.span?.desktop ?? field.span?.tablet ?? field.span?.mobile ?? 12
    const kind = fieldKindFromSpec(spec, path)
    const subOptions = uiSubOptions(spec, path)

    return {
      id: `field-${fieldSequence++}`,
      path,
      jsonPath: `$.${path}`,
      label: typeof schema?.title === 'string' ? schema.title : titleFromSegment(path.split('.').at(-1) ?? path),
      kind,
      span,
      align: field.align === 'end' ? 'end' : 'start',
      ...(panelId ? { panelId } : {}),
      ...(kind === 'range' && typeof schema?.minimum === 'number' ? { rangeMin: schema.minimum } : {}),
      ...(kind === 'range' && typeof schema?.maximum === 'number' ? { rangeMax: schema.maximum } : {}),
      ...(kind === 'range' && typeof subOptions?.step === 'number' ? { rangeStep: subOptions.step } : {}),
      ...((kind === 'autocomplete' || kind === 'asyncOptions') && typeof subOptions?.source === 'string' ? { optionsSource: subOptions.source } : {}),
      ...((kind === 'autocomplete' || kind === 'asyncOptions') && typeof subOptions?.valueKey === 'string' ? { optionsValueKey: subOptions.valueKey } : {}),
      ...((kind === 'autocomplete' || kind === 'asyncOptions') && typeof subOptions?.labelKey === 'string' ? { optionsLabelKey: subOptions.labelKey } : {}),
      ...((kind === 'autocomplete' || kind === 'asyncOptions') && typeof subOptions?.itemTemplate === 'string' ? { optionsItemTemplate: subOptions.itemTemplate } : {}),
    }
  }

  spec.layout.forEach((node, index) => {
    if (node.type === 'panel') {
      const panelId = node.id ?? `panel-${index + 1}`
      panels.push({ id: panelId, title: node.title ?? 'Untitled panel', ...(node.description ? { description: node.description } : {}) })
      node.children.forEach((field) => fields.push(toBuilderField(field, panelId)))
      return
    }
    fields.push(toBuilderField(node, undefined))
  })

  return { fields, panels }
}

export function buildFormSpec(fields: readonly BuilderField[], panels: readonly BuilderPanel[] = [], baseSpec?: FormSpec): FormSpec {
  const schema = structuredClone(baseSpec?.schema ?? {}) as Record<string, unknown>
  const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, unknown>
    : {}
  schema.properties = properties
  const uiSchema = structuredClone(baseSpec?.uiSchema ?? {}) as Record<string, unknown>

  fields.forEach((field) => {
    setNested(properties, field.path, schemaForField(field, schemaAtPath(schema as JsonObject, field.path)))
    const currentUi = valueAtPath(uiSchema as JsonObject, field.path)
    const uiOptions: Record<string, unknown> = currentUi && typeof currentUi === 'object' && !Array.isArray(currentUi)
      ? { ...currentUi }
      : {}
    delete uiOptions['ui:widget']
    delete uiOptions['ui:autocomplete']
    delete uiOptions['ui:options']
    if (field.kind === 'textarea') uiOptions['ui:widget'] = 'textarea'
    if (field.kind === 'checkbox') uiOptions['ui:widget'] = 'checkbox'
    if (field.kind === 'radio') uiOptions['ui:widget'] = 'radio'
    if (field.kind === 'email') uiOptions['ui:autocomplete'] = 'email'
    if (field.kind === 'date' || field.kind === 'time' || field.kind === 'datetime') uiOptions['ui:widget'] = field.kind
    if (field.kind === 'range') {
      uiOptions['ui:widget'] = 'range'
      uiOptions['ui:options'] = {
        ...(field.rangeMin !== undefined ? { min: field.rangeMin } : {}),
        ...(field.rangeMax !== undefined ? { max: field.rangeMax } : {}),
        ...(field.rangeStep !== undefined ? { step: field.rangeStep } : {}),
      }
    }
    if (field.kind === 'autocomplete' || field.kind === 'asyncOptions') {
      uiOptions['ui:widget'] = field.kind
      uiOptions['ui:options'] = {
        ...(field.optionsSource ? { source: field.optionsSource } : {}),
        ...(field.optionsValueKey ? { valueKey: field.optionsValueKey } : {}),
        ...(field.optionsLabelKey ? { labelKey: field.optionsLabelKey } : {}),
        ...(field.optionsItemTemplate ? { itemTemplate: field.optionsItemTemplate } : {}),
      }
    }
    setUiOption(uiSchema, field.path, uiOptions)
  })

  const toFieldNode = (field: BuilderField) => ({
    type: 'field' as const,
    id: field.id,
    path: field.path,
    span: { mobile: 12, tablet: field.span, desktop: field.span },
    align: field.align,
  })

  const layout: (FormSpec['layout'][number])[] = []
  let index = 0
  while (index < fields.length) {
    const field = fields[index]
    if (!field) break
    if (!field.panelId) {
      layout.push(toFieldNode(field))
      index += 1
      continue
    }
    const panelFields: BuilderField[] = []
    while (index < fields.length && fields[index]?.panelId === field.panelId) {
      panelFields.push(fields[index]!)
      index += 1
    }
    const panel = panels.find((item) => item.id === field.panelId)
    layout.push({
      type: 'panel',
      id: field.panelId,
      title: panel?.title ?? 'Untitled panel',
      ...(panel?.description ? { description: panel.description } : {}),
      children: panelFields.map(toFieldNode),
    })
  }

  return {
    ...baseSpec,
    version: '1',
    schema: { title: 'Untitled form', type: 'object', ...schema } as JsonObject,
    uiSchema: uiSchema as JsonObject,
    layout,
  }
}

export function formSpecToYaml(fields: readonly BuilderField[], panels: readonly BuilderPanel[] = [], baseSpec?: FormSpec): string {
  return stringify(buildFormSpec(fields, panels, baseSpec), { lineWidth: 0 })
}

export function defaultSpan(kind: FieldKind): number {
  return FIELD_KINDS.find((item) => item.kind === kind)?.span ?? 6
}

/** Mirrors the AForm renderer: "end"-aligned fields hug the grid's right edge (column 13), everything else packs left-to-right and wraps on its own. */
export function fieldGridColumn(field: BuilderField): string {
  return field.align === 'end' ? `span ${field.span} / -1` : `span ${field.span}`
}

/** Groups consecutive fields sharing the same panelId so the canvas can wrap them in one visual frame. */
export function groupFieldsByPanel(fields: readonly BuilderField[]): readonly { panelId?: string; fields: readonly BuilderField[] }[] {
  const groups: { panelId?: string; fields: BuilderField[] }[] = []
  for (const field of fields) {
    const last = groups.at(-1)
    if (field.panelId && last?.panelId === field.panelId) {
      last.fields.push(field)
    } else {
      groups.push({ ...(field.panelId ? { panelId: field.panelId } : {}), fields: [field] })
    }
  }
  return groups
}

export function internalPath(jsonPath: string): string {
  return jsonPath.replace(/^\$\.?/, '')
}