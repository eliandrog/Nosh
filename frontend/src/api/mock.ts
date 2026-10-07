// In-memory mock API, enabled with VITE_USE_MOCKS=true. Returns exactly the same shapes
// as the real API (types are generated from the backend contract), so screens built
// against it work unchanged with the backend. Sample recipes are copied in the shape of
// backend/data/project-nosh-sample-recipes.json (that file is never modified).
import { ApiError, ValidationError } from './client'
import type { Api } from './endpoints'
import type {
  Cuisine,
  DietaryLabel,
  FieldErrors,
  MealType,
  PlanDay,
  Preferences,
  Profile,
  RecipeDetail,
  RecipeFilters,
  RecipeInput,
  RecipeSummary,
  Tag,
  Unit,
} from './types'

type JsonRecipe = {
  id: string
  name: string
  cuisine: Cuisine
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

const UNITS: Unit[] = [
  { key: 'g', label: 'g', group: 'weight' },
  { key: 'kg', label: 'kg', group: 'weight' },
  { key: 'ml', label: 'ml', group: 'volume' },
  { key: 'l', label: 'l', group: 'volume' },
  { key: 'tsp', label: 'tsp', group: 'volume' },
  { key: 'tbsp', label: 'tbsp', group: 'volume' },
  { key: null, label: 'item', group: 'count' },
  ...['tin', 'clove', 'slice', 'rasher', 'ball', 'thumb', 'handful'].map((u) => ({ key: u, label: u, group: 'pack' })),
]

// ASSUMPTION (5): default image = emoji per first meal type (same mapping as the backend).
const DEFAULT_IMAGE: Record<MealType, string> = { breakfast: '🥣', lunch: '🥪', dinner: '🍲', dessert: '🍰' }

const slugify = (name: string) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const tagName = (key: string) => key.charAt(0).toUpperCase() + key.slice(1)

let nextId = 1
const fakeUuid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`

const ingredientIds = new Map<string, number>()
const ingredientId = (name: string) => {
  const key = name.trim().toLowerCase()
  if (!ingredientIds.has(key)) ingredientIds.set(key, ingredientIds.size + 1)
  return ingredientIds.get(key)!
}

const tags = new Map<string, Tag>(
  ['quick', 'batch-cook', 'freezer-friendly', 'kid-friendly'].map((k) => [k, { key: k, name: tagName(k), isBuiltin: true }]),
)
const tagFor = (name: string): Tag => {
  const key = slugify(name)
  if (!tags.has(key)) tags.set(key, { key, name: name.trim().replace(/\s+/g, ' '), isBuiltin: false })
  return tags.get(key)!
}

const toDetail = (r: JsonRecipe, isCustom = false, id = fakeUuid()): RecipeDetail => ({
  id,
  slug: r.id,
  name: r.name,
  cuisine: r.cuisine,
  serves: r.serves,
  servings: r.serves,
  mealTypes: r.mealType,
  dietary: r.dietary,
  tags: r.tags.map(tagFor),
  isCustom,
  imageUrl: null,
  defaultImage: DEFAULT_IMAGE[r.mealType[0]] ?? '🍽️',
  ingredients: r.ingredients.map((i) => ({ ingredientId: ingredientId(i.item), item: i.item, quantity: i.quantity, unit: i.unit, prep: i.prep ?? null })),
  method: r.method,
})

const recipes = new Map<string, RecipeDetail>(SAMPLE.map((r) => [r.id, toDetail(r)]))
let preferences: Preferences = { dietary: ['vegetarian'] }
let profile: Profile = { name: 'Sam Jones', email: 'sam.jones@example.com', householdSize: 2 }

const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 150))
const summary = ({ ingredients: _i, method: _m, servings: _s, ...s }: RecipeDetail): RecipeSummary => s
const notFound = () => Promise.reject(new ApiError(404, { code: 'recipe_not_found', message: "We couldn't find that recipe.", requestId: 'mock' }))
const invalid = (fields: FieldErrors) =>
  Promise.reject(new ValidationError(422, { code: 'validation_error', message: 'Some details need fixing.', details: { fields }, requestId: 'mock' }))

// Dietary: every selected label must match (vegetarian also accepts vegan). Meal type & tags: any.
function matches(r: RecipeDetail, f: RecipeFilters, prefs: DietaryLabel[]): boolean {
  const dietary = f.dietary ?? (f.all ? [] : prefs)
  const okDietary = dietary.every((d) => r.dietary.includes(d) || (d === 'vegetarian' && r.dietary.includes('vegan')))
  const okMeal = !f.mealType?.length || f.mealType.some((m) => r.mealTypes.includes(m))
  const okTag = !f.tag?.length || f.tag.some((t) => r.tags.some((x) => x.key === t))
  const q = f.q?.trim().toLowerCase()
  const okQ = !q || r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.item.toLowerCase().includes(q))
  return okDietary && okMeal && okTag && okQ
}

function validate(input: RecipeInput, ignoreSlug?: string): FieldErrors {
  const errors: FieldErrors = {}
  const name = input.name.trim()
  if (!slugify(name)) errors.name = 'Give your recipe a name'
  else if ([...recipes.values()].some((r) => r.slug !== ignoreSlug && slugify(r.name) === slugify(name)))
    errors.name = `There's already a recipe called ${name}.`
  if (!(input.serves >= 1)) errors.serves = 'Serves must be at least 1'
  if (!input.mealTypes.length) errors.mealTypes = 'Pick at least one meal type'
  if (!input.ingredients.some((i) => i.item.trim())) errors.ingredients = 'Add at least one ingredient'
  if (!input.method.some((s) => s.trim())) errors.method = 'Add at least one step'
  return errors
}

