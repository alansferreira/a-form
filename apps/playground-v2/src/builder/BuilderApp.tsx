import type { FormSpec, JsonObject, NormalizedFormSpec } from 'a-form-core'
import { normalizeFormSpec, parseYamlSpec, validateFormSpec } from 'a-form-parser'
import { AForm } from 'a-form-react'
import {
  AlignLeft,
  Braces,
  Check,
  CheckSquare,
  ChevronRight,
  CircleDot,
  Clipboard,
  Code2,
  Database,
  Download,
  Eye,
  FileUp,
  GripVertical,
  Hash,
  Laptop,
  List,
  Mail,
  Monitor,
  Plus,
  Play,
  RotateCcw,
  Rows3,
  Settings2,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDeferredValue, useRef, useState } from 'react'
import { Editor } from '../monaco'
import {
  buildFormSpec,
  defaultSpan,
  FIELD_KINDS,
  formSpecToBuilderRows,
  formSpecToYaml,
  inferFieldKind,
  internalPath,
  listDataPaths,
  parseExampleData,
} from './model'
import type { BuilderField, BuilderRow, FieldKind, PalettePayload } from './model'
import { TouchDragOverlay } from './TouchDragOverlay'
import { useTouchDrag } from './useTouchDrag'
import './BuilderApp.css'

const exampleData = `customer:
  firstName: Ana
  lastName: Ferreira
  email: ana@example.com
  age: 32
  acceptsTerms: true
  contactMethod: email
  address:
    city: Sao Paulo
    postalCode: 01001-000
`

const initialRows: readonly BuilderRow[] = [
  {
    id: 'row-1',
    fields: [
      { id: 'field-1', path: 'customer.firstName', jsonPath: '$.customer.firstName', label: 'First name', kind: 'text', span: 6, sampleValue: 'Ana' },
      { id: 'field-2', path: 'customer.email', jsonPath: '$.customer.email', label: 'Email', kind: 'email', span: 6, sampleValue: 'ana@example.com' },
    ],
  },
  {
    id: 'row-2',
    fields: [
      { id: 'field-3', path: 'customer.acceptsTerms', jsonPath: '$.customer.acceptsTerms', label: 'Accepts terms', kind: 'checkbox', span: 12, sampleValue: true },
    ],
  },
]

type BuilderView = 'design' | 'code' | 'preview'
type InspectorView = 'properties' | 'spec'
type SourceView = 'data' | 'fields'
type Viewport = 'mobile' | 'tablet' | 'desktop'
type ImportMode = 'replace' | 'merge'

const initialImportSource = `person:
  name: Johnathan Vance
  email: name@example.com
  phone: +1 (555) 019-2834
  company: Acme Corp
  role: Lead Architect
`

const kindIcons: Record<FieldKind, LucideIcon> = {
  text: Type,
  email: Mail,
  number: Hash,
  textarea: AlignLeft,
  checkbox: CheckSquare,
  radio: CircleDot,
  select: List,
}

const viewports: readonly { id: Viewport; label: string; icon: LucideIcon }[] = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
]

function payloadKey(payload: PalettePayload): string {
  return payload.source === 'canvas' ? payload.fieldId ?? '' : payload.jsonPath ?? payload.kind
}

function Preview({ spec, viewport }: { spec: NormalizedFormSpec; viewport: Viewport }) {
  const [value, setValue] = useState<JsonObject>({})
  return (
    <div className={`builder-preview-frame builder-preview-${viewport}`}>
      <div className="builder-form-canvas">
        <div className="builder-form-heading">
          <span>LIVE FORM / 01</span>
          <h2>Untitled form</h2>
          <p>Generated from the current virtual grid.</p>
        </div>
        <AForm spec={spec} viewport={viewport} value={value} onChange={setValue} noHtml5Validate />
      </div>
    </div>
  )
}

