import type { RecipePage, RecipeSummary } from '../api/types'

/** A RecipePage as the API returns it, for stubbing `api.listRecipes`. */
export function pageOf(
  items: RecipeSummary[],
  { page = 1, pageSize = 20, total = items.length }: { page?: number; pageSize?: number; total?: number } = {},
): RecipePage {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}