function fromInput(slug: string, input: RecipeInput, id?: string): RecipeDetail {
  const json: JsonRecipe = {
    id: slug,
    name: input.name.trim(),
    cuisine: input.cuisine,
    serves: input.serves,
    mealType: input.mealTypes,
    dietary: input.dietary ?? [],
    tags: (input.tags ?? []).map((t) => tagFor(t).key),
    ingredients: input.ingredients.filter((i) => i.item.trim()).map((i) => ({ item: i.item.trim(), quantity: i.quantity ?? null, unit: i.unit ?? null, prep: i.prep ?? undefined })),
    method: input.method.filter((s) => s.trim()),
  }
  return toDetail(json, true, id)
}

const scaled = (r: RecipeDetail, servings?: number): RecipeDetail => {
  if (!servings || servings === r.serves) return r
  const factor = servings / r.serves
  return { ...r, servings, ingredients: r.ingredients.map((i) => ({ ...i, quantity: i.quantity === null ? null : Math.round(i.quantity * factor * 100) / 100 })) }
}

// Local-date ISO string (toISOString would shift dates across midnight in UTC+ timezones).
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const mondayOf = (d = new Date()) => {
  const m = new Date(d)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return isoDate(m)
}

export const mockApi: Api = {
  getOptions: () =>
    delay({
      mealTypes: ['breakfast', 'lunch', 'dinner', 'dessert'],
      dietaryLabels: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      cuisines: ['british', 'chinese', 'indian', 'italian', 'mediterranean', 'mexican', 'thai', 'other'],
    }),
  getUnits: () => delay(UNITS),

  listRecipes: (f = {}) => delay([...recipes.values()].filter((r) => matches(r, f, preferences.dietary)).map(summary)),
  getRecipe: (slug, servings) => {
    const r = recipes.get(slug)
    return r ? delay(scaled(r, servings)) : notFound()
  },
  createRecipe: (input) => {
    const errors = validate(input)
    if (Object.keys(errors).length) return invalid(errors)
    let slug = slugify(input.name)
    for (let n = 2; recipes.has(slug); n++) slug = `${slugify(input.name)}-${n}`
    const r = fromInput(slug, input)
    recipes.set(slug, r)
    return delay(r)
  },
  updateRecipe: (slug, input) => {
    const existing = recipes.get(slug)
    if (!existing) return notFound()
    if (!existing.isCustom) return Promise.reject(new ApiError(403, { code: 'recipe_read_only', message: "Built-in recipes can't be edited.", requestId: 'mock' }))
    const errors = validate(input, slug)
    if (Object.keys(errors).length) return invalid(errors)
    const r = fromInput(slug, input, existing.id)
    recipes.set(slug, r)
    return delay(r)
  },
  deleteRecipe: (slug) => {
    const existing = recipes.get(slug)
    if (!existing) return notFound()
    if (!existing.isCustom) return Promise.reject(new ApiError(403, { code: 'recipe_read_only', message: 'Only your own recipes can be deleted.', requestId: 'mock' }))
    recipes.delete(slug)
    return delay(undefined)
  },
  getRecipeUsage: () => delay({ upcomingMeals: 0 }),

  searchIngredients: (q) => {
    const s = q.trim().toLowerCase()
    return delay([...ingredientIds.entries()].filter(([name]) => name.includes(s)).slice(0, 8).map(([name, id]) => ({ id, name })))
  },
  listTags: () => delay([...tags.values()]),
  createTag: (name) => delay(tagFor(name)),

  getPreferences: () => delay(preferences),
  updatePreferences: (p) => delay((preferences = { dietary: p.dietary ?? [] })),
  getProfile: () => delay(profile),
  updateProfile: (p) => delay((profile = { name: p.name ?? null, email: p.email ?? null, householdSize: p.householdSize ?? null })),

  getWeekPlan: (week) => {
    const start = mondayOf(week ? new Date(`${week}T00:00:00`) : new Date())
    const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${start}T00:00:00`)
      d.setDate(d.getDate() + i)
      return { date: isoDate(d), entries: [] }
    })
    return delay({ weekStart: start, days })
  },
  addPlanEntry: (input) => {
    const r = [...recipes.values()].find((x) => x.id === input.recipeId)
    return delay({ id: Date.now(), date: input.date, position: 0, recipeId: input.recipeId, recipeSlug: r?.slug ?? '', recipeName: r?.name ?? '', recipeDeleted: false, servings: input.servings })
  },
  updatePlanEntry: () => Promise.reject(new ApiError(501, { code: 'not_implemented', message: 'Not available in mock mode.', requestId: 'mock' })),
  deletePlanEntry: () => delay(undefined),
  getPlannedDays: (month) => delay({ month, dates: [] }),

  getShoppingList: (week) => delay({ weekStart: mondayOf(week ? new Date(`${week}T00:00:00`) : new Date()), items: [], changes: null }),
  setTicked: () => Promise.reject(new ApiError(501, { code: 'not_implemented', message: 'Not available in mock mode.', requestId: 'mock' })),
  clearTicked: () => delay(undefined),
  dismissChanges: () => delay(undefined),
}
