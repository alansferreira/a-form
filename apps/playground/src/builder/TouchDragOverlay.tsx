import type { CSSProperties } from 'react'
import type { TouchDragState } from './touch-drag'

export function TouchDragOverlay({ drag }: { drag: TouchDragState }) {
  const style = { '--touch-x': `${drag.x}px`, '--touch-y': `${drag.y}px` } as CSSProperties
  return (
    <div className="builder-touch-overlay" style={style} aria-hidden="true">
      <span>{drag.payload.label}</span>
      <small>{drag.target ? `Row ${drag.target.rowId.replace('row-', '')} / column ${drag.target.slot + 1}` : 'Move over a grid row'}</small>
    </div>
  )
}