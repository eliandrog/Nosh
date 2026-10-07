import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkError } from '../api/client'
import { api } from '../api/endpoints'
import type { RecipeSummary } from '../api/types'
import { RecipesPage, SEARCH_DELAY_MS } from './RecipesPage'

vi.mock('../api/endpoints', () => ({ api: { listRecipes: vi.fn() } }))
const listRecipes = vi.mocked(api.listRecipes)

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

describe('RecipesPage search', () => {
  beforeEach(() => {
    // shouldAdvanceTime keeps Testing Library's findBy/waitFor working while we control the debounce clock.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    listRecipes.mockReset()
    listRecipes.mockResolvedValue([]) // safe default: an unexpected call fails an assertion instead of hanging
  })
  afterEach(() => vi.useRealTimers())

  it('waits for a pause in typing, then makes one API call with the search', async () => {
    listRecipes.mockResolvedValue([DAHL, SOUP])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage()
    expect(await screen.findByText('Tomato Soup')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenLastCalledWith({ q: undefined })

    listRecipes.mockResolvedValue([DAHL])
    await user.type(searchBox(), 'dahl')
    expect(listRecipes).toHaveBeenCalledTimes(1) // no call per key press

    await waitForSearch()
    expect(listRecipes).toHaveBeenCalledTimes(2)
    expect(listRecipes).toHaveBeenLastCalledWith({ q: 'dahl' })
    expect(await screen.findByText('1 recipe for “dahl”')).toBeInTheDocument()
    expect(screen.queryByText('Tomato Soup')).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=dahl') // kept in the URL
  })

  it('starts from the search in the URL', async () => {
    listRecipes.mockResolvedValue([DAHL])
    renderPage('/recipes?q=lentil')

    expect(searchBox()).toHaveValue('lentil')
    expect(await screen.findByText('Lentil Dahl')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenCalledWith({ q: 'lentil' })
  })

  it('ignores a slow reply to an older search', async () => {
    const first = deferred<RecipeSummary[]>()
    const second = deferred<RecipeSummary[]>()
    listRecipes.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage() // first request (all recipes) is still pending...

    await user.type(searchBox(), 'dahl') // ...when the user searches
    await waitForSearch()
    expect(listRecipes).toHaveBeenLastCalledWith({ q: 'dahl' })

    await act(async () => second.resolve([DAHL])) // newer reply arrives first
    await act(async () => first.resolve([SOUP])) // older reply arrives late
    expect(screen.getByText('Lentil Dahl')).toBeInTheDocument()
    expect(screen.queryByText('Tomato Soup')).not.toBeInTheDocument()
  })

  it('explains when nothing matches and clears the search in one tap', async () => {
    listRecipes.mockResolvedValueOnce([]).mockResolvedValueOnce([DAHL, SOUP])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const router = renderPage('/recipes?q=xyz')

    expect(await screen.findByText(/No recipes match “xyz”/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all recipes' }))

    expect(searchBox()).toHaveValue('')
    expect(await screen.findByText('Tomato Soup')).toBeInTheDocument() // clearing doesn't wait for the delay
    expect(listRecipes).toHaveBeenLastCalledWith({ q: undefined })
    expect(router.state.location.search).toBe('')
  })

  it('shows a friendly error with a retry that searches again', async () => {
    listRecipes.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce([DAHL])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage('/recipes?q=dahl')

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Lentil Dahl')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenLastCalledWith({ q: 'dahl' })
  })
})
