import type { DietaryLabel, MealType, Tag } from '../../api/types'
import { dietaryLabel, mealTypeLabel } from '../../lib/recipeFilters'
import type { PendingFilters } from '../../lib/recipeFilters'
import { CloseIcon, FilterIcon } from '../icons'
import './Filters.css'

export type FilterChip =
  | { group: 'mealTypes'; value: MealType }
  | { group: 'dietary'; value: DietaryLabel }
  | { group: 'tags'; value: string }

type FilterButtonProps = { active: number; onClick: () => void }

/** 44px Charcoal button beside the search bar, with a count of filters in force. */
export function FilterButton({ active, onClick }: FilterButtonProps) {
  return (
    <button type="button" className="filters__button" aria-label={active ? `Filters, ${active} active` : 'Filters'} onClick={onClick}>
      <FilterIcon size={20} aria-hidden="true" />
      {active > 0 && (
        <span className="filters__badge" aria-hidden="true">
          {active}
        </span>
      )}
    </button>
  )
}

type ActiveFiltersProps = { filters: PendingFilters; tags: Tag[]; onRemove: (chip: FilterChip) => void }

/** Filters in force as small chips; ✕ removes one. */
export function ActiveFilters({ filters, tags, onRemove }: ActiveFiltersProps) {
  const tagName = (key: string) => tags.find((t) => t.key === key)?.name ?? key
  const chips: { chip: FilterChip; label: string }[] = [
    ...filters.mealTypes.map((value) => ({ chip: { group: 'mealTypes', value } as FilterChip, label: mealTypeLabel(value) })),
    ...filters.dietary.map((value) => ({ chip: { group: 'dietary', value } as FilterChip, label: dietaryLabel(value) })),
    ...filters.tags.map((value) => ({ chip: { group: 'tags', value } as FilterChip, label: tagName(value) })),
  ]
  if (chips.length === 0) return null
  return (
    <ul className="filters__active" aria-label="Active filters">
      {chips.map(({ chip, label }) => (
        <li key={`${chip.group}:${chip.value}`}>
          <button type="button" className="filters__active-chip" aria-label={`Remove filter: ${label}`} onClick={() => onRemove(chip)}>
            {label}
            <CloseIcon size={14} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