export function BuilderApp() {
  const [dataSource, setDataSource] = useState(exampleData)
  const [rows, setRows] = useState<readonly BuilderRow[]>(initialRows)
  const [baseSpec, setBaseSpec] = useState<FormSpec>()
  const [selectedFieldId, setSelectedFieldId] = useState<string>('field-1')
  const [pendingPayload, setPendingPayload] = useState<PalettePayload>()
  const [view, setView] = useState<BuilderView>('design')
  const [inspectorView, setInspectorView] = useState<InspectorView>('properties')
  const [sourceView, setSourceView] = useState<SourceView>('fields')
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [notice, setNotice] = useState('Drag a source into any available grid slot.')
  const [copied, setCopied] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importSource, setImportSource] = useState(initialImportSource)
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [codeDraft, setCodeDraft] = useState('')
  const fieldSequence = useRef(4)
  const rowSequence = useRef(3)
  const importInput = useRef<HTMLInputElement>(null)
  const deferredDataSource = useDeferredValue(dataSource)
  const parsedData = parseExampleData(deferredDataSource)
  const dataPaths = parsedData.value ? listDataPaths(parsedData.value) : []
  const spec = buildFormSpec(rows, baseSpec)
  const normalized = normalizeFormSpec(spec)
  const specYaml = formSpecToYaml(rows, baseSpec)
  const selectedField = rows.flatMap((row) => row.fields).find((field) => field.id === selectedFieldId)
  const placedPaths = new Set(rows.flatMap((row) => row.fields.map((field) => field.path)))

  const selectView = (nextView: BuilderView) => {
    if (nextView === 'code') setCodeDraft(specYaml)
    setView(nextView)
  }

  const beginDrag = (event: React.DragEvent, payload: PalettePayload) => {
    event.dataTransfer.effectAllowed = payload.source === 'canvas' ? 'move' : 'copy'
    event.dataTransfer.setData('application/x-a-form-builder', JSON.stringify(payload))
    setPendingPayload(payload)
  }

  const createField = (payload: PalettePayload): BuilderField => {
    const id = `field-${fieldSequence.current++}`
    const path = payload.path ?? `fields.${payload.kind}${id.replace('field-', '')}`
    return {
      id,
      path,
      jsonPath: payload.jsonPath ?? `$.${path}`,
      label: payload.label,
      kind: payload.kind,
      span: defaultSpan(payload.kind),
      sampleValue: payload.sampleValue,
    }
  }

  const placeField = (payload: PalettePayload, rowId: string, slot: number) => {
    const movingField = payload.source === 'canvas'
      ? rows.flatMap((row) => row.fields).find((field) => field.id === payload.fieldId)
      : undefined
    const field = movingField ?? createField(payload)
    const withoutMoving = rows.map((row) => ({
      ...row,
      fields: row.fields.filter((item) => item.id !== movingField?.id),
    }))
    const duplicate = withoutMoving.flatMap((row) => row.fields).some((item) => item.path === field.path)
    if (duplicate) {
      setNotice(`${field.jsonPath} is already placed on the canvas.`)
      return
    }

    const target = withoutMoving.find((row) => row.id === rowId)
    if (!target) return
    const used = target.fields.reduce((total, item) => total + item.span, 0)
    if (used + field.span > 12) {
      setNotice(`Row has ${12 - used} columns available; ${field.label} needs ${field.span}.`)
      return
    }

    let cursor = 0
    let insertAt = target.fields.length
    target.fields.some((item, index) => {
      const midpoint = cursor + item.span / 2
      if (slot < midpoint) {
        insertAt = index
        return true
      }
      cursor += item.span
      return false
    })
    const nextFields = [...target.fields]
    nextFields.splice(insertAt, 0, field)
    setRows(withoutMoving.map((row) => row.id === rowId ? { ...row, fields: nextFields } : row))
    setSelectedFieldId(field.id)
    setPendingPayload(undefined)
    setInspectorView('properties')
    setNotice(`${field.label} placed in ${rowId}.`)
  }

  const { bindTouchHandle, touchDrag } = useTouchDrag((payload, target) => {
    placeField(payload, target.rowId, target.slot)
  })

  const dropOnRow = (event: React.DragEvent<HTMLDivElement>, rowId: string) => {
    event.preventDefault()
    const rawPayload = event.dataTransfer.getData('application/x-a-form-builder')
    if (!rawPayload) return
    const rect = event.currentTarget.getBoundingClientRect()
    const slot = Math.max(0, Math.min(11, Math.floor(((event.clientX - rect.left) / rect.width) * 12)))
    placeField(JSON.parse(rawPayload) as PalettePayload, rowId, slot)
  }

  const addRow = () => {
    const id = `row-${rowSequence.current++}`
    setRows((current) => [...current, { id, fields: [] }])
    setNotice(`${id} added. Select a source, then click a slot.`)
  }

  const removeRow = (rowId: string) => {
    const row = rows.find((item) => item.id === rowId)
    if (row?.fields.some((field) => field.id === selectedFieldId)) setSelectedFieldId('')
    setRows((current) => current.filter((item) => item.id !== rowId))
  }

  const updateSelected = (changes: Partial<BuilderField>) => {
    setRows((current) => current.map((row) => ({
      ...row,
      fields: row.fields.map((field) => field.id === selectedFieldId ? { ...field, ...changes } : field),
    })))
  }

  const updateSpan = (span: number) => {
    const row = rows.find((item) => item.fields.some((field) => field.id === selectedFieldId))
    if (!row || !selectedField) return
    const otherColumns = row.fields.reduce((total, field) => total + (field.id === selectedFieldId ? 0 : field.span), 0)
    if (otherColumns + span > 12) {
      setNotice(`This row only has ${12 - otherColumns} columns available.`)
      return
    }
    updateSelected({ span })
  }

  const removeSelected = () => {
    setRows((current) => current.map((row) => ({
      ...row,
      fields: row.fields.filter((field) => field.id !== selectedFieldId),
    })))
    setSelectedFieldId('')
  }

  const reset = () => {
    fieldSequence.current = 4
    rowSequence.current = 3
    setRows(initialRows)
    setBaseSpec(undefined)
    setDataSource(exampleData)
    setSelectedFieldId('field-1')
    setPendingPayload(undefined)
    setNotice('Builder reset to the starter layout.')
  }

  const readImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setImportSource(await file.text())
  }

  const applyCode = () => {
    const parsed = parseYamlSpec(codeDraft)
    const diagnostics = parsed.value
      ? [...parsed.diagnostics, ...validateFormSpec(parsed.value)]
      : parsed.diagnostics
    const error = diagnostics.find((diagnostic) => diagnostic.severity === 'error')
    if (!parsed.value || error) {
      setNotice(`Could not apply YAML: ${error?.message ?? 'invalid AForm spec.'}`)
      return
    }

    try {
      const importedRows = formSpecToBuilderRows(parsed.value)
      const firstField = importedRows.flatMap((row) => row.fields)[0]
      setRows(importedRows)
      setBaseSpec(parsed.value)
      fieldSequence.current = importedRows.reduce((total, row) => total + row.fields.length, 0) + 1
      rowSequence.current = importedRows.length + 1
      setSelectedFieldId(firstField?.id ?? '')
      setPendingPayload(undefined)
      setView('design')
      setInspectorView('properties')
      setNotice(`YAML applied with ${importedRows.length} row${importedRows.length === 1 ? '' : 's'}.`)
    } catch (error) {
      setNotice(`Could not apply YAML: ${error instanceof Error ? error.message : 'unsupported layout.'}`)
    }
  }

  const compileImportedData = () => {
    const parsed = parseExampleData(importSource)
    if (!parsed.value) {
      setNotice(`Could not import data: ${parsed.error ?? 'invalid JSON or YAML.'}`)
      return
    }

    const existingPaths = new Set(importMode === 'merge' ? rows.flatMap((row) => row.fields.map((field) => field.path)) : [])
    const importedFields = listDataPaths(parsed.value)
      .filter((node) => !node.branch && !existingPaths.has(internalPath(node.jsonPath)))
      .map((node) => createField({
        source: 'data',
        path: internalPath(node.jsonPath),
        jsonPath: node.jsonPath,
        label: node.label,
        kind: inferFieldKind(node.jsonPath, node.value),
        sampleValue: node.value,
      }))
    const importedRows: BuilderRow[] = []
    for (const field of importedFields) {
      const current = importedRows.at(-1)
      const used = current?.fields.reduce((total, item) => total + item.span, 0) ?? 12
      if (!current || used + field.span > 12) {
        importedRows.push({ id: `row-${rowSequence.current++}`, fields: [field] })
      } else {
        importedRows[importedRows.length - 1] = { ...current, fields: [...current.fields, field] }
      }
    }

    setDataSource(importSource)
    setRows((current) => importMode === 'replace' ? importedRows : [...current, ...importedRows])
    setBaseSpec(undefined)
    setSelectedFieldId(importedFields[0]?.id ?? selectedFieldId)
    setImportOpen(false)
    setNotice(`${importedFields.length} field${importedFields.length === 1 ? '' : 's'} compiled from imported data.`)
  }

  const copySpec = async () => {
    try {
      await navigator.clipboard.writeText(specYaml)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setNotice('Clipboard access is unavailable. Use Download YAML instead.')
    }
  }

  const downloadSpec = () => {
    const url = URL.createObjectURL(new Blob([specYaml], { type: 'text/yaml' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'form.a-form.yaml'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="builder-shell">
      <header className="builder-topbar">
        <div className="builder-brand-mark"><Sparkles size={17} /></div>
        <div className="builder-brand-copy"><strong>AForm</strong><span>/ Registration <em>v1</em></span></div>
        <div className="builder-view-switch" aria-label="Builder view">
          <button className={view === 'design' ? 'active' : ''} type="button" onClick={() => selectView('design')}><Rows3 size={15} /> Design</button>
          <button className={view === 'code' ? 'active' : ''} type="button" onClick={() => selectView('code')}><Code2 size={15} /> Code (YAML)</button>
          <button className={view === 'preview' ? 'active' : ''} type="button" onClick={() => selectView('preview')}><Eye size={15} /> Preview</button>
        </div>
        <div className="builder-top-actions">
          <input ref={importInput} type="file" accept=".yaml,.yml,.json,text/yaml,application/yaml,application/json" hidden onChange={readImportFile} />
          <button type="button" onClick={() => setImportOpen(true)}><Upload size={15} /> YAML Import / Export</button>
          <button className="builder-icon-action" type="button" title="Reset builder" aria-label="Reset builder" onClick={reset}><RotateCcw size={15} /></button>
          <button className="builder-run-action" type="button" onClick={() => selectView('preview')}><Play size={15} /> Run Preview</button>
        </div>
      </header>

      <section className="builder-toolbar">
        <span className="builder-breadcrumb"><Braces size={15} /> form.a-form.yaml <ChevronRight size={13} /> layout</span>
        <span className="builder-notice">{pendingPayload ? `${pendingPayload.label} selected - click a grid slot` : notice}</span>
        <div className="builder-viewport-control" aria-label="Preview viewport">
          {viewports.map(({ id, label, icon: Icon }) => (
            <button className={viewport === id ? 'active' : ''} type="button" key={id} onClick={() => setViewport(id)} title={label} aria-label={label}><Icon size={15} /></button>
          ))}
        </div>
        <span className="builder-viewport-label"><Laptop size={14} /> {viewport}</span>
      </section>

      <section className="builder-workspace">
        <aside className="builder-sources">
          <div className="builder-source-tabs" aria-label="Source view">
            <button className={sourceView === 'data' ? 'active' : ''} type="button" onClick={() => setSourceView('data')}><Database size={14} /> Data Source</button>
            <button className={sourceView === 'fields' ? 'active' : ''} type="button" onClick={() => setSourceView('fields')}><List size={14} /> Available fields <small>{dataPaths.filter((node) => !node.branch).length}</small></button>
          </div>
          {sourceView === 'data' ? (
            <div className="builder-data-editor">
              <Editor
                aria-label="Example YAML data"
                language="yaml"
                path="example-data.yaml"
                theme="a-form-dark"
                value={dataSource}
                onChange={(value) => setDataSource(value ?? '')}
                options={{ automaticLayout: true, fontFamily: 'DM Mono, monospace', fontSize: 11, lineHeight: 18, minimap: { enabled: false }, padding: { top: 10 }, scrollBeyondLastLine: false, tabSize: 2 }}
              />
            </div>
          ) : (
            <div className="builder-source-section">
              <div className="builder-section-label"><span>Schema fields</span><small>{dataPaths.filter((node) => !node.branch).length}</small></div>
              {parsedData.error ? <p className="builder-data-error">{parsedData.error}</p> : (
                <div className="builder-data-tree">
                  {dataPaths.map((node) => {
                    const kind = inferFieldKind(node.jsonPath, node.value)
                    const Icon = kindIcons[kind]
                    const payload: PalettePayload = { source: 'data', path: internalPath(node.jsonPath), jsonPath: node.jsonPath, label: node.label, kind, sampleValue: node.value }
                    const isPlaced = placedPaths.has(internalPath(node.jsonPath))
                    return node.branch ? (
                      <div className="builder-tree-group" key={node.jsonPath} style={{ paddingLeft: node.depth * 12 }}><ChevronRight size={12} /><span>{node.label}</span></div>
                    ) : (
                      <button
                        className={`builder-tree-leaf ${isPlaced ? 'placed' : pendingPayload && payloadKey(pendingPayload) === node.jsonPath ? 'selected' : ''}`}
                        disabled={isPlaced}
                        draggable={!isPlaced}
                        key={node.jsonPath}
                        style={{ paddingLeft: 12 + node.depth * 12 }}
                        type="button"
                        onClick={() => !isPlaced && setPendingPayload(payload)}
                        onDragStart={(event) => !isPlaced && beginDrag(event, payload)}
                        title={isPlaced ? `${node.jsonPath} is already in the form` : `Drag ${node.jsonPath}`}
                      >
                        <Icon size={13} /><span>{node.label}<small>{node.jsonPath}</small></span>{isPlaced ? <em><Check size={11} /> Added</em> : <span className="builder-touch-handle" {...bindTouchHandle(payload)}><GripVertical size={13} /></span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          <div className="builder-source-section builder-field-source">
            <div className="builder-section-label"><span>Field types</span><small>{FIELD_KINDS.length}</small></div>
            <div className="builder-field-palette">
              {FIELD_KINDS.map(({ kind, label }) => {
                const Icon = kindIcons[kind]
                const payload: PalettePayload = { source: 'kind', label, kind }
                return (
                  <button
                    className={pendingPayload && payloadKey(pendingPayload) === kind ? 'selected' : ''}
                    draggable
                    key={kind}
                    type="button"
                    onClick={() => setPendingPayload(payload)}
                    onDragStart={(event) => beginDrag(event, payload)}
                  ><Icon size={16} /><span>{label}</span><span className="builder-touch-handle" {...bindTouchHandle(payload)}><GripVertical size={13} /></span></button>
                )
              })}
            </div>
          </div>
        </aside>

        <section className="builder-stage">
          <div className="builder-stage-heading">
            <div><strong>{view === 'design' ? 'User Registration Flow' : view === 'code' ? 'AForm specification' : 'Live preview'}</strong><span>{view === 'design' ? 'Structured 12-column responsive layout' : `${rows.flatMap((row) => row.fields).length} fields`}</span></div>
            {view === 'design' && <button type="button" onClick={addRow}><Plus size={15} /> Add row</button>}
            {view === 'code' && <button type="button" onClick={applyCode}><Check size={15} /> Apply YAML</button>}
          </div>
          {view === 'design' ? (
            <div className="builder-grid-canvas">
              <div className="builder-grid-ruler">{Array.from({ length: 12 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
              {rows.map((row, rowIndex) => {
                const used = row.fields.reduce((total, field) => total + field.span, 0)
                return (
                  <div className="builder-row-wrap" key={row.id}>
                    <div className="builder-row-meta"><span>ROW {String(rowIndex + 1).padStart(2, '0')}</span><small>{used}/12</small><button type="button" title="Remove row" aria-label={`Remove row ${rowIndex + 1}`} onClick={() => removeRow(row.id)}><Trash2 size={13} /></button></div>
                    <div
                      className={`builder-grid-row ${touchDrag?.target?.rowId === row.id ? 'touch-target' : ''}`}
                      data-builder-row-id={row.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropOnRow(event, row.id)}
                    >
                      <div className="builder-slot-layer" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div>
                      <div className="builder-drop-layer">
                        {Array.from({ length: 12 }, (_, slot) => (
                          <button key={slot} type="button" aria-label={`Place in row ${rowIndex + 1}, column ${slot + 1}`} onClick={() => pendingPayload && placeField(pendingPayload, row.id, slot)} />
                        ))}
                      </div>
                      {touchDrag?.target?.rowId === row.id && <div className="builder-touch-slot" style={{ left: `${touchDrag.target.slot * (100 / 12)}%`, width: `${100 / 12}%` }} />}
                      <div className="builder-fields-layer">
                        {row.fields.map((field) => {
                          const Icon = kindIcons[field.kind]
                          const payload: PalettePayload = { source: 'canvas', fieldId: field.id, label: field.label, kind: field.kind }
                          return (
                            <button
                              className={`builder-field-block ${selectedFieldId === field.id ? 'selected' : ''}`}
                              draggable
                              key={field.id}
                              style={{ gridColumn: `span ${field.span}` }}
                              type="button"
                              onClick={() => { setSelectedFieldId(field.id); setInspectorView('properties') }}
                              onDragStart={(event) => beginDrag(event, payload)}
                            >
                              <span className="builder-touch-handle builder-field-grip" {...bindTouchHandle(payload)}><GripVertical size={14} /></span>
                              <Icon size={17} />
                              <span><strong>{field.label}</strong><small>{field.jsonPath}</small></span>
                              <em>{field.span}</em>
                            </button>
                          )
                        })}
                        {row.fields.length === 0 && <div className="builder-empty-row"><Plus size={16} /> Drop a data path or field type</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
              <button className="builder-add-row" type="button" onClick={addRow}><Plus size={16} /> Add grid row</button>
            </div>
          ) : view === 'code' ? (
            <div className="builder-code-stage">
              <div className="builder-code-heading"><span>form.a-form.yaml</span><button type="button" onClick={downloadSpec}><Download size={14} /> Download</button></div>
              <Editor aria-label="Editable AForm YAML" language="yaml" path="playground-v2-form.a-form.yaml" theme="a-form-dark" value={codeDraft} onChange={(value) => setCodeDraft(value ?? '')} options={{ automaticLayout: true, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 20, minimap: { enabled: false }, padding: { top: 16 }, scrollBeyondLastLine: false }} />
            </div>
          ) : (
            <div className="builder-preview-stage"><Preview spec={normalized} viewport={viewport} /></div>
          )}
        </section>

        <aside className="builder-inspector">
          <div className="builder-inspector-tabs">
            <button className={inspectorView === 'properties' ? 'active' : ''} type="button" onClick={() => setInspectorView('properties')}><Settings2 size={14} /> Properties</button>
            <button className={inspectorView === 'spec' ? 'active' : ''} type="button" onClick={() => setInspectorView('spec')}><Braces size={14} /> Spec</button>
          </div>
          {inspectorView === 'spec' ? (
            <div className="builder-spec-panel">
              <div className="builder-spec-actions">
                <span>form.a-form.yaml</span>
                <button type="button" title="Copy YAML" aria-label="Copy YAML" onClick={copySpec}>{copied ? <Check size={14} /> : <Clipboard size={14} />}</button>
              </div>
              <Editor aria-label="Generated AForm YAML" language="yaml" path="generated-form.a-form.yaml" theme="a-form-dark" value={specYaml} options={{ automaticLayout: true, fontFamily: 'DM Mono, monospace', fontSize: 10, lineHeight: 17, minimap: { enabled: false }, padding: { top: 12 }, readOnly: true, scrollBeyondLastLine: false }} />
            </div>
          ) : selectedField ? (
            <div className="builder-properties">
              <div className="builder-selection-heading"><span className="builder-kind-icon">{(() => { const Icon = kindIcons[selectedField.kind]; return <Icon size={17} /> })()}</span><div><strong>{selectedField.label}</strong><small>{selectedField.kind} field</small></div></div>
              <label>Label<input value={selectedField.label} onChange={(event) => updateSelected({ label: event.target.value })} /></label>
              <label>Absolute path<input value={selectedField.jsonPath} readOnly /></label>
              <label>Field type<select value={selectedField.kind} onChange={(event) => updateSelected({ kind: event.target.value as FieldKind })}>{FIELD_KINDS.map((item) => <option value={item.kind} key={item.kind}>{item.label}</option>)}</select></label>
              <fieldset>
                <legend>Column span</legend>
                <div className="builder-span-control">{[3, 4, 6, 8, 12].map((span) => <button className={selectedField.span === span ? 'active' : ''} type="button" key={span} onClick={() => updateSpan(span)}>{span}</button>)}</div>
              </fieldset>
              <div className="builder-property-summary"><span>Desktop <strong>{selectedField.span}/12</strong></span><span>Tablet <strong>{selectedField.span}/12</strong></span><span>Mobile <strong>12/12</strong></span></div>
              <button className="builder-delete-field" type="button" onClick={removeSelected}><Trash2 size={14} /> Remove field</button>
            </div>
          ) : (
            <div className="builder-no-selection"><Settings2 size={22} /><strong>No field selected</strong><span>Select a field on the grid to edit its properties.</span></div>
          )}
        </aside>
      </section>
      {importOpen && (
        <div className="builder-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setImportOpen(false)}>
          <section className="builder-import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <header>
              <span className="builder-modal-icon"><Braces size={19} /></span>
              <div><strong id="import-title">Import schema or data</strong><small>Paste JSON or YAML to map reactive fields automatically</small></div>
              <button type="button" title="Close" aria-label="Close import dialog" onClick={() => setImportOpen(false)}><X size={17} /></button>
            </header>
            <div className="builder-import-tools">
              <span><Code2 size={14} /> Paste code (JSON / YAML)</span>
              <button type="button" onClick={() => importInput.current?.click()}><FileUp size={14} /> Upload file</button>
              <em><Check size={13} /> Syntax checked on import</em>
            </div>
            <div className="builder-import-body">
              <label htmlFor="import-source">schema_import.yaml</label>
              <textarea id="import-source" spellCheck={false} value={importSource} onChange={(event) => setImportSource(event.target.value)} />
              <fieldset>
                <legend>Import mode</legend>
                <label className={importMode === 'replace' ? 'selected' : ''}><input type="radio" name="import-mode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} /><span><strong>Replace current schema</strong><small>Clear mapped fields and rebuild the form.</small></span></label>
                <label className={importMode === 'merge' ? 'selected' : ''}><input type="radio" name="import-mode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} /><span><strong>Merge with existing fields</strong><small>Keep the canvas and add newly detected paths.</small></span></label>
              </fieldset>
            </div>
            <footer>
              <span><Database size={15} /> {parseExampleData(importSource).value ? `${listDataPaths(parseExampleData(importSource).value!).filter((node) => !node.branch).length} fields detected` : 'Waiting for valid data'}</span>
              <div><button type="button" onClick={() => setImportOpen(false)}>Cancel</button><button className="primary" type="button" onClick={compileImportedData}><Upload size={15} /> Load & compile fields</button></div>
            </footer>
          </section>
        </div>
      )}
      {touchDrag && <TouchDragOverlay drag={touchDrag} />}
    </main>
  )
}