import type { FormSpec, JsonObject, JsonValue } from 'a-form-core'
import { parseYamlSpec, validateFormSpec } from 'a-form-parser'
import { customizeValidator } from '@rjsf/validator-ajv8'
import { generateSync } from 'json-schema-faker'
import { stringify } from 'yaml'
import type { StructuredDocument, StructuredFormat } from '../components/StructuredEditor'
import { defaultSpan, formSpecToBuilderFields, inferFieldKind, isJsonValue, parseExampleData, schemaFromSamples } from './model'
import type { BuilderProject } from './project'

export function dataToFormSpec(data: JsonObject): FormSpec {
  const layout: FormSpec['layout'][number][] = []
  const visit = (object: JsonObject, parent: string) => {
    for (const [key, value] of Object.entries(object)) {
      if (!key || key.includes('.')) throw new Error(`Cannot create a layout path for the root property "${key}".`)
      const path = parent ? `${parent}.${key}` : key
      if (value !== null && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length > 0 && Object.keys(value).every((child) => child.length > 0 && !child.includes('.'))) {
        visit(value, path)
      } else {
        layout.push({ type: 'field', path, span: defaultSpan(inferFieldKind(path, value)) })
      }
    }
  }
  visit(data, '')
  return { version: '1', schema: { title: 'Generated form', ...schemaFromSamples([data]) }, layout }
}

function prepareSchema(schema: JsonValue): JsonValue {
  if (Array.isArray(schema)) return schema.map(prepareSchema)
  if (schema === null || typeof schema !== 'object') return schema
  // Only traverse schema keywords, not examples/defaults or property names.
  const result = { ...schema }
  if (typeof result.$ref === 'string' && !result.$ref.startsWith('#')) {
    throw new Error(`Example generation only supports local $ref references: ${result.$ref}`)
  }
  if ((result.type === 'array' || result.items !== undefined) && result.maxItems !== 0
    && (result.minItems === undefined || result.minItems === 0) && result.items !== false) result.minItems = 1
  for (const keyword of ['properties', 'patternProperties', 'definitions', '$defs', 'dependentSchemas']) {
    const entries = result[keyword]
    if (entries !== null && typeof entries === 'object' && !Array.isArray(entries)) {
      result[keyword] = Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, prepareSchema(value)]))
    }
  }
  for (const keyword of ['items', 'prefixItems', 'additionalItems', 'additionalProperties', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else', 'contains', 'propertyNames', 'unevaluatedProperties', 'unevaluatedItems']) {
    if (result[keyword] !== undefined) result[keyword] = prepareSchema(result[keyword])
  }
  return result
}

export function exampleDataFromSpec(spec: FormSpec): JsonObject {
  const schema = prepareSchema(structuredClone(spec.schema))
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('The spec schema must describe an object.')
  const validator = customizeValidator<JsonObject>()
  let lastError = ''
  // Complex patterns and alternatives can produce invalid candidates; never commit one.
  for (let attempt = 0; attempt < 32; attempt++) {
    const value = generateSync(schema, {
      seed: 42 + attempt,
      alwaysFakeOptionals: true,
      useDefaultValue: true,
      useExamplesValue: true,
      maxDefaultItems: 1,
      maxDepth: 32,
      failOnInvalidTypes: true,
    })
    if (!isJsonValue(value) || value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Example generation must produce an object at its root.')
    }
    const result = validator.rawValidation<{ instancePath: string; message?: string; keyword: string }>(spec.schema, value)
    if (result.validationError) throw result.validationError
    const first = result.errors?.[0]
    if (!first) return value
    lastError = `${first.instancePath || '/'} ${first.message ?? first.keyword}`
  }
  throw new Error(`Could not generate data matching the schema after 32 attempts: ${lastError}.`)
}

function serialize(value: JsonObject, format: StructuredFormat): string {
  return format === 'json' ? JSON.stringify(value, null, 2) : stringify(value, { lineWidth: 0 })
}

export type ImportedSpec = Pick<BuilderProject, 'fields' | 'separators' | 'baseSpec' | 'codeDraft' | 'codeFormat'>
  & Partial<Pick<BuilderProject, 'dataDocument' | 'previewValue'>>

export function specImportChanges(document: StructuredDocument, dataFormat: StructuredFormat, generateData: boolean): ImportedSpec {
  const parsed = parseYamlSpec(document.source)
  const diagnostics = parsed.value ? [...parsed.diagnostics, ...validateFormSpec(parsed.value)] : parsed.diagnostics
  const error = diagnostics.find(({ severity }) => severity === 'error')
  if (!parsed.value || error) throw new Error(error?.message ?? 'Invalid AForm spec.')
  const imported = formSpecToBuilderFields(parsed.value)
  const previewValue = generateData ? exampleDataFromSpec(parsed.value) : undefined
  return {
    ...imported,
    baseSpec: parsed.value,
    codeDraft: null,
    codeFormat: document.format,
    ...(previewValue ? { previewValue, dataDocument: { source: serialize(previewValue, dataFormat), format: dataFormat } } : {}),
  }
}

export function dataImportChanges(document: StructuredDocument, codeFormat: StructuredFormat, generateSpec: boolean): Partial<BuilderProject> {
  const parsed = parseExampleData(document.source)
  if (generateSpec && !parsed.value) throw new Error(parsed.error ?? 'Invalid example data.')
  const spec = generateSpec && parsed.value ? dataToFormSpec(parsed.value) : undefined
  return {
    dataDocument: document,
    ...(parsed.value ? { previewValue: parsed.value } : {}),
    ...(spec ? { ...formSpecToBuilderFields(spec), baseSpec: spec, codeDraft: null, codeFormat } : {}),
  }
}
