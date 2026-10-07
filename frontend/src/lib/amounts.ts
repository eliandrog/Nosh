// How ingredient amounts read on screen: "125 g", "½ tin", "2 cloves", "1", or "to taste".

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' }

/** 0.5 -> "½", 1.5 -> "1½", 2 -> "2", 0.33 -> "0.33". */
export function formatQuantity(quantity: number): string {
  const whole = Math.floor(quantity)
  const fraction = FRACTIONS[String(Math.round((quantity - whole) * 100) / 100)]
  if (fraction) return whole === 0 ? fraction : `${whole}${fraction}`
  return String(Math.round(quantity * 100) / 100)
}

// Units that read as words get a plural "s" ("2 cloves"); symbols like g, ml, tbsp don't.
const WORD_UNITS = new Set(['tin', 'clove', 'slice', 'rasher', 'ball', 'thumb', 'handful'])

export function amountLabel(quantity: number | null, unit: string | null): string {
  if (quantity === null) return 'to taste'
  const amount = formatQuantity(quantity)
  if (!unit) return amount
  return WORD_UNITS.has(unit) && quantity > 1 ? `${amount} ${unit}s` : `${amount} ${unit}`
}
