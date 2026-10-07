import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/endpoints'
import type { PlanEntry, RecipeSummary, WeekPlan } from '../api/types'
import { addDays } from '../lib/dates'
import { WeekPage } from './WeekPage'

vi.mock('../api/endpoints', () => ({
  api: { getWeekPlan: vi.fn(), updatePlanEntry: vi.fn(), deletePlanEntry: vi.fn(), getPlannedDays: vi.fn(), listRecipes: vi.fn() },
}))
const mocked = vi.mocked(api)

const MON = '2026-10-05'
const WED = '2026-10-07' // "today" in these tests

function entry(id: number, date: string, position: number, name: string, servings = 2): PlanEntry {
  const slug = name.toLowerCase().replace(/ /g, '-')
  return { id, date, position, recipeId: `id-${slug}`, recipeSlug: slug, recipeName: name, recipeDeleted: false, servings }
}

function summary(id: string, name: string): RecipeSummary {
  const slug = id.replace(/^id-/, '')
  return { id, slug, name, cuisine: 'british', serves: 4, mealTypes: ['dinner'], dietary: [], tags: [], isCustom: false, imageUrl: null, defaultImage: '🍲' }
}

function week(monday: string, entries: PlanEntry[]): WeekPlan {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  return { weekStart: monday, days: dates.map((date) => ({ date, entries: entries.filter((e) => e.date === date) })) }
}

