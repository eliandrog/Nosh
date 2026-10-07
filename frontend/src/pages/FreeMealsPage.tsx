import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ValidationError, errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { Place, PlaceMeal, PlaceMealKind } from '../api/types'
import type { AddState } from '../components/free-meals/PlaceCard'
import { PlaceCard } from '../components/free-meals/PlaceCard'
import { PlacesMap } from '../components/free-meals/PlacesMap'
import { ChevronLeftIcon } from '../components/icons'
import { Button } from '../components/ui'
import { useLocation } from '../hooks/useLocation'
import { today } from '../lib/dates'
import { FALLBACK_LOCATION, nextDateForWeekday, weekdayOf } from '../lib/places'
import '../components/free-meals/FreeMeals.css'

export const SEARCH_RADIUS_KM = 2

type Filters = { openToday: boolean; kind: PlaceMealKind | null }
type Results = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; places: Place[] }

/** Free meals nearby: map plus a list of places sharing meals, nearest first. */
export default function FreeMealsPage() {
  const location = useLocation()
  const [filters, setFilters] = useState<Filters>({ openToday: false, kind: null })
  const [results, setResults] = useState<Results>({ status: 'loading' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [householdSize, setHouseholdSize] = useState<number | null>(null)
  const [addStates, setAddStates] = useState<Record<number, AddState>>({})
  const [attempt, setAttempt] = useState(0)
  const cardRefs = useRef(new Map<number, HTMLElement>())
  const now = today()

  useEffect(() => {
    let cancelled = false
    api
      .getProfile()
      .then((p) => !cancelled && setHouseholdSize(p.householdSize ?? null))
      .catch(() => undefined) // optional: servings then default to what the meal serves
    return () => {
      cancelled = true
    }
  }, [])

  const lat = location.status === 'ready' ? location.lat : null
  const lng = location.status === 'ready' ? location.lng : null
  useEffect(() => {
    if (lat === null || lng === null) return
    let cancelled = false
    api
      .listPlaces({ lat, lng, radiusKm: SEARCH_RADIUS_KM, openToday: filters.openToday || undefined, kind: filters.kind ?? undefined, today: now })
      .then((places) => !cancelled && setResults({ status: 'ready', places }))
      .catch((e) => !cancelled && setResults({ status: 'error', message: errorMessage(e, "Couldn't load places") }))
    return () => {
      cancelled = true
    }
  }, [lat, lng, filters.openToday, filters.kind, now, attempt])

  const places = results.status === 'ready' ? results.places : []
  // The nearest place is selected until the user picks one (or it drops out of the list).
  const selected = places.find((p) => p.id === selectedId) ?? places[0]

  const select = (id: number) => {
    setSelectedId(id)
    cardRefs.current.get(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }

  const setAdd = (mealId: number, state: AddState) => setAddStates((s) => ({ ...s, [mealId]: state }))
  const add = async (meal: PlaceMeal) => {
    const date = nextDateForWeekday(now, meal.weekday) // today when it's served today
    setAdd(meal.id, { status: 'saving' })
    try {
      await api.addPlanEntry({ date, placeMealId: meal.id, servings: householdSize ?? meal.serves })
      setAdd(meal.id, { status: 'added', date })
    } catch (e) {
      const message = e instanceof ValidationError ? (e.fields.date ?? e.message) : errorMessage(e)
      setAdd(meal.id, { status: 'error', message })
    }
  }

  const toggleKind = (kind: PlaceMealKind) => setFilters((f) => ({ ...f, kind: f.kind === kind ? null : kind }))
  const filterButtons: { label: string; pressed: boolean; onClick: () => void }[] = [
    { label: 'Open today', pressed: filters.openToday, onClick: () => setFilters((f) => ({ ...f, openToday: !f.openToday })) },
    { label: 'Hot meals', pressed: filters.kind === 'hot', onClick: () => toggleKind('hot') },
    { label: 'Food parcels', pressed: filters.kind === 'parcel', onClick: () => toggleKind('parcel') },
  ]

  return (
    <div className="free-meals">
      <div className="free-meals__map-area">
        {location.status === 'ready' ? (
          <PlacesMap
            center={{ lat: location.lat, lng: location.lng }}
            you={location.source === 'device' ? { lat: location.lat, lng: location.lng } : null}
            places={places}
            selectedId={selected?.id ?? null}
            onSelect={select}
          />
        ) : (
          <div className="places-map places-map--placeholder">Finding your location…</div>
        )}
        <div className="free-meals__overlay">
          <Link to="/week" className="icon-btn icon-btn--white" aria-label="Back to your week">
            <ChevronLeftIcon size={22} />
          </Link>
          <div className="free-meals__filters" role="group" aria-label="Filter places">
            {filterButtons.map((b) => (
              <button
                key={b.label}
                type="button"
                className={`free-meals__filter${b.pressed ? ' free-meals__filter--on' : ''}`}
                aria-pressed={b.pressed}
                onClick={b.onClick}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="free-meals__panel" aria-labelledby="free-meals-title">
        <h1 id="free-meals-title" className="free-meals__title">
          Free meals near you
        </h1>
        {location.status === 'ready' && location.source === 'fallback' && (
          <p className="free-meals__note" role="status">
            Showing {FALLBACK_LOCATION.label}. Allow location to see places near you.
          </p>
        )}
        {results.status === 'ready' && (
          <p className="free-meals__count" aria-live="polite">
            {places.length} {places.length === 1 ? 'place' : 'places'} within {SEARCH_RADIUS_KM} km · run by local charities
          </p>
        )}
        {results.status === 'loading' && <p className="free-meals__note">Finding free meals…</p>}
        {results.status === 'error' && (
          <div className="free-meals__note" role="alert">
            <p>{results.message}</p>
            <Button variant="outline" onClick={() => { setResults({ status: 'loading' }); setAttempt((n) => n + 1) }}>
              Try again
            </Button>
          </div>
        )}
        {results.status === 'ready' && places.length === 0 && (
          <p className="free-meals__note">No free meals match nearby. Try removing a filter.</p>
        )}

        <ul className="free-meals__list">
          {places.map((p) => (
            <li key={p.id}>
              <PlaceCard
                ref={(el) => {
                  if (el) cardRefs.current.set(p.id, el)
                  else cardRefs.current.delete(p.id)
                }}
                place={p}
                selected={p.id === selected?.id}
                todayWeekday={weekdayOf(now)}
                addStates={addStates}
                onSelect={() => select(p.id)}
                onAdd={add}
              />
            </li>
          ))}
        </ul>
        <p className="free-meals__credit">Demo places with fictional names. Map © OpenStreetMap contributors © CARTO</p>
      </section>
    </div>
  )
}
