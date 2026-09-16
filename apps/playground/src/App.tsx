import type {
  Diagnostic,
  JsonObject,
  NormalizedFormSpec,
} from 'jsfl-core'
import {
  normalizeFormSpec,
  parseYamlSpec,
  validateFormSpec,
} from 'jsfl-parser'
import { JSFLForm } from 'jsfl-react'
import {
  Check,
  Clipboard,
  Code2,
  FileCode2,
  Laptop,
  Monitor,
  RotateCcw,
  Smartphone,
  Sparkles,
  Tablet,
  TriangleAlert,
} from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import './App.css'
import { Editor } from './monaco'
import { BuilderApp } from './builder/BuilderApp'

const registrationExample = `version: "1"
schema:
  title: Registration
  type: object
  required: [person]
  properties:
    person:
      type: object
      required: [name, email]
      properties:
        name: { type: string, title: Full name, minLength: 2 }
        email: { type: string, title: Email, format: email }
        phone: { type: string, title: Phone }
uiSchema:
  person:
    email:
      ui:autocomplete: email
      ui:placeholder: name@example.com
    phone:
      ui:options:
        inputType: tel
layout:
  - type: row
    children:
      - type: column
        span: { mobile: 12, tablet: 6 }
        children:
          - { type: field, path: person.name }
      - type: column
        span: { mobile: 12, tablet: 6 }
        children:
          - { type: field, path: person.email }
  - type: row
    children:
      - type: column
        span: 12
        children:
          - { type: field, path: person.phone }
validations:
  async:
    - id: email-available
      adapter: customer-api
      paths: [person.email]
      triggers: [blur, submit]
      timeoutMs: 5000
`

const contactExample = `version: "1"
schema:
  title: Quick contact
  type: object
  required: [subject, message]
  properties:
    subject:
      type: string
      title: Subject
    priority:
      type: string
      title: Priority
      enum: [Low, Normal, Urgent]
    message:
      type: string
      title: Message
uiSchema:
  subject:
    ui:placeholder: What can we help with?
  priority:
    ui:enumNames: [Baixa, Normal, Urgente]
    ui:enumDisabled: [Urgent]
  message:
    ui:widget: textarea
    ui:options:
      rows: 5
layout:
  - type: row
    children:
      - type: column
        span: { mobile: 12, tablet: 8 }
        children:
          - { type: field, path: subject }
      - type: column
        span: { mobile: 12, tablet: 4 }
        children:
          - { type: field, path: priority }
  - type: row
    children:
      - type: column
        span: 12
        children:
          - { type: field, path: message }
`

type Viewport = 'mobile' | 'tablet' | 'desktop'
type InspectorTab = 'diagnostics' | 'ast'

const viewports: { id: Viewport; label: string; icon: typeof Smartphone }[] = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
]

function FormPreview({ spec, viewport }: { spec: NormalizedFormSpec; viewport: Viewport }) {
  const title = typeof spec.schema.title === 'string' ? spec.schema.title : 'Untitled form'
  const [formData, setFormData] = useState<JsonObject>({})

  return (
    <div className={`preview-frame preview-${viewport}`}>
      <div className="form-canvas">
        <div className="form-heading">
          <span>YF / 01</span>
          <h2>{title}</h2>
          <p>RJSF widgets arranged by the normalized JSFL layout.</p>
        </div>
        <JSFLForm
          key={viewport}
          spec={spec}
          viewport={viewport}
          value={formData}
          onChange={setFormData}
          noHtml5Validate
        />
      </div>
    </div>
  )
}

