import { buildQuery, request } from './client'
import { mockApi } from './mock'
import type {
  IngredientSuggestion,
  Options,
  PlanEntry,
  PlanEntryInput,
  PlanEntryPatch,
  PlannedDays,
  Preferences,
  PreferencesInput,
  Profile,
  ProfileInput,
  RecipeDetail,
  RecipeFilters,
  RecipeInput,
  RecipeSummary,
  RecipeUsage,
  ShoppingItem,
  ShoppingList,
  Tag,
  Unit,
  WeekPlan,
} from './types'

const slugPath = (slug: string) => `/recipes/${encodeURIComponent(slug)}`

const httpApi = {
  getOptions: () => request<Options>('GET', '/options'),
  getUnits: () => request<Unit[]>('GET', '/units'),

  listRecipes: (f: RecipeFilters = {}) =>
    request<RecipeSummary[]>('GET', `/recipes${buildQuery({ q: f.q, mealType: f.mealType, dietary: f.dietary, tag: f.tag, all: f.all })}`),
  getRecipe: (slug: string, servings?: number) => request<RecipeDetail>('GET', `${slugPath(slug)}${buildQuery({ servings })}`),
  createRecipe: (input: RecipeInput) => request<RecipeDetail>('POST', '/recipes', input),
  updateRecipe: (slug: string, input: RecipeInput) => request<RecipeDetail>('PUT', slugPath(slug), input),
  deleteRecipe: (slug: string) => request<void>('DELETE', slugPath(slug)),
  // ASSUMPTION (3): usage endpoint for the delete confirmation.
  getRecipeUsage: (slug: string) => request<RecipeUsage>('GET', `${slugPath(slug)}/usage`),

  // ASSUMPTION (1): ingredient type-ahead endpoint.
  searchIngredients: (q: string) => request<IngredientSuggestion[]>('GET', `/ingredients${buildQuery({ q })}`),
  listTags: () => request<Tag[]>('GET', '/tags'),
  createTag: (name: string) => request<Tag>('POST', '/tags', { name }),

  getPreferences: () => request<Preferences>('GET', '/preferences'),
  updatePreferences: (p: PreferencesInput) => request<Preferences>('PUT', '/preferences', p),
  getProfile: () => request<Profile>('GET', '/profile'),
  updateProfile: (p: ProfileInput) => request<Profile>('PUT', '/profile', p),

  /** `week`: any date in the week (YYYY-MM-DD); defaults to the current week. */
  getWeekPlan: (week?: string) => request<WeekPlan>('GET', `/plan${buildQuery({ week })}`),
  addPlanEntry: (input: PlanEntryInput) => request<PlanEntry>('POST', '/plan/entries', input),
  updatePlanEntry: (id: number, patch: PlanEntryPatch) => request<PlanEntry>('PATCH', `/plan/entries/${id}`, patch),
  deletePlanEntry: (id: number) => request<void>('DELETE', `/plan/entries/${id}`),
  getPlannedDays: (month: string) => request<PlannedDays>('GET', `/plan/days${buildQuery({ month })}`),

  getShoppingList: (week?: string) => request<ShoppingList>('GET', `/shopping-list${buildQuery({ week })}`),
  setTicked: (itemId: number, ticked: boolean) => request<ShoppingItem>('PATCH', `/shopping-list/items/${itemId}`, { ticked }),
  clearTicked: (week: string) => request<void>('DELETE', `/shopping-list/ticks${buildQuery({ week })}`),
  dismissChanges: (week: string) => request<void>('POST', `/shopping-list/changes/dismiss${buildQuery({ week })}`),
}

export type Api = typeof httpApi

/** Set VITE_USE_MOCKS=true to run the frontend without the backend. */
export const api: Api = import.meta.env.VITE_USE_MOCKS === 'true' ? mockApi : httpApi
