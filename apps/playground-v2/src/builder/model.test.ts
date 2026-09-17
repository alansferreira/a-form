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
    const rows = formSpecToBuilderRows({
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

    expect(rows).toEqual([{
      id: 'row-1',
      fields: [
        { id: 'field-1', path: 'email', jsonPath: '$.email', label: 'Work email', kind: 'email', span: 4 },
        { id: 'field-2', path: 'message', jsonPath: '$.message', label: 'Message', kind: 'textarea', span: 8 },
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
    const rows = formSpecToBuilderRows(baseSpec)
    const rebuilt = buildFormSpec(rows, baseSpec)

    expect(rebuilt.schema).toMatchObject({ title: 'Contact', required: ['email'], properties: { email: { minLength: 3, format: 'email' } } })
    expect(rebuilt.uiSchema).toMatchObject({ email: { 'ui:placeholder': 'name@example.com', 'ui:autocomplete': 'email' } })
    expect(rebuilt.validations).toEqual(baseSpec.validations)
  })
})