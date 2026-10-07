import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeDetail } from '../api/types'
import { EditRecipePage } from './EditRecipePage'

vi.mock('../api/endpoints', () => ({
  api: {
    getRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    getOptions: vi.fn(),
    getUnits: vi.fn(),
    listTags: vi.fn(),
    searchIngredients: vi.fn(),
  },
}))
const mocked = vi.mocked(api)

const STEW: RecipeDetail = {
  id: 'id-stew',
  slug: 'nans-veggie-stew',
  name: "Nan's Veggie Stew",
  cuisine: 'british',
  serves: 4,
  servings: 4,
  mealTypes: ['dinner'],
  dietary: ['vegan'],
  tags: [{ key: 'low-cost', name: 'Low cost', isBuiltin: false }],
  isCustom: true,
  imageUrl: null,
  defaultImage: '🍲',
  ingredients: [{ ingredientId: 1, item: 'carrot', quantity: 400, unit: 'g', prep: 'sliced' }],
  method: ['Fry the carrots.'],
}

function Where() {
  return <p>at {useLocation().pathname}</p>
}

function renderPage(slug = STEW.slug) {
  const router = createMemoryRouter(
    [
      { path: '/recipes/:slug/edit', element: <EditRecipePage /> },
      { path: '/recipes/:slug', element: <Where /> },
    ],
    { initialEntries: [`/recipes/${slug}/edit`] },
  )
  render(<RouterProvider router={router} />)
  return userEvent.setup()
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.getRecipe.mockResolvedValue(STEW)
  mocked.getOptions.mockResolvedValue({
    mealTypes: ['breakfast', 'lunch', 'dinner', 'dessert'],
    dietaryLabels: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
    cuisines: ['british', 'indian', 'other'],
  })
  mocked.getUnits.mockResolvedValue([
    { key: 'g', label: 'g', group: 'weight' },
    { key: null, label: 'item', group: 'count' },
  ])
  mocked.listTags.mockResolvedValue([{ key: 'low-cost', name: 'Low cost', isBuiltin: false }])
  mocked.searchIngredients.mockResolvedValue([])
})

describe('EditRecipePage', () => {
  it('pre-fills the form and saves a rename, moving to the new address', async () => {
    mocked.updateRecipe.mockResolvedValue({ ...STEW, name: "Nan's Winter Stew", slug: 'nans-winter-stew' })
    const user = renderPage()

    const name = await screen.findByLabelText('Recipe name')
    expect(name).toHaveValue("Nan's Veggie Stew")
    expect(screen.getByLabelText('Ingredient 1')).toHaveValue('carrot')
    expect(screen.getByLabelText('Preparation for ingredient 1 (optional)')).toHaveValue('sliced')

    await user.clear(name)
    await user.type(name, "Nan's Winter Stew")
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(mocked.updateRecipe).toHaveBeenCalledWith('nans-veggie-stew', {
      name: "Nan's Winter Stew",
      serves: 4,
      cuisine: 'british',
      mealTypes: ['dinner'],
      dietary: ['vegan'],
      tags: ['Low cost'],
      ingredients: [{ item: 'carrot', quantity: 400, unit: 'g', prep: 'sliced' }],
      method: ['Fry the carrots.'],
    })
    expect(await screen.findByText('at /recipes/nans-winter-stew')).toBeInTheDocument()
  })

  it('shows a name clash from the server next to the name', async () => {
    mocked.updateRecipe.mockRejectedValue(
      new ApiError(409, {
        code: 'recipe_name_taken',
        message: "There's already a recipe called Lentil Dahl.",
        details: { fields: { name: "There's already a recipe called Lentil Dahl." } },
      }),
    )
    const user = renderPage()
    const name = await screen.findByLabelText('Recipe name')
    await user.clear(name)
    await user.type(name, 'Lentil Dahl')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(name).toHaveAccessibleDescription("There's already a recipe called Lentil Dahl.")
  })

  it('does not offer the form for built-in recipes', async () => {
    mocked.getRecipe.mockResolvedValue({ ...STEW, isCustom: false })
    renderPage()
    expect(await screen.findByText('Built-in Nosh recipes can’t be edited or deleted.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Recipe name')).not.toBeInTheDocument()
  })
})
