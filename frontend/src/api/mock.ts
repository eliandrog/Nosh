// In-memory mock API, enabled with VITE_USE_MOCKS=true.
// Sample recipes are copied in the same shape as backend/data/project-nosh-sample-recipes.json
// (that file is never modified). Only recipes are realistic; plan/shopping return simple stubs.
import { ApiError, ValidationError } from './client'
import type { Api } from './endpoints'
import type {
  DietaryLabel,
  MealType,
  PlanEntry,
  Preferences,
  Profile,
  RecipeDetail,
  RecipeFilters,
  RecipeInput,
  RecipeSummary,
  Tag,
  UnitOption,
  ValidationErrors,
} from './types'

type JsonRecipe = {
  id: string
  name: string
  cuisine: string
  mealType: MealType[]
  dietary: DietaryLabel[]
  tags: string[]
  serves: number
  ingredients: { item: string; quantity: number | null; unit: string | null; prep?: string }[]
  method: string[]
}

const SAMPLE: JsonRecipe[] = [
  {
    id: 'porridge-with-berries-and-honey', name: 'Porridge with Berries and Honey', cuisine: 'british', mealType: ['breakfast'], dietary: ['vegetarian'], tags: ['quick'], serves: 2,
    ingredients: [{ item: 'porridge oats', quantity: 100, unit: 'g' }, { item: 'milk', quantity: 500, unit: 'ml' }, { item: 'mixed berries', quantity: 100, unit: 'g' }, { item: 'honey', quantity: 2, unit: 'tbsp' }],
    method: ['Put the oats and milk in a pan over medium heat.', 'Stir for 4 to 5 minutes until thick and creamy.', 'Spoon into bowls and top with the berries.', 'Drizzle with honey and serve.'],
  },
  {
    id: 'scrambled-eggs-on-toast', name: 'Scrambled Eggs on Toast', cuisine: 'british', mealType: ['breakfast'], dietary: ['vegetarian'], tags: ['quick'], serves: 2,
    ingredients: [{ item: 'eggs', quantity: 4, unit: null }, { item: 'milk', quantity: 2, unit: 'tbsp' }, { item: 'butter', quantity: 15, unit: 'g' }, { item: 'bread', quantity: 2, unit: 'slice' }, { item: 'salt and pepper', quantity: null, unit: null }],
    method: ['Beat the eggs with the milk and a pinch of salt and pepper.', 'Melt the butter in a non-stick pan over low heat.', 'Pour in the eggs and stir gently until just set.', 'Toast the bread and serve the eggs on top.'],
  },
  {
    id: 'tomato-soup', name: 'Tomato Soup', cuisine: 'british', mealType: ['lunch'], dietary: ['vegetarian', 'vegan', 'gluten-free'], tags: ['batch-cook'], serves: 4,
    ingredients: [{ item: 'chopped tomatoes', quantity: 2, unit: 'tin' }, { item: 'onion', quantity: 1, unit: null, prep: 'chopped' }, { item: 'garlic', quantity: 2, unit: 'clove', prep: 'crushed' }, { item: 'vegetable stock', quantity: 500, unit: 'ml' }, { item: 'olive oil', quantity: 2, unit: 'tbsp' }, { item: 'salt and pepper', quantity: null, unit: null }],
    method: ['Heat the oil and soften the onion for 5 minutes.', 'Add the garlic and cook for 1 minute.', 'Add the tomatoes and stock, then simmer for 15 minutes.', 'Blend until smooth, season and serve.'],
  },
  {
    id: 'lentil-dahl', name: 'Lentil Dahl', cuisine: 'indian', mealType: ['dinner'], dietary: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'], tags: ['batch-cook'], serves: 4,
    ingredients: [{ item: 'red lentils', quantity: 250, unit: 'g' }, { item: 'onion', quantity: 1, unit: null, prep: 'chopped' }, { item: 'garlic', quantity: 2, unit: 'clove', prep: 'crushed' }, { item: 'ginger', quantity: 1, unit: 'thumb', prep: 'grated' }, { item: 'chopped tomatoes', quantity: 1, unit: 'tin' }, { item: 'curry powder', quantity: 2, unit: 'tbsp' }, { item: 'coconut milk', quantity: 200, unit: 'ml' }, { item: 'rice', quantity: 300, unit: 'g' }],
    method: ['Soften the onion, garlic and ginger in a little oil for 5 minutes.', 'Stir in the curry powder and cook for 1 minute.', 'Add the lentils, tomatoes and 500ml water, then simmer for 20 minutes.', 'Stir in the coconut milk, warm through and serve with the rice.'],
  },
  {
    id: 'margherita-pizza', name: 'Margherita Pizza', cuisine: 'italian', mealType: ['dinner'], dietary: ['vegetarian'], tags: [], serves: 2,
    ingredients: [{ item: 'pizza base', quantity: 2, unit: null }, { item: 'passata', quantity: 150, unit: 'ml' }, { item: 'mozzarella', quantity: 1, unit: 'ball', prep: 'torn' }, { item: 'fresh basil', quantity: 1, unit: 'handful' }, { item: 'olive oil', quantity: 1, unit: 'tbsp' }],
    method: ['Heat the oven to 220C.', 'Spread the passata over the bases.', 'Scatter over the mozzarella.', 'Bake for 10 to 12 minutes, then top with the basil and a drizzle of oil.'],
  },
  {
    id: 'spaghetti-bolognese', name: 'Spaghetti Bolognese', cuisine: 'italian', mealType: ['dinner'], dietary: [], tags: ['batch-cook', 'freezer-friendly'], serves: 4,
    ingredients: [{ item: 'beef mince', quantity: 500, unit: 'g' }, { item: 'onion', quantity: 1, unit: null, prep: 'chopped' }, { item: 'garlic', quantity: 2, unit: 'clove', prep: 'crushed' }, { item: 'carrot', quantity: 1, unit: null, prep: 'diced' }, { item: 'chopped tomatoes', quantity: 1, unit: 'tin' }, { item: 'tomato puree', quantity: 2, unit: 'tbsp' }, { item: 'spaghetti', quantity: 400, unit: 'g' }, { item: 'beef stock cube', quantity: 1, unit: null }],
    method: ['Brown the mince in a large pan, then set aside.', 'Soften the onion, carrot and garlic for 5 minutes.', 'Return the mince, then add the tomatoes, puree and crumbled stock cube.', 'Simmer for 25 to 30 minutes.', 'Cook the spaghetti and serve with the sauce on top.'],
  },
]

