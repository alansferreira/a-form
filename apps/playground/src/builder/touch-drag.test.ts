// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { targetAtPoint } from './touch-drag'

describe('touch drag targeting', () => {
  it('resolves the drop index from the element under the pointer', () => {
    document.body.innerHTML = '<button data-builder-drop-index="3"><span id="handle"></span></button>'
    const handle = document.getElementById('handle')!
    const originalElementFromPoint = document.elementFromPoint
    document.elementFromPoint = () => handle
    try {
      expect(targetAtPoint(10, 10)).toEqual({ index: 3 })
    } finally {
      document.elementFromPoint = originalElementFromPoint
    }
  })

  it('returns undefined when the pointer is not over a drop zone', () => {
    document.body.innerHTML = '<div id="outside"></div>'
    const outside = document.getElementById('outside')!
    const originalElementFromPoint = document.elementFromPoint
    document.elementFromPoint = () => outside
    try {
      expect(targetAtPoint(10, 10)).toBeUndefined()
    } finally {
      document.elementFromPoint = originalElementFromPoint
    }
  })
})