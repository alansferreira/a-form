import type { CSSProperties } from 'react'
import type { TouchDragState } from './touch-drag'

export function TouchDragOverlay({ drag }: { drag: TouchDragState }) {
  const style = { '--touch-x': `${drag.x}px`, '--touch-y': `${drag.y}px` } as CSSProperties
  return (
    <div className="builder-touch-overlay" style={style} aria-hidden="true">
      <span>{drag.payload.label}</span>
      <small>{drag.target ? `Insert at position ${drag.target.index + 1}` : 'Move over the canvas'}</small>
    </div>
  )
}