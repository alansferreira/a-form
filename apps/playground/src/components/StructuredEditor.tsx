import type { OnChange } from '@monaco-editor/react'
import { Check, Code2, FileUp, Upload, X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'
import { Editor } from '../monaco'
import './StructuredEditor.css'

export type StructuredFormat = 'json' | 'yaml'

export interface StructuredDocument {
  readonly source: string
  readonly format: StructuredFormat
}

export interface StructuredImportOptions {
  readonly generateRelated: boolean
}

interface StructuredEditorProps extends Omit<ComponentProps<typeof Editor>, 'language' | 'onChange' | 'path' | 'value'> {
  readonly document: StructuredDocument
  readonly label: string
  readonly path: string
  readonly toolbarActions?: ReactNode
  readonly onChange: (document: StructuredDocument) => void
  readonly onImport?: (document: StructuredDocument, options: StructuredImportOptions) => boolean | void
  readonly importOption?: { readonly label: string; readonly description: string }
}

function formatFromFile(file: File): StructuredFormat | undefined {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'json' || file.type === 'application/json') return 'json'
  if (extension === 'yaml' || extension === 'yml' || file.type.includes('yaml')) return 'yaml'
  return undefined
}

export function StructuredEditor({ document, label, path, toolbarActions, onChange, onImport = onChange, importOption, ...editorProps }: StructuredEditorProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [draft, setDraft] = useState<StructuredDocument>(document)
  const [generateRelated, setGenerateRelated] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const pathStem = path.replace(/\.(json|ya?ml)$/i, '')
  const editorPath = `${pathStem}.${document.format === 'json' ? 'json' : 'yaml'}`
  const importPath = `import-${pathStem}.${draft.format === 'json' ? 'json' : 'yaml'}`

  const openImport = () => {
    setDraft(document)
    setGenerateRelated(false)
    setImportError(null)
    setImportOpen(true)
  }

  const changeValue: OnChange = (value) => {
    onChange({ ...document, source: value ?? '' })
  }

  const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    try {
      setDraft({ source: await file.text(), format: formatFromFile(file) ?? draft.format })
      setImportError(null)
    } catch (error) {
      setImportError(`Could not read the file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const applyImport = () => {
    try {
      if (onImport(draft, { generateRelated: importOption !== undefined && generateRelated }) !== false) setImportOpen(false)
      else setImportError('The document could not be imported.')
    } catch (error) {
      setImportError(`Could not import: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-toolbar">
        <span>{editorPath}</span>
        <div className="structured-editor-actions">
          <span className="structured-editor-format">{document.format}</span>
          <button type="button" title={`Import ${label}`} onClick={openImport}><Upload size={14} /> Import</button>
          {toolbarActions}
        </div>
      </div>
      <div className="structured-editor-canvas">
        <Editor
          {...editorProps}
          aria-label={label}
          language={document.format}
          path={editorPath}
          value={document.source}
          onChange={changeValue}
        />
      </div>

      {importOpen && (
        <div className="structured-editor-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setImportOpen(false)}>
          <section className="structured-editor-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header>
              <span className="structured-editor-modal-icon"><Code2 size={19} /></span>
              <div><strong id={titleId}>Import {label}</strong><small>Paste or upload JSON or YAML</small></div>
              <button type="button" title="Close" aria-label="Close import dialog" onClick={() => setImportOpen(false)}><X size={17} /></button>
            </header>
            <div className="structured-editor-import-tools">
              <div className="structured-editor-format-switch" aria-label="Import format">
                {(['yaml', 'json'] as const).map((format) => (
                  <button className={draft.format === format ? 'active' : ''} type="button" key={format} onClick={() => setDraft({ ...draft, format })}>{format}</button>
                ))}
              </div>
              <input ref={inputRef} type="file" accept=".yaml,.yml,.json,text/yaml,application/yaml,application/json" hidden onChange={readFile} />
              <button type="button" onClick={() => inputRef.current?.click()}><FileUp size={14} /> Upload file</button>
              <em><Check size={13} /> {draft.format.toUpperCase()}</em>
            </div>
            <div className="structured-editor-import-body">
              <label>{importPath}</label>
              <div className="structured-editor-import-canvas">
                <Editor
                  aria-label={`Import ${label}`}
                  language={draft.format}
                  path={importPath}
                  theme={editorProps.theme}
                  value={draft.source}
                  onChange={(value) => { setDraft({ ...draft, source: value ?? '' }); setImportError(null) }}
                  options={{ automaticLayout: true, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 20, minimap: { enabled: false }, padding: { top: 16 }, scrollBeyondLastLine: false }}
                />
              </div>
            </div>
            {importOption && (
              <div className="structured-editor-import-option">
                <label><input type="checkbox" checked={generateRelated} aria-describedby={`${titleId}-option`} onChange={(event) => setGenerateRelated(event.target.checked)} /> {importOption.label}</label>
                <p id={`${titleId}-option`}>{importOption.description}</p>
              </div>
            )}
            {importError && <p className="structured-editor-import-error" role="alert">{importError}</p>}
            <footer>
              <span>{draft.format.toUpperCase()} document</span>
              <div><button type="button" onClick={() => setImportOpen(false)}>Cancel</button><button className="primary" type="button" onClick={applyImport}><Upload size={15} /> Import</button></div>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
