import { describe, expect, it } from 'vitest'
import { emptyForm, mapServerFields, toSubmission, validate } from './recipeForm'
import type { IngredientRow, RecipeForm } from './recipeForm'

const row = (patch: Partial<IngredientRow>): IngredientRow => ({
  id: 'x',
  quantity: '',
  unit: 'g',
  ingredientId: null,
  item: '',
  prep: '',
  ...patch,
})

function filledForm(patch: Partial<RecipeForm> = {}): RecipeForm {
  return {
    ...emptyForm(),
    name: "  Nan's Veggie Stew ",
    mealTypes: ['dinner'],
    ingredients: [
      row({ id: 'a', item: '' }), // blank row, dropped
      row({ id: 'b', quantity: '400', unit: 'g', item: ' carrots ', prep: ' sliced ' }),
      row({ id: 'c', quantity: '', unit: '', item: 'salt' }), // "to taste", counted unit
    ],
    method: [
      { id: 's1', text: '  ' },
      { id: 's2', text: ' Fry the carrots. ' },
    ],
    ...patch,
  }
}

describe('validate', () => {
  it('reports every missing required field at once', () => {
    expect(validate(emptyForm())).toEqual({
      name: 'Give your recipe a name.',
      mealTypes: 'Pick at least one meal type.',
      ingredients: 'Add at least one ingredient.',
      method: 'Add at least one step.',
    })
  })

  it('accepts a complete form and checks quantities are positive numbers', () => {
    expect(validate(filledForm())).toEqual({})
    const form = filledForm({ ingredients: [row({ item: 'milk', quantity: '0' }), row({ item: 'eggs', quantity: 'two' })] })
    expect(Object.keys(validate(form))).toEqual(['ingredients.0.quantity', 'ingredients.1.quantity'])
  })
})

describe('toSubmission', () => {
  it('builds a clean payload: trims text, drops blank rows, maps "item" unit and "to taste"', () => {
    const { payload, ingredientRows, stepRows } = toSubmission(filledForm({ tags: ['Low cost'] }))
    expect(payload).toEqual({
      name: "Nan's Veggie Stew",
      serves: 2,
      cuisine: 'british',
      mealTypes: ['dinner'],
      dietary: [],
      tags: ['Low cost'],
      ingredients: [
        { item: 'carrots', quantity: 400, unit: 'g', prep: 'sliced' },
        { item: 'salt', quantity: null, unit: null, prep: null },
      ],
      method: ['Fry the carrots.'],
    })
    expect(ingredientRows).toEqual([1, 2])
    expect(stepRows).toEqual([1])
  })

  it('sends picked ingredients by id and typed-only ones by name', () => {
    const form = filledForm({
      ingredients: [row({ ingredientId: 2, item: 'onion', quantity: '1', unit: '' }), row({ item: ' pak choi ' })],
    })
    expect(toSubmission(form).payload.ingredients).toEqual([
      { ingredientId: 2, quantity: 1, unit: null, prep: null },
      { item: 'pak choi', quantity: null, unit: 'g', prep: null },
    ])
  })
})

describe('mapServerFields', () => {
  it('moves server errors from payload positions to the matching rows on screen', () => {
    const submission = toSubmission(filledForm())
    const mapped = mapServerFields(
      { name: 'Taken', 'ingredients.0.unit': 'Pick a unit', 'method.0': 'Too long', ingredients: 'Add one' },
      submission,
    )
    expect(mapped).toEqual({ name: 'Taken', 'ingredients.1.unit': 'Pick a unit', 'method.1': 'Too long', ingredients: 'Add one' })
  })
})
