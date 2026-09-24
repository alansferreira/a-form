import { describe, expect, it } from 'vitest'
import { buildFormSpec, formSpecToBuilderFields, inferFieldKind, listDataPaths, parseExampleData } from './model'

describe('builder model', () => {
  it('extracts simple absolute paths from YAML example data', () => {
    const parsed = parseExampleData('customer:\n  email: ana@example.com\n  active: true\n')
    expect(parsed.error).toBeUndefined()
    expect(listDataPaths(parsed.value!)).toEqual([
      { jsonPath: '$.customer', label: 'Customer', depth: 0, branch: true, value: undefined },
      { jsonPath: '$.customer.email', label: 'Email', depth: 1, branch: false, value: 'ana@example.com' },
      { jsonPath: '$.customer.active', label: 'Active', depth: 1, branch: false, value: true },
    ])
  })

  it('accepts JSON example data', () => {
    const parsed = parseExampleData('{"customer":{"email":"ana@example.com","active":true}}')

    expect(parsed.error).toBeUndefined()
    expect(parsed.value).toEqual({ customer: { email: 'ana@example.com', active: true } })
  })

  it('infers field kinds and creates nested schema paths', () => {
    expect(inferFieldKind('customer.email', 'ana@example.com')).toBe('email')
    expect(inferFieldKind('customer.active', true)).toBe('checkbox')

    const spec = buildFormSpec([{
      id: 'field-1',
      path: 'customer.email',
      jsonPath: '$.customer.email',
      label: 'Email',
      kind: 'email',
      span: 6,
      align: 'start',
    }])

    expect(spec.schema).toMatchObject({
      properties: {
        customer: {
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } },
        },
      },
    })
    expect(spec.layout[0]).toMatchObject({ path: 'customer.email' })
  })

  it('converts an existing spec into editable builder fields', () => {
    const { fields, panels } = formSpecToBuilderFields({
      version: '1',
      schema: {
        type: 'object',
        properties: {
          email: { type: 'string', title: 'Work email', format: 'email' },
          message: { type: 'string', title: 'Message' },
        },
      },
      uiSchema: { message: { 'ui:widget': 'textarea' } },
      layout: [
        { type: 'field', path: 'email', span: { mobile: 12, desktop: 4 } },
        { type: 'field', path: 'message', span: 8 },
      ],
    })

    expect(panels).toEqual([])
    expect(fields).toEqual([
      { id: 'field-1', path: 'email', jsonPath: '$.email', label: 'Work email', kind: 'email', span: 4, align: 'start' },
      { id: 'field-2', path: 'message', jsonPath: '$.message', label: 'Message', kind: 'textarea', span: 8, align: 'start' },
    ])
  })

  it('preserves imported constraints and validations when rebuilding', () => {
    const baseSpec = {
      version: '1' as const,
      schema: {
        title: 'Contact',
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', title: 'Email', format: 'email', minLength: 3 } },
      },
      uiSchema: { email: { 'ui:placeholder': 'name@example.com' } },
      layout: [{ type: 'field' as const, path: 'email' }],
      validations: { async: [{ id: 'available', adapter: 'api', paths: ['email'] }] },
    }
    const { fields } = formSpecToBuilderFields(baseSpec)
    const rebuilt = buildFormSpec(fields, [], baseSpec)

    expect(rebuilt.schema).toMatchObject({ title: 'Contact', required: ['email'], properties: { email: { minLength: 3, format: 'email' } } })
    expect(rebuilt.uiSchema).toMatchObject({ email: { 'ui:placeholder': 'name@example.com', 'ui:autocomplete': 'email' } })
    expect(rebuilt.validations).toEqual(baseSpec.validations)
  })

  it('round-trips a panel grouping two fields', () => {
    const baseSpec = {
      version: '1' as const,
      schema: {
        type: 'object',
        properties: {
          email: { type: 'string', title: 'Email' },
          phone: { type: 'string', title: 'Phone' },
        },
      },
      layout: [{
        type: 'panel' as const,
        id: 'panel-1',
        title: 'Contact',
        children: [
          { type: 'field' as const, path: 'email' },
          { type: 'field' as const, path: 'phone' },
        ],
      }],
    }

    const { fields, panels } = formSpecToBuilderFields(baseSpec)
    expect(panels).toEqual([{ id: 'panel-1', title: 'Contact' }])
    expect(fields.every((field) => field.panelId === 'panel-1')).toBe(true)

    const rebuilt = buildFormSpec(fields, panels, baseSpec)
    expect(rebuilt.layout).toEqual([{
      type: 'panel',
      id: 'panel-1',
      title: 'Contact',
      children: [
        { type: 'field', id: 'field-1', path: 'email', span: { mobile: 12, tablet: 12, desktop: 12 }, align: 'start' },
        { type: 'field', id: 'field-2', path: 'phone', span: { mobile: 12, tablet: 12, desktop: 12 }, align: 'start' },
      ],
    }])
  })

  it('round-trips a range field with min/max/step', () => {
    const spec = buildFormSpec([{
      id: 'field-1',
      path: 'satisfaction',
      jsonPath: '$.satisfaction',
      label: 'Satisfaction',
      kind: 'range',
      span: 6,
      align: 'start',
      rangeMin: 0,
      rangeMax: 10,
      rangeStep: 1,
    }])

    expect(spec.schema).toMatchObject({ properties: { satisfaction: { type: 'number', minimum: 0, maximum: 10 } } })
    expect(spec.uiSchema).toMatchObject({ satisfaction: { 'ui:widget': 'range', 'ui:options': { min: 0, max: 10, step: 1 } } })

    const { fields } = formSpecToBuilderFields(spec)
    expect(fields[0]).toMatchObject({ kind: 'range', rangeMin: 0, rangeMax: 10, rangeStep: 1 })
  })

  it('round-trips an asyncOptions field with a templated source', () => {
    const spec = buildFormSpec([{
      id: 'field-1',
      path: 'city',
      jsonPath: '$.city',
      label: 'City',
      kind: 'asyncOptions',
      span: 6,
      align: 'start',
      optionsSource: '/api/cities?country={{country}}',
      optionsValueKey: 'id',
      optionsLabelKey: 'name',
    }])

    expect(spec.uiSchema).toMatchObject({
      city: { 'ui:widget': 'asyncOptions', 'ui:options': { source: '/api/cities?country={{country}}', valueKey: 'id', labelKey: 'name' } },
    })

    const { fields } = formSpecToBuilderFields(spec)
    expect(fields[0]).toMatchObject({
      kind: 'asyncOptions',
      optionsSource: '/api/cities?country={{country}}',
      optionsValueKey: 'id',
      optionsLabelKey: 'name',
    })
  })
})