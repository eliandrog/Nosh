import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeDetail, Unit } from '../api/types'
import { AddRecipePage } from './AddRecipePage'

vi.mock('../api/endpoints', () => ({
  api: {
    getOptions: vi.fn(),
    getUnits: vi.fn(),
    listTags: vi.fn(),
    searchIngredients: vi.fn(),
    createRecipe: vi.fn(),
  },
}))
const mocked = vi.mocked(api)

const UNITS: Unit[] = [
  { key: 'g', label: 'g', group: 'weight' },
  { key: 'ml', label: 'ml', group: 'volume' },
  { key: null, label: 'item', group: 'count' },
  { key: 'tin', label: 'tin', group: 'pack' },
]

function RecipesLocation() {
  const { search } = useLocation()
  return <p>Recipes list {search}</p>
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/recipes/new', element: <AddRecipePage /> },
      { path: '/recipes', element: <RecipesLocation /> },
    ],
    { initialEntries: ['/recipes/new'] },
  )
  render(<RouterProvider router={router} />)
  return userEvent.setup()
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.getOptions.mockResolvedValue({
    mealTypes: ['breakfast', 'lunch', 'dinner', 'dessert'],
    dietaryLabels: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
    cuisines: ['british', 'indian', 'other'],
  })
  mocked.getUnits.mockResolvedValue(UNITS)
  mocked.listTags.mockResolvedValue([{ key: 'quick', name: 'Quick', isBuiltin: true }])
  mocked.searchIngredients.mockResolvedValue([])
})

const save = () => screen.getByRole('button', { name: 'Save recipe' })

async function fillMinimum(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Recipe name'), "Nan's Veggie Stew")
  await user.click(screen.getByRole('button', { name: 'Dinner' }))
  await user.type(screen.getByLabelText('Ingredient 1'), 'carrots')
  await user.type(screen.getByLabelText('Step 1'), 'Fry the carrots.')
}

describe('AddRecipePage', () => {
  it('blocks saving until required fields are filled, and says what is missing', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Save recipe' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Nearly there. 4 things to add before saving.')
    expect(screen.getByText('Give your recipe a name.')).toBeInTheDocument()
    expect(screen.getByText('Pick at least one meal type.')).toBeInTheDocument()
    expect(mocked.createRecipe).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Recipe name'), 'Stew') // errors update as they're fixed
    expect(screen.getByRole('alert')).toHaveTextContent('3 things')
  })

  it('saves the recipe with a clean payload and opens it in the recipe list', async () => {
    mocked.createRecipe.mockResolvedValue({ name: "Nan's Veggie Stew" } as RecipeDetail)
    const user = renderPage()
    await fillMinimum(user)

    await user.type(screen.getByLabelText('Quantity for ingredient 1'), '400')
    await user.type(screen.getByLabelText('Preparation for ingredient 1 (optional)'), 'sliced')
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }))
    await user.type(screen.getByLabelText('Ingredient 2'), 'stock cube')
    await user.selectOptions(screen.getByLabelText('Unit for ingredient 2'), 'item')
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }))
    await user.type(screen.getByLabelText('Ingredient 3'), 'mistake')
    await user.click(screen.getByRole('button', { name: 'Remove ingredient 3' }))
    await user.click(screen.getByRole('button', { name: 'Vegan' }))
    await user.click(screen.getByRole('button', { name: 'New tag' }))
    await user.type(screen.getByLabelText('New tag name'), 'Low cost{Enter}')
    await user.click(save())

    expect(mocked.createRecipe).toHaveBeenCalledWith({
      name: "Nan's Veggie Stew",
      serves: 2,
      cuisine: 'british',
      mealTypes: ['dinner'],
      dietary: ['vegan'],
      tags: ['Low cost'],
      ingredients: [
        { item: 'carrots', quantity: 400, unit: 'g', prep: 'sliced' },
        { item: 'stock cube', quantity: null, unit: null, prep: null },
      ],
      method: ['Fry the carrots.'],
    })
    expect(await screen.findByText(`Recipes list ?q=${encodeURIComponent("Nan's Veggie Stew")}`)).toBeInTheDocument()
  })

  it('shows server errors next to the right field', async () => {
    mocked.createRecipe.mockRejectedValue(
      new ApiError(409, {
        code: 'recipe_name_taken',
        message: "There's already a recipe called Lentil Dahl.",
        details: { fields: { name: "There's already a recipe called Lentil Dahl." } },
        requestId: 'abc',
      }),
    )
    const user = renderPage()
    await fillMinimum(user)
    await user.click(save())

    const name = screen.getByLabelText('Recipe name')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription("There's already a recipe called Lentil Dahl.")
    expect(within(screen.getByRole('alert')).getByText(/1 thing to add/)).toBeInTheDocument()
    expect(save()).toBeEnabled() // can fix and try again
  })
})
