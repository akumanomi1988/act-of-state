import { describe, expect, it } from 'vitest'
import { change, number, signed } from './format'

describe('Spanish governmental number formatting', () => {
  it('groups thousands even when the amount is below ten thousand', () => {
    expect(number(-1400)).toBe('-1.400')
    expect(number(10600)).toBe('10.600')
  })

  it('keeps political outcome deltas readable', () => {
    expect(change(12000, 10600)).toBe('-1.400')
    expect(change(50, 62)).toBe('+12')
    expect(signed(1400)).toBe('+1.400')
  })
})
