import { readFileSync } from 'node:fs'
import type { FormSpec, JsonObject } from 'a-form-core'
import { parseYamlSpec, validateFormSpec } from 'a-form-parser'
import validator from '@rjsf/validator-ajv8'
import { describe, expect, it } from 'vitest'
import { parse, stringify } from 'yaml'
import { dataImportChanges, dataToFormSpec, exampleDataFromSpec, specImportChanges } from './importGeneration'
import { buildFormSpec, formSpecToBuilderFields } from './model'

const specFor = (properties: JsonObject): FormSpec => ({
  version: '1', schema: { type: 'object', properties, additionalProperties: false }, layout: [],
})
const errors = (spec: FormSpec, value: JsonObject) => validator.validateFormData(value, spec.schema).errors

describe('example data from specs', () => {
  it('generates deterministic valid samples for nested types, defaults, examples, enums, constants, and constraints', () => {
    const spec = specFor({
      name: { type: 'string', default: 'Example customer' },
      email: { type: 'string', format: 'email' },
      created: { type: 'string', format: 'date-time' },
      code: { type: 'string', pattern: '^[A-Z]{3}[0-9]{2}$' },
      description: { type: 'string', minLength: 4, maxLength: 10 },
      age: { type: 'integer', minimum: 18, maximum: 80 },
      active: { type: 'boolean' },
      status: { type: 'string', enum: ['enabled', 'disabled'] },
      region: { const: 'test' },
      note: { type: 'string', examples: ['Sample note'] },
      missing: { type: 'null' },
      nested: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } },
    })
    const original = structuredClone(spec)
    const value = exampleDataFromSpec(spec)
    expect(errors(spec, value)).toEqual([])
    expect(value.name).toBe('Example customer')
    expect(value.region).toBe('test')
    expect(value.note).toBe('Sample note')
    expect(value.missing).toBeNull()
    expect(value).toHaveProperty('nested.tags.0')
    expect(exampleDataFromSpec(spec)).toEqual(value)
    expect(spec).toEqual(original)
  })

  it('resolves local references and respects empty, bounded, nested, and heterogeneous arrays', () => {
    const base = specFor({
      empty: { type: 'array', maxItems: 0, items: { type: 'string' } },
      rows: { type: 'array', minItems: 2, maxItems: 2, items: { $ref: '#/definitions/row' } },
      mixed: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
    })
    const spec: FormSpec = {
      ...base,
      schema: {
        ...base.schema,
        definitions: { row: { type: 'object', properties: { id: { type: 'integer' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['id'] } },
      },
    }
    const value = exampleDataFromSpec(spec)
    expect(errors(spec, value)).toEqual([])
    expect(value.empty).toEqual([])
    expect(value.rows).toHaveLength(2)
    expect(value).toHaveProperty('rows.0.tags.0')
  })

  it('handles exclusive alternatives and does not generate both branches', () => {
    const spec = specFor({
      env: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            valueFrom: { type: 'object', properties: { secret: { type: 'string' } }, required: ['secret'] },
          },
          required: ['name'],
          oneOf: [
            { required: ['value'], not: { required: ['valueFrom'] } },
            { required: ['valueFrom'], not: { required: ['value'] } },
          ],
        },
      },
    })
    const value = exampleDataFromSpec(spec)
    expect(errors(spec, value)).toEqual([])
  })

  it('generates valid data for the production Helm example', () => {
    const source = readFileSync(new URL('../../../../examples/helm-values-production.a-form.yaml', import.meta.url), 'utf8')
    const parsed = parseYamlSpec(source)
    expect(parsed.value).toBeDefined()
    const value = exampleDataFromSpec(parsed.value!)
    expect(errors(parsed.value!, value)).toEqual([])
    expect(value).toHaveProperty('worker.worker.env.0')
    expect(value).toHaveProperty('worker.externalSecrets.secrets.0.dataFrom.0.extract.key')
  })

  it('leaves literal references inside defaults untouched', () => {
    const spec = specFor({ metadata: { type: 'object', default: { $ref: 'literal-data' } } })
    expect(exampleDataFromSpec(spec).metadata).toEqual({ $ref: 'literal-data' })
  })

  it('validates the current schema when different imports reuse the same $id', () => {
    const first: FormSpec = { ...specFor({ name: { const: 'First' } }), schema: { ...specFor({ name: { const: 'First' } }).schema, $id: 'urn:studio:sample' } }
    const second: FormSpec = { ...first, schema: { ...first.schema, properties: { name: { const: 'Second' } } } }
    expect(exampleDataFromSpec(first)).toEqual({ name: 'First' })
    expect(exampleDataFromSpec(second)).toEqual({ name: 'Second' })
  })

  it('fails explicitly for remote references, impossible schemas, and invalid defaults', () => {
    expect(() => exampleDataFromSpec(specFor({ x: { $ref: 'https://example.com/schema.json' } }))).toThrow('local $ref')
    expect(() => exampleDataFromSpec(specFor({ x: { type: 'integer', enum: ['not an integer'] } }))).toThrow()
    expect(() => exampleDataFromSpec(specFor({ x: { type: 'string', minLength: 4, default: 'a' } }))).toThrow('matching the schema')
  })
})

