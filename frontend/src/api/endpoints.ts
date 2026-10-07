import { buildQuery, request } from './client'
import { mockApi } from './mock'
import type {
  IngredientSuggestion,
  Options,
  PlanEntry,
  PlanEntryInput,
  Preferences,
  Profile,
  RecipeDetail,
  RecipeFilters,
  RecipeInput,
  RecipeSummary,
  RecipeUsage,
  ShoppingList,
  Tag,
  UnitOption,
  WeekPlan,
} from './types'

const httpApi = {
  getOptions: () => request<Options>('GET', '/options'),
  getUnits: () => request<UnitOption[]>('GET', '/units'),

  listRecipes: (f: RecipeFilters = {}) =>
    request<RecipeSummary[]>('GET', `/recipes${buildQuery({ q: f.q, mealType: f.mealType, dietary: f.dietary, tag: f.tag, all: f.all })}`),
  getRecipe: (id: string, servings?: number) => request<RecipeDetail>('GET', `/recipes/${encodeURIComponent(id)}${buildQuery({ servings })}`),
  createRecipe: (input: RecipeInput) => request<RecipeDetail>('POST', '/recipes', input),
  updateRecipe: (id: string, input: RecipeInput) => request<RecipeDetail>('PUT', `/recipes/${encodeURIComponent(id)}`, input),
  deleteRecipe: (id: string) => request<void>('DELETE', `/recipes/${encodeURIComponent(id)}`),
  // ASSUMPTION (3): usage endpoint for the delete confirmation.
  getRecipeUsage: (id: string) => request<RecipeUsage>('GET', `/recipes/${encodeURIComponent(id)}/usage`),

  // ASSUMPTION (1): ingredient type-ahead endpoint.
  searchIngredients: (q: string) => request<IngredientSuggestion[]>('GET', `/ingredients${buildQuery({ q })}`),
  listTags: () => request<Tag[]>('GET', '/tags'),
  // ASSUMPTION (4): inline tag creation from the recipe form is deferred; endpoint kept for later.
  createTag: (name: string) => request<Tag>('POST', '/tags', { name }),

  getPreferences: () => request<Preferences>('GET', '/preferences'),
  updatePreferences: (p: Preferences) => request<Preferences>('PUT', '/preferences', p),
  getProfile: () => request<Profile>('GET', '/profile'),
  updateProfile: (p: Profile) => request<Profile>('PUT', '/profile', p),

  getWeekPlan: (weekStart?: string) => request<WeekPlan>('GET', `/plan${buildQuery({ week: weekStart })}`),
  addPlanEntry: (input: PlanEntryInput) => request<PlanEntry>('POST', '/plan/entries', input),
  updatePlanEntry: (id: number, patch: Partial<PlanEntryInput & { position: number }>) => request<PlanEntry>('PATCH', `/plan/entries/${id}`, patch),
  deletePlanEntry: (id: number) => request<void>('DELETE', `/plan/entries/${id}`),
  getPlannedDays: (month: string) => request<string[]>('GET', `/plan/days${buildQuery({ month })}`),

  getShoppingList: (weekStart?: string) => request<ShoppingList>('GET', `/shopping-list${buildQuery({ week: weekStart })}`),
  setTick: (weekStart: string, lineKey: string, ticked: boolean) => request<void>('PUT', '/shopping-list/ticks', { week: weekStart, lineKey, ticked }),
  clearTicks: (weekStart: string) => request<void>('DELETE', `/shopping-list/ticks${buildQuery({ week: weekStart })}`),
}

export type Api = typeof httpApi

/** Set VITE_USE_MOCKS=true to run the frontend without the backend. */
export const api: Api = import.meta.env.VITE_USE_MOCKS === 'true' ? mockApi : httpApi
