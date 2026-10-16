// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { parse, stringify } from 'yaml'
import { BuilderApp } from './BuilderApp'
import { changeProject, deserializeProject, PROJECT_STORAGE_KEY, serializeProject } from './project'

vi.mock('../monaco', () => ({
  Editor: ({ value, 'aria-label': label, onChange }: {
    value: string
    'aria-label': string
    onChange: (value: string) => void
  }) => <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />,
}))

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true })
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = false })
const mounted: { root: ReturnType<typeof createRoot>; container: HTMLElement }[] = []
beforeEach(() => { localStorage.clear() })
afterEach(() => {
  mounted.forEach(({ root, container }) => {
    act(() => root.unmount())
    container.remove()
  })
  mounted.length = 0
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
})

async function mountBuilder() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  await act(async () => root.render(<BuilderApp />))
  return container
}

function getButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((button) =>
    button.getAttribute('aria-label') === text || button.textContent?.trim() === text,
  )
  if (!button) throw new Error(`Button ${text} was not rendered.`)
  return button
}

async function click(container: HTMLElement, text: string) {
  await act(async () => getButton(container, text).click())
}

async function edit(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function flushSave() {
  await act(async () => { window.dispatchEvent(new Event('pagehide')) })
}

function unmountBuilder() {
  const { root, container } = mounted.pop()!
  act(() => root.unmount())
  container.remove()
}

async function importDialog(container: HTMLElement, area: string, source: string, generateRelated = false) {
  await click(container.querySelector<HTMLElement>(area)!, 'Import')
  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
  await edit(dialog.querySelector<HTMLTextAreaElement>('textarea')!, source)
  const checkbox = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  expect(checkbox.checked).toBe(false)
  if (generateRelated) await act(async () => checkbox.click())
  return dialog
}

it('keeps array inspector options when switching from design to preview and code', async () => {
  const container = await mountBuilder()
  const button = (text: string) => {
    return getButton(container, text)
  }
  await act(async () => button('Array').click())
  await act(async () => button('Append field to canvas').click())
  const options = container.querySelectorAll<HTMLInputElement>('.builder-array-options input')
  expect(options).toHaveLength(3)
  await act(async () => options[2]!.click())
  expect(options[2]!.checked).toBe(false)

  await act(async () => button('Preview').click())
  const array = container.querySelector('[data-a-form-array="fields.array4"]')
  expect(array).not.toBeNull()
  const add = () => array!.querySelector<HTMLButtonElement>('[id$="__add"]')!
  await act(async () => add().click())
  await act(async () => add().click())
  expect(array!.querySelectorAll('[id$="__moveUp"],[id$="__moveDown"]')).toHaveLength(0)
  expect(array!.querySelectorAll('[id$="__remove"]')).toHaveLength(2)

  await act(async () => button('Code (YAML)').click())
  const source = container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!.value
  const spec = parse(source)
  expect(spec.schema.properties.fields.properties.array4.type).toBe('array')
  expect(spec.uiSchema.fields.array4['ui:options']).toEqual({
    addable: true, removable: true, orderable: false,
  })
})

it('keeps preview values across navigation, themes, and reload, with undo and redo after reload', async () => {
  let container = await mountBuilder()
  await click(container, 'Preview')
  const nameInput = () => container.querySelector<HTMLInputElement>('[id="root.customer.firstName"]')!
  expect(nameInput().value).toBe('Ana')
  await edit(nameInput(), 'Beatriz')
  await click(container, 'Design')
  await click(container, 'Code (YAML)')
  await click(container, 'Preview')
  expect(nameInput().value).toBe('Beatriz')
  const theme = container.querySelector<HTMLSelectElement>('.builder-theme-control select')!
  await act(async () => {
    theme.value = 'bootstrap'
    theme.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(nameInput().value).toBe('Beatriz')
  await flushSave()
  unmountBuilder()
  container = await mountBuilder()
  await click(container, 'Preview')
  expect(nameInput().value).toBe('Beatriz')
  await click(container, 'Undo')
  expect(nameInput().value).toBe('Ana')
  await click(container, 'Redo')
  expect(nameInput().value).toBe('Beatriz')
})

it('preserves invalid code drafts and refuses to leave Code or overwrite them by reselecting the tab', async () => {
  let container = await mountBuilder()
  await click(container, 'Code (YAML)')
  const editor = () => container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!
  await edit(editor(), 'schema: [')
  await click(container, 'Code (YAML)')
  expect(editor().value).toBe('schema: [')
  await click(container, 'Preview')
  expect(editor().value).toBe('schema: [')
  expect(container.textContent).toContain('Could not apply YAML')
  expect(container.querySelector<HTMLFieldSetElement>('[aria-label="Field properties"]')!.disabled).toBe(true)
  await flushSave()
  unmountBuilder()
  container = await mountBuilder()
  expect(editor().value).toBe('schema: [')
  await click(container, 'Undo')
  expect(editor().value).toContain('version:')
  await click(container, 'Design')
  expect(container.querySelector('.builder-grid-canvas')).not.toBeNull()
  await click(container, 'Redo')
  expect(editor().value).toBe('schema: [')
})

it('applies valid code atomically, preserves the target view, and restores the draft on undo', async () => {
  const container = await mountBuilder()
  await click(container, 'Code (YAML)')
  const editor = container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!
  const spec = parse(editor.value)
  spec.schema.title = 'Updated from code'
  const source = stringify(spec)
  await edit(editor, source)
  await click(container, 'Preview')
  expect(container.querySelector('.builder-preview-stage h2')!.textContent).toBe('Updated from code')
  await click(container, 'Undo')
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!.value).toBe(source)
  await click(container, 'Redo')
  expect(container.querySelector('.builder-preview-stage h2')!.textContent).toBe('Updated from code')
})

it('restores layout, inspector changes, data source drafts, and unique IDs after reload', async () => {
  let container = await mountBuilder()
  await edit(container.querySelector<HTMLInputElement>('.builder-properties label input')!, 'Customer name')
  await click(container, 'Array')
  await click(container, 'Append field to canvas')
  await click(container, 'Add separator')
  await click(container, 'Data Source')
  await edit(container.querySelector<HTMLTextAreaElement>('[aria-label="Example data"]')!, 'customer: [')
  await flushSave()
  unmountBuilder()
  container = await mountBuilder()
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(4)
  expect(container.querySelector('.builder-field-block')!.textContent).toContain('Customer name')
  expect(container.querySelectorAll('.builder-separator')).toHaveLength(1)
  await click(container, 'Data Source')
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Example data"]')!.value).toBe('customer: [')
  await click(container, 'Array')
  await click(container, 'Append field to canvas')
  await click(container, 'Code (YAML)')
  const spec = parse(container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!.value)
  expect(spec.schema.properties.fields.properties.array4.type).toBe('array')
  expect(spec.schema.properties.fields.properties.array5.type).toBe('array')
})

it('updates preview from valid source data but keeps the last valid values during invalid drafts', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000)
  const container = await mountBuilder()
  await click(container, 'Data Source')
  const source = container.querySelector<HTMLTextAreaElement>('[aria-label="Example data"]')!
  await edit(source, 'customer:\n  firstName: Carla\n')
  await edit(source, 'customer: [')
  await click(container, 'Preview')
  expect(container.querySelector<HTMLInputElement>('[id="root.customer.firstName"]')!.value).toBe('Carla')
  await click(container, 'Undo')
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Example data"]')!.value).toContain('firstName: Ana')
})

