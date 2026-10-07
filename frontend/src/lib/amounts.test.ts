import { describe, expect, it } from 'vitest'
import { amountLabel, formatQuantity } from './amounts'

describe('amounts', () => {
  it.each([
    [0.5, '½'],
    [1.5, '1½'],
    [0.25, '¼'],
    [2, '2'],
    [0.33, '0.33'],
  ])('formats %s as %s', (q, text) => expect(formatQuantity(q)).toBe(text))

  it.each<[number | null, string | null, string]>([
    [125, 'g', '125 g'],
    [0.5, 'tin', '½ tin'],
    [2, 'clove', '2 cloves'],
    [3, 'tbsp', '3 tbsp'],
    [1, null, '1'],
    [null, null, 'to taste'],
  ])('reads %s %s as "%s"', (q, unit, text) => expect(amountLabel(q, unit)).toBe(text))
})
