import { describe, expect, it } from 'vitest'
import { buildFormSpec, formSpecToBuilderRows, inferFieldKind, listDataPaths, parseExampleData } from './model'

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
      id: 'row-1',
      fields: [{
        id: 'field-1',
        path: 'customer.email',
        jsonPath: '$.customer.email',
        label: 'Email',
        kind: 'email',
        span: 6,
        align: 'start',
      }],
    }])

    expect(spec.schema).toMatchObject({
      properties: {
        customer: {
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } },
        },
      },
    })
    expect(spec.layout[0]?.children[0]?.children[0]).toMatchObject({ path: 'customer.email' })
  })

  it('converts an existing spec into editable builder rows', () => {
    const { rows, panels } = formSpecToBuilderRows({
      version: '1',
      schema: {
        type: 'object',
        properties: {
          email: { type: 'string', title: 'Work email', format: 'email' },
          message: { type: 'string', title: 'Message' },
        },
      },
      uiSchema: { message: { 'ui:widget': 'textarea' } },
      layout: [{
        type: 'row',
        children: [
          { type: 'column', span: { mobile: 12, desktop: 4 }, children: [{ type: 'field', path: 'email' }] },
          { type: 'column', span: 8, children: [{ type: 'field', path: 'message' }] },
        ],
      }],
    })

    expect(panels).toEqual([])
    expect(rows).toEqual([{
      id: 'row-1',
      fields: [
        { id: 'field-1', path: 'email', jsonPath: '$.email', label: 'Work email', kind: 'email', span: 4, align: 'start' },
        { id: 'field-2', path: 'message', jsonPath: '$.message', label: 'Message', kind: 'textarea', span: 8, align: 'start' },
      ],
    }])
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
      layout: [{ type: 'row' as const, children: [{ type: 'column' as const, children: [{ type: 'field' as const, path: 'email' }] }] }],
      validations: { async: [{ id: 'available', adapter: 'api', paths: ['email'] }] },
    }
    const { rows } = formSpecToBuilderRows(baseSpec)
    const rebuilt = buildFormSpec(rows, [], baseSpec)

    expect(rebuilt.schema).toMatchObject({ title: 'Contact', required: ['email'], properties: { email: { minLength: 3, format: 'email' } } })
    expect(rebuilt.uiSchema).toMatchObject({ email: { 'ui:placeholder': 'name@example.com', 'ui:autocomplete': 'email' } })
    expect(rebuilt.validations).toEqual(baseSpec.validations)
  })

  it('round-trips a panel grouping two rows', () => {
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
          { type: 'row' as const, children: [{ type: 'column' as const, children: [{ type: 'field' as const, path: 'email' }] }] },
          { type: 'row' as const, children: [{ type: 'column' as const, children: [{ type: 'field' as const, path: 'phone' }] }] },
        ],
      }],
    }

    const { rows, panels } = formSpecToBuilderRows(baseSpec)
    expect(panels).toEqual([{ id: 'panel-1', title: 'Contact' }])
    expect(rows.every((row) => row.panelId === 'panel-1')).toBe(true)

    const rebuilt = buildFormSpec(rows, panels, baseSpec)
    expect(rebuilt.layout).toEqual([{
      type: 'panel',
      id: 'panel-1',
      title: 'Contact',
      children: [
        { type: 'row', id: 'row-1', children: [{ type: 'column', id: 'row-1.field-1', span: { mobile: 12, tablet: 12, desktop: 12 }, align: 'start', children: [{ type: 'field', id: 'field-1', path: 'email' }] }] },
        { type: 'row', id: 'row-2', children: [{ type: 'column', id: 'row-2.field-2', span: { mobile: 12, tablet: 12, desktop: 12 }, align: 'start', children: [{ type: 'field', id: 'field-2', path: 'phone' }] }] },
      ],
    }])
  })

  it('round-trips a range field with min/max/step', () => {
    const spec = buildFormSpec([{
      id: 'row-1',
      fields: [{
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
      }],
    }])

    expect(spec.schema).toMatchObject({ properties: { satisfaction: { type: 'number', minimum: 0, maximum: 10 } } })
    expect(spec.uiSchema).toMatchObject({ satisfaction: { 'ui:widget': 'range', 'ui:options': { min: 0, max: 10, step: 1 } } })

    const { rows } = formSpecToBuilderRows(spec)
    expect(rows[0]?.fields[0]).toMatchObject({ kind: 'range', rangeMin: 0, rangeMax: 10, rangeStep: 1 })
  })

  it('round-trips an asyncOptions field with a templated source', () => {
    const spec = buildFormSpec([{
      id: 'row-1',
      fields: [{
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
      }],
    }])

    expect(spec.uiSchema).toMatchObject({
      city: { 'ui:widget': 'asyncOptions', 'ui:options': { source: '/api/cities?country={{country}}', valueKey: 'id', labelKey: 'name' } },
    })

    const { rows } = formSpecToBuilderRows(spec)
    expect(rows[0]?.fields[0]).toMatchObject({
      kind: 'asyncOptions',
      optionsSource: '/api/cities?country={{country}}',
      optionsValueKey: 'id',
      optionsLabelKey: 'name',
    })
  })
})