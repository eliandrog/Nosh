import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeDetail } from '../api/types'
import { addDays, dayLabel, mondayOf, today } from '../lib/dates'
import { RecipeDetailPage } from './RecipeDetailPage'

vi.mock('../api/endpoints', () => ({
  api: {
    getRecipe: vi.fn(),
    getProfile: vi.fn(),
    addPlanEntry: vi.fn(),
    getRecipeUsage: vi.fn(),
    deleteRecipe: vi.fn(),
  },
}))
const mocked = vi.mocked(api)

const DAHL: RecipeDetail = {
  id: 'id-dahl',
  slug: 'lentil-dahl',
  name: 'Lentil Dahl',
  cuisine: 'indian',
  serves: 4,
  servings: 4,
  mealTypes: ['dinner', 'dessert'],
  dietary: ['vegan'],
  tags: [{ key: 'batch-cook', name: 'Batch-cook', isBuiltin: true }],
  isCustom: false,
  imageUrl: null,
  defaultImage: '🍲',
  ingredients: [
    { ingredientId: 1, item: 'red lentils', quantity: 250, unit: 'g', prep: null },
    { ingredientId: 2, item: 'onion', quantity: 1, unit: null, prep: 'chopped' },
    { ingredientId: 3, item: 'chopped tomatoes', quantity: 1, unit: 'tin', prep: null },
    { ingredientId: 4, item: 'garlic', quantity: 2, unit: 'clove', prep: null },
    { ingredientId: 5, item: 'salt', quantity: null, unit: null, prep: null },
  ],
  method: ['Soften the onion.', 'Simmer for 20 minutes.'],
}

const scaled = (servings: number): RecipeDetail => ({
  ...DAHL,
  servings,
  ingredients: DAHL.ingredients.map((i) => ({ ...i, quantity: i.quantity && (i.quantity * servings) / 4 })),
})

function Where() {
  return <p>at {useLocation().pathname}</p>
}

function renderPage(slug = 'lentil-dahl') {
  const router = createMemoryRouter(
    [
      { path: '/recipes/:slug', element: <RecipeDetailPage /> },
      { path: '/recipes', element: <Where /> },
    ],
    { initialEntries: [`/recipes/${slug}`] },
  )
  render(<RouterProvider router={router} />)
  return userEvent.setup()
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.getRecipe.mockImplementation(async (_slug, servings) => (servings ? scaled(servings) : DAHL))
  mocked.getProfile.mockResolvedValue({ name: null, email: null, householdSize: 2 })
})

describe('RecipeDetailPage', () => {
  it('shows facts, labels, readable amounts and the method', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Lentil Dahl' })).toBeInTheDocument()
    const facts = screen.getByRole('list', { name: 'Recipe facts' })
    expect(facts).toHaveTextContent('Indian')
    expect(facts).toHaveTextContent('Serves 4')
    expect(facts).toHaveTextContent('Dinner · Pudding') // dessert reads as Pudding
    expect(screen.getByRole('list', { name: 'Labels' })).toHaveTextContent('VeganBatch-cook')

    const ingredients = within(screen.getByRole('region', { name: 'Ingredients' }))
    expect(ingredients.getByText('onion, chopped')).toBeInTheDocument()
    for (const amount of ['250 g', '1 tin', '2 cloves', 'to taste']) expect(ingredients.getByText(amount)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Method' })).toHaveTextContent('Simmer for 20 minutes.')
  })

  it('hides edit and delete for built-in recipes', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Lentil Dahl' })
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByText('Built-in Nosh recipes can’t be edited or deleted.')).toBeInTheDocument()
  })

  it('adds to the week with household-size servings and a scaled preview', async () => {
    mocked.addPlanEntry.mockResolvedValue({
      id: 1, date: today(), position: 0, recipeId: DAHL.id, recipeSlug: DAHL.slug, recipeName: DAHL.name, recipeDeleted: false, servings: 3,
    })
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Add to my week' }))
    const sheet = within(screen.getByRole('dialog'))

    // Defaults to the household size (2) and previews amounts for it.
    expect(await sheet.findByText('125 g')).toBeInTheDocument()
    expect(mocked.getRecipe).toHaveBeenLastCalledWith('lentil-dahl', 2)
    expect(sheet.getByText('+ 1 more ingredient')).toBeInTheDocument()

    await user.click(sheet.getByRole('button', { name: 'More servings' }))
    expect(await sheet.findByText('187½ g')).toBeInTheDocument() // preview refetched for 3
    expect(mocked.getRecipe).toHaveBeenLastCalledWith('lentil-dahl', 3)

    const tomorrow = addDays(today(), 1)
    const day = tomorrow < addDays(mondayOf(today()), 7) ? tomorrow : today() // stay within this week
    await user.click(sheet.getByRole('button', { name: dayLabel(day) }))
    await user.click(sheet.getByRole('button', { name: `Add to ${dayLabel(day)}` }))

    expect(mocked.addPlanEntry).toHaveBeenCalledWith({ date: day, recipeId: 'id-dahl', servings: 3 })
    expect(await sheet.findByRole('link', { name: 'See your week' })).toHaveAttribute('href', `/week?week=${day}`)
  })

  it('deletes your own recipe after showing how many upcoming meals it removes', async () => {
    mocked.getRecipe.mockResolvedValue({ ...DAHL, isCustom: true, slug: 'nans-stew', name: "Nan's Stew" })
    mocked.getRecipeUsage.mockResolvedValue({ upcomingMeals: 2 })
    mocked.deleteRecipe.mockResolvedValue(undefined)
    const user = renderPage('nans-stew')

    expect(await screen.findByText('Your recipe')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const sheet = within(screen.getByRole('dialog'))
    expect(await sheet.findByText(/This removes 2 upcoming meals/)).toBeInTheDocument()
    expect(mocked.getRecipeUsage).toHaveBeenCalledWith('nans-stew', today())

    await user.click(sheet.getByRole('button', { name: 'Delete recipe' }))
    expect(mocked.deleteRecipe).toHaveBeenCalledWith('nans-stew', today())
    expect(await screen.findByText('at /recipes')).toBeInTheDocument()
  })

  it('explains when the recipe no longer exists', async () => {
    mocked.getRecipe.mockRejectedValue(new ApiError(404, { code: 'recipe_not_found', message: 'Not found' }))
    renderPage('gone')
    expect(await screen.findByRole('heading', { name: 'We couldn’t find that recipe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to recipes' })).toHaveAttribute('href', '/recipes')
  })
})
