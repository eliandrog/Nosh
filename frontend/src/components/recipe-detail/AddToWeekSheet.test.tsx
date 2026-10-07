import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/endpoints'
import type { RecipeDetail } from '../../api/types'
import { AddToWeekSheet } from './AddToWeekSheet'

vi.mock('../../api/endpoints', () => ({
  api: { getRecipe: vi.fn(), getProfile: vi.fn(), addPlanEntry: vi.fn() },
}))
const mocked = vi.mocked(api)

const SOUP: RecipeDetail = {
  id: 'id-soup',
  slug: 'tomato-soup',
  name: 'Tomato Soup',
  cuisine: 'british',
  serves: 4,
  servings: 4,
  mealTypes: ['lunch'],
  dietary: ['vegan'],
  tags: [],
  isCustom: false,
  imageUrl: null,
  defaultImage: '🥪',
  ingredients: [{ ingredientId: 1, item: 'chopped tomatoes', quantity: 2, unit: 'tin', prep: null }],
  method: ['Simmer.'],
}

function renderSheet() {
  render(
    <MemoryRouter>
      <AddToWeekSheet recipe={SOUP} open onClose={() => undefined} />
    </MemoryRouter>,
  )
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 7, 9, 0)) // Wednesday 7 October 2026
  vi.resetAllMocks()
  mocked.getRecipe.mockResolvedValue(SOUP)
  mocked.getProfile.mockResolvedValue({ name: null, email: null, householdSize: null })
})
afterEach(() => vi.useRealTimers())

describe('AddToWeekSheet weeks', () => {
  it('starts on this week with today selected and does not go back in time', async () => {
    renderSheet()
    expect(screen.getByText('5 – 11 October')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wed 7 Oct' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled()
    expect(await screen.findByRole('button', { name: 'Add to Wed 7 Oct' })).toBeInTheDocument()
  })

  it('adds the meal to a day in a later week', async () => {
    mocked.addPlanEntry.mockResolvedValue({
      id: 1, date: '2026-10-16', position: 0, recipeId: SOUP.id, recipeSlug: SOUP.slug, recipeName: SOUP.name, recipeDeleted: false, servings: 4,
    })
    const user = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getByText('12 – 18 October')).toBeInTheDocument()
    expect(screen.getByText('Next week')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mon 12 Oct' })).toHaveAttribute('aria-pressed', 'true') // first day of that week

    await user.click(screen.getByRole('button', { name: 'Fri 16 Oct' }))
    await user.click(screen.getByRole('button', { name: 'Add to Fri 16 Oct' }))

    expect(mocked.addPlanEntry).toHaveBeenCalledWith({ date: '2026-10-16', recipeId: 'id-soup', servings: 4 })
    expect(await screen.findByRole('link', { name: 'See your week' })).toHaveAttribute('href', '/week?week=2026-10-16')
  })
})
