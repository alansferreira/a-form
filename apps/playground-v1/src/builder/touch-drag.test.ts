import { describe, expect, it } from 'vitest'
import { slotFromPoint } from './touch-drag'

describe('touch drag grid targeting', () => {
  it('maps pointer coordinates to the bounded 12-column grid', () => {
    expect(slotFromPoint(100, 100, 600)).toBe(0)
    expect(slotFromPoint(399, 100, 600)).toBe(5)
    expect(slotFromPoint(699, 100, 600)).toBe(11)
    expect(slotFromPoint(40, 100, 600)).toBe(0)
    expect(slotFromPoint(900, 100, 600)).toBe(11)
  })
})