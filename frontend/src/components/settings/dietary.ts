import type { DietaryLabel } from '../../api/types'

/** Fixed order and wording for dietary labels across the Settings screens. */
export const DIETARY_OPTIONS: readonly { label: DietaryLabel; name: string; description: string }[] = [
  { label: 'vegetarian', name: 'Vegetarian', description: 'No meat or fish' },
  { label: 'vegan', name: 'Vegan', description: 'No animal products' },
  { label: 'gluten-free', name: 'Gluten-free', description: 'No wheat, barley or rye' },
  { label: 'dairy-free', name: 'Dairy-free', description: 'No milk, cheese or butter' },
]

/** "Vegetarian, Gluten-free" in the fixed order, or "None". */
export function dietarySummary(labels: readonly DietaryLabel[]): string {
  const names = DIETARY_OPTIONS.filter((o) => labels.includes(o.label)).map((o) => o.name)
  return names.length ? names.join(', ') : 'None'
}
