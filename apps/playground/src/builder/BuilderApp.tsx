import type { FormSpec, JsonObject, NormalizedFormSpec } from 'a-form-core'
import { normalizeFormSpec, parseYamlSpec, validateFormSpec } from 'a-form-parser'
import { AForm } from 'a-form-react'
import * as yaml from 'yaml';

import { PresentationAdapterRegistry } from 'a-form-react'
import { NeobrutalismAdapter } from 'a-form-presentation-neobrutalism'
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
  Rows3,
  Search,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { StructuredEditor } from '../components/StructuredEditor'
import type { StructuredDocument } from '../components/StructuredEditor'
import {
  buildFormSpec,
  defaultSpan,
  FIELD_KINDS,
  fieldGridColumn,
  formSpecToBuilderFields,
  formSpecToYaml,
  groupFieldsByPanel,
  inferFieldKind,
  internalPath,
  listDataPaths,
  parseExampleData,
} from './model'
import type { BuilderField, BuilderPanel, FieldKind, PalettePayload } from './model'
import { TouchDragOverlay } from './TouchDragOverlay'
import { useTouchDrag } from './useTouchDrag'
import './BuilderApp.css'
import 'a-form-presentation-neobrutalism/styles.css'
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

/** Mirrors the AForm renderer: an insertion point only belongs to a panel when both of its neighbors already share that panel. */
function panelIdAt(fields: readonly BuilderField[], index: number): string | undefined {
  const before = fields[index - 1]
  const after = fields[index]
  return before?.panelId && before.panelId === after?.panelId ? before.panelId : undefined
}

type BuilderView = 'design' | 'code' | 'preview'
type InspectorView = 'properties' | 'spec'
type SourceView = 'data' | 'fields'
type PreviewTheme = 'amber-tech-high-contrast' | 'tailwind' | 'bootstrap' | 'material'
type Viewport = 'mobile' | 'tablet' | 'desktop'
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
}

const viewports: readonly { id: Viewport; label: string; icon: LucideIcon }[] = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
]

const previewThemes: readonly { id: PreviewTheme; label: string }[] = [
  { id: 'amber-tech-high-contrast', label: 'Amber Tech High Contrast' },
  { id: 'tailwind', label: 'Tailwind' },
  { id: 'bootstrap', label: 'Bootstrap' },
  { id: 'material', label: 'Material' },
]

const presentationRegistry = new PresentationAdapterRegistry()
presentationRegistry.register(NeobrutalismAdapter)
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
  onChange 
}: { 
  spec: NormalizedFormSpec; 
  viewport: Viewport; 
  theme: PreviewTheme, 
  onChange?: (value: JsonObject) => void 
}) {
  const [value, setValue] = useState<JsonObject>({})
  return (
    <div className={`builder-preview-frame builder-preview-${viewport}`}>
      <div className={`builder-form-canvas builder-theme-${theme}`}>
        <div className="builder-form-heading">
          <span>LIVE FORM / 01</span>
          <h2>{spec.schema?.title ? spec.schema?.title as string : 'Untitled form'}</h2>
          <p>Generated from the current virtual grid.</p>
        </div>
          <AForm
            spec={spec}
            viewport={viewport}
            value={value}
            onChange={(value) => {
              setValue(value)
              onChange?.(value)
            }}
            noHtml5Validate
            presentation={theme === 'amber-tech-high-contrast' || theme === 'tailwind' || theme === 'bootstrap' || theme === 'material'
              ? { registry: presentationRegistry, adapterId: theme === 'amber-tech-high-contrast' ? 'neobrutalism' : theme }
              : undefined}
          />
      </div>
    </div>
  )
}

