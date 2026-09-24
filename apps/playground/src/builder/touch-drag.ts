import type { PalettePayload } from './model'

export interface TouchDragState {
  readonly x: number
  readonly y: number
  readonly payload: PalettePayload
  readonly target?: TouchDropTarget
}

export interface TouchDropTarget {
  readonly index: number
}

export function targetAtPoint(x: number, y: number): TouchDropTarget | undefined {
  const element = document.elementFromPoint(x, y)
  const dropZone = element?.closest<HTMLElement>('[data-builder-drop-index]')
  if (!dropZone?.dataset.builderDropIndex) return undefined
  return { index: Number(dropZone.dataset.builderDropIndex) }
}