import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../api/client'
import { api } from '../api/endpoints'
import type { Place } from '../api/types'
import FreeMealsPage from './FreeMealsPage'

vi.mock('../api/endpoints', () => ({ api: { listPlaces: vi.fn(), getProfile: vi.fn(), addPlanEntry: vi.fn() } }))
const mocked = vi.mocked(api)

// No real map in jsdom: markers become buttons named after the place, marked when selected.
type MarkerProps = { title?: string; icon?: { options: { className?: string } }; eventHandlers?: { click?: () => void } }
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  useMap: () => ({ setView: vi.fn(), panTo: vi.fn(), getZoom: () => 15 }),
  Marker: ({ title, icon, eventHandlers }: MarkerProps) => (
    <button type="button" aria-label={`Pin: ${title}`} data-selected={icon?.options.className?.includes('selected')} onClick={eventHandlers?.click}>
      pin
    </button>
  ),
}))

const WED = '2026-10-07' // "today" in these tests

const KITCHEN: Place = {
  id: 1, name: 'Demo Community Kitchen', type: 'community_kitchen', postcode: 'SW2 1RW', latitude: 51.460662, longitude: -0.116872, isDemo: true, distanceKm: 0.03,
  meals: [{ id: 11, name: 'Vegetable curry with rice', kind: 'hot', weekday: 2, startTime: '12:00:00', endTime: '14:00:00', serves: 1, servesNote: null, dietary: ['vegan'], openToday: true }],
}
const HUB: Place = {
  id: 3, name: 'Example Food Hub', type: 'food_hub', postcode: 'SW9 8PR', latitude: 51.462606, longitude: -0.111969, isDemo: true, distanceKm: 0.25,
  meals: [{ id: 33, name: 'Food parcel: tins, pasta, fresh veg', kind: 'parcel', weekday: 3, startTime: '10:00:00', endTime: '13:00:00', serves: 4, servesNote: 'feeds 4 for about 3 days', dietary: ['vegetarian'], openToday: false }],
}

function denyLocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError) },
  })
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/free-meals', element: <FreeMealsPage /> },
      { path: '/week', element: <p>Week</p> },
    ],
    { initialEntries: ['/free-meals'] },
  )
  render(<RouterProvider router={router} />)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

const card = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) }).closest('article') as HTMLElement

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 7, 9, 0)) // Wednesday 7 October 2026, local time
  vi.resetAllMocks()
  denyLocation()
  mocked.getProfile.mockResolvedValue({ name: null, email: null, householdSize: 3 })
  mocked.listPlaces.mockResolvedValue([KITCHEN, HUB])
})
afterEach(() => vi.useRealTimers())

describe('FreeMealsPage', () => {
  it('falls back to Brixton when location is denied and lists places nearest first', async () => {
    renderPage()

    expect(await screen.findByText('Showing Brixton. Allow location to see places near you.')).toBeInTheDocument()
    expect(mocked.listPlaces).toHaveBeenCalledWith({ lat: 51.4613, lng: -0.1149, radiusKm: 2, openToday: undefined, kind: undefined, today: WED })
    const names = screen.getAllByRole('article').map((a) => a.querySelector('.place-card__name')?.textContent)
    expect(names).toEqual(['Demo Community Kitchen', 'Example Food Hub'])
    expect(within(card('Demo Community Kitchen')).getByText('Community kitchen · 30 m')).toBeInTheDocument()
    expect(within(card('Example Food Hub')).getByText('Serves 4 · feeds 4 for about 3 days')).toBeInTheDocument()
  })

  it('sends the filters to the API', async () => {
    const user = renderPage()
    await screen.findByText(/2 places within 2 km/)

    await user.click(screen.getByRole('button', { name: 'Open today' }))
    expect(mocked.listPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ openToday: true, kind: undefined }))

    await user.click(screen.getByRole('button', { name: 'Food parcels' }))
    expect(mocked.listPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ openToday: true, kind: 'parcel' }))
    await user.click(screen.getByRole('button', { name: 'Hot meals' })) // only one kind at a time
    expect(screen.getByRole('button', { name: 'Hot meals' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Food parcels' })).toHaveAttribute('aria-pressed', 'false')
    expect(mocked.listPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'hot' }))
  })

  it('keeps the selected pin and card in sync', async () => {
    const user = renderPage()
    await screen.findByText(/2 places within 2 km/)
    expect(card('Demo Community Kitchen')).toHaveAttribute('aria-current', 'true') // nearest selected first

    await user.click(screen.getByRole('button', { name: 'Pin: Example Food Hub' }))
    expect(card('Example Food Hub')).toHaveAttribute('aria-current', 'true')
    expect(card('Demo Community Kitchen')).not.toHaveAttribute('aria-current')

    await user.click(within(card('Demo Community Kitchen')).getByRole('button', { name: /^Demo Community Kitchen/ }))
    expect(screen.getByRole('button', { name: 'Pin: Demo Community Kitchen' })).toHaveAttribute('data-selected', 'true')
    expect(screen.getByRole('button', { name: 'Pin: Example Food Hub' })).toHaveAttribute('data-selected', 'false')
  })

  it("adds today's meal today and a later meal on its next weekday, using the household size", async () => {
    mocked.addPlanEntry.mockResolvedValue({} as never)
    const user = renderPage()
    await screen.findByText(/2 places within 2 km/)

    await user.click(within(card('Demo Community Kitchen')).getByRole('button', { name: "Add to today's meals" }))
    expect(mocked.addPlanEntry).toHaveBeenLastCalledWith({ date: WED, placeMealId: 11, servings: 3 })
    expect(await within(card('Demo Community Kitchen')).findByRole('link', { name: 'See your week' })).toHaveAttribute('href', '/week?week=2026-10-05')

    await user.click(screen.getByRole('button', { name: 'Pin: Example Food Hub' }))
    await user.click(within(card('Example Food Hub')).getByRole('button', { name: 'Add on Thursday' }))
    expect(mocked.addPlanEntry).toHaveBeenLastCalledWith({ date: '2026-10-08', placeMealId: 33, servings: 3 })
  })

  it("shows the server's message when the day is rejected", async () => {
    mocked.addPlanEntry.mockRejectedValue(
      new ValidationError(422, { code: 'validation_error', message: 'Some details need fixing.', details: { fields: { date: 'This meal is only served on Wednesdays.' } } }),
    )
    const user = renderPage()
    await screen.findByText(/2 places within 2 km/)

    await user.click(within(card('Demo Community Kitchen')).getByRole('button', { name: "Add to today's meals" }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This meal is only served on Wednesdays.')
  })
})