function renderWeek(url = '/week') {
  const router = createMemoryRouter([{ path: '/week', element: <WeekPage /> }], { initialEntries: [url] })
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 7, 9, 0)) // Wednesday 7 October 2026, local time
  vi.resetAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('WeekPage', () => {
  it('shows this week Monday to Sunday with meals in order and today highlighted', async () => {
    mocked.getWeekPlan.mockResolvedValue(
      week(MON, [entry(1, WED, 0, 'Scrambled Eggs on Toast'), entry(2, WED, 1, 'Jacket Potato', 4), entry(3, MON, 0, 'Lentil Dahl')]),
    )
    renderWeek()

    const today = await screen.findByRole('region', { name: 'Wed 7 Oct, today' })
    expect(within(today).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Scrambled Eggs on Toastfor 2',
      'Jacket Potatofor 4',
    ])
    expect(screen.getByRole('heading', { level: 1, name: 'This week' })).toBeInTheDocument()
    expect(screen.getByText('3 meals planned. Tap a meal to change it.')).toBeInTheDocument()
    expect(screen.getAllByRole('region')).toHaveLength(7)
    expect(mocked.getWeekPlan).toHaveBeenCalledWith(MON)
    expect(within(today).getByRole('link', { name: 'Add a meal on Wed 7 Oct' })).toHaveAttribute('href', `/week/add?date=${WED}`)
  })

  it('moves between weeks with the arrows and keeps the week in the URL', async () => {
    mocked.getWeekPlan.mockImplementation(async (monday) => week(monday ?? MON, []))
    const { router, user } = renderWeek()
    await screen.findByText('5 – 11 October')

    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await screen.findByText('12 – 18 October')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Next week' })).toBeInTheDocument()
    expect(mocked.getWeekPlan).toHaveBeenLastCalledWith('2026-10-12')
    expect(router.state.location.search).toBe('?week=2026-10-12')

    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(await screen.findByText('28 September – 4 October')).toBeInTheDocument()
  })

  it('changes servings and removes a meal from the meal sheet, then reloads the week', async () => {
    const soup = entry(5, WED, 0, 'Tomato Soup', 2)
    mocked.getWeekPlan.mockResolvedValueOnce(week(MON, [soup])).mockResolvedValueOnce(week(MON, [{ ...soup, servings: 3 }])).mockResolvedValue(week(MON, []))
    mocked.updatePlanEntry.mockResolvedValue({ ...soup, servings: 3 })
    mocked.deletePlanEntry.mockResolvedValue(undefined)
    const { user } = renderWeek()

    await user.click(await screen.findByRole('button', { name: /Tomato Soup/ }))
    const sheet = screen.getByRole('dialog', { name: 'Tomato Soup' })
    await user.click(within(sheet).getByRole('button', { name: 'More servings' }))
    expect(mocked.updatePlanEntry).toHaveBeenCalledWith(5, { servings: 3 })
    expect(await within(sheet).findByText('3')).toBeInTheDocument() // reloaded value

    await user.click(within(sheet).getByRole('button', { name: 'Remove from plan' }))
    expect(mocked.deletePlanEntry).toHaveBeenCalledWith(5)
    expect(await screen.findByText('Add as many meals a day as suits you.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('swaps a meal for another recipe, keeping its day and servings', async () => {
    const soup = entry(5, WED, 0, 'Tomato Soup', 3)
    const dahl = { ...soup, recipeId: 'id-lentil-dahl', recipeSlug: 'lentil-dahl', recipeName: 'Lentil Dahl' }
    mocked.getWeekPlan.mockResolvedValueOnce(week(MON, [soup])).mockResolvedValue(week(MON, [dahl]))
    const items = [summary('id-tomato-soup', 'Tomato Soup'), summary('id-lentil-dahl', 'Lentil Dahl')]
    mocked.listRecipes.mockResolvedValue({ items, total: 2, page: 1, pageSize: 20, totalPages: 1 })
    mocked.updatePlanEntry.mockResolvedValue(dahl)
    const { user } = renderWeek()

    await user.click(await screen.findByRole('button', { name: /Tomato Soup/ }))
    await user.click(screen.getByRole('button', { name: 'Swap for another recipe' }))
    const picker = screen.getByRole('dialog', { name: 'Swap Tomato Soup' })
    expect(within(picker).queryByRole('button', { name: /Tomato Soup/ })).not.toBeInTheDocument() // can't swap for itself

    expect(mocked.listRecipes).toHaveBeenCalledWith({ q: undefined, pageSize: 20 })
    await user.click(await within(picker).findByRole('button', { name: /Lentil Dahl/ }))
    expect(mocked.updatePlanEntry).toHaveBeenCalledWith(5, { recipeId: 'id-lentil-dahl' }) // date/position/servings untouched
    expect(await screen.findByRole('button', { name: /Lentil Dahl/ })).toBeInTheDocument() // week reloaded
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Calendar picker', () => {
  const openCalendar = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Choose a week, 5 – 11 October' }))
    return screen.getByRole('dialog', { name: 'Jump to a date' })
  }

  beforeEach(() => {
    mocked.getWeekPlan.mockImplementation(async (monday) => week(monday ?? MON, []))
    mocked.getPlannedDays.mockImplementation(async (month) => ({
      month,
      dates: month === '2026-10' ? ['2026-10-05', '2026-10-07'] : ['2026-09-25'],
    }))
  })

  it('shows dots on days with meals and loads them for each month', async () => {
    const { user } = renderWeek()
    const calendar = await openCalendar(user)

    expect(mocked.getPlannedDays).toHaveBeenLastCalledWith('2026-10')
    expect(await within(calendar).findByRole('gridcell', { name: 'Wed 7 Oct, today, meals planned' })).toBeInTheDocument()
    expect(within(calendar).getByRole('gridcell', { name: 'Tue 6 Oct' })).toBeInTheDocument()

    await user.click(within(calendar).getByRole('button', { name: 'Next month' }))
    expect(within(calendar).getByText('November 2026')).toBeInTheDocument()
    expect(mocked.getPlannedDays).toHaveBeenLastCalledWith('2026-11')
  })

  it('jumps to the week of the chosen day and keeps it in the URL', async () => {
    const { user, router } = renderWeek()
    const calendar = await openCalendar(user)

    await user.click(within(calendar).getByRole('button', { name: 'Previous month' }))
    await user.click(await within(calendar).findByRole('gridcell', { name: 'Fri 25 Sept, meals planned' }))
    await user.click(within(calendar).getByRole('button', { name: 'Show week of 21 – 27 Sept' }))

    expect(await screen.findByText('21 – 27 September')).toBeInTheDocument()
    expect(mocked.getWeekPlan).toHaveBeenLastCalledWith('2026-09-21')
    expect(router.state.location.search).toBe('?week=2026-09-21')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Today goes straight back to the current week', async () => {
    const { user, router } = renderWeek('/week?week=2026-11-16')
    await user.click(await screen.findByRole('button', { name: 'Choose a week, 16 – 22 November' }))

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(await screen.findByText('5 – 11 October')).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('moves the selection with arrow keys', async () => {
    const { user } = renderWeek()
    const calendar = await openCalendar(user)
    within(calendar).getByRole('gridcell', { name: /Wed 7 Oct/ }).focus()

    await user.keyboard('{ArrowDown}') // one week later
    expect(within(calendar).getByRole('gridcell', { name: 'Wed 14 Oct' })).toHaveFocus()
    expect(within(calendar).getByRole('button', { name: 'Show week of 12 – 18 Oct' })).toBeInTheDocument()
  })
})
