import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'
import { configureMonacoYaml } from 'monaco-yaml'
import YamlWorker from './yaml.worker?worker&inline'

globalThis.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === 'json') return new JsonWorker()
    if (label === 'yaml') return new YamlWorker()
    return new EditorWorker()
  },
}

loader.config({ monaco })

monaco.editor.defineTheme('a-form-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#171A18',
    'editor.foreground': '#DCE6DD',
    'editorLineNumber.foreground': '#68706A',
    'editorLineNumber.activeForeground': '#B8C1BA',
    'editorCursor.foreground': '#E5BE42',
    'editor.selectionBackground': '#3A443D',
    'editor.inactiveSelectionBackground': '#303731',
    'editorIndentGuide.background1': '#2A2E2B',
    'editorIndentGuide.activeBackground1': '#4A524C',
  },
})

configureMonacoYaml(monaco, {
  validate: true,
  format: { enable: true },
})

export { Editor }