describe('specs from data', () => {
  it('preserves nested structure, heterogeneous item types, null, empty objects, and arrays', () => {
    const data: JsonObject = {
      customer: { name: 'Example', active: false, missing: null },
      rows: [{ id: 1 }, { id: 2, name: 'Two' }],
      mixed: ['text', 1, null],
      matrix: [[1, 2]],
      empty: [],
      metadata: {},
    }
    const spec = dataToFormSpec(data)
    const imported = formSpecToBuilderFields(spec)
    const generated = buildFormSpec(imported.fields, imported.separators, spec)
    expect(validateFormSpec(generated).filter(({ severity }) => severity === 'error')).toEqual([])
    expect(errors(generated, data)).toEqual([])
    expect(generated.schema).toHaveProperty('properties.customer.properties.missing.type', 'null')
    expect(spec.schema).toHaveProperty('properties.rows.items.properties.name.type', 'string')
    expect(spec.schema).toHaveProperty('properties.mixed.items.anyOf')
    expect(spec.schema).toHaveProperty('properties.matrix.items.items.type', 'number')
    expect(spec.schema).toHaveProperty('properties.empty.items.type', 'string')
    expect(spec.layout.map((node) => node.type === 'field' ? node.path : '')).toEqual([
      'customer.name', 'customer.active', 'customer.missing', 'rows', 'mixed', 'matrix', 'empty', 'metadata',
    ])
  })

  it('groups objects with dotted child keys instead of changing their structure', () => {
    const data = { annotations: { 'example.com/key': 'a', 'a.b': 'b' } }
    const spec = dataToFormSpec(data)
    const fields = formSpecToBuilderFields(spec).fields
    expect(fields.map(({ path }) => path)).toEqual(['annotations'])
    expect(errors(buildFormSpec(fields, [], spec), data)).toEqual([])
    expect(() => dataToFormSpec({ 'a.b': 1 })).toThrow('root property')
    expect(() => dataToFormSpec({ '': 1 })).toThrow('root property')
  })

  it('supports an empty root object without inventing fields', () => {
    expect(dataToFormSpec({}).layout).toEqual([])
    expect(errors(dataToFormSpec({}), {})).toEqual([])
  })
})

describe('paired import changes', () => {
  it.each(['yaml', 'json'] as const)('imports a spec and generates data in the target %s format', (format) => {
    const spec = specFor({ name: { type: 'string', default: 'Generated' } })
    const changes = specImportChanges({ source: stringify(spec), format: 'yaml' }, format, true)
    expect(changes.baseSpec).toEqual(spec)
    expect(changes.previewValue).toEqual({ name: 'Generated' })
    expect(changes.dataDocument!.format).toBe(format)
    expect(parse(changes.dataDocument!.source)).toEqual(changes.previewValue)
    expect(changes.codeDraft).toBeNull()
  })

  it('does not replace data when applying a spec without generation', () => {
    const changes = specImportChanges({ source: stringify(specFor({})), format: 'yaml' }, 'yaml', false)
    expect(changes).not.toHaveProperty('previewValue')
    expect(changes).not.toHaveProperty('dataDocument')
  })

  it('preserves integer, nullable, format, and validation constraints in the Studio after import', () => {
    const spec: FormSpec = {
      ...specFor({
        age: { type: 'integer', minimum: 18, maximum: 80 },
        token: { type: 'string', format: 'uuid' },
        missing: { type: 'null' },
        alternative: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      }),
      layout: ['age', 'token', 'missing', 'alternative'].map((path) => ({ type: 'field', path })),
    }
    const changes = specImportChanges({ source: stringify(spec), format: 'yaml' }, 'yaml', true)
    const result = buildFormSpec(changes.fields, changes.separators, changes.baseSpec!)
    expect(result.schema).toHaveProperty('properties.age.type', 'integer')
    expect(result.schema).toHaveProperty('properties.age.minimum', 18)
    expect(result.schema).toHaveProperty('properties.token.format', 'uuid')
    expect(result.schema).toHaveProperty('properties.missing.type', 'null')
    expect(result.schema).toHaveProperty('properties.alternative.anyOf', [{ type: 'string' }, { type: 'number' }])
    expect(errors(result, changes.previewValue!)).toEqual([])
  })

  it('creates a spec alongside imported data without changing the imported values or source', () => {
    const document = { source: '{"customer":{"name":"Original"},"rows":[1,2]}', format: 'json' as const }
    const changes = dataImportChanges(document, 'yaml', true)
    expect(changes.dataDocument).toBe(document)
    expect(changes.previewValue).toEqual(JSON.parse(document.source))
    expect(changes.baseSpec!.schema).toHaveProperty('properties.rows.type', 'array')
    expect(changes.fields!.map(({ path }) => path)).toEqual(['customer.name', 'rows'])
    expect(changes.codeFormat).toBe('yaml')
    expect(changes.codeDraft).toBeNull()
  })

  it('keeps invalid raw data as a draft only when generation is unchecked', () => {
    const document = { source: 'data: [', format: 'yaml' as const }
    expect(dataImportChanges(document, 'yaml', false)).toEqual({ dataDocument: document })
    expect(() => dataImportChanges(document, 'yaml', true)).toThrow()
    expect(() => dataImportChanges({ source: 'x: .inf', format: 'yaml' }, 'yaml', true)).toThrow()
    expect(() => specImportChanges({ source: 'schema: [', format: 'yaml' }, 'yaml', true)).toThrow()
  })
})