const UNITS: UnitOption[] = [
  { value: 'g', label: 'g', group: 'weight' },
  { value: 'kg', label: 'kg', group: 'weight' },
  { value: 'ml', label: 'ml', group: 'volume' },
  { value: 'l', label: 'l', group: 'volume' },
  { value: 'tsp', label: 'tsp', group: 'volume' },
  { value: 'tbsp', label: 'tbsp', group: 'volume' },
  { value: null, label: 'item', group: 'count' },
  ...['tin', 'clove', 'slice', 'rasher', 'ball', 'thumb', 'handful'].map((u) => ({ value: u, label: u, group: 'packs' as const })),
]

const ingredientIds = new Map<string, number>()
const ingredientId = (name: string) => {
  const key = name.trim().toLowerCase()
  if (!ingredientIds.has(key)) ingredientIds.set(key, ingredientIds.size + 1)
  return ingredientIds.get(key)!
}

const toDetail = (r: JsonRecipe, isCustom = false): RecipeDetail => ({
  id: r.id,
  name: r.name,
  cuisine: r.cuisine,
  serves: r.serves,
  mealType: r.mealType,
  dietary: r.dietary,
  tags: r.tags,
  isCustom,
  imageUrl: null,
  ingredients: r.ingredients.map((i) => ({ ingredientId: ingredientId(i.item), name: i.item, quantity: i.quantity, unit: i.unit, prep: i.prep ?? null })),
  method: r.method,
})

const recipes = new Map<string, RecipeDetail>(SAMPLE.map((r) => [r.id, toDetail(r)]))
let preferences: Preferences = { dietary: ['vegetarian'] }
let profile: Profile = { name: 'Sam Jones', email: 'sam.jones@example.com', householdSize: 2 }
const tags: Tag[] = ['quick', 'batch-cook', 'freezer-friendly', 'kid-friendly'].map((k) => ({ key: k, name: k[0].toUpperCase() + k.slice(1).replace('-', ' '), isBuiltin: true }))

const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 150))
const summary = ({ ingredients: _i, method: _m, ...s }: RecipeDetail): RecipeSummary => s

// Dietary: every selected label must match (vegetarian also accepts vegan). Meal type & tags: any.
function matches(r: RecipeDetail, f: RecipeFilters, prefs: DietaryLabel[]): boolean {
  const dietary = f.dietary ?? (f.all ? [] : prefs)
  const okDietary = dietary.every((d) => r.dietary.includes(d) || (d === 'vegetarian' && r.dietary.includes('vegan')))
  const okMeal = !f.mealType?.length || f.mealType.some((m) => r.mealType.includes(m))
  const okTag = !f.tag?.length || f.tag.some((t) => r.tags.includes(t))
  const q = f.q?.trim().toLowerCase()
  const okQ = !q || r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q))
  return okDietary && okMeal && okTag && okQ
}

