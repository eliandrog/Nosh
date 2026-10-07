import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { api } from '../api/endpoints'
import type { ShoppingItem, ShoppingList, WeekPlan } from '../api/types'
import { ShoppingPage } from './ShoppingPage'

vi.mock('../api/endpoints', () => ({
  api: {
    getShoppingList: vi.fn(),
    getWeekPlan: vi.fn(),
    setTicked: vi.fn(),
    clearTicked: vi.fn(),
    dismissChanges: vi.fn(),
  },
}))
const mocked = vi.mocked(api)

const WEEK = '2025-01-06' // a fixed past Monday, so tests don't depend on today's date

function item(id: number, name: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return { id, ingredientId: id, name, unit: 'item', quantity: 1, toTaste: false, ticked: false, usedIn: ['Lentil Dahl'], ...overrides }
}

function list(items: ShoppingItem[], changes: ShoppingList['changes'] = null): ShoppingList {
  return { weekStart: WEEK, items, changes }
}

function weekWithMeals(count: number): WeekPlan {
  const entry = { id: 1, date: WEEK, position: 0, recipeId: 'r1', recipeSlug: 'lentil-dahl', recipeName: 'Lentil Dahl', recipeDeleted: false, servings: 2 }
  return { weekStart: WEEK, days: [{ date: WEEK, entries: Array.from({ length: count }, (_, i) => ({ ...entry, id: i + 1 })) }] }
}

function renderPage() {
  const router = createMemoryRouter([{ path: '/shopping', element: <ShoppingPage /> }], { initialEntries: [`/shopping?week=${WEEK}`] })
  render(<RouterProvider router={router} />)
}

const checkbox = (name: RegExp) => screen.getByRole('checkbox', { name })

describe('ShoppingPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocked.getWeekPlan.mockResolvedValue(weekWithMeals(2))
    mocked.setTicked.mockImplementation(async (id, ticked) => ({ ...item(id, 'x'), ticked }))
    mocked.clearTicked.mockResolvedValue(undefined)
    mocked.dismissChanges.mockResolvedValue(undefined)
  })

  it('shows each line with its amount, "used in" and progress', async () => {
    mocked.getShoppingList.mockResolvedValue(
      list([
        item(1, 'milk', { unit: 'ml', quantity: 630, usedIn: ['Porridge', 'Scrambled Eggs'] }),
        item(2, 'salt and pepper', { quantity: null, toTaste: true }),
        item(3, 'chopped tomatoes', { unit: 'tin', quantity: 3, ticked: true }),
      ]),
    )
    renderPage()

    expect(await screen.findByText('Everything for your 2 planned meals, added up.')).toBeInTheDocument()
    expect(checkbox(/milk, 630 ml/)).not.toBeChecked()
    expect(checkbox(/salt and pepper, to taste/)).toBeInTheDocument()
    expect(checkbox(/chopped tomatoes, 3 tins/)).toBeChecked()
    expect(screen.getByText('Porridge, Scrambled Eggs')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 in the basket')).toBeInTheDocument()
  })

  it('ticks straight away and saves it', async () => {
    mocked.getShoppingList.mockResolvedValue(list([item(1, 'onion')]))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('checkbox', { name: /onion/ }))

    expect(checkbox(/onion/)).toBeChecked()
    expect(mocked.setTicked).toHaveBeenCalledWith(1, true)
    expect(screen.getByText('1 of 1 in the basket')).toBeInTheDocument()
  })

  it('puts the tick back and explains when saving fails', async () => {
    mocked.getShoppingList.mockResolvedValue(list([item(1, 'onion')]))
    mocked.setTicked.mockRejectedValue(new ApiError(500, { message: 'Something went wrong on our side. Please try again.', requestId: 'abc123' }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('checkbox', { name: /onion/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('(ref abc123)')
    expect(checkbox(/onion/)).not.toBeChecked()
  })

  it('clears every tick for the week', async () => {
    mocked.getShoppingList.mockResolvedValue(list([item(1, 'onion', { ticked: true }), item(2, 'garlic', { ticked: true })]))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Clear ticked' }))

    expect(mocked.clearTicked).toHaveBeenCalledWith(WEEK)
    expect(screen.getByText('0 of 2 in the basket')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear ticked' })).toBeDisabled()
  })

  it('shows what changed and hides the banner when dismissed', async () => {
    mocked.getShoppingList.mockResolvedValue(list([item(1, 'onion')], { added: 2, removed: 0, changed: 1 }))
    const user = userEvent.setup()
    renderPage()

    const banner = await screen.findByRole('status')
    expect(within(banner).getByText(/2 added and 1 changed\./)).toBeInTheDocument()
    await user.click(within(banner).getByRole('button', { name: 'Dismiss' }))

    expect(mocked.dismissChanges).toHaveBeenCalledWith(WEEK)
    expect(screen.queryByText('List updated for your new plan')).not.toBeInTheDocument()
  })

  it('points to the week plan when nothing is planned', async () => {
    mocked.getShoppingList.mockResolvedValue(list([]))
    mocked.getWeekPlan.mockResolvedValue(weekWithMeals(0))
    renderPage()

    expect(await screen.findByText(/Nothing to buy yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plan meals' })).toHaveAttribute('href', `/week?week=${WEEK}`)
  })
})