export function BuilderApp() {
  const [dataDocument, setDataDocument] = useState<StructuredDocument>({ source: exampleData, format: 'yaml' })
  const [, setPreviewOutputDocument] = useState<StructuredDocument>({ source: exampleData, format: 'yaml' })
  const [fields, setFields] = useState<readonly BuilderField[]>(initialFields)
  const [panels, setPanels] = useState<readonly BuilderPanel[]>([])
  const [baseSpec, setBaseSpec] = useState<FormSpec>()
  const [selectedFieldId, setSelectedFieldId] = useState<string>('field-1')
  const [pathDraft, setPathDraft] = useState('')
  const [pendingPayload, setPendingPayload] = useState<PalettePayload>()
  const [view, setView] = useState<BuilderView>('design')
  const [inspectorView, setInspectorView] = useState<InspectorView>('properties')
  const [sourceView, setSourceView] = useState<SourceView>('fields')
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('amber-tech-high-contrast')
  const [notice, setNotice] = useState('Drag a source and drop it anywhere on the canvas; the grid wraps automatically.')
  const [dataCopied, setDataCopied] = useState(false)
  // const [copied, setCopied] = useState(false)
  const [codeDocument, setCodeDocument] = useState<StructuredDocument>({ source: '', format: 'yaml' })
  // const [specFormat, setSpecFormat] = useState<StructuredDocument['format']>('yaml')
  const fieldSequence = useRef(4)
  const panelSequence = useRef(1)
  const deferredDataSource = useDeferredValue(dataDocument.source)
  const parsedData = parseExampleData(deferredDataSource)
  const dataPaths = parsedData.value ? listDataPaths(parsedData.value) : []
  const spec = buildFormSpec(fields, panels, baseSpec)
  const normalized = normalizeFormSpec(spec)
  const specYaml = formSpecToYaml(fields, panels, baseSpec)
  // const specDocument: StructuredDocument = {
  //   source: specFormat === 'json' ? JSON.stringify(spec, null, 2) : specYaml,
  //   format: specFormat,
  // }
  const selectedField = fields.find((field) => field.id === selectedFieldId)
  const placedPaths = new Set(fields.map((field) => field.path))
  const emptyPanels = panels.filter((panel) => !fields.some((field) => field.panelId === panel.id))

  useEffect(() => {
    setPathDraft(selectedField?.jsonPath ?? '')
  }, [selectedFieldId, selectedField?.jsonPath])

  const selectView = (nextView: BuilderView) => {
    if (nextView === 'code') {
      setCodeDocument((current) => ({
        ...current,
        source: current.format === 'json' ? JSON.stringify(spec, null, 2) : specYaml,
      }))
    } else {
      applySpecDocument(codeDocument)
    }
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
      align: 'start',
      sampleValue: payload.sampleValue,
    }
  }

  /** Inserts (or reorders) a field at `index`; the grid itself decides when the result fits on the same line or wraps. */
  const placeField = (payload: PalettePayload, index: number, forcedPanelId?: string) => {
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
    const panelId = forcedPanelId ?? panelIdAt(withoutMoving, clampedIndex)
    const fieldWithoutPanel: BuilderField = { ...field }
    delete (fieldWithoutPanel as { panelId?: string }).panelId
    const placedField: BuilderField = panelId ? { ...fieldWithoutPanel, panelId } : fieldWithoutPanel
    const nextFields = [...withoutMoving]
    nextFields.splice(clampedIndex, 0, placedField)
    setFields(nextFields)
    setSelectedFieldId(placedField.id)
    setPendingPayload(undefined)
    setInspectorView('properties')
    setNotice(`${placedField.label} placed${panelId ? ' in panel.' : '.'}`)
  }

  const { bindTouchHandle, touchDrag } = useTouchDrag((payload, target) => {
    placeField(payload, target.index)
  })

  const dropAt = (event: React.DragEvent, index: number, panelId?: string) => {
    event.preventDefault()
    const rawPayload = event.dataTransfer.getData('application/x-a-form-builder')
    if (!rawPayload) return
    placeField(JSON.parse(rawPayload) as PalettePayload, index, panelId)
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

  const addPanel = () => {
    const panelId = `panel-${panelSequence.current++}`
    setPanels((current) => [...current, { id: panelId, title: 'New panel' }])
    setNotice(`${panelId} added. Drop a field into it to get started.`)
  }

  const renamePanel = (panelId: string, title: string) => {
    setPanels((current) => current.map((panel) => panel.id === panelId ? { ...panel, title } : panel))
  }

  const removePanel = (panelId: string) => {
    setPanels((current) => current.filter((panel) => panel.id !== panelId))
  }

  const updateSelected = (changes: Partial<BuilderField>) => {
    setFields((current) => current.map((field) => field.id === selectedFieldId ? { ...field, ...changes } : field))
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
    const duplicate = fields.some((field) => field.id !== selectedFieldId && field.path === path)
    if (duplicate) {
      setNotice(`Path "${path}" is already used by another field.`)
      setPathDraft(selectedField.jsonPath)
      return
    }
    updateSelected({ path, jsonPath: `$.${path}` })
  }

  const removeSelected = () => {
    setFields((current) => current.filter((field) => field.id !== selectedFieldId))
    setSelectedFieldId('')
  }

  const applySpecDocument = (document: StructuredDocument): boolean => {
    const parsed = parseYamlSpec(document.source)
    const diagnostics = parsed.value
      ? [...parsed.diagnostics, ...validateFormSpec(parsed.value)]
      : parsed.diagnostics
    const error = diagnostics.find((diagnostic) => diagnostic.severity === 'error')
    if (!parsed.value || error) {
      setNotice(`Could not apply ${document.format.toUpperCase()}: ${error?.message ?? 'invalid AForm spec.'}`)
      return false
    }

    try {
      const { fields: importedFields, panels: importedPanels } = formSpecToBuilderFields(parsed.value)
      const firstField = importedFields[0]
      setFields(importedFields)
      setPanels(importedPanels)
      setBaseSpec(parsed.value)
      fieldSequence.current = importedFields.length + 1
      panelSequence.current = importedPanels.length + 1
      setSelectedFieldId(firstField?.id ?? '')
      setPendingPayload(undefined)
      setView('design')
      setInspectorView('properties')
      setNotice(`${document.format.toUpperCase()} applied with ${importedFields.length} field${importedFields.length === 1 ? '' : 's'}.`)
      return true
    } catch (error) {
      setNotice(`Could not apply ${document.format.toUpperCase()}: ${error instanceof Error ? error.message : 'unsupported layout.'}`)
      return false
    }
  }

  const applyCode = () => {
    applySpecDocument(codeDocument)
  }

  // const importGeneratedSpec = (document: StructuredDocument): boolean => {
  //   const applied = applySpecDocument(document)
  //   if (applied) setSpecFormat(document.format)
  //   return applied
  // }

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(dataDocument.source)
      setDataCopied(true)
      window.setTimeout(() => setDataCopied(false), 1400)
    } catch {
      setNotice('Clipboard access is unavailable.')
    }
  }

  // const copySpec = async () => {
  //   try {
  //     await navigator.clipboard.writeText(specDocument.source)
  //     setCopied(true)
  //     window.setTimeout(() => setCopied(false), 1400)
  //   } catch {
  //     setNotice('Clipboard access is unavailable. Use Download YAML instead.')
  //   }
  // }

  const downloadSpec = () => {
    const extension = codeDocument.format === 'json' ? 'json' : 'yaml'
    const source = codeDocument.source || (extension === 'json' ? JSON.stringify(spec, null, 2) : specYaml)
    const url = URL.createObjectURL(new Blob([source], { type: extension === 'json' ? 'application/json' : 'text/yaml' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `form.a-form.${extension}`
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
        <nav className="builder-external-links" aria-label="External links">
          <a href="https://github.com/alansferreira/a-form" target="_blank" rel="noreferrer" title="Open AForm on GitHub" aria-label="Open AForm on GitHub"><Github size={15} /></a>
          <a href="https://www.linkedin.com/in/alansferreira/" target="_blank" rel="noreferrer" title="Open Alan Ferreira on LinkedIn" aria-label="Open Alan Ferreira on LinkedIn"><Linkedin size={15} /></a>
        </nav>
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
              <StructuredEditor
                document={dataDocument}
                label="Example data"
                path="example-data.yaml"
                theme="a-form-dark"
                onChange={setDataDocument}
                toolbarActions={<button type="button" title={`Copy ${dataDocument.format.toUpperCase()}`} aria-label={`Copy ${dataDocument.format.toUpperCase()}`} onClick={copyData}>{dataCopied ? <Check size={14} /> : <Clipboard size={14} />}</button>}
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
            <div><strong>{view === 'design' ? 'User Registration Flow' : view === 'code' ? 'AForm specification' : 'Live preview'}</strong><span>{view === 'design' ? 'Fields flow left-to-right and wrap automatically when a line runs out of space' : `${fields.length} fields`}</span></div>
            {view === 'design' && <button type="button" onClick={addPanel}><Rows3 size={15} /> Add panel</button>}
            {view === 'code' && <button type="button" onClick={applyCode}><Check size={15} /> Apply {codeDocument.format.toUpperCase()}</button>}
            {view === 'preview' && (
              <label className="builder-theme-control">
                <Palette size={15} />
                <span>Theme</span>
                <select value={previewTheme} onChange={(event) => setPreviewTheme(event.target.value as PreviewTheme)}>
                  {previewThemes.map((theme) => <option value={theme.id} key={theme.id}>{theme.label}</option>)}
                </select>
              </label>
            )}
          </div>
          {view === 'design' ? (
            <div className="builder-grid-canvas">
              <div className="builder-grid-ruler">{Array.from({ length: 12 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
              <div className="builder-flow-grid" onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropAt(event, fields.length)}>
                {groupFieldsByPanel(fields).map((group) => {
                  const fieldElements = group.fields.map((field) => {
                    const Icon = kindIcons[field.kind]
                    const payload: PalettePayload = { source: 'canvas', fieldId: field.id, label: field.label, kind: field.kind }
                    const index = fields.indexOf(field)
                    return (
                      <button
                        className={`builder-field-block ${selectedFieldId === field.id ? 'selected' : ''} ${touchDrag?.target?.index === index ? 'touch-target' : ''}`}
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
                      </button>
                    )
                  })

                  if (!group.panelId) return fieldElements

                  const panel = panels.find((item) => item.id === group.panelId)
                  const appendIndex = fields.indexOf(group.fields[group.fields.length - 1]!) + 1
                  return (
                    <div className="builder-panel-wrap" key={group.panelId} style={{ gridColumn: '1 / -1' }}>
                      <div className="builder-panel-meta">
                        <input
                          aria-label="Panel title"
                          value={panel?.title ?? ''}
                          onChange={(event) => renamePanel(group.panelId!, event.target.value)}
                        />
                        <button type="button" title="Remove panel" aria-label="Remove panel" onClick={() => removePanel(group.panelId!)}><Trash2 size={13} /></button>
                      </div>
                      <div className="builder-panel-frame builder-flow-grid">
                        {fieldElements}
                        <button
                          className="builder-panel-add"
                          data-builder-drop-index={appendIndex}
                          type="button"
                          onClick={() => pendingPayload && placeField(pendingPayload, appendIndex, group.panelId)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => dropAt(event, appendIndex, group.panelId)}
                        ><Plus size={13} /> Add field to panel</button>
                      </div>
                    </div>
                  )
                })}
                {emptyPanels.map((panel) => (
                  <div className="builder-panel-wrap" key={panel.id} style={{ gridColumn: '1 / -1' }}>
                    <div className="builder-panel-meta">
                      <input aria-label="Panel title" value={panel.title} onChange={(event) => renamePanel(panel.id, event.target.value)} />
                      <button type="button" title="Remove panel" aria-label="Remove panel" onClick={() => removePanel(panel.id)}><Trash2 size={13} /></button>
                    </div>
                    <div
                      className="builder-panel-frame builder-empty-row"
                      data-builder-drop-index={fields.length}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropAt(event, fields.length, panel.id)}
                      onClick={() => pendingPayload && placeField(pendingPayload, fields.length, panel.id)}
                    ><Plus size={16} /> Drop a field here to fill this panel</div>
                  </div>
                ))}
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
                <button className="builder-add-row" type="button" onClick={addPanel}><Rows3 size={16} /> Add panel</button>
              </div>
            </div>
          ) : view === 'code' ? (
            <div className="builder-code-stage">
              <StructuredEditor
                document={codeDocument}
                label="AForm schema"
                path="form.a-form.yaml"
                theme="a-form-dark"
                onChange={setCodeDocument}
                toolbarActions={<button type="button" onClick={downloadSpec}><Download size={14} /> Download</button>}
                options={{ automaticLayout: true, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 20, minimap: { enabled: false }, padding: { top: 16 }, scrollBeyondLastLine: false }}
              />
            </div>
          ) : (
            <div className="builder-preview-stage"><Preview spec={normalized} viewport={viewport} theme={previewTheme} onChange={
              (value) => {
                console.log('Preview value changed:');
                console.log(value);
                setPreviewOutputDocument({...dataDocument, source: yaml.stringify(value, { indent: 2})})
              }} /></div>
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
            <div className="builder-properties">
              <div className="builder-selection-heading"><span className="builder-kind-icon">{(() => { const Icon = kindIcons[selectedField.kind]; return <Icon size={17} /> })()}</span><div><strong>{selectedField.label}</strong><small>{selectedField.kind} field</small></div></div>
              <label>Label<input value={selectedField.label} onChange={(event) => updateSelected({ label: event.target.value })} /></label>
              <label>Absolute path<input
                value={pathDraft}
                onChange={(event) => setPathDraft(event.target.value)}
                onBlur={(event) => commitFieldPath(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitFieldPath(pathDraft) } }}
              /></label>
              <label>Field type<select value={selectedField.kind} onChange={(event) => updateSelected({ kind: event.target.value as FieldKind })}>{FIELD_KINDS.map((item) => <option value={item.kind} key={item.kind}>{item.label}</option>)}</select></label>
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
            </div>
          ) : (
            <div className="builder-no-selection"><Settings2 size={22} /><strong>No field selected</strong><span>Select a field on the grid to edit its properties.</span></div>
          )}
        </aside>
      </section>
      {touchDrag && <TouchDragOverlay drag={touchDrag} />}
    </main>
  )
}