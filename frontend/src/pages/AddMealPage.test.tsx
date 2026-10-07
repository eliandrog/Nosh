import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/endpoints'
import type { PlanEntry, Profile, RecipeSummary } from '../api/types'
import { pageOf } from '../test/pages'
import { AddMealPage } from './AddMealPage'

vi.mock('../api/endpoints', () => ({
  api: { listRecipes: vi.fn(), getProfile: vi.fn(), addPlanEntry: vi.fn() },
}))
const mocked = vi.mocked(api)

const DAHL: RecipeSummary = {
  id: 'uuid-dahl',
  slug: 'lentil-dahl',
  name: 'Lentil Dahl',
  cuisine: 'indian',
  serves: 4,
  mealTypes: ['dinner'],
  dietary: ['vegan'],
  tags: [],
  isCustom: false,
  imageUrl: null,
  defaultImage: '🍲',
}

function WeekLocation() {
  return <p>Week {useLocation().search}</p>
}

function renderAddMeal(profile: Profile) {
  mocked.getProfile.mockResolvedValue(profile)
  const router = createMemoryRouter(
    [
      { path: '/week/add', element: <AddMealPage /> },
      { path: '/week', element: <WeekLocation /> },
    ],
    { initialEntries: ['/week/add?date=2026-10-07'] },
  )
  render(<RouterProvider router={router} />)
  return userEvent.setup()
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.listRecipes.mockResolvedValue(pageOf([DAHL]))
  mocked.addPlanEntry.mockResolvedValue({ id: 1 } as PlanEntry)
})

describe('AddMealPage', () => {
  it('adds the picked recipe for the household size and goes back to that week', async () => {
    const user = renderAddMeal({ name: null, email: null, householdSize: 3 })
    expect(screen.getByRole('heading', { name: 'Add a meal' })).toBeInTheDocument()
    expect(screen.getByText('Wednesday 7 October')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Add Lentil Dahl' }))
    const sheet = screen.getByRole('dialog', { name: 'Add Lentil Dahl' })
    expect(within(sheet).getByText('3')).toBeInTheDocument() // household size, not the recipe's 4
    await user.click(within(sheet).getByRole('button', { name: 'More servings' }))
    await user.click(within(sheet).getByRole('button', { name: 'Add to Wed 7 Oct' }))

    expect(mocked.addPlanEntry).toHaveBeenCalledWith({ date: '2026-10-07', recipeId: 'uuid-dahl', servings: 4 })
    expect(await screen.findByText('Week ?week=2026-10-07')).toBeInTheDocument()
  })

  it("defaults to the recipe's own servings when no household size is set", async () => {
    const user = renderAddMeal({ name: null, email: null, householdSize: null })
    await user.click(await screen.findByRole('button', { name: 'Add Lentil Dahl' }))
    expect(within(screen.getByRole('dialog')).getByText('4')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create a new recipe/ })).toHaveAttribute('href', '/recipes/new')
  })
})
