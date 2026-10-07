import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkError } from '../../api/client'
import { api } from '../../api/endpoints'
import type { DietaryLabel, RecipeFilters, RecipePage, RecipeSummary } from '../../api/types'
import { pageOf } from '../../test/pages'
import { DietaryPreferencesPage } from './DietaryPreferencesPage'

vi.mock('../../api/endpoints', () => ({
  api: { getPreferences: vi.fn(), updatePreferences: vi.fn(), listRecipes: vi.fn() },
}))
const mocked = vi.mocked(api)

const recipe = (slug: string, dietary: DietaryLabel[]): RecipeSummary => ({
  id: slug,
  slug,
  name: slug,
  cuisine: 'british',
  serves: 2,
  mealTypes: ['dinner'],
  dietary,
  tags: [],
  isCustom: false,
  imageUrl: null,
  defaultImage: '🍲',
})
const ALL = [recipe('dahl', ['vegetarian', 'vegan']), recipe('pizza', ['vegetarian']), recipe('bolognese', [])]

/** Stub server: filters and pages like the real API (every selected label must match). */
function listRecipes(f: RecipeFilters = {}): Promise<RecipePage> {
  const dietary = f.all ? [] : (f.dietary ?? [])
  const matching = ALL.filter((r) => dietary.every((d) => r.dietary.includes(d)))
  const pageSize = f.pageSize ?? 20
  return Promise.resolve(pageOf(matching.slice(0, pageSize), { pageSize, total: matching.length }))
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/settings/dietary', element: <DietaryPreferencesPage /> },
      { path: '/settings', element: <h1>Settings page</h1> },
    ],
    { initialEntries: ['/settings/dietary'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('DietaryPreferencesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocked.getPreferences.mockResolvedValue({ dietary: ['vegetarian'] })
    mocked.listRecipes.mockImplementation(listRecipes)
  })

  it('shows saved preferences as switches and how many recipes suit them', async () => {
    renderPage()

    expect(await screen.findByText('2 of 3 recipes suit you')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Vegetarian' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Vegan' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/always check the packet labels/)).toBeInTheDocument()
  })

  it('turning a preference on saves all selected labels and updates the summary', async () => {
    mocked.updatePreferences.mockImplementation(async (p) => ({ dietary: p.dietary ?? [] }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('2 of 3 recipes suit you')

    await user.click(screen.getByRole('switch', { name: 'Vegan' }))

    expect(mocked.updatePreferences).toHaveBeenCalledWith({ dietary: ['vegetarian', 'vegan'] })
    expect(await screen.findByText('1 of 3 recipes suit you')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Vegan' })).toHaveAttribute('aria-checked', 'true')
  })

  it('puts the switch back and explains when saving fails', async () => {
    mocked.updatePreferences.mockRejectedValue(new NetworkError())
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('2 of 3 recipes suit you')

    await user.click(screen.getByRole('switch', { name: 'Vegetarian' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")
    expect(screen.getByRole('switch', { name: 'Vegetarian' })).toHaveAttribute('aria-checked', 'true')
  })

  it('goes back to Settings', async () => {
    const user = userEvent.setup()
    const router = renderPage()

    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(router.state.location.pathname).toBe('/settings')
  })
})
