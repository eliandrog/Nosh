import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkError } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeFilters, RecipePage, RecipeSummary } from '../api/types'
import { pageOf } from '../test/pages'
import { COUNT_DELAY_MS } from '../components/recipes/FilterSheet'
import { PAGE_SIZE, RecipesPage, SEARCH_DELAY_MS } from './RecipesPage'

vi.mock('../api/endpoints', () => ({ api: { listRecipes: vi.fn(), getPreferences: vi.fn(), listTags: vi.fn() } }))
const listRecipes = vi.mocked(api.listRecipes)
const getPreferences = vi.mocked(api.getPreferences)
const listTags = vi.mocked(api.listTags)

function recipe(slug: string, name: string): RecipeSummary {
  return {
    id: `id-${slug}`,
    slug,
    name,
    cuisine: 'indian',
    serves: 4,
    mealTypes: ['dinner'],
    dietary: ['vegan'],
    tags: [],
    isCustom: false,
    imageUrl: null,
    defaultImage: '🍲',
  }
}

const DAHL = recipe('lentil-dahl', 'Lentil Dahl')
const SOUP = recipe('tomato-soup', 'Tomato Soup')
const page = (items: RecipeSummary[], options: { page?: number; total?: number } = {}) =>
  pageOf(items, { pageSize: PAGE_SIZE, ...options })

