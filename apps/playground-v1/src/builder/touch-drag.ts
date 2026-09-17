import type { PalettePayload } from './model'

export interface TouchDragState {
  readonly x: number
  readonly y: number
  readonly payload: PalettePayload
  readonly target?: TouchDropTarget
}

export interface TouchDropTarget {
  readonly rowId: string
  readonly slot: number
}

export function slotFromPoint(clientX: number, left: number, width: number): number {
  if (width <= 0) return 0
  return Math.max(0, Math.min(11, Math.floor(((clientX - left) / width) * 12)))
}

export function targetAtPoint(x: number, y: number): TouchDropTarget | undefined {
  const element = document.elementFromPoint(x, y)
  const row = element?.closest<HTMLElement>('[data-builder-row-id]')
  if (!row?.dataset.builderRowId) return undefined
  const rect = row.getBoundingClientRect()
  return { rowId: row.dataset.builderRowId, slot: slotFromPoint(x, rect.left, rect.width) }
}