it('records array operations separately and restores their values after navigation and reload', async () => {
  let container = await mountBuilder()
  await click(container, 'Array')
  await click(container, 'Append field to canvas')
  await click(container, 'Preview')
  const array = () => container.querySelector('[data-a-form-array="fields.array4"]')!
  const arrayButton = async (suffix: string) => {
    await act(async () => array().querySelector<HTMLButtonElement>(`[id$="${suffix}"]`)!.click())
  }
  const items = () => Array.from(array().querySelectorAll<HTMLInputElement>('input')).map((input) => input.value)
  await arrayButton('__add')
  await arrayButton('__add')
  expect(items()).toEqual(['', ''])
  await click(container, 'Undo')
  expect(items()).toEqual([''])
  await click(container, 'Redo')
  await edit(array().querySelectorAll<HTMLInputElement>('input')[0]!, 'First')
  await edit(array().querySelectorAll<HTMLInputElement>('input')[1]!, 'Second')
  await arrayButton('.0__moveDown')
  expect(items()).toEqual(['Second', 'First'])
  await click(container, 'Undo')
  expect(items()).toEqual(['First', 'Second'])
  await click(container, 'Redo')
  await arrayButton('.0__remove')
  expect(items()).toEqual(['First'])
  await click(container, 'Undo')
  expect(items()).toEqual(['Second', 'First'])
  await click(container, 'Design')
  await click(container, 'Preview')
  expect(items()).toEqual(['Second', 'First'])
  await flushSave()
  unmountBuilder()
  container = await mountBuilder()
  await click(container, 'Preview')
  expect(items()).toEqual(['Second', 'First'])
})

