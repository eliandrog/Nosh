// API types come from the backend's OpenAPI contract (generated, never edited by hand):
//   backend/app/schemas.py -> backend/openapi.json -> npm run gen:api -> schema.gen.ts
// This file only gives them friendly names, plus a few frontend-only helper types.
import type { components } from './schema.gen'

type Schemas = components['schemas']

export type MealType = Schemas['MealType']
export type DietaryLabel = Schemas['DietaryLabel']
export type Cuisine = Schemas['Cuisine']

export type Unit = Schemas['UnitOut']
export type Options = Schemas['OptionsOut']
export type Tag = Schemas['TagOut']
export type TagInput = Schemas['TagIn']

export type RecipeSummary = Schemas['RecipeSummary']
/** One page of GET /api/recipes: { items, total, page, pageSize, totalPages }. */
export type RecipePage = Schemas['RecipePage']
export type RecipeDetail = Schemas['RecipeDetail']
export type RecipeIngredient = Schemas['IngredientLine']
export type RecipeIngredientInput = Schemas['IngredientLineIn']
export type RecipeInput = Schemas['RecipeCreate']
export type RecipeUsage = Schemas['RecipeUsageOut']
export type IngredientSuggestion = Schemas['IngredientSuggestion']
export type IngredientInput = Schemas['IngredientIn']
/** `created: false` = an ingredient with the same name already existed and is returned instead. */
export type IngredientCreated = Schemas['IngredientOut']

export type Preferences = Schemas['PreferencesOut']
export type PreferencesInput = Schemas['PreferencesIn']
export type Profile = Schemas['ProfileOut']
export type ProfileInput = Schemas['ProfileIn']

export type PlanEntry = Schemas['PlanEntryOut']
export type PlanDay = Schemas['PlanDayOut']
export type WeekPlan = Schemas['WeekPlanOut']
export type PlanEntryInput = Schemas['PlanEntryCreate']
export type PlanEntryPatch = Schemas['PlanEntryUpdate']
export type PlannedDays = Schemas['PlanDaysOut']

export type ShoppingItem = Schemas['ShoppingListItemOut']
export type ShoppingListChanges = Schemas['ShoppingListChangesOut']
export type ShoppingList = Schemas['ShoppingListOut']

/** Every API error: { error: { code, message, details?, requestId } }. */
export type ErrorResponse = Schemas['ErrorResponse']
export type ErrorBody = Schemas['ErrorBody']

// ---------- Frontend-only ----------

/** Query options for GET /api/recipes. */
export type RecipeFilters = {
  q?: string
  mealType?: MealType[]
  dietary?: DietaryLabel[]
  tag?: string[]
  /** true = ignore saved dietary preferences */
  all?: boolean
  /** 1-based; defaults to 1 on the server */
  page?: number
  /** 1–50; defaults to 20 on the server */
  pageSize?: number
}

/** Field path (camelCase, e.g. "ingredients.0.unit") -> message to show next to that field. */
export type FieldErrors = Record<string, string>
