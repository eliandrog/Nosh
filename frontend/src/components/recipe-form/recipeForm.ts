// Form state, validation and payload mapping for "Add your own recipe".
// Pure functions only, so the rules are easy to test and reuse for "Edit recipe" later.
import type { Cuisine, DietaryLabel, FieldErrors, MealType, RecipeInput } from '../../api/types'

export type IngredientRow = {
  id: string
  quantity: string // kept as text while typing; blank = "to taste"
  unit: string // '' = counted items ("item"), matching the API's null unit
  item: string
  prep: string
}

export type MethodStep = { id: string; text: string }

export type RecipeForm = {
  name: string
  serves: number
  cuisine: Cuisine
  mealTypes: MealType[]
  dietary: DietaryLabel[]
  tags: string[]
  ingredients: IngredientRow[]
  method: MethodStep[]
}

let nextId = 0
const newId = (prefix: string) => `${prefix}-${++nextId}`

export const emptyIngredient = (): IngredientRow => ({ id: newId('ing'), quantity: '', unit: 'g', item: '', prep: '' })
export const emptyStep = (): MethodStep => ({ id: newId('step'), text: '' })

export const emptyForm = (): RecipeForm => ({
  name: '',
  serves: 2,
  cuisine: 'british',
  mealTypes: [],
  dietary: [],
  tags: [],
  ingredients: [emptyIngredient()],
  method: [emptyStep()],
})

const filled = (s: string) => s.trim() !== ''

/** Client-side checks before saving. Keys match the form fields (row index = position on screen). */
export function validate(form: RecipeForm): FieldErrors {
  const errors: FieldErrors = {}
  if (!/[a-z0-9]/i.test(form.name)) errors.name = 'Give your recipe a name.'
  if (form.serves < 1) errors.serves = 'Serves must be at least 1.'
  if (form.mealTypes.length === 0) errors.mealTypes = 'Pick at least one meal type.'
  if (!form.ingredients.some((row) => filled(row.item))) errors.ingredients = 'Add at least one ingredient.'
  form.ingredients.forEach((row, i) => {
    if (!filled(row.quantity)) return
    const value = Number(row.quantity)
    if (!Number.isFinite(value) || value <= 0) errors[`ingredients.${i}.quantity`] = 'Use a number above 0, or leave it blank for "to taste".'
  })
  if (!form.method.some((step) => filled(step.text))) errors.method = 'Add at least one step.'
  return errors
}

export type Submission = {
  payload: RecipeInput
  /** payload index -> form row index, to place server errors next to the right row. */
  ingredientRows: number[]
  stepRows: number[]
}

/** Builds the API payload, dropping blank ingredient rows and steps. */
export function toSubmission(form: RecipeForm): Submission {
  const ingredientRows = form.ingredients.flatMap((row, i) => (filled(row.item) ? [i] : []))
  const stepRows = form.method.flatMap((step, i) => (filled(step.text) ? [i] : []))
  return {
    ingredientRows,
    stepRows,
    payload: {
      name: form.name.trim(),
      serves: form.serves,
      cuisine: form.cuisine,
      mealTypes: form.mealTypes,
      dietary: form.dietary,
      tags: form.tags,
      ingredients: ingredientRows.map((i) => {
        const row = form.ingredients[i]
        return {
          item: row.item.trim(),
          quantity: filled(row.quantity) ? Number(row.quantity) : null,
          unit: row.unit === '' ? null : row.unit,
          prep: filled(row.prep) ? row.prep.trim() : null,
        }
      }),
      method: stepRows.map((i) => form.method[i].text.trim()),
    },
  }
}

/** Maps server field paths (payload indexes, e.g. "ingredients.1.unit") onto form rows. */
export function mapServerFields(fields: FieldErrors, submission: Submission): FieldErrors {
  const mapped: FieldErrors = {}
  for (const [path, message] of Object.entries(fields)) {
    const [field, index, ...rest] = path.split('.')
    const rows = field === 'ingredients' ? submission.ingredientRows : field === 'method' ? submission.stepRows : null
    if (rows && index !== undefined && /^\d+$/.test(index) && rows[Number(index)] !== undefined) {
      mapped[[field, rows[Number(index)], ...rest].join('.')] = message
    } else {
      mapped[path] = message
    }
  }
  return mapped
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Pudding',
}

export const DIETARY_LABELS: Record<DietaryLabel, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
  'dairy-free': 'Dairy-free',
}

export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