it('undoes removing a field and moving its separator anchor in one step', async () => {
  const container = await mountBuilder()
  await click(container, 'Add separator')
  await click(container, 'Remove field')
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(2)
  expect(container.querySelector('.builder-flow-grid > .builder-field-block')!.textContent).toContain('Email')
  await click(container, 'Undo')
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(3)
  expect(container.querySelector('.builder-flow-grid > :first-child')!.classList.contains('builder-separator')).toBe(true)
  expect(container.querySelector('.builder-flow-grid > :nth-child(2)')!.textContent).toContain('First name')
  await click(container, 'Redo')
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(2)
})

it('debounces autosave and flushes pending changes before unload', async () => {
  vi.useFakeTimers()
  const container = await mountBuilder()
  await act(async () => { vi.advanceTimersByTime(300) })
  const previous = localStorage.getItem(PROJECT_STORAGE_KEY)!
  await edit(container.querySelector<HTMLInputElement>('.builder-properties label input')!, 'Saved name')
  await act(async () => { vi.advanceTimersByTime(299) })
  expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(previous)
  await act(async () => { vi.advanceTimersByTime(1) })
  expect(deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present.fields[0]!.label).toBe('Saved name')
  expect(container.querySelector('.builder-save-status')!.textContent).toBe('Saved locally')
  await edit(container.querySelector<HTMLInputElement>('.builder-properties label input')!, 'Final name')
  const unload = new Event('beforeunload', { cancelable: true })
  await act(async () => { window.dispatchEvent(unload) })
  expect(unload.defaultPrevented).toBe(false)
  expect(deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present.fields[0]!.label).toBe('Final name')
})

it('preserves a corrupt saved copy until explicit replacement', async () => {
  localStorage.setItem(PROJECT_STORAGE_KEY, '{corrupt')
  const container = await mountBuilder()
  expect(container.querySelector('[role="alert"]')!.textContent).toContain('has not been overwritten')
  await flushSave()
  expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe('{corrupt')
  expect(getButton(container, 'Download saved copy')).toBeDefined()
  const unload = new Event('beforeunload', { cancelable: true })
  await act(async () => { window.dispatchEvent(unload) })
  expect(unload.defaultPrevented).toBe(true)
  await click(container, 'Replace saved copy with this project')
  expect(deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present.fields).toHaveLength(3)
  expect(container.querySelector('.builder-storage-alert')).toBeNull()
})

it('shows quota errors without losing in-memory work and can retry saving', async () => {
  const container = await mountBuilder()
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
  })
  await edit(container.querySelector<HTMLInputElement>('.builder-properties label input')!, 'Still here')
  await flushSave()
  expect(container.querySelector('.builder-storage-alert')!.textContent).toContain('Storage quota exceeded')
  expect(container.querySelector<HTMLInputElement>('.builder-properties label input')!.value).toBe('Still here')
  expect(container.querySelector('.builder-save-status')!.textContent).toBe('Not saved')
  write.mockRestore()
  await click(container, 'Retry saving')
  expect(deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present.fields[0]!.label).toBe('Still here')
  expect(container.querySelector('.builder-storage-alert')).toBeNull()
})

