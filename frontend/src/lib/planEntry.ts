import type { PlanEntry } from '../api/types'

/** Display name for a planned meal: the recipe, or a free meal with the place it comes from. */
export function mealName(entry: PlanEntry): string {
  if (entry.placeMeal) return `${entry.placeMeal.name} (${entry.placeMeal.placeName})`
  return entry.recipeName ?? 'Meal'
}