function DiagnosticList({ diagnostics }: { diagnostics: readonly Diagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <div className="empty-state">
        <Check size={18} />
        <div><strong>Schema is valid</strong><span>No issues found in this document.</span></div>
      </div>
    )
  }

  return (
    <div className="diagnostic-list">
      {diagnostics.map((diagnostic, index) => (
        <div className={`diagnostic diagnostic-${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}>
          <TriangleAlert size={16} />
          <div>
            <strong>{diagnostic.code}</strong>
            <p>{diagnostic.message}</p>
            <span>{diagnostic.range ? `Ln ${diagnostic.range.start.line + 1}, Col ${diagnostic.range.start.character + 1}` : diagnostic.path.join('.') || 'Document'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [source, setSource] = useState(registrationExample)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [tab, setTab] = useState<InspectorTab>('diagnostics')
  const [copied, setCopied] = useState(false)
  const deferredSource = useDeferredValue(source)
  const parsed = parseYamlSpec(deferredSource)
  const diagnostics = parsed.value
    ? [...parsed.diagnostics, ...validateFormSpec(parsed.value)]
    : parsed.diagnostics
  const normalized = parsed.value && diagnostics.every(({ severity }) => severity !== 'error')
    ? normalizeFormSpec(parsed.value)
    : undefined

  const copySource = async () => {
    await navigator.clipboard.writeText(source)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><Sparkles size={17} /></div>
        <div className="brand-copy">
          <strong>JSFL Forms</strong>
          <span>Playground</span>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${diagnostics.length ? 'status-warning' : ''}`}>
            {diagnostics.length ? <TriangleAlert size={14} /> : <Check size={14} />}
            {diagnostics.length ? `${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}` : 'Valid schema'}
          </span>
          <a href="https://github.com/alansferreira/jsfl-forms" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </header>

      <section className="toolbar">
        <div className="example-picker">
          <FileCode2 size={16} />
          <select
            aria-label="Example"
            value={source === contactExample ? 'contact' : 'registration'}
            onChange={(event) => setSource(event.target.value === 'contact' ? contactExample : registrationExample)}
          >
            <option value="registration">Registration</option>
            <option value="contact">Quick contact</option>
          </select>
        </div>
        <div className="viewport-control" aria-label="Preview viewport">
          {viewports.map(({ id, label, icon: Icon }) => (
            <button className={viewport === id ? 'active' : ''} type="button" key={id} onClick={() => setViewport(id)} title={label} aria-label={label}>
              <Icon size={16} />
            </button>
          ))}
        </div>
        <span className="viewport-label"><Laptop size={15} /> {viewport}</span>
      </section>

      <section className="workspace">
        <div className="panel editor-panel">
          <div className="panel-title">
            <div><Code2 size={16} /><strong>Schema</strong><span>YAML</span></div>
            <div>
              <button type="button" title="Reset example" aria-label="Reset example" onClick={() => setSource(registrationExample)}><RotateCcw size={15} /></button>
              <button type="button" title="Copy YAML" aria-label="Copy YAML" onClick={copySource}>{copied ? <Check size={15} /> : <Clipboard size={15} />}</button>
            </div>
          </div>
          <div className="code-editor">
            <Editor
              aria-label="YAML schema editor"
              language="yaml"
              path="form.jsfl.yaml"
              theme="jsfl-dark"
              value={source}
              onChange={(value) => setSource(value ?? '')}
              options={{
                automaticLayout: true,
                fontFamily: 'DM Mono, monospace',
                fontSize: 12,
                lineHeight: 21,
                minimap: { enabled: false },
                padding: { top: 15, bottom: 40 },
                scrollBeyondLastLine: false,
                tabSize: 2,
              }}
            />
          </div>
        </div>

        <div className="panel preview-panel">
          <div className="panel-title">
            <div><Monitor size={16} /><strong>Preview</strong><span>Live</span></div>
          </div>
          <div className="preview-stage">
            {normalized ? <FormPreview spec={normalized} viewport={viewport} /> : (
              <div className="preview-error"><TriangleAlert size={22} /><strong>Preview unavailable</strong><span>Fix the schema errors to render this form.</span></div>
            )}
          </div>
        </div>

        <aside className="panel inspector-panel">
          <div className="inspector-tabs">
            <button className={tab === 'diagnostics' ? 'active' : ''} type="button" onClick={() => setTab('diagnostics')}>Diagnostics <span>{diagnostics.length}</span></button>
            <button className={tab === 'ast' ? 'active' : ''} type="button" onClick={() => setTab('ast')}>Normalized AST</button>
          </div>
          <div className="inspector-content">
            {tab === 'diagnostics'
              ? <DiagnosticList diagnostics={diagnostics} />
              : (
                <Editor
                  aria-label="Normalized JSON AST"
                  language="json"
                  path="normalized-ast.json"
                  theme="jsfl-dark"
                  value={normalized ? JSON.stringify(normalized, null, 2) : '// Waiting for a valid schema'}
                  options={{
                    automaticLayout: true,
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 10,
                    lineHeight: 17,
                    minimap: { enabled: false },
                    padding: { top: 15 },
                    readOnly: true,
                    scrollBeyondLastLine: false,
                  }}
                />
              )}
          </div>
        </aside>
      </section>
    </main>
  )
}

export { App as LegacyPlayground }
export default BuilderApp