it('keeps the playground usable when browser storage is blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Access denied', 'SecurityError')
  })
  const container = await mountBuilder()
  expect(container.querySelector('.builder-storage-alert')!.textContent).toContain('Browser storage is unavailable')
  await click(container, 'Array')
  await click(container, 'Append field to canvas')
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(4)
  await click(container, 'Undo')
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(3)
})

it('does not overwrite another tab even before its storage event arrives, and can load its copy', async () => {
  const container = await mountBuilder()
  await flushSave()
  const saved = deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!)
  const other = serializeProject(changeProject(saved, {
    fields: saved.present.fields.map((field, index) => index === 0 ? { ...field, label: 'Other tab' } : field),
  }))
  await edit(container.querySelector<HTMLInputElement>('.builder-properties label input')!, 'This tab')
  localStorage.setItem(PROJECT_STORAGE_KEY, other)
  await flushSave()
  expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(other)
  expect(container.querySelector('.builder-storage-alert')!.textContent).toContain('Another tab')
  expect(container.querySelector<HTMLInputElement>('.builder-properties label input')!.value).toBe('This tab')
  await click(container, 'Load saved copy (discard this tab)')
  expect(container.querySelector<HTMLInputElement>('.builder-properties label input')!.value).toBe('Other tab')
})

it('pauses saving on cross-tab storage events until the user chooses this copy', async () => {
  const container = await mountBuilder()
  await flushSave()
  const saved = localStorage.getItem(PROJECT_STORAGE_KEY)!
  await edit(container.querySelector<HTMLInputElement>('.builder-properties label input')!, 'This tab')
  const other = serializeProject(changeProject(deserializeProject(saved), { previewValue: { external: true } }))
  localStorage.setItem(PROJECT_STORAGE_KEY, other)
  await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: PROJECT_STORAGE_KEY, newValue: other })) })
  await flushSave()
  expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(other)
  await click(container, 'Replace saved copy with this project')
  expect(deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present.fields[0]!.label).toBe('This tab')
  expect(container.querySelector('.builder-storage-alert')).toBeNull()
})

const importedSpec = {
  version: '1',
  schema: {
    type: 'object',
    properties: {
      customer: { type: 'object', properties: { name: { type: 'string', default: 'Generated customer' } } },
      rows: { type: 'array', items: { type: 'object', properties: { active: { type: 'boolean' } } } },
    },
  },
  layout: [{ type: 'field', path: 'customer.name' }, { type: 'field', path: 'rows' }],
}

it('imports a spec without replacing existing data when generation is unchecked', async () => {
  const container = await mountBuilder()
  await click(container, 'Code (YAML)')
  const source = stringify(importedSpec)
  const dialog = await importDialog(container, '.builder-code-stage', source)
  await click(dialog, 'Import')
  expect(container.querySelector('[role="dialog"]')).toBeNull()
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!.value).toBe(source)
  await flushSave()
  const project = deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present
  expect(project.dataDocument.source).toContain('firstName: Ana')
  expect(project.previewValue).toHaveProperty('customer.firstName', 'Ana')
  expect(project.codeDraft!.source).toBe(source)
})

it('imports a spec with generated data as one undoable change and restores both after reload', async () => {
  let container = await mountBuilder()
  await click(container, 'Code (YAML)')
  const dialog = await importDialog(container, '.builder-code-stage', stringify(importedSpec), true)
  expect(dialog.textContent).toContain('replace the data source and preview values')
  await click(dialog, 'Import')
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(2)
  const data = () => parse(container.querySelector<HTMLTextAreaElement>('[aria-label="Example data"]')!.value)
  expect(data()).toHaveProperty('customer.name', 'Generated customer')
  expect(data().rows).toHaveLength(1)
  await flushSave()
  let saved = deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!)
  expect(saved.past).toHaveLength(1)
  expect(saved.present.previewValue).toEqual(data())
  await click(container, 'Undo')
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(3)
  expect(data()).toHaveProperty('customer.firstName', 'Ana')
  await click(container, 'Redo')
  expect(data()).toHaveProperty('customer.name', 'Generated customer')
  await flushSave()
  unmountBuilder()
  container = await mountBuilder()
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(2)
  await click(container, 'Data Source')
  expect(data()).toHaveProperty('customer.name', 'Generated customer')
  await click(container, 'Preview')
  expect(container.querySelector<HTMLInputElement>('[id="root.customer.name"]')!.value).toBe('Generated customer')
  await flushSave()
  saved = deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!)
  expect(saved.present.previewValue).toHaveProperty('customer.name', 'Generated customer')
})

