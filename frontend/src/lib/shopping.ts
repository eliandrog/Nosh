import type { ShoppingItem, ShoppingListChanges } from '../api/types'

const PACKS = new Set(['tin', 'clove', 'slice', 'rasher', 'ball', 'thumb', 'handful'])

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/** "630 ml", "3 tins", "2" (counted items), "5 ml + to taste", "to taste". */
export function formatAmount(item: Pick<ShoppingItem, 'quantity' | 'unit' | 'toTaste'>): string {
  if (item.quantity === null) return 'to taste'
  const n = formatNumber(item.quantity)
  const unit = item.unit === 'item' ? '' : PACKS.has(item.unit) && item.quantity !== 1 ? `${item.unit}s` : item.unit
  const amount = unit ? `${n} ${unit}` : n
  return item.toTaste ? `${amount} + to taste` : amount
}

/** "2 added and 1 changed." for the "List updated" banner. */
export function changesSummary(changes: ShoppingListChanges): string {
  const parts = [
    changes.added ? `${changes.added} added` : '',
    changes.removed ? `${changes.removed} removed` : '',
    changes.changed ? `${changes.changed} changed` : '',
  ].filter(Boolean)
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.` : `${parts[0]}.`
}