function validate(input: RecipeInput, ignoreId?: string): ValidationErrors {
  const errors: ValidationErrors = {}
  const name = input.name.trim()
  if (!name) errors.name = 'Give your recipe a name'
  else if ([...recipes.values()].some((r) => r.id !== ignoreId && r.name.trim().toLowerCase() === name.toLowerCase()))
    errors.name = `There's already a recipe called ${name}`
  if (!(input.serves >= 1)) errors.serves = 'Serves must be at least 1'
  if (!input.ingredients.some((i) => i.name.trim())) errors.ingredients = 'Add at least one ingredient'
  if (!input.method.some((s) => s.trim())) errors.method = 'Add at least one step'
  return errors
}

const slugify = (name: string) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function fromInput(id: string, input: RecipeInput): RecipeDetail {
  return toDetail({ id, ...input, ingredients: input.ingredients.filter((i) => i.name.trim()).map((i) => ({ item: i.name.trim(), quantity: i.quantity, unit: i.unit, prep: i.prep ?? undefined })), method: input.method.filter((s) => s.trim()) }, true)
}

// Local-date ISO string (toISOString would shift dates across midnight in UTC+ timezones).
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const mondayOf = (d = new Date()) => {
  const m = new Date(d)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return isoDate(m)
}

export const mockApi: Api = {
  getOptions: () => delay({ mealTypes: ['breakfast', 'lunch', 'dinner', 'dessert'], dietaryLabels: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'], cuisines: ['british', 'chinese', 'indian', 'italian', 'mediterranean', 'mexican', 'thai'] }),
  getUnits: () => delay(UNITS),

  listRecipes: (f = {}) => delay([...recipes.values()].filter((r) => matches(r, f, preferences.dietary)).map(summary)),
  getRecipe: (id) => {
    const r = recipes.get(id)
    return r ? delay(r) : Promise.reject(new ApiError(404, 'Recipe not found'))
  },
  createRecipe: (input) => {
    const errors = validate(input)
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors))
    let id = slugify(input.name)
    for (let n = 2; recipes.has(id); n++) id = `${slugify(input.name)}-${n}`
    const r = fromInput(id, input)
    recipes.set(id, r)
    return delay(r)
  },
  updateRecipe: (id, input) => {
    const existing = recipes.get(id)
    if (!existing) return Promise.reject(new ApiError(404, 'Recipe not found'))
    if (!existing.isCustom) return Promise.reject(new ApiError(403, 'Built-in recipes can’t be edited'))
    const errors = validate(input, id)
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors))
    const r = fromInput(id, input)
    recipes.set(id, r)
    return delay(r)
  },
  deleteRecipe: (id) => {
    const existing = recipes.get(id)
    if (!existing?.isCustom) return Promise.reject(new ApiError(existing ? 403 : 404, 'Only your own recipes can be deleted'))
    recipes.delete(id)
    return delay(undefined)
  },
  getRecipeUsage: () => delay({ upcomingMeals: 0 }),

  searchIngredients: (q) => {
    const s = q.trim().toLowerCase()
    return delay([...ingredientIds.entries()].filter(([name]) => name.includes(s)).slice(0, 8).map(([name, id]) => ({ id, name })))
  },
  listTags: () => delay(tags),
  createTag: (name) => {
    const tag = { key: slugify(name), name, isBuiltin: false }
    tags.push(tag)
    return delay(tag)
  },

  getPreferences: () => delay(preferences),
  updatePreferences: (p) => delay((preferences = p)),
  getProfile: () => delay(profile),
  updateProfile: (p) => delay((profile = p)),

  getWeekPlan: (weekStart) => {
    const start = weekStart ?? mondayOf()
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${start}T00:00:00`)
      d.setDate(d.getDate() + i)
      return { date: isoDate(d), entries: [] as PlanEntry[] }
    })
    return delay({ weekStart: start, days })
  },
  addPlanEntry: (input) => delay({ id: Date.now(), position: 0, recipeName: recipes.get(input.recipeId)?.name ?? '', recipeDeleted: false, ...input }),
  updatePlanEntry: () => Promise.reject(new ApiError(501, 'Not available in mock mode')),
  deletePlanEntry: () => delay(undefined),
  getPlannedDays: () => delay([]),

  getShoppingList: (weekStart) => delay({ weekStart: weekStart ?? mondayOf(), items: [], changedSinceLastView: null }),
  setTick: () => delay(undefined),
  clearTicks: () => delay(undefined),
}
