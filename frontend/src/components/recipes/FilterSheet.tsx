import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../../api/endpoints'
import type { DietaryLabel, MealType, Tag } from '../../api/types'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { DIETARY, MEAL_TYPES, dietaryLabel, mealTypeLabel } from '../../lib/recipeFilters'
import type { PendingFilters } from '../../lib/recipeFilters'
import { BottomSheet, Button, Chip } from '../ui'
import './Filters.css'

export const COUNT_DELAY_MS = 300

type FilterSheetProps = {
  /** Filters in force when the sheet opens (dietary already resolved from saved preferences). */
  initial: PendingFilters
  saved: DietaryLabel[]
  tags: Tag[]
  /** Current search text, so the count matches what "Show" will list. */
  query: string
  onApply: (pending: PendingFilters) => void
  onClose: () => void
}

type Count = { key: string; total: number } | { key: string; failed: true }

const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
const keyOf = (f: PendingFilters) => JSON.stringify([f.mealTypes, f.dietary, f.tags])
const sameSet = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((v) => b.includes(v))

/** "Filter recipes" sheet. Mounted only while open, so it always starts from the filters in force. */
export function FilterSheet({ initial, saved, tags, query, onApply, onClose }: FilterSheetProps) {
  const [pending, setPending] = useState<PendingFilters>(initial)
  const key = keyOf(pending)
  const countKey = useDebouncedValue(key, COUNT_DELAY_MS)
  const [count, setCount] = useState<Count | null>(null)

  // Live "Show N recipes": one small request (pageSize 1, read `total`) after choices settle.
  useEffect(() => {
    let cancelled = false // ignores replies for older choices
    const [mealTypes, dietary, tagKeys] = JSON.parse(countKey) as [MealType[], DietaryLabel[], string[]]
    api
      .listRecipes({
        q: query || undefined,
        page: 1,
        pageSize: 1,
        ...(mealTypes.length ? { mealType: mealTypes } : {}),
        ...(tagKeys.length ? { tag: tagKeys } : {}),
        ...(dietary.length ? { dietary } : { all: true }),
      })
      .then((page) => !cancelled && setCount({ key: countKey, total: page.total }))
      .catch(() => !cancelled && setCount({ key: countKey, failed: true }))
    return () => {
      cancelled = true
    }
  }, [countKey, query])

  const counted = count && count.key === key && 'total' in count ? count.total : null
  const showLabel = counted === null ? 'Show recipes' : `Show ${counted} ${counted === 1 ? 'recipe' : 'recipes'}`
  const fromPreferences = saved.length > 0 && sameSet(pending.dietary, saved)

  return (
    <BottomSheet open title="Filter recipes" onClose={onClose}>
      <button type="button" className="filters__clear" onClick={() => setPending({ mealTypes: [], dietary: [], tags: [] })}>
        Clear all
      </button>

      <FilterGroup title="Meal type" hint="any of these">
        {MEAL_TYPES.map((m) => (
          <Chip key={m} variant="option" selected={pending.mealTypes.includes(m)} onClick={() => setPending((p) => ({ ...p, mealTypes: toggle(p.mealTypes, m) }))}>
            {mealTypeLabel(m)}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup title="Dietary" hint={fromPreferences ? 'from your preferences' : 'all of these'}>
        {DIETARY.map((d) => (
          <Chip key={d} variant="option" selected={pending.dietary.includes(d)} onClick={() => setPending((p) => ({ ...p, dietary: toggle(p.dietary, d) }))}>
            {dietaryLabel(d)}
          </Chip>
        ))}
      </FilterGroup>

      {tags.length > 0 && (
        <FilterGroup title="Tags" hint="any of these">
          {tags.map((t) => (
            <Chip key={t.key} variant="option" selected={pending.tags.includes(t.key)} onClick={() => setPending((p) => ({ ...p, tags: toggle(p.tags, t.key) }))}>
              {t.name}
            </Chip>
          ))}
        </FilterGroup>
      )}

      <Button block onClick={() => onApply(pending)} aria-describedby="filters-count-status">
        {showLabel}
      </Button>
      <p id="filters-count-status" className="visually-hidden" aria-live="polite">
        {counted === null ? '' : `${counted} matching ${counted === 1 ? 'recipe' : 'recipes'}`}
      </p>
    </BottomSheet>
  )
}

function FilterGroup({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <fieldset className="filters__group">
      <legend className="filters__legend">
        {title} <span className="filters__hint">· {hint}</span>
      </legend>
      <div className="filters__options">{children}</div>
    </fieldset>
  )
}
