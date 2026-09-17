import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { PalettePayload } from './model'
import { targetAtPoint } from './touch-drag'
import type { TouchDragState, TouchDropTarget } from './touch-drag'

export function useTouchDrag(onDrop: (payload: PalettePayload, target: TouchDropTarget) => void) {
  const [state, setState] = useState<TouchDragState>()
  const stateRef = useRef<TouchDragState | undefined>(undefined)
  const onDropRef = useRef(onDrop)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  const updateState = (next: TouchDragState | undefined) => {
    stateRef.current = next
    setState(next)
  }

  const stopAutoScroll = () => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
    frameRef.current = undefined
  }

  const autoScroll = () => {
    const current = stateRef.current
    if (!current) return
    const edge = 72
    const speed = current.y < edge
      ? -Math.ceil((edge - current.y) / 8)
      : current.y > window.innerHeight - edge
        ? Math.ceil((current.y - (window.innerHeight - edge)) / 8)
        : 0
    if (speed !== 0) {
      window.scrollBy({ top: speed })
      updateState({ ...current, target: targetAtPoint(current.x, current.y) })
    }
    frameRef.current = requestAnimationFrame(autoScroll)
  }

  const finish = () => {
    const current = stateRef.current
    stopAutoScroll()
    document.body.classList.remove('builder-touch-dragging')
    updateState(undefined)
    if (current?.target) onDropRef.current(current.payload, current.target)
  }

  useEffect(() => () => {
    stopAutoScroll()
    document.body.classList.remove('builder-touch-dragging')
  }, [])

  const bindTouchHandle = (payload: PalettePayload) => ({
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse' || !event.isPrimary) return
      event.preventDefault()
      event.stopPropagation()
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Some embedded browsers expose Pointer Events without pointer capture.
      }
      const next = { payload, x: event.clientX, y: event.clientY, target: targetAtPoint(event.clientX, event.clientY) }
      document.body.classList.add('builder-touch-dragging')
      updateState(next)
      stopAutoScroll()
      frameRef.current = requestAnimationFrame(autoScroll)
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (!stateRef.current || event.pointerType === 'mouse') return
      event.preventDefault()
      updateState({
        ...stateRef.current,
        x: event.clientX,
        y: event.clientY,
        target: targetAtPoint(event.clientX, event.clientY),
      })
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      if (!stateRef.current || event.pointerType === 'mouse') return
      event.preventDefault()
      event.stopPropagation()
      finish()
    },
    onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
      if (!stateRef.current || event.pointerType === 'mouse') return
      stopAutoScroll()
      document.body.classList.remove('builder-touch-dragging')
      updateState(undefined)
    },
    onClick(event: ReactMouseEvent<HTMLElement>) {
      event.stopPropagation()
    },
  })

  return { bindTouchHandle, touchDrag: state }
}