import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  changeProject,
  createHistory,
  deserializeProject,
  PROJECT_STORAGE_KEY,
  redoProject,
  serializeProject,
  undoProject,
} from './project'
import type { BuilderProject } from './project'

interface StorageProblem {
  readonly kind: 'invalid' | 'unavailable' | 'conflict'
  readonly message: string
}

function storageMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function restoreProject(project: BuilderProject) {
  let source: string | null = null
  try {
    source = window.localStorage.getItem(PROJECT_STORAGE_KEY)
    return { history: source === null ? createHistory(project) : deserializeProject(source), source, problem: null }
  } catch (error) {
    const problem: StorageProblem = source === null
      ? { kind: 'unavailable', message: `Browser storage is unavailable: ${storageMessage(error)}` }
      : { kind: 'invalid', message: `The saved copy could not be restored and has not been overwritten: ${storageMessage(error)}` }
    return { history: createHistory(project), source, problem }
  }
}

export function useBuilderProject(defaultProject: BuilderProject) {
  const [initial] = useState(() => restoreProject(defaultProject))
  const [history, setHistory] = useState(initial.history)
  const [problem, setProblem] = useState<StorageProblem | null>(initial.problem)
  const [savedSource, setSavedSource] = useState(initial.source)
  const [savedCopy, setSavedCopy] = useState(initial.source)
  const source = useMemo(() => serializeProject(history), [history])
  const persistence = useRef({
    source,
    expected: initial.source,
    blocked: initial.problem?.kind === 'invalid',
    pending: source !== initial.source,
  })

  const save = useCallback((notify = true, replace = false): boolean => {
    const current = persistence.current
    if (current.blocked && !replace) return false
    if (!current.pending && !replace) return true
    try {
      const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY)
      if (!replace && stored !== current.expected) {
        current.blocked = true
        if (notify) {
          setSavedCopy(stored)
          setProblem({ kind: 'conflict', message: 'Another tab changed the saved project. Your work is still open here; choose which copy to keep before saving.' })
        }
        return false
      }
      window.localStorage.setItem(PROJECT_STORAGE_KEY, current.source)
      current.expected = current.source
      current.pending = false
      current.blocked = false
      if (notify) {
        setSavedSource(current.source)
        setSavedCopy(current.source)
        setProblem(null)
      }
      return true
    } catch (error) {
      if (notify) setProblem({ kind: 'unavailable', message: `Changes are not saved in this browser: ${storageMessage(error)}. Keep this tab open and download your work before leaving.` })
      return false
    }
  }, [])

  useEffect(() => {
    persistence.current.source = source
    persistence.current.pending = source !== savedSource
    if (!persistence.current.pending || persistence.current.blocked) return
    const timer = window.setTimeout(() => save(), 300)
    return () => window.clearTimeout(timer)
  }, [source, savedSource, save])

  useEffect(() => {
    const onPageHide = () => { save() }
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') save() }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!save()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PROJECT_STORAGE_KEY && event.key !== null) return
      if (event.newValue === persistence.current.expected) return
      persistence.current.blocked = true
      setSavedCopy(event.newValue)
      setProblem({ kind: 'conflict', message: 'Another tab changed the saved project. Your work is still open here; choose which copy to keep before saving.' })
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      save(false)
    }
  }, [save])

  const loadSaved = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY)
      if (stored === null) throw new Error('There is no saved project to restore.')
      const restored = deserializeProject(stored)
      const restoredSource = serializeProject(restored)
      persistence.current = { source: restoredSource, expected: stored, pending: false, blocked: false }
      setHistory(restored)
      setSavedSource(restoredSource)
      setSavedCopy(stored)
      setProblem(null)
      return true
    } catch (error) {
      setProblem({ kind: 'invalid', message: `Could not load the saved project: ${storageMessage(error)}` })
      return false
    }
  }, [])

  const updateProject = useCallback((changes: Partial<BuilderProject>, group?: string) => {
    setHistory((current) => changeProject(current, changes, group))
  }, [])
  const undo = useCallback(() => { setHistory(undoProject) }, [])
  const redo = useCallback(() => { setHistory(redoProject) }, [])

  return {
    project: history.present,
    updateProject,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saving: source !== savedSource,
    problem,
    savedCopy,
    save: () => save(),
    replaceSaved: () => save(true, true),
    loadSaved,
  }
}
