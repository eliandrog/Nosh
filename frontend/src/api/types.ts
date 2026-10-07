// Types for the shared Nosh API contract (camelCase JSON).

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'dessert'
export type DietaryLabel = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free'

/** `null` unit = counted item (e.g. 2 onions), matching the JSON. */
export type Unit = string | null

export type RecipeSummary = {
  id: string
  name: string
  cuisine: string
  serves: number
  mealType: MealType[]
  dietary: DietaryLabel[]
  tags: string[]
  isCustom: boolean
  imageUrl: string | null
}

export type RecipeIngredient = {
  ingredientId: number
  name: string
  /** `null` = "to taste" */
  quantity: number | null
  unit: Unit
  prep: string | null
}

export type RecipeDetail = RecipeSummary & {
  ingredients: RecipeIngredient[]
  method: string[]
}

export type RecipeIngredientInput = {
  name: string
  quantity: number | null
  unit: Unit
  prep: string | null
}

export type RecipeInput = {
  name: string
  cuisine: string
  serves: number
  mealType: MealType[]
  dietary: DietaryLabel[]
  tags: string[]
  ingredients: RecipeIngredientInput[]
  method: string[]
}

export type RecipeFilters = {
  q?: string
  mealType?: MealType[]
  dietary?: DietaryLabel[]
  tag?: string[]
  /** true = ignore saved dietary preferences */
  all?: boolean
}

// ASSUMPTION (3): GET /api/recipes/{id}/usage returns the number of upcoming planned meals.
export type RecipeUsage = { upcomingMeals: number }

export type UnitOption = {
  value: Unit
  label: string
  group: 'weight' | 'volume' | 'count' | 'packs'
}

export type Options = {
  mealTypes: MealType[]
  dietaryLabels: DietaryLabel[]
  cuisines: string[]
}

export type Tag = { key: string; name: string; isBuiltin: boolean }

// ASSUMPTION (1): GET /api/ingredients?q= exists for type-ahead suggestions.
export type IngredientSuggestion = { id: number; name: string }

export type Preferences = { dietary: DietaryLabel[] }

export type Profile = { name: string; email: string; householdSize: number | null }

export type PlanEntry = {
  id: number
  date: string // YYYY-MM-DD
  position: number
  recipeId: string
  recipeName: string
  servings: number
  recipeDeleted: boolean
}

export type WeekPlan = {
  weekStart: string // Monday, YYYY-MM-DD
  days: { date: string; entries: PlanEntry[] }[]
}

export type PlanEntryInput = { date: string; recipeId: string; servings: number }

export type ShoppingItem = {
  lineKey: string
  name: string
  quantity: number | null
  unit: Unit
  fromRecipes: string[]
  ticked: boolean
}

export type ShoppingList = {
  weekStart: string
  items: ShoppingItem[]
  changedSinceLastView: { added: number } | null
}

// ASSUMPTION (2): validation failures come back as HTTP 422 with { errors: { field: message } }.
export type ValidationErrors = Record<string, string>
