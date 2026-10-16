import type { JsonObject, NormalizedFormSpec } from 'a-form-core'
import { normalizeFormSpec } from 'a-form-parser'
import { AForm, AInlineForm } from 'a-form-react'
import type { AFormViewport } from 'a-form-react'

import { PresentationAdapterRegistry } from 'a-form-react'
import { BootstrapAdapter } from 'a-form-presentation-bootstrap'
import { MaterialAdapter } from 'a-form-presentation-material'
import { TailwindAdapter } from 'a-form-presentation-tailwind'
import {
  AlignLeft,
  Braces,
  Calendar,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronRight,
  CircleDot,
  Clipboard,
  Clock,
  Cloud,
  Code2,
  Database,
  Download,
  Eye,
  Maximize,
  GripVertical,
  Github,
  Hash,
  Laptop,
  Linkedin,
  List,
  Mail,
  Monitor,
  Palette,
  Plus,
  Search,
  Rows3,
  Redo2,
  SeparatorHorizontal,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { StructuredEditor } from '../components/StructuredEditor'
import type { StructuredDocument } from '../components/StructuredEditor'
import {
  buildFormSpec,
  defaultSpan,
  FIELD_KINDS,
  fieldGridColumn,
  formSpecToYaml,
  inferFieldKind,
  internalPath,
  listDataPaths,
  parseExampleData,
} from './model'
import type { BuilderDragPayload, BuilderField, BuilderSeparator, FieldKind, PalettePayload } from './model'
import { TouchDragOverlay } from './TouchDragOverlay'
import { useTouchDrag } from './useTouchDrag'
import { useBuilderProject } from './useBuilderProject'
import type { BuilderProject } from './project'
import { dataImportChanges, specImportChanges } from './importGeneration'
import type { ImportedSpec } from './importGeneration'
import './BuilderApp.css'
import 'a-form-presentation-bootstrap/styles.css'
import 'a-form-presentation-tailwind/styles.css'

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

const initialFields: readonly BuilderField[] = [
  { id: 'field-1', path: 'customer.firstName', jsonPath: '$.customer.firstName', label: 'First name', kind: 'text', span: 6, align: 'start', sampleValue: 'Ana' },
  { id: 'field-2', path: 'customer.email', jsonPath: '$.customer.email', label: 'Email', kind: 'email', span: 6, align: 'start', sampleValue: 'ana@example.com' },
  { id: 'field-3', path: 'customer.acceptsTerms', jsonPath: '$.customer.acceptsTerms', label: 'Accepts terms', kind: 'checkbox', span: 12, align: 'start', sampleValue: true },
]

const initialProject: BuilderProject = {
  fields: initialFields,
  separators: [],
  baseSpec: null,
  dataDocument: { source: exampleData, format: 'yaml' },
  codeDraft: null,
  codeFormat: 'yaml',
  previewValue: parseExampleData(exampleData).value ?? {},
}

function nextId(items: readonly { id: string }[], prefix: string): string {
  const sequence = items.reduce((max, { id }) => {
    const suffix = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : 0
    return Number.isSafeInteger(suffix) ? Math.max(max, suffix) : max
  }, 0)
  return `${prefix}${sequence + 1}`
}

type BuilderView = 'design' | 'code' | 'preview'
type InspectorView = 'properties' | 'spec'
type SourceView = 'data' | 'fields'
type PreviewTheme = 'tailwind' | 'bootstrap' | 'material'
type Viewport = AFormViewport
const kindIcons: Record<FieldKind, LucideIcon> = {
  text: Type,
  email: Mail,
  number: Hash,
  textarea: AlignLeft,
  checkbox: CheckSquare,
  radio: CircleDot,
  select: List,
  date: Calendar,
  time: Clock,
  datetime: CalendarClock,
  range: SlidersHorizontal,
  autocomplete: Search,
  asyncOptions: Cloud,
  array: Rows3,
  object: Braces,
}

const viewports: readonly { id: Viewport; label: string; icon: LucideIcon }[] = [
  { id: 'auto', label: 'Auto', icon: Maximize },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
]

const previewThemes: readonly { id: PreviewTheme; label: string }[] = [
  { id: 'tailwind', label: 'Tailwind' },
  { id: 'bootstrap', label: 'Bootstrap' },
  { id: 'material', label: 'Material' },
]

const presentationRegistry = new PresentationAdapterRegistry()
presentationRegistry.register(TailwindAdapter)
presentationRegistry.register(BootstrapAdapter)
presentationRegistry.register(MaterialAdapter)

function payloadKey(payload: PalettePayload): string {
  return payload.source === 'canvas' ? payload.fieldId ?? '' : payload.jsonPath ?? payload.kind
}

function Preview({ 
  spec, 
  viewport, 
  theme, 
  inline,
  value,
  onChange 
}: { 
  spec: NormalizedFormSpec; 
  viewport: Viewport; 
  theme: PreviewTheme, 
  inline?: boolean,
  value: JsonObject,
  onChange: (value: JsonObject) => void
}) {
  return (
    <div className={`builder-preview-frame builder-preview-${viewport}`}>
      <div className="builder-form-canvas">
        <div className="builder-form-heading">
          <span>LIVE FORM / 01</span>
          <h2>{spec.schema?.title ? spec.schema?.title as string : 'Untitled form'}</h2>
          <p>Generated from the current virtual grid.</p>
        </div>
          {inline ? (
            <AInlineForm
              key={theme}
              spec={spec}
              value={value}
              onChange={onChange}
              presentation={{ registry: presentationRegistry, adapterId: theme }}
            />
          ) : (
          <AForm
            key={theme}
            spec={spec}
            viewport={viewport}
            value={value}
            onChange={onChange}
            noHtml5Validate
            presentation={{ registry: presentationRegistry, adapterId: theme }}
          />
          )}
      </div>
    </div>
  )
}

export function BuilderApp() {
  const workspace = useBuilderProject(initialProject)
  const { project, updateProject } = workspace
  const { fields, separators, baseSpec: storedBaseSpec, dataDocument, codeDraft, codeFormat, previewValue } = project
  const baseSpec = storedBaseSpec ?? undefined
  const [selectedFieldId, setSelectedFieldId] = useState<string>('field-1')
  const [pathDraft, setPathDraft] = useState('')
  const [pathDraftSource, setPathDraftSource] = useState<string>()
  const [pendingPayload, setPendingPayload] = useState<PalettePayload>()
  const [requestedView, setView] = useState<BuilderView>(() => codeDraft ? 'code' : 'design')
  const view: BuilderView = codeDraft ? 'code' : requestedView
  const [inspectorView, setInspectorView] = useState<InspectorView>('properties')
  const [sourceView, setSourceView] = useState<SourceView>('fields')
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('tailwind')
  const [inlinePreview, setInlinePreview] = useState(false)
  const [notice, setNotice] = useState('Drag a source and drop it anywhere on the canvas; the grid wraps automatically.')
  const [dataCopied, setDataCopied] = useState(false)
  const [codeIssue, setCodeIssue] = useState<{ source: string; message: string } | null>(null)
  const deferredDataSource = useDeferredValue(dataDocument.source)
  const parsedData = parseExampleData(deferredDataSource)
  const dataPaths = parsedData.value ? listDataPaths(parsedData.value) : []
  const spec = buildFormSpec(fields, separators, baseSpec)
  const normalized = normalizeFormSpec(spec)
  const specYaml = formSpecToYaml(fields, separators, baseSpec)
  const codeDocument: StructuredDocument = codeDraft ?? {
    source: codeFormat === 'json' ? JSON.stringify(spec, null, 2) : specYaml,
    format: codeFormat,
  }
  const codeError = codeIssue?.source === codeDocument.source ? codeIssue.message : null
  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? fields[0]
  const placedPaths = new Set(fields.map((field) => field.path))
  const pathSource = `${selectedField?.id ?? ''}|${selectedField?.jsonPath ?? ''}`
  if (pathDraftSource !== pathSource) {
    setPathDraftSource(pathSource)
    setPathDraft(selectedField?.jsonPath ?? '')
  }

  const selectView = (nextView: BuilderView) => {
    if (nextView === view) return
    if (view === 'code' && codeDraft && !applySpecDocument(codeDraft)) return
    setView(nextView)
  }

  const beginDrag = (event: React.DragEvent, payload: BuilderDragPayload) => {
    event.dataTransfer.effectAllowed = payload.source === 'data' || payload.source === 'kind' ? 'copy' : 'move'
    event.dataTransfer.setData('application/x-a-form-builder', JSON.stringify(payload))
    if (payload.source !== 'separator') setPendingPayload(payload)
  }

  const createField = (payload: PalettePayload): BuilderField => {
    const id = nextId(fields, 'field-')
    const path = payload.path ?? `fields.${payload.kind}${id.replace('field-', '')}`
    return {
      id,
      path,
      jsonPath: payload.jsonPath ?? `$.${path}`,
      label: payload.label,
      kind: payload.kind,
      span: defaultSpan(payload.kind),
      align: 'start',
      sampleValue: payload.sampleValue,
    }
  }

  /** Inserts (or reorders) a field at `index`; the grid itself decides when the result fits on the same line or wraps. */
  const placeField = (payload: PalettePayload, index: number) => {
    const movingField = payload.source === 'canvas'
      ? fields.find((field) => field.id === payload.fieldId)
      : undefined
    const field = movingField ?? createField(payload)
    const withoutMoving = fields.filter((item) => item.id !== movingField?.id)
    const duplicate = withoutMoving.some((item) => item.path === field.path)
    if (duplicate) {
      setNotice(`${field.jsonPath} is already placed on the canvas.`)
      return
    }

    const clampedIndex = Math.max(0, Math.min(withoutMoving.length, index))
    const nextFields = [...withoutMoving]
    nextFields.splice(clampedIndex, 0, field)
    updateProject({ fields: nextFields })
    setSelectedFieldId(field.id)
    setPendingPayload(undefined)
    setInspectorView('properties')
    setNotice(`${field.label} placed.`)
  }

  const moveSeparator = (separatorId: string, index: number) => {
    const targetIndex = Math.max(0, Math.min(fields.length, index))
    const beforeFieldId = fields[targetIndex]?.id
    const current = separators.find((separator) => separator.id === separatorId)
    if (!current || current.beforeFieldId === beforeFieldId) return
    updateProject({ separators: separators.map((separator) => separator.id === separatorId
      ? { ...separator, beforeFieldId }
      : separator) })
    setNotice(`${current.title} moved.`)
  }

  const applyDrop = (payload: BuilderDragPayload, index: number) => {
    if (payload.source === 'separator') {
      moveSeparator(payload.separatorId, index)
      return
    }
    placeField(payload, index)
  }

  const { bindTouchHandle, touchDrag } = useTouchDrag((payload, target) => {
    applyDrop(payload, target.index)
  })

  const dropAt = (event: React.DragEvent, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    const rawPayload = event.dataTransfer.getData('application/x-a-form-builder')
    if (!rawPayload) return
    applyDrop(JSON.parse(rawPayload) as BuilderDragPayload, index)
  }

  /** Drops onto a field block insert before/after it depending on which half of the block was targeted. */
  const dropOnField = (event: React.DragEvent<HTMLElement>, field: BuilderField) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const secondHalf = event.clientX - rect.left > rect.width / 2
    const baseIndex = fields.findIndex((item) => item.id === field.id)
    dropAt(event, secondHalf ? baseIndex + 1 : baseIndex)
  }

  const clickToPlaceOnField = (event: React.MouseEvent<HTMLElement>, field: BuilderField) => {
    if (!pendingPayload) return
    const rect = event.currentTarget.getBoundingClientRect()
    const secondHalf = event.clientX - rect.left > rect.width / 2
    const baseIndex = fields.findIndex((item) => item.id === field.id)
    placeField(pendingPayload, secondHalf ? baseIndex + 1 : baseIndex)
  }

  const addSeparator = () => {
    const separatorId = nextId(separators, 'separator-')
    updateProject({ separators: [...separators, {
      id: separatorId,
      title: 'New section',
      ...(selectedField ? { beforeFieldId: selectedField.id } : {}),
    }] })
    setNotice(`${separatorId} added to the field flow.`)
  }

  const renameSeparator = (separatorId: string, title: string) => {
    updateProject({ separators: separators.map((separator) => separator.id === separatorId ? { ...separator, title } : separator) }, `separator:${separatorId}:title`)
  }

  const removeSeparator = (separatorId: string) => {
    updateProject({ separators: separators.filter((separator) => separator.id !== separatorId) })
  }

  const updateSelected = (changes: Partial<BuilderField>, group?: string) => {
    updateProject({ fields: fields.map((field) => field.id === selectedField?.id ? { ...field, ...changes } : field) }, group)
  }

  const updateSpan = (span: number) => {
    if (!selectedField) return
    updateSelected({ span })
  }

  const commitFieldPath = (rawValue: string) => {
    if (!selectedField) return
    const path = rawValue.trim().replace(/^\$\.?/, '')
    if (!path || !/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(path)) {
      setNotice('Absolute path must be dot-separated identifiers, e.g. customer.firstName.')
      setPathDraft(selectedField.jsonPath)
      return
    }
    const duplicate = fields.some((field) => field.id !== selectedField.id && field.path === path)
    if (duplicate) {
      setNotice(`Path "${path}" is already used by another field.`)
      setPathDraft(selectedField.jsonPath)
      return
    }
    updateSelected({ path, jsonPath: `$.${path}` })
  }

  const removeSelected = () => {
    if (!selectedField) return
    const removedIndex = fields.findIndex((field) => field.id === selectedField.id)
    const nextAnchor = fields[removedIndex + 1]?.id
    updateProject({
      separators: separators.map((separator) => separator.beforeFieldId === selectedField.id
        ? { ...separator, beforeFieldId: nextAnchor }
        : separator),
      fields: fields.filter((field) => field.id !== selectedField.id),
    })
    setSelectedFieldId(nextAnchor ?? '')
  }

  const commitSpecImport = (changes: ImportedSpec, format: StructuredDocument['format']) => {
    updateProject(changes)
    setSelectedFieldId(changes.fields[0]?.id ?? '')
    setPendingPayload(undefined)
    setInspectorView('properties')
    setCodeIssue(null)
    setNotice(`${format.toUpperCase()} applied with ${changes.fields.length} field${changes.fields.length === 1 ? '' : 's'}.`)
  }

  const applySpecDocument = (document: StructuredDocument): boolean => {
    try {
      commitSpecImport(specImportChanges(document, dataDocument.format, false), document.format)
      return true
    } catch (error) {
      const message = `Could not apply ${document.format.toUpperCase()}: ${error instanceof Error ? error.message : 'unsupported layout.'}`
      setNotice(message)
      setCodeIssue({ source: document.source, message })
      return false
    }
  }

  const applyCode = () => {
    if (applySpecDocument(codeDocument)) setView('design')
  }

  const changeData = (document: StructuredDocument) => {
    updateProject(dataImportChanges(document, codeFormat, false), 'data-source')
  }

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(dataDocument.source)
      setDataCopied(true)
      window.setTimeout(() => setDataCopied(false), 1400)
    } catch {
      setNotice('Clipboard access is unavailable.')
    }
  }

  const download = (source: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([source], { type }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadSpec = () => {
    download(codeDocument.source, `form.a-form.${codeDocument.format}`, codeDocument.format === 'json' ? 'application/json' : 'text/yaml')
  }

  const undo = () => {
    workspace.undo()
    setPendingPayload(undefined)
    setNotice('Change undone.')
  }
  const redo = () => {
    workspace.redo()
    setPendingPayload(undefined)
    setNotice('Change redone.')
  }

  const renderSeparator = (separator: BuilderSeparator, index: number) => (
    <div
      className={`builder-separator ${touchDrag?.payload.source === 'separator' && touchDrag.payload.separatorId === separator.id ? 'dragging' : ''}`}
      data-builder-drop-index={index}
      key={separator.id}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => dropAt(event, index)}
    >
      <span
        className="builder-touch-handle builder-separator-grip"
        draggable
        title="Move separator"
        {...bindTouchHandle({ source: 'separator', separatorId: separator.id, label: separator.title })}
        onDragStart={(event) => beginDrag(event, { source: 'separator', separatorId: separator.id, label: separator.title })}
      ><GripVertical size={13} /></span>
      <span className="builder-separator-line" />
      <input
        aria-label="Separator title"
        value={separator.title}
        onChange={(event) => renameSeparator(separator.id, event.target.value)}
      />
      <span className="builder-separator-line" />
      <button type="button" title="Remove separator" aria-label="Remove separator" onClick={() => removeSeparator(separator.id)}><Trash2 size={13} /></button>
    </div>
  )

  return (
    <main className="builder-shell" onKeyDown={(event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor')) return
      const key = event.key.toLowerCase()
      if (key === 'z' || key === 'y') {
        event.preventDefault()
        if (key === 'y' || event.shiftKey) { if (workspace.canRedo) redo() }
        else if (workspace.canUndo) undo()
      }
    }}>
      <header className="builder-topbar">
        <div className="builder-brand-mark"><Sparkles size={17} /></div>
        <div className="builder-brand-copy"><strong>AForm</strong><span>/ Registration <em>v1</em></span></div>
        <div className="builder-view-switch" aria-label="Builder view">
          <button className={view === 'design' ? 'active' : ''} type="button" onClick={() => selectView('design')}><Rows3 size={15} /> Design</button>
          <button className={view === 'code' ? 'active' : ''} type="button" onClick={() => selectView('code')}><Code2 size={15} /> Code (YAML)</button>
          <button className={view === 'preview' ? 'active' : ''} type="button" onClick={() => selectView('preview')}><Eye size={15} /> Preview</button>
        </div>
        <div className="builder-top-actions builder-history" aria-label="Change history">
          <button className="builder-icon-action" type="button" title="Undo (Ctrl/Cmd+Z outside editors)" aria-label="Undo" disabled={!workspace.canUndo} onClick={undo}><Undo2 size={15} /></button>
          <button className="builder-icon-action" type="button" title="Redo (Ctrl/Cmd+Shift+Z outside editors)" aria-label="Redo" disabled={!workspace.canRedo} onClick={redo}><Redo2 size={15} /></button>
          <span className={`builder-save-status${workspace.problem ? ' builder-save-error' : ''}`} role="status" title="Local to this browser; not synced to a server.">
            {workspace.problem ? 'Not saved' : workspace.saving ? 'Saving...' : 'Saved locally'}
          </span>
        </div>
        <nav className="builder-external-links" aria-label="External links">
          <a href="https://github.com/alansferreira/a-form" target="_blank" rel="noreferrer" title="Open AForm on GitHub" aria-label="Open AForm on GitHub"><Github size={15} /></a>
          <a href="https://www.linkedin.com/in/alansferreira/" target="_blank" rel="noreferrer" title="Open Alan Ferreira on LinkedIn" aria-label="Open Alan Ferreira on LinkedIn"><Linkedin size={15} /></a>
        </nav>
      </header>

      {workspace.problem && (
        <aside className="builder-storage-alert" role="alert">
          <span>{workspace.problem.message}</span>
          <div>
            <button type="button" onClick={() => download(workspace.project.dataDocument.source, `example-data.${workspace.project.dataDocument.format}`, 'text/plain')}>Download data source</button>
            <button type="button" onClick={() => download(JSON.stringify(workspace.project.previewValue, null, 2), 'preview-values.json', 'application/json')}>Download preview values</button>
            <button type="button" onClick={downloadSpec}>Download spec</button>
            {workspace.savedCopy !== null && <button type="button" onClick={() => download(workspace.savedCopy!, 'studio-saved-copy.json', 'application/json')}>Download saved copy</button>}
            {workspace.problem.kind === 'conflict' && <button type="button" onClick={() => {
              if (workspace.loadSaved()) { setView('design'); setPendingPayload(undefined); setNotice('Saved project loaded.') }
            }}>Load saved copy (discard this tab)</button>}
            {workspace.problem.kind === 'unavailable'
              ? <button type="button" onClick={workspace.save}>Retry saving</button>
              : <button type="button" onClick={workspace.replaceSaved}>Replace saved copy with this project</button>}
          </div>
        </aside>
      )}
      <section className="builder-toolbar">
        <span className="builder-breadcrumb"><Braces size={15} /> form.a-form.yaml <ChevronRight size={13} /> layout</span>
        <span className="builder-notice">{pendingPayload ? `${pendingPayload.label} selected - click a grid slot` : notice}</span>
        <div className="builder-viewport-control" aria-label="Preview viewport">
          {viewports.map(({ id, label, icon: Icon }) => (
            <button className={viewport === id ? 'active' : ''} type="button" key={id} onClick={() => setViewport(id)} title={label} aria-label={label} aria-pressed={viewport === id}><Icon size={15} /></button>
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
              <StructuredEditor
                document={dataDocument}
                label="Example data"
                path="example-data.yaml"
                theme="a-form-dark"
                onChange={changeData}
                importOption={{
                  label: 'Create a spec from these data',
                  description: 'Replace the current spec, layout, and code draft with a form inferred from these data. Existing data values are kept.',
                }}
                onImport={(document, { generateRelated }) => {
                  const changes = dataImportChanges(document, codeFormat, generateRelated)
                  updateProject(changes)
                  if (generateRelated) {
                    setSelectedFieldId(changes.fields?.[0]?.id ?? '')
                    setPendingPayload(undefined)
                    setCodeIssue(null)
                    setInspectorView('properties')
                    setView('design')
                    setNotice('Data imported and a matching spec created.')
                  }
                }}
                toolbarActions={<>
                  {parsedData.error && <span role="alert" title={parsedData.error}>Invalid data</span>}
                  <button type="button" title={`Copy ${dataDocument.format.toUpperCase()}`} aria-label={`Copy ${dataDocument.format.toUpperCase()}`} onClick={copyData}>{dataCopied ? <Check size={14} /> : <Clipboard size={14} />}</button>
                </>}
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
            <div><strong>{view === 'design' ? 'User Registration Flow' : view === 'code' ? 'AForm specification' : 'Live preview'}</strong><span>{view === 'design' ? 'Fields flow left-to-right and wrap automatically when a line runs out of space' : `${fields.length} fields${view === 'code' && codeDraft ? ' / unapplied draft' : ''}`}</span></div>
            {view === 'design' && <button type="button" onClick={addSeparator}><SeparatorHorizontal size={15} /> Add separator</button>}
            {view === 'code' && <button type="button" onClick={applyCode}><Check size={15} /> Apply {codeDocument.format.toUpperCase()}</button>}
            {view === 'preview' && (
              <label className="builder-theme-control">
                <Palette size={15} />
                <span>Theme</span>
                <select value={previewTheme} onChange={(event) => setPreviewTheme(event.target.value as PreviewTheme)}>
                  {previewThemes.map((theme) => <option value={theme.id} key={theme.id}>{theme.label}</option>)}
                </select>
                {normalized.inline && (
                  <select value={inlinePreview ? 'inline' : 'grid'} onChange={(event) => setInlinePreview(event.target.value === 'inline')}>
                    <option value="grid">Grid</option>
                    <option value="inline">Inline</option>
                  </select>
                )}
              </label>
            )}
          </div>
          {view === 'design' ? (
            <div className="builder-grid-canvas">
              <div className="builder-grid-ruler">{Array.from({ length: 12 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
              <div className="builder-flow-grid" onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropAt(event, fields.length)}>
                {fields.flatMap((field, index) => {
                  const Icon = kindIcons[field.kind]
                  const payload: PalettePayload = { source: 'canvas', fieldId: field.id, label: field.label, kind: field.kind }
                  return [
                    ...separators.filter((separator) => separator.beforeFieldId === field.id).map((separator) => renderSeparator(separator, index)),
                    <button
                      className={`builder-field-block ${selectedField?.id === field.id ? 'selected' : ''} ${touchDrag?.target?.index === index ? 'touch-target' : ''}`}
                      data-builder-drop-index={index}
                      draggable
                      key={field.id}
                      style={{ gridColumn: fieldGridColumn(field) }}
                      type="button"
                      onClick={(event) => {
                        if (pendingPayload) { clickToPlaceOnField(event, field); return }
                        setSelectedFieldId(field.id)
                        setInspectorView('properties')
                      }}
                      onDragStart={(event) => beginDrag(event, payload)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropOnField(event, field)}
                    >
                      <span className="builder-touch-handle builder-field-grip" {...bindTouchHandle(payload)}><GripVertical size={14} /></span>
                      <Icon size={17} />
                      <span><strong>{field.label}</strong><small>{field.jsonPath}</small></span>
                      <em>{field.span}</em>
                    </button>,
                  ]
                })}
                {separators.filter((separator) => !separator.beforeFieldId || !fields.some((field) => field.id === separator.beforeFieldId)).map((separator) => renderSeparator(separator, fields.length))}
                {fields.length === 0 && <div className="builder-empty-row" style={{ gridColumn: '1 / -1' }}><Plus size={16} /> Drop a data path or field type onto the canvas</div>}
              </div>
              <div className="builder-canvas-actions">
                <button
                  className="builder-add-row"
                  data-builder-drop-index={fields.length}
                  type="button"
                  onClick={() => pendingPayload && placeField(pendingPayload, fields.length)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropAt(event, fields.length)}
                ><Plus size={16} /> Append field to canvas</button>
                <button className="builder-add-row" type="button" onClick={addSeparator}><SeparatorHorizontal size={16} /> Add separator</button>
              </div>
            </div>
          ) : view === 'code' ? (
            <div className="builder-code-stage">
              {codeError && <p className="builder-code-error" role="alert">{codeError}</p>}
              <StructuredEditor
                document={codeDocument}
                label="AForm schema"
                path="form.a-form.yaml"
                theme="a-form-dark"
                onChange={(document) => updateProject({ codeDraft: document, codeFormat: document.format }, 'code-draft')}
                importOption={{
                  label: 'Create example data from this spec',
                  description: 'Apply this spec and replace the data source and preview values with generated test data. Defaults and examples from the spec may be copied.',
                }}
                onImport={(document, { generateRelated }) => {
                  if (!generateRelated) {
                    updateProject({ codeDraft: document, codeFormat: document.format })
                    return
                  }
                  const changes = specImportChanges(document, dataDocument.format, true)
                  commitSpecImport(changes, document.format)
                  setView('design')
                  setSourceView('data')
                  setNotice('Spec imported and example data created.')
                }}
                toolbarActions={<button type="button" onClick={downloadSpec}><Download size={14} /> Download</button>}
                options={{ automaticLayout: true, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 20, minimap: { enabled: false }, padding: { top: 16 }, scrollBeyondLastLine: false }}
              />
            </div>
          ) : (
            <div className="builder-preview-stage"><Preview spec={normalized} viewport={viewport} theme={previewTheme} inline={inlinePreview && Boolean(normalized.inline)} value={previewValue} onChange={
              (value) => updateProject({ previewValue: value })
            } /></div>
          )}
        </section>

        <aside className="builder-inspector">
          <div className="builder-inspector-tabs">
            <button className={inspectorView === 'properties' ? 'active' : ''} type="button" onClick={() => setInspectorView('properties')}><Settings2 size={14} /> Properties</button>
            {/* <button className={inspectorView === 'spec' ? 'active' : ''} type="button" onClick={() => setInspectorView('spec')}><Braces size={14} /> Spec</button> */}
          </div>
          {
          // inspectorView === 'spec' ? (
          //   <div className="builder-spec-panel">
          //     <StructuredEditor
          //       document={specDocument}
          //       label="Generated AForm spec"
          //       path="generated-form.a-form.yaml"
          //       theme="a-form-dark"
          //       onChange={() => undefined}
          //       onImport={importGeneratedSpec}
          //       toolbarActions={<button type="button" title={`Copy ${specFormat.toUpperCase()}`} aria-label={`Copy ${specFormat.toUpperCase()}`} onClick={copySpec}>{copied ? <Check size={14} /> : <Clipboard size={14} />}</button>}
          //       options={{ automaticLayout: true, fontFamily: 'DM Mono, monospace', fontSize: 10, lineHeight: 17, minimap: { enabled: false }, padding: { top: 12 }, readOnly: true, scrollBeyondLastLine: false }}
          //     />
          //   </div>
          // ) : 
          selectedField ? (
            <fieldset className="builder-properties" aria-label="Field properties" disabled={codeDraft !== null}>
              {codeDraft && <p className="builder-draft-notice">Apply or undo the code draft before changing field properties.</p>}
              <div className="builder-selection-heading"><span className="builder-kind-icon">{(() => { const Icon = kindIcons[selectedField.kind]; return <Icon size={17} /> })()}</span><div><strong>{selectedField.label}</strong><small>{selectedField.kind} field</small></div></div>
              <label>Label<input value={selectedField.label} onChange={(event) => updateSelected({ label: event.target.value }, `field:${selectedField.id}:label`)} /></label>
              <label>Absolute path<input
                value={pathDraft}
                onChange={(event) => setPathDraft(event.target.value)}
                onBlur={(event) => commitFieldPath(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitFieldPath(pathDraft) } }}
              /></label>
              <label>Field type<select value={selectedField.kind} onChange={(event) => updateSelected({ kind: event.target.value as FieldKind })}>{FIELD_KINDS.map((item) => <option value={item.kind} key={item.kind}>{item.label}</option>)}</select></label>
              {selectedField.kind === 'array' && (
                <fieldset className="builder-array-options">
                  <legend>Array controls</legend>
                  <label><input type="checkbox" checked={selectedField.arrayAddable ?? true} onChange={(event) => updateSelected({ arrayAddable: event.target.checked })} /> Allow adding items</label>
                  <label><input type="checkbox" checked={selectedField.arrayRemovable ?? true} onChange={(event) => updateSelected({ arrayRemovable: event.target.checked })} /> Allow removing items</label>
                  <label><input type="checkbox" checked={selectedField.arrayOrderable ?? true} onChange={(event) => updateSelected({ arrayOrderable: event.target.checked })} /> Allow reordering items</label>
                </fieldset>
              )}
              {selectedField.kind === 'range' && (
                <fieldset>
                  <legend>Range</legend>
                  <div className="builder-range-control">
                    <label>Min<input type="number" value={selectedField.rangeMin ?? 0} onChange={(event) => updateSelected({ rangeMin: Number(event.target.value) })} /></label>
                    <label>Max<input type="number" value={selectedField.rangeMax ?? 100} onChange={(event) => updateSelected({ rangeMax: Number(event.target.value) })} /></label>
                    <label>Step<input type="number" value={selectedField.rangeStep ?? 1} onChange={(event) => updateSelected({ rangeStep: Number(event.target.value) })} /></label>
                        </div>
                </fieldset>
              )}
              {(selectedField.kind === 'autocomplete' || selectedField.kind === 'asyncOptions') && (
                <fieldset>
                  <legend>{selectedField.kind === 'asyncOptions' ? 'Async source' : 'Autocomplete source'}</legend>
                  <label>Source URL (Mustache template)<input
                    placeholder="/api/cities?country={{customer.country}}"
                    value={selectedField.optionsSource ?? ''}
                    onChange={(event) => updateSelected({ optionsSource: event.target.value })}
                  /></label>
                  <label>Value key<input placeholder="id" value={selectedField.optionsValueKey ?? ''} onChange={(event) => updateSelected({ optionsValueKey: event.target.value })} /></label>
                  <label>Label key<input placeholder="name" value={selectedField.optionsLabelKey ?? ''} onChange={(event) => updateSelected({ optionsLabelKey: event.target.value })} /></label>
                  <label>Item label template<input placeholder="{{item.name}} ({{item.code}})" value={selectedField.optionsItemTemplate ?? ''} onChange={(event) => updateSelected({ optionsItemTemplate: event.target.value })} /></label>
                </fieldset>
              )}
              <fieldset>
                <legend>Column span</legend>
                <div className="builder-span-control">{[3, 4, 6, 8, 12].map((span) => <button className={selectedField.span === span ? 'active' : ''} type="button" key={span} onClick={() => updateSpan(span)}>{span}</button>)}</div>
              </fieldset>
              <fieldset>
                <legend>Alignment</legend>
                <div className="builder-span-control">
                  <button className={selectedField.align === 'start' ? 'active' : ''} type="button" onClick={() => updateSelected({ align: 'start' })}>Left</button>
                  <button className={selectedField.align === 'end' ? 'active' : ''} type="button" onClick={() => updateSelected({ align: 'end' })}>Right</button>
                </div>
              </fieldset>
              <div className="builder-property-summary"><span>Desktop <strong>{selectedField.span}/12</strong></span><span>Tablet <strong>{selectedField.span}/12</strong></span><span>Mobile <strong>12/12</strong></span></div>
              <button className="builder-delete-field" type="button" onClick={removeSelected}><Trash2 size={14} /> Remove field</button>
            </fieldset>
          ) : (
            <div className="builder-no-selection"><Settings2 size={22} /><strong>No field selected</strong><span>Select a field on the grid to edit its properties.</span></div>
          )}
        </aside>
      </section>
      {touchDrag && <TouchDragOverlay drag={touchDrag} />}
    </main>
  )
}