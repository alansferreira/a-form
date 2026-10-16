import type { FormSpec, JsonObject, JsonValue } from 'a-form-core'
import { normalizeFormSpec, parseYamlSpec, validateFormSpec } from 'a-form-parser'
import type { StructuredDocument, StructuredFormat } from '../components/StructuredEditor'
import { buildFormSpec, FIELD_KINDS } from './model'
import type { BuilderField, BuilderSeparator } from './model'

export const PROJECT_STORAGE_KEY = 'a-form-studio.project.v1'
export const HISTORY_LIMIT = 100

export interface BuilderProject {
  readonly fields: readonly BuilderField[]
  readonly separators: readonly BuilderSeparator[]
  readonly baseSpec: FormSpec | null
  readonly dataDocument: StructuredDocument
  readonly codeDraft: StructuredDocument | null
  readonly codeFormat: StructuredFormat
  readonly previewValue: JsonObject
}

export interface ProjectHistory {
  readonly past: readonly BuilderProject[]
  readonly present: BuilderProject
  readonly future: readonly BuilderProject[]
  readonly group: { readonly key: string; readonly time: number } | null
}

export function createHistory(project: BuilderProject): ProjectHistory {
  return { past: [], present: project, future: [], group: null }
}

export function changeProject(
  history: ProjectHistory,
  changes: Partial<BuilderProject>,
  group?: string,
  time = Date.now(),
): ProjectHistory {
  const present = { ...history.present, ...changes }
  if (JSON.stringify(present) === JSON.stringify(history.present)) return history
  const coalesce = group !== undefined && group === history.group?.key && time - history.group.time < 750
  return {
    past: coalesce ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
    group: group === undefined ? null : { key: group, time },
  }
}

export function undoProject(history: ProjectHistory): ProjectHistory {
  const present = history.past.at(-1)
  return present ? {
    past: history.past.slice(0, -1),
    present,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
    group: null,
  } : history
}

export function redoProject(history: ProjectHistory): ProjectHistory {
  const present = history.future[0]
  return present ? {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present,
    future: history.future.slice(1),
    group: null,
  } : history
}

export function serializeProject(history: ProjectHistory): string {
  return JSON.stringify({
    version: 1,
    history: { past: history.past, present: history.present, future: history.future },
  })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  return isObject(value) && Object.values(value).every(isJsonValue)
}

function isDocument(value: unknown): value is StructuredDocument {
  return isObject(value) && typeof value.source === 'string' && (value.format === 'yaml' || value.format === 'json')
}

function isField(value: unknown): value is BuilderField {
  if (!isObject(value)) return false
  return ['id', 'path', 'jsonPath', 'label'].every((key) => typeof value[key] === 'string')
    && FIELD_KINDS.some(({ kind }) => kind === value.kind)
    && typeof value.span === 'number' && Number.isInteger(value.span) && value.span >= 1 && value.span <= 12
    && (value.align === 'start' || value.align === 'end')
    && ['optionsSource', 'optionsValueKey', 'optionsLabelKey', 'optionsItemTemplate'].every((key) => value[key] === undefined || typeof value[key] === 'string')
    && ['rangeMin', 'rangeMax', 'rangeStep'].every((key) => value[key] === undefined || (typeof value[key] === 'number' && Number.isFinite(value[key])))
    && ['arrayAddable', 'arrayRemovable', 'arrayOrderable'].every((key) => value[key] === undefined || typeof value[key] === 'boolean')
    && (value.sampleValue === undefined || isJsonValue(value.sampleValue))
}

function isSeparator(value: unknown): value is BuilderSeparator {
  return isObject(value) && typeof value.id === 'string' && typeof value.title === 'string'
    && (value.description === undefined || typeof value.description === 'string')
    && (value.beforeFieldId === undefined || typeof value.beforeFieldId === 'string')
}

function isFormSpec(value: unknown): value is FormSpec {
  if (!isObject(value)) return false
  const parsed = parseYamlSpec(JSON.stringify(value))
  return parsed.value !== undefined
    && ![...parsed.diagnostics, ...validateFormSpec(parsed.value)].some(({ severity }) => severity === 'error')
}

function isProject(value: unknown): value is BuilderProject {
  if (!isObject(value)) return false
  let baseSpec: FormSpec | undefined
  if (value.baseSpec !== null) {
    if (!isFormSpec(value.baseSpec)) return false
    baseSpec = value.baseSpec
  }
  if (!Array.isArray(value.fields) || !value.fields.every(isField)
    || !Array.isArray(value.separators) || !value.separators.every(isSeparator)
    || !isDocument(value.dataDocument) || !(value.codeDraft === null || isDocument(value.codeDraft))
    || !(value.codeFormat === 'yaml' || value.codeFormat === 'json')
    || !isObject(value.previewValue) || !isJsonValue(value.previewValue)) return false
  const ids = value.fields.map((field) => field.id)
  const paths = value.fields.map((field) => field.path)
  const separatorIds = value.separators.map((separator) => separator.id)
  if (new Set([...ids, ...separatorIds]).size !== ids.length + separatorIds.length
    || new Set(paths).size !== paths.length) return false
  // Unfinished visual edits (e.g. an empty separator title) must also survive reload.
  normalizeFormSpec(buildFormSpec(value.fields, value.separators, baseSpec))
  return true
}

export function deserializeProject(source: string): ProjectHistory {
  const value: unknown = JSON.parse(source)
  if (!isObject(value) || value.version !== 1 || !isObject(value.history)
    || !Array.isArray(value.history.past) || !Array.isArray(value.history.future)
    || value.history.past.length > HISTORY_LIMIT || value.history.future.length > HISTORY_LIMIT
    || !value.history.past.every(isProject) || !isProject(value.history.present)
    || !value.history.future.every(isProject)) {
    throw new Error('The saved project is invalid or uses an unsupported version.')
  }
  return { past: value.history.past, present: value.history.present, future: value.history.future, group: null }
}