it('generates a spec from imported JSON data and atomically replaces an older code draft', async () => {
  const container = await mountBuilder()
  await click(container, 'Code (YAML)')
  await edit(container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!, 'schema: [')
  await click(container, 'Data Source')
  const value = { account: { name: 'Imported name' }, rows: [{ id: 1, tags: ['test'] }], missing: null }
  const source = JSON.stringify(value)
  const dialog = await importDialog(container, '.builder-data-editor', source, true)
  await click(dialog.querySelector<HTMLElement>('.structured-editor-format-switch')!, 'json')
  await click(dialog, 'Import')
  expect(container.querySelector('[role="dialog"]')).toBeNull()
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(3)
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Example data"]')!.value).toBe(source)
  await flushSave()
  let project = deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present
  expect(project.dataDocument.format).toBe('json')
  expect(project.previewValue).toEqual(value)
  expect(project.codeDraft).toBeNull()
  expect(project.fields.map(({ path }) => path)).toEqual(['account.name', 'rows', 'missing'])
  await click(container, 'Undo')
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!.value).toBe('schema: [')
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Example data"]')!.value).toContain('firstName: Ana')
  await click(container, 'Redo')
  await click(container, 'Code (YAML)')
  const spec = parse(container.querySelector<HTMLTextAreaElement>('[aria-label="AForm schema"]')!.value)
  expect(spec.schema.properties.missing.type).toBe('null')
  expect(spec.schema.properties.rows.items.properties.tags.items.type).toBe('string')
  await flushSave()
  project = deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present
  expect(project.previewValue).toEqual(value)
})

it('imports data without replacing the spec when generation is unchecked', async () => {
  const container = await mountBuilder()
  await click(container, 'Data Source')
  const dialog = await importDialog(container, '.builder-data-editor', 'other:\n  value: 123\n')
  await click(dialog, 'Import')
  expect(container.querySelectorAll('.builder-field-block')).toHaveLength(3)
  await flushSave()
  const project = deserializeProject(localStorage.getItem(PROJECT_STORAGE_KEY)!).present
  expect(project.baseSpec).toBeNull()
  expect(project.previewValue).toEqual({ other: { value: 123 } })
})

it('keeps failed data generation in the import dialog without changing either document', async () => {
  const container = await mountBuilder()
  await click(container, 'Data Source')
  await flushSave()
  const previous = localStorage.getItem(PROJECT_STORAGE_KEY)
  const dialog = await importDialog(container, '.builder-data-editor', 'broken: [', true)
  await click(dialog, 'Import')
  expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  expect(dialog.querySelector('[role="alert"]')!.textContent).toContain('Could not import')
  expect(dialog.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('broken: [')
  await flushSave()
  expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(previous)
})

it('keeps failed spec generation open without replacing the existing project', async () => {
  const container = await mountBuilder()
  await click(container, 'Code (YAML)')
  await flushSave()
  const previous = localStorage.getItem(PROJECT_STORAGE_KEY)
  const spec = { ...importedSpec, schema: { type: 'object', properties: { x: { $ref: 'https://example.com/schema.json' } } }, layout: [{ type: 'field', path: 'x' }] }
  const dialog = await importDialog(container, '.builder-code-stage', stringify(spec), true)
  await click(dialog, 'Import')
  expect(dialog.querySelector('[role="alert"]')!.textContent).toContain('only supports local $ref')
  await flushSave()
  expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(previous)
})

it('resets the generation checkbox when an import is canceled and reopened', async () => {
  const container = await mountBuilder()
  await click(container, 'Code (YAML)')
  const dialog = await importDialog(container, '.builder-code-stage', stringify(importedSpec), true)
  await click(dialog, 'Cancel')
  await click(container.querySelector<HTMLElement>('.builder-code-stage')!, 'Import')
  expect(container.querySelector<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')!.checked).toBe(false)
})
