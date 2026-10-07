import { DIETARY_LABELS, MEAL_TYPE_LABELS } from '../components/recipe-form/recipeForm'
import type { DietaryLabel, MealType, RecipeFilters } from '../api/types'

export const MEAL_TYPES = Object.keys(MEAL_TYPE_LABELS) as MealType[]
export const DIETARY = Object.keys(DIETARY_LABELS) as DietaryLabel[]

/**
 * Filters applied to the recipe list, kept in the URL:
 *   ?mealType=dinner&dietary=vegetarian&tag=low-cost   (comma lists)
 *   ?all=true                                          (explicitly no dietary filter)
 *
 * `dietary: null` means "nothing chosen yet": the server then applies the saved preferences.
 * Clearing dietary must be explicit (`all=true`), otherwise saved preferences would silently re-apply.
 */
export type AppliedFilters = {
  mealTypes: MealType[]
  dietary: DietaryLabel[] | null
  tags: string[]
}

/** What the filter sheet edits: dietary is always concrete there. */
export type PendingFilters = {
  mealTypes: MealType[]
  dietary: DietaryLabel[]
  tags: string[]
}

export const NO_FILTERS: PendingFilters = { mealTypes: [], dietary: [], tags: [] }

const csv = (value: string | null) => (value ?? '').split(',').map((v) => v.trim()).filter(Boolean)
const only = <T extends string>(values: string[], allowed: readonly T[]) => [...new Set(values)].filter((v): v is T => allowed.includes(v as T))

export function parseFilters(params: URLSearchParams): AppliedFilters {
  const dietary = params.has('dietary') ? only(csv(params.get('dietary')), DIETARY) : params.get('all') === 'true' ? [] : null
  return {
    mealTypes: only(csv(params.get('mealType')), MEAL_TYPES),
    dietary,
    tags: [...new Set(csv(params.get('tag')))],
  }
}

/** Dietary labels in force: chosen ones, or the saved preferences when none were chosen. */
export const effectiveDietary = (applied: AppliedFilters, saved: DietaryLabel[]): DietaryLabel[] => applied.dietary ?? saved

export const activeCount = (f: PendingFilters) => f.mealTypes.length + f.dietary.length + f.tags.length

/** API query for the applied filters (only the keys that are set). */
export function toQuery(applied: AppliedFilters): Pick<RecipeFilters, 'mealType' | 'dietary' | 'tag' | 'all'> {
  const query: Pick<RecipeFilters, 'mealType' | 'dietary' | 'tag' | 'all'> = {}
  if (applied.mealTypes.length) query.mealType = applied.mealTypes
  if (applied.tags.length) query.tag = applied.tags
  if (applied.dietary?.length) query.dietary = applied.dietary
  else if (applied.dietary) query.all = true // explicitly no dietary filter
  return query
}

const sameSet = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((v) => b.includes(v))

/**
 * Dietary choice to store. When it matches the saved preferences it isn't pinned (null), so links keep
 * following the latest saved preferences; only a deliberate difference is stored in the URL.
 */
export function dietaryToStore(chosen: DietaryLabel[], saved: DietaryLabel[]): DietaryLabel[] | null {
  return sameSet(chosen, saved) ? null : chosen
}

/** Turns the sheet's choices into applied filters. */
export function applyPending(pending: PendingFilters, saved: DietaryLabel[]): AppliedFilters {
  return { mealTypes: pending.mealTypes, tags: pending.tags, dietary: dietaryToStore(pending.dietary, saved) }
}

/** Writes the filters into the URL, keeping the search and going back to page 1. */
export function writeFilters(prev: URLSearchParams, applied: AppliedFilters): URLSearchParams {
  const next = new URLSearchParams(prev)
  for (const key of ['mealType', 'dietary', 'tag', 'all', 'page']) next.delete(key)
  if (applied.mealTypes.length) next.set('mealType', applied.mealTypes.join(','))
  if (applied.tags.length) next.set('tag', applied.tags.join(','))
  if (applied.dietary?.length) next.set('dietary', applied.dietary.join(','))
  else if (applied.dietary) next.set('all', 'true')
  return next
}

export const mealTypeLabel = (m: MealType) => MEAL_TYPE_LABELS[m]
export const dietaryLabel = (d: DietaryLabel) => DIETARY_LABELS[d]
