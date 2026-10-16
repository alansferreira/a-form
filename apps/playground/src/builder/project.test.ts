import { describe, expect, it } from 'vitest'
import {
  changeProject, createHistory, deserializeProject, HISTORY_LIMIT,
  redoProject, serializeProject, undoProject,
} from './project'
import type { BuilderProject } from './project'

const project: BuilderProject = {
  fields: [{ id: 'field-1', path: 'items', jsonPath: '$.items', label: 'Items', kind: 'array', span: 12, align: 'start' }],
  separators: [{ id: 'separator-1', title: 'Items', beforeFieldId: 'field-1' }],
  baseSpec: null,
  dataDocument: { source: 'items: []', format: 'yaml' },
  codeDraft: null,
  codeFormat: 'yaml',
  previewValue: { items: [{ name: 'One', tags: ['a', 'b'] }] },
}

describe('project history', () => {
  it('undoes and redoes atomic content changes without changing the input', () => {
    const initial = createHistory(project)
    const changed = changeProject(initial, { fields: [], separators: [] })
    expect(changed.present.fields).toEqual([])
    expect(changed.present.separators).toEqual([])
    expect(undoProject(changed).present).toEqual(project)
    expect(redoProject(undoProject(changed)).present).toEqual(changed.present)
    expect(initial.present).toBe(project)
    expect(undoProject(initial)).toBe(initial)
    expect(redoProject(initial)).toBe(initial)
  })

  it('coalesces typing in the same control but separates controls, pauses, and discrete actions', () => {
    const first = changeProject(createHistory(project), { dataDocument: { source: 'i', format: 'yaml' } }, 'data', 1000)
    const typed = changeProject(first, { dataDocument: { source: 'it', format: 'yaml' } }, 'data', 1500)
    expect(typed.past).toHaveLength(1)
    expect(undoProject(typed).present).toEqual(project)
    const paused = changeProject(typed, { dataDocument: { source: 'items', format: 'yaml' } }, 'data', 2300)
    expect(paused.past).toHaveLength(2)
    const different = changeProject(paused, { codeDraft: { source: 'v', format: 'yaml' } }, 'code', 2400)
    expect(different.past).toHaveLength(3)
    expect(changeProject(different, { fields: [] }).past).toHaveLength(4)
  })

  it('clears redo on a new change, not on no-ops, and starts a new typing group after undo', () => {
    const changed = changeProject(createHistory(project), { previewValue: { items: [] } }, 'preview', 1000)
    const undone = undoProject(changed)
    expect(changeProject(undone, { previewValue: project.previewValue })).toBe(undone)
    const branched = changeProject(undone, { previewValue: { items: ['other'] } }, 'preview', 1100)
    expect(branched.future).toEqual([])
    expect(branched.past).toHaveLength(1)
  })

  it('bounds undo history', () => {
    let history = createHistory(project)
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      history = changeProject(history, { previewValue: { count: i } })
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    expect(history.past[0]!.previewValue).toEqual({ count: 4 })
  })
})

describe('saved projects', () => {
  it('restores unfinished visual edits in both the current snapshot and undo history', () => {
    const unfinished = changeProject(createHistory(project), {
      separators: [{ ...project.separators[0]!, title: '' }],
    }, 'separator-title', 1000)
    const completed = changeProject(unfinished, {
      separators: [{ ...project.separators[0]!, title: 'Renamed' }],
    }, 'separator-title', 2000)
    expect(deserializeProject(serializeProject(unfinished)).present.separators[0]!.title).toBe('')
    expect(undoProject(deserializeProject(serializeProject(completed))).present.separators[0]!.title).toBe('')
  })

  it('round-trips history, nested values, schemas, and invalid editor drafts', () => {
    const changed = changeProject(createHistory(project), {
      baseSpec: {
        version: '1',
        schema: { type: 'object', properties: { items: { type: 'array', minItems: 1, items: { $ref: '#/definitions/item' } } }, definitions: { item: { type: 'object', properties: { name: { type: 'string' } } } } },
        uiSchema: { items: { 'ui:options': { orderable: false } } },
        layout: [{ type: 'field', path: 'items' }],
      },
      codeDraft: { source: 'schema: [', format: 'yaml' },
      dataDocument: { source: '{broken', format: 'json' },
    })
    const history = undoProject(changeProject(changed, { previewValue: { items: [] } }))
    const restored = deserializeProject(serializeProject(history))
    expect(restored).toEqual({ ...history, group: null })
    expect(redoProject(restored).present.previewValue).toEqual({ items: [] })
    expect(undoProject(restored).present).toEqual(project)
  })

  it.each([
    'not JSON',
    '{"version":2}',
    JSON.stringify({ version: 1, history: { past: [], present: { ...project, fields: [{ ...project.fields[0], kind: 'missing' }] }, future: [] } }),
    JSON.stringify({ version: 1, history: { past: [], present: { ...project, previewValue: [] }, future: [] } }),
    JSON.stringify({ version: 1, history: { past: [], present: { ...project, fields: [project.fields[0], project.fields[0]] }, future: [] } }),
    JSON.stringify({ version: 1, history: { past: [], present: { ...project, baseSpec: { version: '1', layout: [] } }, future: [] } }),
    JSON.stringify({ version: 1, history: { past: [], present: { ...project, fields: [{ ...project.fields[0], arrayAddable: 'true' }] }, future: [] } }),
  ])('rejects malformed stored content: %s', (source) => {
    expect(() => deserializeProject(source)).toThrow()
  })
})
