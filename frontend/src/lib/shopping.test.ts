import { describe, expect, it } from 'vitest'
import { changesSummary, formatAmount } from './shopping'

describe('formatAmount', () => {
  it.each([
    [{ quantity: 630, unit: 'ml', toTaste: false }, '630 ml'],
    [{ quantity: 3, unit: 'tin', toTaste: false }, '3 tins'],
    [{ quantity: 1, unit: 'tin', toTaste: false }, '1 tin'],
    [{ quantity: 2, unit: 'item', toTaste: false }, '2'],
    [{ quantity: 1.25, unit: 'kg', toTaste: false }, '1.25 kg'],
    [{ quantity: 5, unit: 'ml', toTaste: true }, '5 ml + to taste'],
    [{ quantity: null, unit: 'item', toTaste: true }, 'to taste'],
  ])('%o reads "%s"', (item, expected) => {
    expect(formatAmount(item)).toBe(expected)
  })
})

describe('changesSummary', () => {
  it('lists only what changed, in plain words', () => {
    expect(changesSummary({ added: 2, removed: 0, changed: 0 })).toBe('2 added.')
    expect(changesSummary({ added: 3, removed: 1, changed: 2 })).toBe('3 added, 1 removed and 2 changed.')
  })
})