/** Promise we resolve by hand, to control when (and in which order) API replies arrive. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function renderPage(url = '/recipes') {
  const router = createMemoryRouter([{ path: '/recipes', element: <RecipesPage /> }], { initialEntries: [url] })
  render(<RouterProvider router={router} />)
  return router
}

const searchBox = () => screen.getByRole('searchbox', { name: 'Search recipes' })
const waitForSearch = () => act(() => vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS))
const request = (q: string | undefined, n = 1) => ({ q, page: n, pageSize: PAGE_SIZE })

beforeEach(() => {
  // shouldAdvanceTime keeps Testing Library's findBy/waitFor working while we control the debounce clock.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  listRecipes.mockReset()
  listRecipes.mockResolvedValue(page([])) // safe default: an unexpected call fails an assertion instead of hanging
  getPreferences.mockReset()
  getPreferences.mockResolvedValue({ dietary: [] })
  listTags.mockReset()
  listTags.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('RecipesPage search', () => {
  it('waits for a pause in typing, then makes one API call with the search', async () => {
    listRecipes.mockResolvedValue(page([DAHL, SOUP]))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage()
    expect(await screen.findByText('Tomato Soup')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenLastCalledWith(request(undefined))

    listRecipes.mockResolvedValue(page([DAHL]))
    await user.type(searchBox(), 'dahl')
    expect(listRecipes).toHaveBeenCalledTimes(1) // no call per key press

    await waitForSearch()
    expect(listRecipes).toHaveBeenCalledTimes(2)
    expect(listRecipes).toHaveBeenLastCalledWith(request('dahl'))
    expect(await screen.findByText('1 recipe for “dahl”')).toBeInTheDocument()
    expect(screen.queryByText('Tomato Soup')).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=dahl') // kept in the URL
  })

  it('starts from the search in the URL', async () => {
    listRecipes.mockResolvedValue(page([DAHL]))
    renderPage('/recipes?q=lentil')

    expect(searchBox()).toHaveValue('lentil')
    expect(await screen.findByText('Lentil Dahl')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenCalledWith(request('lentil'))
  })

  it('ignores a slow reply to an older search', async () => {
    const first = deferred<RecipePage>()
    const second = deferred<RecipePage>()
    listRecipes.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage() // first request (all recipes) is still pending...

    await user.type(searchBox(), 'dahl') // ...when the user searches
    await waitForSearch()
    expect(listRecipes).toHaveBeenLastCalledWith(request('dahl'))

    await act(async () => second.resolve(page([DAHL]))) // newer reply arrives first
    await act(async () => first.resolve(page([SOUP]))) // older reply arrives late
    expect(screen.getByText('Lentil Dahl')).toBeInTheDocument()
    expect(screen.queryByText('Tomato Soup')).not.toBeInTheDocument()
  })

  it('explains when nothing matches and clears the search in one tap', async () => {
    listRecipes.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([DAHL, SOUP]))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage('/recipes?q=xyz')

    expect(await screen.findByText(/No recipes match “xyz”/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all recipes' }))

    expect(searchBox()).toHaveValue('')
    expect(await screen.findByText('Tomato Soup')).toBeInTheDocument() // clearing doesn't wait for the delay
    expect(listRecipes).toHaveBeenLastCalledWith(request(undefined))
    expect(router.state.location.search).toBe('')
  })

  it('shows a friendly error with a retry that searches again', async () => {
    listRecipes.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(page([DAHL]))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage('/recipes?q=dahl')

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Lentil Dahl')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenLastCalledWith(request('dahl'))
  })
})

describe('RecipesPage pages', () => {
  const previous = () => screen.getByRole('button', { name: 'Previous page' })
  const next = () => screen.getByRole('button', { name: 'Next page' })

  it('moves between pages with Next and Previous, keeping the page in the URL', async () => {
    listRecipes
      .mockResolvedValueOnce(page([DAHL], { page: 1, total: 12 }))
      .mockResolvedValueOnce(page([SOUP], { page: 2, total: 12 }))
      .mockResolvedValueOnce(page([DAHL], { page: 1, total: 12 }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage()

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenLastCalledWith(request(undefined, 1))
    expect(previous()).toBeDisabled()

    await user.click(next())
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('Tomato Soup')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenLastCalledWith(request(undefined, 2))
    expect(router.state.location.search).toBe('?page=2')

    await user.click(previous())
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('disables Next on the last page and opens straight onto the page in the URL', async () => {
    listRecipes.mockResolvedValue(page([SOUP], { page: 3, total: 12 }))
    renderPage('/recipes?page=3')

    expect(await screen.findByText('Page 3 of 3')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenCalledWith(request(undefined, 3))
    expect(next()).toBeDisabled()
    expect(previous()).toBeEnabled()
  })

  it('starts a new search from page 1', async () => {
    listRecipes.mockResolvedValue(page([SOUP], { page: 2, total: 12 }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage('/recipes?page=2')
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()

    listRecipes.mockResolvedValue(page([DAHL], { total: 1 }))
    await user.type(searchBox(), 'dahl')
    await waitForSearch()

    expect(listRecipes).toHaveBeenLastCalledWith(request('dahl', 1))
    expect(router.state.location.search).toBe('?q=dahl')
    expect(await screen.findByText('1 recipe for “dahl”')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Recipe pages' })).not.toBeInTheDocument() // one page: no controls
  })

  it('always shows the Add your own recipe button, even before recipes load', async () => {
    listRecipes.mockReturnValue(deferred<RecipePage>().promise) // never resolves
    renderPage()
    expect(screen.getByRole('link', { name: /Add your own recipe/ })).toHaveAttribute('href', '/recipes/new')
  })
})

describe('RecipesPage header', () => {
  it('shows the Nosh logo mark beside the title without changing the heading', () => {
    const { container } = render(
      <RouterProvider router={createMemoryRouter([{ path: '/recipes', element: <RecipesPage /> }], { initialEntries: ['/recipes'] })} />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Recipes') // logo adds nothing to the name

    const logo = container.querySelector('img.nosh-mark')
    expect(logo).not.toBeNull()
    expect(logo).toHaveAttribute('alt', '') // decorative: the title already says where you are
    expect(logo).toHaveAttribute('width', '36')
    expect(logo).toHaveAttribute('height', '40') // fixed size: no layout shift while it loads
  })
})

describe('RecipesPage filters', () => {
  const LOW_COST = { key: 'low-cost', name: 'Low cost', isBuiltin: false }

  /** Live counts (pageSize 1) report 7 recipes, or 3 once a meal type is chosen; list calls return Dahl. */
  function stubCountsAndList() {
    listRecipes.mockImplementation((f: RecipeFilters = {}) =>
      Promise.resolve(f.pageSize === 1 ? pageOf([], { pageSize: 1, total: f.mealType?.length ? 3 : 7 }) : page([DAHL])),
    )
  }
  const openSheet = async (user: ReturnType<typeof userEvent.setup>, name: RegExp = /^Filters/) => {
    await user.click(await screen.findByRole('button', { name }))
    return screen.getByRole('dialog', { name: 'Filter recipes' })
  }
  const lastListCall = () => listRecipes.mock.calls.filter(([f]) => f?.pageSize === PAGE_SIZE).at(-1)?.[0]

  it('starts from saved dietary preferences and shows a live count as choices change', async () => {
    getPreferences.mockResolvedValue({ dietary: ['vegetarian'] })
    stubCountsAndList()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    const sheet = await openSheet(user, /^Filters, 1 active$/)
    expect(within(sheet).getByRole('button', { name: /Vegetarian/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByText(/from your preferences/)).toBeInTheDocument()
    expect(await within(sheet).findByRole('button', { name: 'Show 7 recipes' })).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Dinner' }))
    await act(() => vi.advanceTimersByTimeAsync(COUNT_DELAY_MS))
    expect(listRecipes).toHaveBeenLastCalledWith({ page: 1, pageSize: 1, mealType: ['dinner'], dietary: ['vegetarian'] })
    expect(await within(sheet).findByRole('button', { name: 'Show 3 recipes' })).toBeInTheDocument()
  })

  it('applies filters from page 1, keeps the search and puts them in the URL', async () => {
    listTags.mockResolvedValue([LOW_COST])
    stubCountsAndList()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage('/recipes?q=dahl&page=2')

    const sheet = await openSheet(user)
    await user.click(within(sheet).getByRole('button', { name: 'Dinner' }))
    await user.click(await within(sheet).findByRole('button', { name: 'Low cost' }))
    await act(() => vi.advanceTimersByTimeAsync(COUNT_DELAY_MS))
    await user.click(await within(sheet).findByRole('button', { name: 'Show 3 recipes' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(new URLSearchParams(router.state.location.search).toString()).toBe('q=dahl&mealType=dinner&tag=low-cost')
    expect(lastListCall()).toEqual({ q: 'dahl', page: 1, pageSize: PAGE_SIZE, mealType: ['dinner'], tag: ['low-cost'] })
    expect(await screen.findByText('1 recipe for “dahl” · 2 filters')).toBeInTheDocument()
  })

  it('restores filters from the URL and removes one with its chip', async () => {
    listTags.mockResolvedValue([LOW_COST])
    stubCountsAndList()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage('/recipes?mealType=dinner&dietary=vegan&tag=low-cost')

    expect(await screen.findByText('Lentil Dahl')).toBeInTheDocument()
    expect(lastListCall()).toEqual({ page: 1, pageSize: PAGE_SIZE, mealType: ['dinner'], dietary: ['vegan'], tag: ['low-cost'] })
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(await within(chips).findByRole('button', { name: 'Remove filter: Low cost' })).toBeInTheDocument()

    await user.click(within(chips).getByRole('button', { name: 'Remove filter: Vegan' }))
    // The only dietary filter was removed: say so explicitly, or saved preferences would come back.
    expect(new URLSearchParams(router.state.location.search).get('all')).toBe('true')
    expect(lastListCall()).toEqual({ page: 1, pageSize: PAGE_SIZE, mealType: ['dinner'], tag: ['low-cost'], all: true })
  })

  it('turning off a saved dietary preference sends all=true', async () => {
    getPreferences.mockResolvedValue({ dietary: ['vegetarian'] })
    stubCountsAndList()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage()

    const sheet = await openSheet(user, /^Filters, 1 active$/)
    await user.click(within(sheet).getByRole('button', { name: /Vegetarian/ }))
    await act(() => vi.advanceTimersByTimeAsync(COUNT_DELAY_MS))
    await user.click(await within(sheet).findByRole('button', { name: 'Show 7 recipes' }))

    expect(router.state.location.search).toBe('?all=true')
    expect(lastListCall()).toEqual({ page: 1, pageSize: PAGE_SIZE, all: true })
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument() // nothing active any more
  })

  it('offers to clear filters when nothing matches', async () => {
    listRecipes.mockResolvedValueOnce(page([], { total: 0 })).mockResolvedValue(page([DAHL, SOUP]))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage('/recipes?mealType=dessert')

    expect(await screen.findByText('No recipes match these filters.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByText('Tomato Soup')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?all=true')
    expect(lastListCall()).toEqual({ page: 1, pageSize: PAGE_SIZE, all: true })
  })
})
